import type { ModernizedPostgresProbe } from "../db/modernizedPostgresProbe.js";
import type { RuntimeTarget } from "../config/targets.js";
import type { AppointmentRecord, NewAppointment, PatientContact } from "./legacyWorkflowActions.js";

export class ModernizedWorkflowActions {
  constructor(
    private readonly db: ModernizedPostgresProbe,
    private readonly target: RuntimeTarget
  ) {}

  async getPatientContact(pid: number): Promise<PatientContact | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT legacy_pid AS pid, pubpid, phone_home AS "phoneHome", phone_cell AS "phoneCell", email,
  hipaa_allow_sms AS "hipaaAllowSms", hipaa_allow_email AS "hipaaAllowEmail"
FROM patients
WHERE legacy_pid = ${integer(pid)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      pid: Number(row.pid),
      pubpid: row.pubpid,
      phoneHome: row.phoneHome,
      phoneCell: row.phoneCell,
      email: row.email,
      hipaaAllowSms: row.hipaaAllowSms,
      hipaaAllowEmail: row.hipaaAllowEmail
    };
  }

  async updatePatientContact(contact: PatientContact): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/patients/${encodeURIComponent(contact.pubpid)}/contact`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phoneHome: contact.phoneHome,
        phoneCell: contact.phoneCell,
        email: contact.email,
        hipaaAllowSms: contact.hipaaAllowSms,
        hipaaAllowEmail: contact.hipaaAllowEmail
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient contact update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createAppointment(input: NewAppointment): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/appointments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        providerId: input.providerId,
        title: input.title,
        date: input.eventDate,
        startTime: input.startTime.slice(0, 5),
        durationMinutes: Math.round(input.durationSeconds / 60),
        facilityId: input.facilityId,
        categoryId: 9,
        room: input.room
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized appointment create failed with ${response.status}: ${await response.text()}`);
    }

    const appointment = (await response.json()) as { id: string };
    return appointment.id;
  }

  async getAppointment(id: number | string): Promise<AppointmentRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", provider_id AS "providerId", title,
  appointment_date AS "eventDate", start_time AS "startTime",
  (start_time + make_interval(mins => duration_minutes))::time AS "endTime",
  status, facility_id AS "facilityId", facility_id AS "billingLocationId", COALESCE(room, '') AS room
FROM appointments
WHERE id = ${sqlString(String(id))}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      patientId: Number(row.patientId),
      providerId: Number(row.providerId),
      title: row.title,
      eventDate: row.eventDate,
      startTime: normalizeTime(row.startTime),
      endTime: normalizeTime(row.endTime),
      status: row.status,
      facilityId: Number(row.facilityId),
      billingLocationId: Number(row.billingLocationId),
      room: row.room
    };
  }

  async updateAppointmentStatus(id: number | string, status: string, title: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/appointments/${encodeURIComponent(String(id))}/status`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, title })
    });

    if (!response.ok) {
      throw new Error(`Modernized appointment status update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteAppointment(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/appointments/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Modernized appointment delete failed with ${response.status}: ${await response.text()}`);
    }
  }
}

function integer(value: number) {
  if (!Number.isInteger(value)) {
    throw new Error(`Expected integer SQL value, received ${value}.`);
  }
  return value;
}

function sqlString(value: string) {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
}

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}
