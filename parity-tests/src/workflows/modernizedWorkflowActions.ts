import type { ModernizedPostgresProbe } from "../db/modernizedPostgresProbe.js";
import type { RuntimeTarget } from "../config/targets.js";
import type {
  AppointmentRecord,
  BillingLineRecord,
  ClinicalListRecord,
  EncounterRecord,
  NewBillingLine,
  NewClinicalListEntry,
  NewPatientMessage,
  NewAppointment,
  NewEncounter,
  NewProcedureOrder,
  NewProcedureReport,
  NewProcedureResult,
  NewPrescription,
  NewSoapNote,
  NewVitals,
  PatientContact,
  PatientMessageRecord,
  ProcedureOrderRecord,
  ProcedureReportRecord,
  ProcedureResultRecord,
  PrescriptionRecord,
  SoapNoteRecord,
  VitalsRecord
} from "./legacyWorkflowActions.js";

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

  async createClinicalListEntry(input: NewClinicalListEntry): Promise<string> {
    if (input.type !== "allergy") {
      throw new Error(`Modernized clinical list mutation only supports allergy entries in this slice, received ${input.type}.`);
    }

    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/allergies`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        title: input.title,
        dateTime: input.dateTime,
        comments: input.comments,
        reaction: input.reaction,
        severity: input.severity,
        listOptionId: input.listOptionId
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized clinical allergy create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: string };
    return mutation.id;
  }

  async getClinicalListEntry(id: number | string): Promise<ClinicalListRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", type, title, activity, COALESCE(comments, '') AS comments,
  COALESCE(reaction, '') AS reaction, COALESCE(severity, '') AS severity,
  COALESCE(list_option_id, '') AS "listOptionId"
FROM allergies
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
      type: row.type,
      title: row.title,
      activity: Number(row.activity),
      comments: row.comments,
      reaction: row.reaction,
      severity: row.severity,
      listOptionId: row.listOptionId
    };
  }

  async deactivateClinicalListEntry(id: number | string, comments: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/allergies/${encodeURIComponent(String(id))}/deactivate`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ comments })
    });

    if (!response.ok) {
      throw new Error(`Modernized clinical allergy deactivate failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteClinicalListEntry(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/allergies/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Modernized clinical allergy delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createPatientMessage(input: NewPatientMessage): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        title: input.title,
        body: input.body,
        assignedTo: input.assignedTo
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient message create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: string };
    return mutation.id;
  }

  async getPatientMessage(id: number | string): Promise<PatientMessageRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", COALESCE(title, '') AS title, COALESCE(body, '') AS body,
  COALESCE(status, '') AS status, COALESCE(assigned_to, '') AS "assignedTo",
  deleted
FROM messages
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
      title: row.title,
      body: row.body,
      status: row.status,
      assignedTo: row.assignedTo,
      deleted: Number(row.deleted)
    };
  }

  async updatePatientMessageStatus(id: number | string, status: string, body: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/messages/${encodeURIComponent(String(id))}/status`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, body })
    });

    if (!response.ok) {
      throw new Error(`Modernized patient message update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async softDeletePatientMessage(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/messages/${encodeURIComponent(String(id))}/soft-delete`, {
      method: "PUT"
    });

    if (!response.ok) {
      throw new Error(`Modernized patient message soft delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deletePatientMessage(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/messages/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Modernized patient message delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createPrescription(input: NewPrescription): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/prescriptions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        providerId: input.providerId,
        startDate: input.startDate,
        drug: input.drug,
        rxNormCode: input.rxNormCode,
        dosage: input.dosage,
        quantity: input.quantity,
        route: "oral",
        refills: input.refills,
        note: input.note,
        diagnosis: input.diagnosis
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized prescription create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: string };
    return mutation.id;
  }

  async getPrescription(id: number | string): Promise<PrescriptionRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", provider_id AS "providerId", start_date AS "startDate",
  COALESCE(end_date::text, '') AS "endDate", drug, COALESCE(dosage, '') AS dosage,
  COALESCE(quantity, '') AS quantity, refills, active, COALESCE(note, '') AS note
FROM prescriptions
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
      startDate: row.startDate,
      endDate: row.endDate || null,
      drug: row.drug,
      dosage: row.dosage,
      quantity: row.quantity,
      refills: Number(row.refills),
      active: Number(row.active),
      note: row.note
    };
  }

  async deactivatePrescription(id: number | string, endDate: string, note: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/prescriptions/${encodeURIComponent(String(id))}/deactivate`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endDate, note })
    });

    if (!response.ok) {
      throw new Error(`Modernized prescription deactivate failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deletePrescription(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/clinical-lists/prescriptions/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Modernized prescription delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createBillingLine(input: NewBillingLine): Promise<string> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/billing/lines`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        providerId: input.providerId,
        encounter: input.encounter,
        billingDate: input.dateTime.slice(0, 10),
        codeType: input.codeType,
        code: input.code,
        codeText: input.codeText,
        fee: Number(input.fee),
        units: input.units,
        justify: input.justify
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized billing line create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: string };
    return mutation.id;
  }

  async getBillingLine(id: number | string): Promise<BillingLineRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", encounter, code_type AS "codeType", code, code_text AS "codeText",
  COALESCE(fee::text, '') AS fee, units, activity, billed
FROM billing
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
      encounter: Number(row.encounter),
      codeType: row.codeType,
      code: row.code,
      codeText: row.codeText,
      fee: Number(row.fee).toFixed(2),
      units: Number(row.units),
      activity: Number(row.activity),
      billed: Number(row.billed)
    };
  }

  async updateBillingLineStatus(id: number | string, billed: number, activity: number): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/billing/lines/${encodeURIComponent(String(id))}/status`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ billed, activity })
    });

    if (!response.ok) {
      throw new Error(`Modernized billing line status update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteBillingLine(id: number | string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/billing/lines/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Modernized billing line delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createProcedureOrder(input: NewProcedureOrder): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        providerId: input.providerId,
        encounterId: input.encounterId,
        dateOrdered: input.dateOrdered,
        priority: input.priority,
        status: input.status,
        procedureCode: input.procedureCode,
        procedureName: input.procedureName,
        procedureType: input.procedureType,
        diagnosis: input.diagnosis,
        instructions: input.instructions
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure order create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async getProcedureOrder(id: number): Promise<ProcedureOrderRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", encounter AS "encounterId",
  COALESCE(order_status, '') AS "orderStatus", COALESCE(order_priority, '') AS "orderPriority",
  COALESCE(code, '') AS "procedureCode", COALESCE(name, '') AS "procedureName",
  COALESCE(procedure_type, '') AS "procedureType"
FROM lab_orders
WHERE id = ${integer(id)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      patientId: Number(row.patientId),
      encounterId: Number(row.encounterId),
      orderStatus: row.orderStatus,
      orderPriority: row.orderPriority,
      procedureCode: row.procedureCode,
      procedureName: row.procedureName,
      procedureType: row.procedureType
    };
  }

  async updateProcedureOrderStatus(id: number, status: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/orders/${encodeURIComponent(String(id))}/status`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure order status update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createProcedureReport(input: NewProcedureReport): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: input.orderId,
        dateCollected: input.dateCollected,
        dateReport: input.dateReport,
        specimenNumber: input.specimenNumber,
        reportStatus: input.reportStatus,
        reviewStatus: input.reviewStatus,
        notes: input.notes
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure report create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async getProcedureReport(id: number): Promise<ProcedureReportRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, order_id AS "orderId", COALESCE(status, '') AS "reportStatus",
  COALESCE(review_status, '') AS "reviewStatus", COALESCE(notes, '') AS "reportNotes"
FROM lab_reports
WHERE id = ${integer(id)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      orderId: Number(row.orderId),
      reportStatus: row.reportStatus,
      reviewStatus: row.reviewStatus,
      reportNotes: row.reportNotes
    };
  }

  async createProcedureResult(input: NewProcedureResult): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/results`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reportId: input.reportId,
        resultCode: input.resultCode,
        resultText: input.resultText,
        dateTime: input.dateTime,
        facility: input.facility,
        units: input.units,
        result: input.result,
        range: input.range,
        abnormal: input.abnormal,
        comments: input.comments,
        status: input.status
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized procedure result create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async getProcedureResult(id: number): Promise<ProcedureResultRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, report_id AS "reportId", COALESCE(code, '') AS "resultCode",
  COALESCE(text, '') AS "resultText", COALESCE(result, '') AS result,
  COALESCE(abnormal, '') AS abnormal, COALESCE(result_status, '') AS status
FROM lab_results
WHERE id = ${integer(id)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      reportId: Number(row.reportId),
      resultCode: row.resultCode,
      resultText: row.resultText,
      result: row.result,
      abnormal: row.abnormal,
      status: row.status
    };
  }

  async deleteProcedureOrderCascade(id: number): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/procedures/orders/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Modernized procedure order delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createEncounter(input: NewEncounter): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        patientId: String(input.patientId),
        providerId: input.providerId,
        dateTime: input.dateTime,
        reason: input.reason,
        facilityId: input.facilityId,
        billingFacilityId: input.billingFacilityId,
        billingNote: input.billingNote
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized encounter create failed with ${response.status}: ${await response.text()}`);
    }

    const encounter = (await response.json()) as { id: number; encounter: number };
    return encounter.encounter;
  }

  async getEncounter(id: number): Promise<EncounterRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, encounter, pid AS "patientId", provider_id AS "providerId", encounter_date AS date,
  reason, facility_id AS "facilityId", COALESCE(billing_facility_id, facility_id) AS "billingFacilityId",
  COALESCE(billing_note, '') AS "billingNote"
FROM encounters
WHERE encounter = ${integer(id)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      encounter: Number(row.encounter),
      patientId: Number(row.patientId),
      providerId: Number(row.providerId),
      date: row.date,
      reason: row.reason,
      facilityId: Number(row.facilityId),
      billingFacilityId: Number(row.billingFacilityId),
      billingNote: row.billingNote
    };
  }

  async updateEncounterReason(id: number, reason: string, billingNote: string): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(id))}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason, billingNote })
    });

    if (!response.ok) {
      throw new Error(`Modernized encounter update failed with ${response.status}: ${await response.text()}`);
    }
  }

  async deleteEncounter(id: number): Promise<void> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Modernized encounter delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createVitals(input: NewVitals): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(input.encounter))}/vitals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dateTime: input.dateTime,
        systolic: Number(input.bps),
        diastolic: Number(input.bpd),
        weight: input.weight,
        height: input.height,
        pulse: input.pulse,
        oxygenSaturation: input.oxygenSaturation,
        note: input.note
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized encounter vitals create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async getVitals(id: number): Promise<VitalsRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", COALESCE(bps::text, '') AS bps, COALESCE(bpd::text, '') AS bpd,
  COALESCE(weight::text, '0') AS weight, COALESCE(height::text, '0') AS height,
  COALESCE(pulse::text, '0') AS pulse, COALESCE(oxygen_saturation::text, '0') AS "oxygenSaturation",
  COALESCE(note, '') AS note
FROM vitals
WHERE id = ${integer(id)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      patientId: Number(row.patientId),
      bps: row.bps,
      bpd: row.bpd,
      weight: Number(row.weight),
      height: Number(row.height),
      pulse: Number(row.pulse),
      oxygenSaturation: Number(row.oxygenSaturation),
      note: row.note
    };
  }

  async deleteVitals(id: number): Promise<void> {
    const vitals = await this.db.queryRows<Record<string, string>>(`
SELECT encounter
FROM vitals
WHERE id = ${integer(id)}
LIMIT 1;
`);
    const encounter = vitals[0]?.encounter;
    if (!encounter) {
      return;
    }

    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(encounter)}/vitals/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Modernized encounter vitals delete failed with ${response.status}: ${await response.text()}`);
    }
  }

  async createSoapNote(input: NewSoapNote): Promise<number> {
    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(input.encounter))}/soap-notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dateTime: input.dateTime,
        subjective: input.subjective,
        objective: input.objective,
        assessment: input.assessment,
        plan: input.plan
      })
    });

    if (!response.ok) {
      throw new Error(`Modernized encounter SOAP note create failed with ${response.status}: ${await response.text()}`);
    }

    const mutation = (await response.json()) as { id: number };
    return mutation.id;
  }

  async getSoapNote(id: number): Promise<SoapNoteRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", COALESCE(subjective, '') AS subjective, COALESCE(objective, '') AS objective,
  COALESCE(assessment, '') AS assessment, COALESCE(plan, '') AS plan
FROM clinical_notes
WHERE id = ${integer(id)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      patientId: Number(row.patientId),
      subjective: row.subjective,
      objective: row.objective,
      assessment: row.assessment,
      plan: row.plan
    };
  }

  async deleteSoapNote(id: number): Promise<void> {
    const notes = await this.db.queryRows<Record<string, string>>(`
SELECT encounter
FROM clinical_notes
WHERE id = ${integer(id)}
LIMIT 1;
`);
    const encounter = notes[0]?.encounter;
    if (!encounter) {
      return;
    }

    const response = await fetch(`${this.target.apiBaseUrl}/api/encounters/${encodeURIComponent(encounter)}/soap-notes/${encodeURIComponent(String(id))}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Modernized encounter SOAP note delete failed with ${response.status}: ${await response.text()}`);
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
