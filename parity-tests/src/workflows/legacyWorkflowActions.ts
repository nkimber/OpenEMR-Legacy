import { escapeSql, type LegacyMariaDbProbe } from "../db/legacyMariaDbProbe.js";

export type PatientContact = {
  pid: number;
  pubpid: string;
  phoneHome: string;
  phoneCell: string;
  email: string;
  hipaaAllowSms: string;
  hipaaAllowEmail: string;
};

export type AppointmentRecord = {
  id: number;
  patientId: number;
  providerId: number;
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  status: string;
  facilityId: number;
  billingLocationId: number;
  room: string;
};

export type ClinicalListRecord = {
  id: number;
  patientId: number;
  type: string;
  title: string;
  activity: number;
  comments: string;
  reaction: string;
  severity: string;
  listOptionId: string;
};

export type PatientMessageRecord = {
  id: number;
  patientId: number;
  title: string;
  body: string;
  status: string;
  assignedTo: string;
  deleted: number;
};

export type PrescriptionRecord = {
  id: number;
  patientId: number;
  providerId: number;
  startDate: string;
  endDate: string | null;
  drug: string;
  dosage: string;
  quantity: string;
  refills: number;
  active: number;
  note: string;
};

type NewAppointment = {
  patientId: number;
  providerId: number;
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  homeText: string;
  facilityId: number;
  billingLocationId: number;
  room: string;
};

type NewClinicalListEntry = {
  patientId: number;
  type: "allergy" | "medical_problem" | "medication";
  title: string;
  dateTime: string;
  comments: string;
  reaction: string;
  severity: string;
  listOptionId: string;
};

type NewPatientMessage = {
  patientId: number;
  title: string;
  body: string;
  assignedTo: string;
};

type NewPrescription = {
  patientId: number;
  providerId: number;
  startDate: string;
  drug: string;
  rxNormCode: string;
  dosage: string;
  quantity: string;
  refills: number;
  note: string;
  diagnosis: string;
};

export class LegacyWorkflowActions {
  constructor(private readonly db: LegacyMariaDbProbe) {}

  async getPatientContact(pid: number): Promise<PatientContact | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT pid, pubpid, phone_home AS phoneHome, phone_cell AS phoneCell, email,
  hipaa_allowsms AS hipaaAllowSms, hipaa_allowemail AS hipaaAllowEmail
FROM patient_data
WHERE pid = ${integer(pid)}
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
    await this.db.execute(`
UPDATE patient_data
SET phone_home = ${sqlString(contact.phoneHome)},
  phone_cell = ${sqlString(contact.phoneCell)},
  email = ${sqlString(contact.email)},
  hipaa_allowsms = ${sqlString(contact.hipaaAllowSms)},
  hipaa_allowemail = ${sqlString(contact.hipaaAllowEmail)}
WHERE pid = ${integer(contact.pid)};
`);
  }

  async createAppointment(input: NewAppointment): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO openemr_postcalendar_events
  (uuid, pc_catid, pc_multiple, pc_aid, pc_pid, pc_title, pc_time, pc_hometext,
   pc_eventDate, pc_endDate, pc_duration, pc_startTime, pc_endTime, pc_eventstatus,
   pc_sharing, pc_apptstatus, pc_facility, pc_billing_location, pc_room)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), 9, 0, ${sqlString(String(input.providerId))}, ${sqlString(String(input.patientId))},
   ${sqlString(input.title)}, NOW(), ${sqlString(input.homeText)}, ${sqlString(input.eventDate)}, ${sqlString(input.eventDate)},
   ${integer(input.durationSeconds)}, ${sqlString(input.startTime)}, ${sqlString(input.endTime)}, 1, 1, '-',
   ${integer(input.facilityId)}, ${integer(input.billingLocationId)}, ${sqlString(input.room)});
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async getAppointment(id: number): Promise<AppointmentRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT pc_eid AS id, pc_pid AS patientId, pc_aid AS providerId, pc_title AS title,
  DATE(pc_eventDate) AS eventDate, pc_startTime AS startTime, pc_endTime AS endTime,
  pc_apptstatus AS status, pc_facility AS facilityId, pc_billing_location AS billingLocationId,
  pc_room AS room
FROM openemr_postcalendar_events
WHERE pc_eid = ${integer(id)}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      id: Number(row.id),
      patientId: Number(row.patientId),
      providerId: Number(row.providerId),
      title: row.title,
      eventDate: row.eventDate,
      startTime: row.startTime,
      endTime: row.endTime,
      status: row.status,
      facilityId: Number(row.facilityId),
      billingLocationId: Number(row.billingLocationId),
      room: row.room
    };
  }

  async updateAppointmentStatus(id: number, status: string, title: string): Promise<void> {
    await this.db.execute(`
UPDATE openemr_postcalendar_events
SET pc_apptstatus = ${sqlString(status)}, pc_title = ${sqlString(title)}
WHERE pc_eid = ${integer(id)};
`);
  }

  async deleteAppointment(id: number): Promise<void> {
    await this.db.execute(`
DELETE FROM openemr_postcalendar_events
WHERE pc_eid = ${integer(id)};
`);
  }

  async createClinicalListEntry(input: NewClinicalListEntry): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO lists
  (uuid, date, type, title, begdate, diagnosis, activity, comments, pid, user, groupname,
   reaction, severity_al, list_option_id)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${sqlString(input.dateTime)}, ${sqlString(input.type)}, ${sqlString(input.title)},
   ${sqlString(input.dateTime)}, '', 1, ${sqlString(input.comments)}, ${integer(input.patientId)}, 'admin', 'Default',
   ${sqlString(input.reaction)}, ${sqlString(input.severity)}, ${sqlString(input.listOptionId)});
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async getClinicalListEntry(id: number): Promise<ClinicalListRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS patientId, type, title, activity, comments, reaction, severity_al AS severity,
  list_option_id AS listOptionId
FROM lists
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
      type: row.type,
      title: row.title,
      activity: Number(row.activity),
      comments: row.comments,
      reaction: row.reaction,
      severity: row.severity,
      listOptionId: row.listOptionId
    };
  }

  async deactivateClinicalListEntry(id: number, comments: string): Promise<void> {
    await this.db.execute(`
UPDATE lists
SET activity = 0, enddate = '2026-06-18 00:00:00', comments = ${sqlString(comments)}
WHERE id = ${integer(id)};
`);
  }

  async deleteClinicalListEntry(id: number): Promise<void> {
    await this.db.execute(`
DELETE FROM lists
WHERE id = ${integer(id)};
`);
  }

  async createPatientMessage(input: NewPatientMessage): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO pnotes
  (date, body, pid, user, groupname, activity, authorized, title, assigned_to, message_status)
VALUES
  (NOW(), ${sqlString(input.body)}, ${integer(input.patientId)}, 'admin', 'Default', 1, 1,
   ${sqlString(input.title)}, ${sqlString(input.assignedTo)}, 'New');
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async getPatientMessage(id: number): Promise<PatientMessageRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS patientId, title, body, message_status AS status, assigned_to AS assignedTo,
  COALESCE(deleted, 0) AS deleted
FROM pnotes
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
      title: row.title,
      body: row.body,
      status: row.status,
      assignedTo: row.assignedTo,
      deleted: Number(row.deleted)
    };
  }

  async updatePatientMessageStatus(id: number, status: string, body: string): Promise<void> {
    await this.db.execute(`
UPDATE pnotes
SET message_status = ${sqlString(status)}, body = ${sqlString(body)}, update_by = 1, update_date = NOW()
WHERE id = ${integer(id)};
`);
  }

  async softDeletePatientMessage(id: number): Promise<void> {
    await this.db.execute(`
UPDATE pnotes
SET deleted = 1, activity = 0, update_by = 1, update_date = NOW()
WHERE id = ${integer(id)};
`);
  }

  async deletePatientMessage(id: number): Promise<void> {
    await this.db.execute(`
DELETE FROM pnotes
WHERE id = ${integer(id)};
`);
  }

  async createPrescription(input: NewPrescription): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO prescriptions
  (uuid, patient_id, filled_by_id, date_added, date_modified, provider_id, encounter, start_date,
   drug, rxnorm_drugcode, dosage, quantity, route, refills, medication, note, active, datetime,
   user, site, txDate, usage_category_title, request_intent_title, diagnosis, created_by, updated_by)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${integer(input.patientId)}, 1, NOW(), NOW(), ${integer(input.providerId)}, 0,
   ${sqlString(input.startDate)}, ${sqlString(input.drug)}, ${sqlString(input.rxNormCode)}, ${sqlString(input.dosage)},
   ${sqlString(input.quantity)}, 'oral', ${integer(input.refills)}, 1, ${sqlString(input.note)}, 1, NOW(), 'admin',
   'default', ${sqlString(input.startDate)}, 'community', 'order', ${sqlString(input.diagnosis)}, 1, 1);
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async getPrescription(id: number): Promise<PrescriptionRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, patient_id AS patientId, provider_id AS providerId, DATE(start_date) AS startDate,
  DATE(end_date) AS endDate, drug, dosage, quantity, refills, active, note
FROM prescriptions
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
      providerId: Number(row.providerId),
      startDate: row.startDate,
      endDate: dbNullToNull(row.endDate),
      drug: row.drug,
      dosage: row.dosage,
      quantity: row.quantity,
      refills: Number(row.refills),
      active: Number(row.active),
      note: row.note
    };
  }

  async deactivatePrescription(id: number, endDate: string, note: string): Promise<void> {
    await this.db.execute(`
UPDATE prescriptions
SET active = 0, end_date = ${sqlString(endDate)}, note = ${sqlString(note)}, date_modified = NOW(), updated_by = 1
WHERE id = ${integer(id)};
`);
  }

  async deletePrescription(id: number): Promise<void> {
    await this.db.execute(`
DELETE FROM prescriptions
WHERE id = ${integer(id)};
`);
  }
}

function sqlString(value: string) {
  return `'${escapeSql(value)}'`;
}

function integer(value: number) {
  if (!Number.isInteger(value)) {
    throw new Error(`Expected integer value, received ${value}.`);
  }
  return String(value);
}

function dbNullToNull(value: string | undefined) {
  if (!value || value === "NULL" || value === "\\N") {
    return null;
  }
  return value;
}
