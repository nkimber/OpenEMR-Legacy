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
  id: number | string;
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
  id: number | string;
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
  id: number | string;
  patientId: number;
  title: string;
  body: string;
  status: string;
  assignedTo: string;
  deleted: number;
};

export type PrescriptionRecord = {
  id: number | string;
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

export type EncounterRecord = {
  id: number;
  encounter: number;
  patientId: number;
  providerId: number;
  date: string;
  reason: string;
  facilityId: number;
  billingFacilityId: number;
  billingNote: string;
};

export type VitalsRecord = {
  id: number;
  patientId: number;
  bps: string;
  bpd: string;
  weight: number;
  height: number;
  pulse: number;
  oxygenSaturation: number;
  note: string;
};

export type SoapNoteRecord = {
  id: number;
  patientId: number;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

export type BillingLineRecord = {
  id: number;
  patientId: number;
  encounter: number;
  codeType: string;
  code: string;
  codeText: string;
  fee: string;
  units: number;
  activity: number;
  billed: number;
};

export type ProcedureOrderRecord = {
  id: number;
  patientId: number;
  encounterId: number;
  orderStatus: string;
  orderPriority: string;
  procedureCode: string;
  procedureName: string;
  procedureType: string;
};

export type ProcedureReportRecord = {
  id: number;
  orderId: number;
  reportStatus: string;
  reviewStatus: string;
  reportNotes: string;
};

export type ProcedureResultRecord = {
  id: number;
  reportId: number;
  resultCode: string;
  resultText: string;
  result: string;
  abnormal: string;
  status: string;
};

export type NewAppointment = {
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

export type NewClinicalListEntry = {
  patientId: number;
  type: "allergy" | "medical_problem" | "medication";
  title: string;
  dateTime: string;
  comments: string;
  reaction: string;
  severity: string;
  listOptionId: string;
};

export type NewPatientMessage = {
  patientId: number;
  title: string;
  body: string;
  assignedTo: string;
};

export type NewPrescription = {
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

export type NewEncounter = {
  patientId: number;
  providerId: number;
  dateTime: string;
  reason: string;
  facilityId: number;
  facilityName: string;
  billingFacilityId: number;
  billingNote: string;
};

export type NewVitals = {
  patientId: number;
  encounter: number;
  dateTime: string;
  bps: string;
  bpd: string;
  weight: number;
  height: number;
  pulse: number;
  oxygenSaturation: number;
  note: string;
};

export type NewSoapNote = {
  patientId: number;
  encounter: number;
  dateTime: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

type NewBillingLine = {
  patientId: number;
  providerId: number;
  encounter: number;
  dateTime: string;
  codeType: string;
  code: string;
  codeText: string;
  fee: string;
  units: number;
  justify: string;
};

type NewProcedureOrder = {
  patientId: number;
  providerId: number;
  encounterId: number;
  dateOrdered: string;
  priority: string;
  status: string;
  procedureCode: string;
  procedureName: string;
  procedureType: string;
  diagnosis: string;
  instructions: string;
};

type NewProcedureReport = {
  orderId: number;
  dateCollected: string;
  dateReport: string;
  specimenNumber: string;
  reportStatus: string;
  reviewStatus: string;
  notes: string;
};

type NewProcedureResult = {
  reportId: number;
  resultCode: string;
  resultText: string;
  dateTime: string;
  facility: string;
  units: string;
  result: string;
  range: string;
  abnormal: string;
  comments: string;
  status: string;
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

  async getAppointment(id: number | string): Promise<AppointmentRecord | null> {
    const legacyId = legacyInteger(id);
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT pc_eid AS id, pc_pid AS patientId, pc_aid AS providerId, pc_title AS title,
  DATE(pc_eventDate) AS eventDate, pc_startTime AS startTime, pc_endTime AS endTime,
  pc_apptstatus AS status, pc_facility AS facilityId, pc_billing_location AS billingLocationId,
  pc_room AS room
FROM openemr_postcalendar_events
WHERE pc_eid = ${integer(legacyId)}
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

  async updateAppointmentStatus(id: number | string, status: string, title: string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE openemr_postcalendar_events
SET pc_apptstatus = ${sqlString(status)}, pc_title = ${sqlString(title)}
WHERE pc_eid = ${integer(legacyId)};
`);
  }

  async deleteAppointment(id: number | string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
DELETE FROM openemr_postcalendar_events
WHERE pc_eid = ${integer(legacyId)};
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

  async getClinicalListEntry(id: number | string): Promise<ClinicalListRecord | null> {
    const legacyId = legacyInteger(id);
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS patientId, type, title, activity, comments, reaction, severity_al AS severity,
  list_option_id AS listOptionId
FROM lists
WHERE id = ${integer(legacyId)}
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

  async deactivateClinicalListEntry(id: number | string, comments: string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE lists
SET activity = 0, enddate = '2026-06-18 00:00:00', comments = ${sqlString(comments)}
WHERE id = ${integer(legacyId)};
`);
  }

  async deleteClinicalListEntry(id: number | string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
DELETE FROM lists
WHERE id = ${integer(legacyId)};
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

  async getPatientMessage(id: number | string): Promise<PatientMessageRecord | null> {
    const legacyId = legacyInteger(id);
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS patientId, title, body, message_status AS status, assigned_to AS assignedTo,
  COALESCE(deleted, 0) AS deleted
FROM pnotes
WHERE id = ${integer(legacyId)}
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

  async updatePatientMessageStatus(id: number | string, status: string, body: string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE pnotes
SET message_status = ${sqlString(status)}, body = ${sqlString(body)}, update_by = 1, update_date = NOW()
WHERE id = ${integer(legacyId)};
`);
  }

  async softDeletePatientMessage(id: number | string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE pnotes
SET deleted = 1, activity = 0, update_by = 1, update_date = NOW()
WHERE id = ${integer(legacyId)};
`);
  }

  async deletePatientMessage(id: number | string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
DELETE FROM pnotes
WHERE id = ${integer(legacyId)};
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

  async getPrescription(id: number | string): Promise<PrescriptionRecord | null> {
    const legacyId = legacyInteger(id);
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, patient_id AS patientId, provider_id AS providerId, DATE(start_date) AS startDate,
  DATE(end_date) AS endDate, drug, dosage, quantity, refills, active, note
FROM prescriptions
WHERE id = ${integer(legacyId)}
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

  async deactivatePrescription(id: number | string, endDate: string, note: string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
UPDATE prescriptions
SET active = 0, end_date = ${sqlString(endDate)}, note = ${sqlString(note)}, date_modified = NOW(), updated_by = 1
WHERE id = ${integer(legacyId)};
`);
  }

  async deletePrescription(id: number | string): Promise<void> {
    const legacyId = legacyInteger(id);
    await this.db.execute(`
DELETE FROM prescriptions
WHERE id = ${integer(legacyId)};
`);
  }

  async createEncounter(input: NewEncounter): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO form_encounter
  (uuid, date, reason, facility, facility_id, pid, encounter, pc_catid, provider_id, billing_facility, class_code, billing_note)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${sqlString(input.dateTime)}, ${sqlString(input.reason)}, ${sqlString(input.facilityName)},
   ${integer(input.facilityId)}, ${integer(input.patientId)}, 0, 9, ${integer(input.providerId)},
   ${integer(input.billingFacilityId)}, 'AMB', ${sqlString(input.billingNote)});
SELECT LAST_INSERT_ID() AS id;
`);
    const encounterId = Number(rows[0]?.id);
    await this.db.execute(`
UPDATE form_encounter
SET encounter = ${integer(encounterId)}
WHERE id = ${integer(encounterId)};
`);
    return encounterId;
  }

  async getEncounter(id: number): Promise<EncounterRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, encounter, pid AS patientId, provider_id AS providerId, DATE(date) AS date,
  reason, facility_id AS facilityId, billing_facility AS billingFacilityId, COALESCE(billing_note, '') AS billingNote
FROM form_encounter
WHERE id = ${integer(id)}
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
    await this.db.execute(`
UPDATE form_encounter
SET reason = ${sqlString(reason)}, billing_note = ${sqlString(billingNote)}
WHERE id = ${integer(id)};
`);
  }

  async deleteEncounter(id: number): Promise<void> {
    await this.db.execute(`
DELETE FROM form_encounter
WHERE id = ${integer(id)};
`);
  }

  async createVitals(input: NewVitals): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO form_vitals
  (uuid, date, pid, user, groupname, authorized, activity, bps, bpd, weight, height, pulse, oxygen_saturation, note)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${sqlString(input.dateTime)}, ${integer(input.patientId)}, 'admin', 'Default',
   1, 1, ${sqlString(input.bps)}, ${sqlString(input.bpd)}, ${decimal(input.weight)}, ${decimal(input.height)},
   ${decimal(input.pulse)}, ${decimal(input.oxygenSaturation)}, ${sqlString(input.note)});
SELECT LAST_INSERT_ID() AS id;
`);
    const vitalsId = Number(rows[0]?.id);
    await this.createFormLink({
      dateTime: input.dateTime,
      encounter: input.encounter,
      formName: "Vitals",
      formId: vitalsId,
      patientId: input.patientId,
      formDir: "vitals"
    });
    return vitalsId;
  }

  async getVitals(id: number): Promise<VitalsRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS patientId, bps, bpd, weight, height, pulse, oxygen_saturation AS oxygenSaturation, note
FROM form_vitals
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
    await this.db.execute(`
DELETE FROM forms
WHERE form_name = 'Vitals' AND form_id = ${integer(id)};
DELETE FROM form_vitals
WHERE id = ${integer(id)};
`);
  }

  async createSoapNote(input: NewSoapNote): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO form_soap
  (date, pid, user, groupname, authorized, activity, subjective, objective, assessment, plan)
VALUES
  (${sqlString(input.dateTime)}, ${integer(input.patientId)}, 'admin', 'Default', 1, 1,
   ${sqlString(input.subjective)}, ${sqlString(input.objective)}, ${sqlString(input.assessment)}, ${sqlString(input.plan)});
SELECT LAST_INSERT_ID() AS id;
`);
    const soapId = Number(rows[0]?.id);
    await this.createFormLink({
      dateTime: input.dateTime,
      encounter: input.encounter,
      formName: "SOAP",
      formId: soapId,
      patientId: input.patientId,
      formDir: "soap"
    });
    return soapId;
  }

  async getSoapNote(id: number): Promise<SoapNoteRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS patientId, subjective, objective, assessment, plan
FROM form_soap
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
    await this.db.execute(`
DELETE FROM forms
WHERE form_name = 'SOAP' AND form_id = ${integer(id)};
DELETE FROM form_soap
WHERE id = ${integer(id)};
`);
  }

  async createBillingLine(input: NewBillingLine): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO billing
  (date, code_type, code, pid, provider_id, user, groupname, authorized, encounter,
   code_text, billed, activity, units, fee, justify)
VALUES
  (${sqlString(input.dateTime)}, ${sqlString(input.codeType)}, ${sqlString(input.code)}, ${integer(input.patientId)},
   ${integer(input.providerId)}, 1, 'Default', 1, ${integer(input.encounter)}, ${sqlString(input.codeText)},
   0, 1, ${integer(input.units)}, ${decimal(Number(input.fee))}, ${sqlString(input.justify)});
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async getBillingLine(id: number): Promise<BillingLineRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT id, pid AS patientId, encounter, code_type AS codeType, code, code_text AS codeText,
  fee, units, activity, billed
FROM billing
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

  async updateBillingLineStatus(id: number, billed: number, activity: number): Promise<void> {
    await this.db.execute(`
UPDATE billing
SET billed = ${integer(billed)}, activity = ${integer(activity)}
WHERE id = ${integer(id)};
`);
  }

  async deleteBillingLine(id: number): Promise<void> {
    await this.db.execute(`
DELETE FROM billing
WHERE id = ${integer(id)};
`);
  }

  async createProcedureOrder(input: NewProcedureOrder): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO procedure_order
  (uuid, provider_id, patient_id, encounter_id, date_ordered, order_priority, order_status,
   patient_instructions, activity, control_id, specimen_type, clinical_hx, order_diagnosis,
   procedure_order_type, order_intent, location_id)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${integer(input.providerId)}, ${integer(input.patientId)}, ${integer(input.encounterId)},
   ${sqlString(input.dateOrdered)}, ${sqlString(input.priority)}, ${sqlString(input.status)},
   ${sqlString(input.instructions)}, 1, ${sqlString(`PARITY-${Date.now()}`)}, 'blood',
   'Parity workflow clinical history', ${sqlString(input.diagnosis)}, 'laboratory_test', 'order', ${integer(input.providerId)});
SELECT LAST_INSERT_ID() AS id;
`);
    const orderId = Number(rows[0]?.id);
    await this.db.execute(`
INSERT INTO procedure_order_code
  (procedure_order_id, procedure_order_seq, procedure_code, procedure_name, procedure_source, diagnoses, procedure_order_title, procedure_type)
VALUES
  (${integer(orderId)}, 1, ${sqlString(input.procedureCode)}, ${sqlString(input.procedureName)}, '1',
   ${sqlString(input.diagnosis)}, ${sqlString(input.procedureName)}, ${sqlString(input.procedureType)});
`);
    return orderId;
  }

  async getProcedureOrder(id: number): Promise<ProcedureOrderRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT po.procedure_order_id AS id, po.patient_id AS patientId, po.encounter_id AS encounterId,
  po.order_status AS orderStatus, po.order_priority AS orderPriority,
  poc.procedure_code AS procedureCode, poc.procedure_name AS procedureName, poc.procedure_type AS procedureType
FROM procedure_order po
LEFT JOIN procedure_order_code poc ON poc.procedure_order_id = po.procedure_order_id AND poc.procedure_order_seq = 1
WHERE po.procedure_order_id = ${integer(id)}
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
    await this.db.execute(`
UPDATE procedure_order
SET order_status = ${sqlString(status)}
WHERE procedure_order_id = ${integer(id)};
`);
  }

  async createProcedureReport(input: NewProcedureReport): Promise<number> {
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO procedure_report
  (uuid, procedure_order_id, procedure_order_seq, date_collected, date_report, source,
   specimen_num, report_status, review_status, report_notes)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${integer(input.orderId)}, 1, ${sqlString(input.dateCollected)},
   ${sqlString(input.dateReport)}, 1, ${sqlString(input.specimenNumber)}, ${sqlString(input.reportStatus)},
   ${sqlString(input.reviewStatus)}, ${sqlString(input.notes)});
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async getProcedureReport(id: number): Promise<ProcedureReportRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT procedure_report_id AS id, procedure_order_id AS orderId, report_status AS reportStatus,
  review_status AS reviewStatus, COALESCE(report_notes, '') AS reportNotes
FROM procedure_report
WHERE procedure_report_id = ${integer(id)}
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
    const rows = await this.db.queryRows<{ id: string }>(`
INSERT INTO procedure_result
  (uuid, procedure_report_id, result_data_type, result_code, result_text, date, facility,
   units, result, \`range\`, abnormal, comments, result_status)
VALUES
  (UNHEX(REPLACE(UUID(), '-', '')), ${integer(input.reportId)}, 'S', ${sqlString(input.resultCode)},
   ${sqlString(input.resultText)}, ${sqlString(input.dateTime)}, ${sqlString(input.facility)}, ${sqlString(input.units)},
   ${sqlString(input.result)}, ${sqlString(input.range)}, ${sqlString(input.abnormal)}, ${sqlString(input.comments)},
   ${sqlString(input.status)});
SELECT LAST_INSERT_ID() AS id;
`);
    return Number(rows[0]?.id);
  }

  async getProcedureResult(id: number): Promise<ProcedureResultRecord | null> {
    const rows = await this.db.queryRows<Record<string, string>>(`
SELECT procedure_result_id AS id, procedure_report_id AS reportId, result_code AS resultCode,
  result_text AS resultText, result, abnormal, result_status AS status
FROM procedure_result
WHERE procedure_result_id = ${integer(id)}
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
    await this.db.execute(`
DELETE pr
FROM procedure_result pr
INNER JOIN procedure_report rpt ON rpt.procedure_report_id = pr.procedure_report_id
WHERE rpt.procedure_order_id = ${integer(id)};
DELETE FROM procedure_report
WHERE procedure_order_id = ${integer(id)};
DELETE FROM procedure_order_code
WHERE procedure_order_id = ${integer(id)};
DELETE FROM procedure_order
WHERE procedure_order_id = ${integer(id)};
`);
  }

  private async createFormLink(input: {
    dateTime: string;
    encounter: number;
    formName: string;
    formId: number;
    patientId: number;
    formDir: string;
  }): Promise<void> {
    await this.db.execute(`
INSERT INTO forms
  (date, encounter, form_name, form_id, pid, user, groupname, authorized, deleted, formdir, provider_id)
VALUES
  (${sqlString(input.dateTime)}, ${integer(input.encounter)}, ${sqlString(input.formName)}, ${integer(input.formId)},
   ${integer(input.patientId)}, 'admin', 'Default', 1, 0, ${sqlString(input.formDir)}, 1);
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

function legacyInteger(value: number | string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Expected legacy numeric ID, received ${value}.`);
  }
  return parsed;
}

function decimal(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error(`Expected finite decimal value, received ${value}.`);
  }
  return String(value);
}

function dbNullToNull(value: string | undefined) {
  if (!value || value === "NULL" || value === "\\N") {
    return null;
  }
  return value;
}
