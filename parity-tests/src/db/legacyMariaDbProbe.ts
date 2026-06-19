import type { RuntimeTarget } from "../config/targets.js";
import { runCommand } from "../core/command.js";

export type GoldCountMap = Record<string, number>;

export type TemporalCoverageRow = {
  name: string;
  total: number;
  currentYear: number;
  futureCurrentYear: number;
  minDate: string | null;
  maxDate: string | null;
};

export type PatientRecord = {
  pid: number;
  pubpid: string;
  fname: string;
  lname: string;
  dob: string;
  sex: string;
  providerId: number;
  allowPatientPortal: string;
};

export type AppointmentSummary = {
  id: number | string;
  patientId: number;
  title: string;
  eventDate: string;
  startTime: string;
  status: string;
};

export type EncounterSummary = {
  id: number;
  encounter: number;
  patientId: number;
  date: string;
  reason: string;
};

export type EncounterClinicalDetail = {
  encounter: number;
  patientId: number;
  date: string;
  reason: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  bloodPressure: string;
  pulse: string;
};

export type ClinicalProblemSummary = {
  title: string;
  diagnosis: string;
  date: string;
  comments: string;
};

export type ClinicalAllergySummary = {
  title: string;
  reaction: string;
  severity: string;
  date: string;
  comments: string;
};

export type ClinicalMedicationSummary = {
  title: string;
  diagnosis: string;
  date: string;
  comments: string;
};

export type ClinicalPrescriptionSummary = {
  drug: string;
  dosage: string;
  route: string;
  diagnosis: string;
  startDate: string;
};

export type ClinicalListsSummary = {
  patientId: number;
  problems: ClinicalProblemSummary[];
  allergies: ClinicalAllergySummary[];
  medications: ClinicalMedicationSummary[];
  prescriptions: ClinicalPrescriptionSummary[];
};

export type PatientMessageSummary = {
  title: string;
  body: string;
  status: string;
  date: string;
};

export type PatientMessagesSummary = {
  patientId: number;
  portalEnabled: boolean;
  messages: PatientMessageSummary[];
};

export type BillingLineSummary = {
  id: string;
  encounter: number;
  codeType: string;
  code: string;
  codeText: string;
  fee: string;
  justify: string;
};

export type AdministrationUserSummary = {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  role: string;
  authorized: boolean;
  active: boolean;
  calendar: boolean;
  facilityId: number;
  facilityName: string;
  email: string;
  npi: string;
};

export type AdministrationFacilitySummary = {
  id: number;
  code: string;
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  color: string;
};

export type AdministrationDirectorySummary = {
  users: AdministrationUserSummary[];
  facilities: AdministrationFacilitySummary[];
};

export type OperationalReportCounts = {
  patients: number;
  portalPatients: number;
  appointments: number;
  futureAppointments: number;
  currentYearAppointments: number;
  encounters: number;
  currentYearEncounters: number;
  billingLines: number;
  billingTotal: number;
  labReports: number;
  messages: number;
  newMessages: number;
  doneMessages: number;
  facilities: number;
  providers: number;
};

export type ProviderActivityReportSummary = {
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  encounters: number;
  billingLines: number;
  billingTotal: number;
};

export type FacilityActivityReportSummary = {
  code: string;
  name: string;
  appointments: number;
  encounters: number;
  billingLines: number;
  billingTotal: number;
};

export type ClinicalConditionReportSummary = {
  title: string;
  diagnosis: string;
  patients: number;
};

export type OperationalReportsSummary = {
  counts: OperationalReportCounts;
  providerActivity: ProviderActivityReportSummary[];
  facilityActivity: FacilityActivityReportSummary[];
  clinicalConditions: ClinicalConditionReportSummary[];
};

export type ProcedureOrderSummary = {
  id: number;
  patientId: number;
  encounterId: number;
  dateOrdered: string;
  orderStatus: string;
  procedureCode: string;
  procedureName: string;
};

export type ProcedureResultSummary = {
  id: number;
  reportId: number;
  code: string;
  text: string;
  units: string;
  result: string;
  range: string;
  abnormal: string;
  resultDate: string;
  resultStatus: string;
};

export type ProcedureReportSummary = {
  id: number;
  orderId: number;
  reportDate: string;
  status: string;
  reviewStatus: string;
  results: ProcedureResultSummary[];
};

export type ProcedureOrderWithResults = ProcedureOrderSummary & {
  reports: ProcedureReportSummary[];
};

export type ProcedureResultsSummary = {
  patientId: number;
  orders: ProcedureOrderWithResults[];
};

export class LegacyMariaDbProbe {
  constructor(private readonly target: RuntimeTarget) {}

  async execute(sql: string): Promise<void> {
    await this.runSql(sql);
  }

  async queryRows<T extends Record<string, string>>(sql: string): Promise<T[]> {
    return parseTabRows<T>(await this.runSql(sql));
  }

  private async runSql(sql: string): Promise<string> {
    const dbUser = this.target.env.MYSQL_USER || this.target.database.defaultUser;
    const dbPassword = this.target.env.MYSQL_PASSWORD || "";
    const dbName = this.target.env.MYSQL_DATABASE || this.target.database.defaultDatabase;
    const command = [
      "docker",
      "compose",
      "exec",
      "-T",
      this.target.database.composeService ?? "mysql",
      "mariadb",
      "-B",
      "-u",
      dbUser,
      `-p${dbPassword}`,
      dbName,
      "-e",
      sql
    ];
    const result = await runCommand(command, { cwd: this.target.workingDirectoryAbs, timeoutMs: 120_000 });
    if (result.exitCode !== 0) {
      throw new Error(`MariaDB query failed.\n${result.stderr || result.stdout}`);
    }
    return result.stdout;
  }

  async getGoldCounts(): Promise<GoldCountMap> {
    const rows = await this.queryRows<{ name: string; value: string }>(`
SELECT 'patients' AS name, COUNT(*) AS value FROM patient_data
UNION ALL SELECT 'providersAndStaff', COUNT(*) FROM users WHERE username LIKE 'gold-%'
UNION ALL SELECT 'facilities', COUNT(*) FROM facility WHERE id IN (10, 11, 12)
UNION ALL SELECT 'insuranceRecords', COUNT(*) FROM insurance_data
UNION ALL SELECT 'appointments', COUNT(*) FROM openemr_postcalendar_events
UNION ALL SELECT 'encounters', COUNT(*) FROM form_encounter
UNION ALL SELECT 'vitals', COUNT(*) FROM form_vitals
UNION ALL SELECT 'clinicalNotes', COUNT(*) FROM form_soap
UNION ALL SELECT 'problems', COUNT(*) FROM lists WHERE type = 'medical_problem'
UNION ALL SELECT 'allergies', COUNT(*) FROM lists WHERE type = 'allergy'
UNION ALL SELECT 'medicationListEntries', COUNT(*) FROM lists WHERE type = 'medication'
UNION ALL SELECT 'medicationsAndPrescriptions', COUNT(*) FROM prescriptions
UNION ALL SELECT 'labOrders', COUNT(*) FROM procedure_order
UNION ALL SELECT 'labReports', COUNT(*) FROM procedure_report
UNION ALL SELECT 'labResults', COUNT(*) FROM procedure_result
UNION ALL SELECT 'messages', COUNT(*) FROM pnotes
UNION ALL SELECT 'billingLineItems', COUNT(*) FROM billing
UNION ALL SELECT 'portalPatients', COUNT(*) FROM patient_data WHERE allow_patient_portal = 'YES';
`);
    return Object.fromEntries(rows.map((row) => [row.name, Number(row.value)]));
  }

  async getTemporalCoverage(asOfDate: string, currentYear: string): Promise<Record<string, TemporalCoverageRow>> {
    const yearStart = `${currentYear}-01-01`;
    const nextYear = `${Number(currentYear) + 1}-01-01`;
    const rows = await this.queryRows<Record<string, string>>(`
SELECT 'appointments' AS name, COUNT(*) AS total,
  COALESCE(SUM(CASE WHEN DATE(pc_eventDate) >= '${yearStart}' AND DATE(pc_eventDate) < '${nextYear}' THEN 1 ELSE 0 END), 0) AS currentYear,
  COALESCE(SUM(CASE WHEN DATE(pc_eventDate) > '${asOfDate}' AND DATE(pc_eventDate) < '${nextYear}' THEN 1 ELSE 0 END), 0) AS futureCurrentYear,
  DATE(MIN(pc_eventDate)) AS minDate, DATE(MAX(pc_eventDate)) AS maxDate
FROM openemr_postcalendar_events
UNION ALL SELECT 'encounters', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date) >= '${yearStart}' AND DATE(date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date) > '${asOfDate}' AND DATE(date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date)), DATE(MAX(date))
FROM form_encounter
UNION ALL SELECT 'medicationListEntries', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date) >= '${yearStart}' AND DATE(date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date) > '${asOfDate}' AND DATE(date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date)), DATE(MAX(date))
FROM lists WHERE type = 'medication'
UNION ALL SELECT 'prescriptions', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(start_date) >= '${yearStart}' AND DATE(start_date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(start_date) > '${asOfDate}' AND DATE(start_date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  DATE(MIN(start_date)), DATE(MAX(start_date))
FROM prescriptions
UNION ALL SELECT 'procedureOrders', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date_ordered) >= '${yearStart}' AND DATE(date_ordered) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date_ordered) > '${asOfDate}' AND DATE(date_ordered) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date_ordered)), DATE(MAX(date_ordered))
FROM procedure_order
UNION ALL SELECT 'procedureReports', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date_report) >= '${yearStart}' AND DATE(date_report) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date_report) > '${asOfDate}' AND DATE(date_report) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date_report)), DATE(MAX(date_report))
FROM procedure_report
UNION ALL SELECT 'procedureResults', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date) >= '${yearStart}' AND DATE(date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date) > '${asOfDate}' AND DATE(date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date)), DATE(MAX(date))
FROM procedure_result
UNION ALL SELECT 'messages', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date) >= '${yearStart}' AND DATE(date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date) > '${asOfDate}' AND DATE(date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date)), DATE(MAX(date))
FROM pnotes
UNION ALL SELECT 'billingLineItems', COUNT(*),
  COALESCE(SUM(CASE WHEN DATE(date) >= '${yearStart}' AND DATE(date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN DATE(date) > '${asOfDate}' AND DATE(date) < '${nextYear}' THEN 1 ELSE 0 END), 0),
  DATE(MIN(date)), DATE(MAX(date))
FROM billing;
`);
    return Object.fromEntries(
      rows.map((row) => [
        row.name,
        {
          name: row.name,
          total: Number(row.total),
          currentYear: Number(row.currentYear),
          futureCurrentYear: Number(row.futureCurrentYear),
          minDate: nullIfDbNull(row.minDate),
          maxDate: nullIfDbNull(row.maxDate)
        }
      ])
    );
  }

  async findPatientByCanonicalId(canonicalId: string): Promise<PatientRecord | null> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT pid, pubpid, fname, lname, DATE(DOB) AS dob, sex, providerID AS providerId, allow_patient_portal AS allowPatientPortal
FROM patient_data
WHERE pubpid = '${escapeSql(canonicalId)}'
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      pid: Number(row.pid),
      pubpid: row.pubpid,
      fname: row.fname,
      lname: row.lname,
      dob: row.dob,
      sex: row.sex,
      providerId: Number(row.providerId),
      allowPatientPortal: row.allowPatientPortal
    };
  }

  async getPatientWorkflowCounts(pid: number) {
    const rows = await this.queryRows<{ name: string; value: string }>(`
SELECT 'appointments' AS name, COUNT(*) AS value FROM openemr_postcalendar_events WHERE pc_pid = ${pid}
UNION ALL SELECT 'encounters', COUNT(*) FROM form_encounter WHERE pid = ${pid}
UNION ALL SELECT 'vitals', COUNT(*) FROM form_vitals WHERE pid = ${pid}
UNION ALL SELECT 'clinicalNotes', COUNT(*) FROM form_soap WHERE pid = ${pid}
UNION ALL SELECT 'problems', COUNT(*) FROM lists WHERE pid = ${pid} AND type = 'medical_problem'
UNION ALL SELECT 'allergies', COUNT(*) FROM lists WHERE pid = ${pid} AND type = 'allergy'
UNION ALL SELECT 'medications', COUNT(*) FROM lists WHERE pid = ${pid} AND type = 'medication'
UNION ALL SELECT 'prescriptions', COUNT(*) FROM prescriptions WHERE patient_id = ${pid}
UNION ALL SELECT 'messages', COUNT(*) FROM pnotes WHERE pid = ${pid}
UNION ALL SELECT 'procedureOrders', COUNT(*) FROM procedure_order WHERE patient_id = ${pid}
UNION ALL SELECT 'billingLineItems', COUNT(*) FROM billing WHERE pid = ${pid};
`);
    return Object.fromEntries(rows.map((row) => [row.name, Number(row.value)]));
  }

  async getFutureAppointmentForPatient(pid: number, afterDate: string): Promise<AppointmentSummary | null> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT pc_eid AS id, pc_pid AS patientId, pc_title AS title, DATE(pc_eventDate) AS eventDate,
  pc_startTime AS startTime, pc_apptstatus AS status
FROM openemr_postcalendar_events
WHERE pc_pid = ${pid} AND pc_eventDate > '${escapeSql(afterDate)}'
ORDER BY pc_eventDate, pc_startTime
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
      eventDate: row.eventDate,
      startTime: row.startTime,
      status: row.status
    };
  }

  async getLatestEncounterForPatient(pid: number): Promise<EncounterSummary | null> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT id, encounter, pid AS patientId, DATE(date) AS date, reason
FROM form_encounter
WHERE pid = ${pid}
ORDER BY date DESC, id DESC
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
      date: row.date,
      reason: row.reason
    };
  }

  async getEncounterClinicalDetail(pid: number, encounter: number): Promise<EncounterClinicalDetail | null> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT fe.encounter, fe.pid AS patientId, DATE(fe.date) AS date, fe.reason,
  COALESCE(fs.subjective, '') AS subjective,
  COALESCE(fs.objective, '') AS objective,
  COALESCE(fs.assessment, '') AS assessment,
  COALESCE(fs.plan, '') AS plan,
  CONCAT(COALESCE(fv.bps, ''), '/', COALESCE(fv.bpd, '')) AS bloodPressure,
  COALESCE(CAST(fv.pulse AS CHAR), '') AS pulse
FROM form_encounter fe
LEFT JOIN forms fv_link ON fv_link.pid = fe.pid
  AND fv_link.encounter = fe.encounter
  AND fv_link.formdir = 'vitals'
  AND fv_link.deleted = 0
LEFT JOIN form_vitals fv ON fv.id = fv_link.form_id
LEFT JOIN forms fs_link ON fs_link.pid = fe.pid
  AND fs_link.encounter = fe.encounter
  AND fs_link.formdir = 'soap'
  AND fs_link.deleted = 0
LEFT JOIN form_soap fs ON fs.id = fs_link.form_id
WHERE fe.pid = ${pid} AND fe.encounter = ${encounter}
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      encounter: Number(row.encounter),
      patientId: Number(row.patientId),
      date: row.date,
      reason: row.reason,
      subjective: row.subjective,
      objective: row.objective,
      assessment: row.assessment,
      plan: row.plan,
      bloodPressure: row.bloodPressure,
      pulse: row.pulse
    };
  }

  async getClinicalListsForPatient(pid: number): Promise<ClinicalListsSummary> {
    const problems = await this.queryRows<Record<string, string>>(`
SELECT title, COALESCE(diagnosis, '') AS diagnosis, DATE(date) AS date, COALESCE(comments, '') AS comments
FROM lists
WHERE pid = ${pid} AND type = 'medical_problem'
ORDER BY date DESC, id;
`);
    const allergies = await this.queryRows<Record<string, string>>(`
SELECT title, COALESCE(reaction, '') AS reaction, COALESCE(severity_al, '') AS severity,
  DATE(date) AS date, COALESCE(comments, '') AS comments
FROM lists
WHERE pid = ${pid} AND type = 'allergy'
ORDER BY date DESC, id;
`);
    const medications = await this.queryRows<Record<string, string>>(`
SELECT title, COALESCE(diagnosis, '') AS diagnosis, DATE(date) AS date, COALESCE(comments, '') AS comments
FROM lists
WHERE pid = ${pid} AND type = 'medication'
ORDER BY date DESC, id;
`);
    const prescriptions = await this.queryRows<Record<string, string>>(`
SELECT drug, COALESCE(dosage, '') AS dosage, COALESCE(route, '') AS route,
  COALESCE(diagnosis, '') AS diagnosis, DATE(start_date) AS startDate
FROM prescriptions
WHERE patient_id = ${pid}
ORDER BY start_date DESC, id;
`);

    return {
      patientId: pid,
      problems: problems.map((row) => ({
        title: row.title,
        diagnosis: row.diagnosis,
        date: row.date,
        comments: row.comments
      })),
      allergies: allergies.map((row) => ({
        title: row.title,
        reaction: row.reaction,
        severity: row.severity,
        date: row.date,
        comments: row.comments
      })),
      medications: medications.map((row) => ({
        title: row.title,
        diagnosis: row.diagnosis,
        date: row.date,
        comments: row.comments
      })),
      prescriptions: prescriptions.map((row) => ({
        drug: row.drug,
        dosage: row.dosage,
        route: row.route,
        diagnosis: row.diagnosis,
        startDate: row.startDate
      }))
    };
  }

  async getPatientMessagesForPatient(pid: number): Promise<PatientMessagesSummary> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT pn.title, pn.body, COALESCE(pn.message_status, '') AS status, DATE(pn.date) AS date,
  pd.allow_patient_portal AS portalEnabled
FROM pnotes pn
INNER JOIN patient_data pd ON pd.pid = pn.pid
WHERE pn.pid = ${pid} AND COALESCE(pn.deleted, 0) = 0
ORDER BY pn.date DESC, pn.id DESC;
`);

    return {
      patientId: pid,
      portalEnabled: rows.some((row) => row.portalEnabled === "YES"),
      messages: rows.map((row) => ({
        title: row.title,
        body: row.body,
        status: row.status,
        date: row.date
      }))
    };
  }

  async getBillingLinesForEncounter(pid: number, encounter: number): Promise<BillingLineSummary[]> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT id, encounter, code_type AS codeType, code, code_text AS codeText,
  COALESCE(CAST(fee AS CHAR), '') AS fee, COALESCE(justify, '') AS justify
FROM billing
WHERE pid = ${pid} AND encounter = ${encounter} AND activity = 1
ORDER BY id;
`);
    return rows.map((row) => ({
      id: row.id,
      encounter: Number(row.encounter),
      codeType: row.codeType,
      code: row.code,
      codeText: row.codeText,
      fee: row.fee,
      justify: row.justify
    }));
  }

  async getAdministrationDirectory(): Promise<AdministrationDirectorySummary> {
    const users = await this.queryRows<Record<string, string>>(`
SELECT u.id, u.username, u.fname AS firstName, u.lname AS lastName,
  COALESCE(NULLIF(u.abook_type, ''), NULLIF(u.main_menu_role, ''), '') AS role,
  COALESCE(u.authorized, 0) AS authorized,
  COALESCE(u.active, 0) AS active,
  COALESCE(u.calendar, 0) AS calendar,
  COALESCE(u.facility_id, 0) AS facilityId,
  COALESCE(f.name, u.facility, '') AS facilityName,
  COALESCE(u.email, '') AS email,
  COALESCE(u.npi, '') AS npi
FROM users u
LEFT JOIN facility f ON f.id = u.facility_id
WHERE u.username LIKE 'gold-%'
ORDER BY u.id;
`);

    const facilities = await this.queryRows<Record<string, string>>(`
SELECT id, COALESCE(facility_code, '') AS code, name, COALESCE(phone, '') AS phone,
  COALESCE(street, '') AS street, COALESCE(city, '') AS city, COALESCE(state, '') AS state,
  COALESCE(postal_code, '') AS postalCode, COALESCE(color, '') AS color
FROM facility
WHERE id IN (10, 11, 12)
ORDER BY id;
`);

    return {
      users: users.map((row) => ({
        id: Number(row.id),
        username: row.username,
        firstName: row.firstName,
        lastName: row.lastName,
        displayName: `${row.lastName}, ${row.firstName}`,
        role: row.role,
        authorized: row.authorized === "1",
        active: row.active === "1",
        calendar: row.calendar === "1",
        facilityId: Number(row.facilityId),
        facilityName: row.facilityName,
        email: row.email,
        npi: row.npi
      })),
      facilities: facilities.map((row) => ({
        id: Number(row.id),
        code: row.code,
        name: row.name,
        phone: row.phone,
        street: row.street,
        city: row.city,
        state: row.state,
        postalCode: row.postalCode,
        color: row.color
      }))
    };
  }

  async getOperationalReports(): Promise<OperationalReportsSummary> {
    const asOfDate = "2026-06-18";
    const yearStart = "2026-01-01";
    const nextYear = "2027-01-01";
    const countRows = await this.queryRows<{ name: string; value: string }>(`
SELECT 'patients' AS name, COUNT(*) AS value FROM patient_data
UNION ALL SELECT 'portalPatients', COUNT(*) FROM patient_data WHERE allow_patient_portal = 'YES'
UNION ALL SELECT 'appointments', COUNT(*) FROM openemr_postcalendar_events WHERE pc_pid <> 0
UNION ALL SELECT 'futureAppointments', COUNT(*) FROM openemr_postcalendar_events WHERE pc_pid <> 0 AND DATE(pc_eventDate) > '${asOfDate}'
UNION ALL SELECT 'currentYearAppointments', COUNT(*) FROM openemr_postcalendar_events WHERE pc_pid <> 0 AND DATE(pc_eventDate) >= '${yearStart}' AND DATE(pc_eventDate) < '${nextYear}'
UNION ALL SELECT 'encounters', COUNT(*) FROM form_encounter
UNION ALL SELECT 'currentYearEncounters', COUNT(*) FROM form_encounter WHERE DATE(date) >= '${yearStart}' AND DATE(date) < '${nextYear}'
UNION ALL SELECT 'billingLines', COUNT(*) FROM billing
UNION ALL SELECT 'billingTotal', COALESCE(SUM(fee), 0) FROM billing
UNION ALL SELECT 'labReports', COUNT(*) FROM procedure_report
UNION ALL SELECT 'messages', COUNT(*) FROM pnotes
UNION ALL SELECT 'newMessages', COUNT(*) FROM pnotes WHERE message_status = 'New'
UNION ALL SELECT 'doneMessages', COUNT(*) FROM pnotes WHERE message_status = 'Done'
UNION ALL SELECT 'facilities', COUNT(*) FROM facility WHERE id IN (10, 11, 12)
UNION ALL SELECT 'providers', COUNT(*) FROM users WHERE username LIKE 'gold-provider-%';
`);
    const countMap = Object.fromEntries(countRows.map((row) => [row.name, Number(row.value)]));

    const providerRows = await this.queryRows<Record<string, string>>(`
SELECT u.username, u.fname AS firstName, u.lname AS lastName,
  COALESCE(pe.encounters, 0) AS encounters,
  COALESCE(pb.billing_lines, 0) AS billingLines,
  COALESCE(pb.billing_total, 0) AS billingTotal
FROM users u
LEFT JOIN (
  SELECT provider_id, COUNT(*) AS encounters
  FROM form_encounter
  GROUP BY provider_id
) pe ON pe.provider_id = u.id
LEFT JOIN (
  SELECT provider_id, COUNT(*) AS billing_lines, COALESCE(SUM(fee), 0) AS billing_total
  FROM billing
  GROUP BY provider_id
) pb ON pb.provider_id = u.id
WHERE u.username LIKE 'gold-provider-%'
ORDER BY encounters DESC, billingTotal DESC, u.id
LIMIT 8;
`);

    const facilityRows = await this.queryRows<Record<string, string>>(`
SELECT f.facility_code AS code, f.name,
  COALESCE(fa.appointments, 0) AS appointments,
  COALESCE(fe.encounters, 0) AS encounters,
  COALESCE(fb.billing_lines, 0) AS billingLines,
  COALESCE(fb.billing_total, 0) AS billingTotal
FROM facility f
LEFT JOIN (
  SELECT pc_facility, COUNT(*) AS appointments
  FROM openemr_postcalendar_events
  WHERE pc_pid <> 0
  GROUP BY pc_facility
) fa ON fa.pc_facility = f.id
LEFT JOIN (
  SELECT facility_id, COUNT(*) AS encounters
  FROM form_encounter
  GROUP BY facility_id
) fe ON fe.facility_id = f.id
LEFT JOIN (
  SELECT fe.facility_id, COUNT(b.id) AS billing_lines, COALESCE(SUM(b.fee), 0) AS billing_total
  FROM billing b
  INNER JOIN form_encounter fe ON fe.encounter = b.encounter
  GROUP BY fe.facility_id
) fb ON fb.facility_id = f.id
WHERE f.id IN (10, 11, 12)
ORDER BY f.id;
`);

    const conditionRows = await this.queryRows<Record<string, string>>(`
SELECT title, COALESCE(diagnosis, '') AS diagnosis, COUNT(*) AS patients
FROM lists
WHERE type = 'medical_problem' AND activity = 1
GROUP BY title, diagnosis
ORDER BY patients DESC, title
LIMIT 8;
`);

    return {
      counts: {
        patients: countMap.patients,
        portalPatients: countMap.portalPatients,
        appointments: countMap.appointments,
        futureAppointments: countMap.futureAppointments,
        currentYearAppointments: countMap.currentYearAppointments,
        encounters: countMap.encounters,
        currentYearEncounters: countMap.currentYearEncounters,
        billingLines: countMap.billingLines,
        billingTotal: countMap.billingTotal,
        labReports: countMap.labReports,
        messages: countMap.messages,
        newMessages: countMap.newMessages,
        doneMessages: countMap.doneMessages,
        facilities: countMap.facilities,
        providers: countMap.providers
      },
      providerActivity: providerRows.map((row) => ({
        username: row.username,
        firstName: row.firstName,
        lastName: row.lastName,
        displayName: `${row.lastName}, ${row.firstName}`,
        encounters: Number(row.encounters),
        billingLines: Number(row.billingLines),
        billingTotal: Number(row.billingTotal)
      })),
      facilityActivity: facilityRows.map((row) => ({
        code: row.code,
        name: row.name,
        appointments: Number(row.appointments),
        encounters: Number(row.encounters),
        billingLines: Number(row.billingLines),
        billingTotal: Number(row.billingTotal)
      })),
      clinicalConditions: conditionRows.map((row) => ({
        title: row.title,
        diagnosis: row.diagnosis,
        patients: Number(row.patients)
      }))
    };
  }

  async getLatestProcedureOrderForPatient(pid: number): Promise<ProcedureOrderSummary | null> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT po.procedure_order_id AS id, po.patient_id AS patientId, po.encounter_id AS encounterId,
  DATE(po.date_ordered) AS dateOrdered, po.order_status AS orderStatus,
  poc.procedure_code AS procedureCode, poc.procedure_name AS procedureName
FROM procedure_order po
LEFT JOIN procedure_order_code poc ON poc.procedure_order_id = po.procedure_order_id AND poc.procedure_order_seq = 1
WHERE po.patient_id = ${pid}
ORDER BY po.date_ordered DESC, po.procedure_order_id DESC
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
      dateOrdered: row.dateOrdered,
      orderStatus: row.orderStatus,
      procedureCode: row.procedureCode,
      procedureName: row.procedureName
    };
  }

  async getProcedureResultsForPatient(pid: number): Promise<ProcedureResultsSummary> {
    const orderRows = await this.queryRows<Record<string, string>>(`
SELECT po.procedure_order_id AS id, po.patient_id AS patientId, po.encounter_id AS encounterId,
  DATE(po.date_ordered) AS dateOrdered, po.order_status AS orderStatus,
  poc.procedure_code AS procedureCode, poc.procedure_name AS procedureName
FROM procedure_order po
LEFT JOIN procedure_order_code poc ON poc.procedure_order_id = po.procedure_order_id AND poc.procedure_order_seq = 1
WHERE po.patient_id = ${pid}
ORDER BY po.date_ordered DESC, po.procedure_order_id DESC;
`);
    const orders: ProcedureOrderWithResults[] = orderRows.map((row) => ({
      id: Number(row.id),
      patientId: Number(row.patientId),
      encounterId: Number(row.encounterId),
      dateOrdered: row.dateOrdered,
      orderStatus: row.orderStatus,
      procedureCode: row.procedureCode,
      procedureName: row.procedureName,
      reports: []
    }));

    if (orders.length === 0) {
      return { patientId: pid, orders };
    }

    const orderIdList = orders.map((order) => order.id).join(",");
    const reportRows = await this.queryRows<Record<string, string>>(`
SELECT procedure_report_id AS id, procedure_order_id AS orderId, DATE(date_report) AS reportDate,
  COALESCE(report_status, '') AS status, COALESCE(review_status, '') AS reviewStatus
FROM procedure_report
WHERE procedure_order_id IN (${orderIdList})
ORDER BY date_report DESC, procedure_report_id DESC;
`);
    const reports: ProcedureReportSummary[] = reportRows.map((row) => ({
      id: Number(row.id),
      orderId: Number(row.orderId),
      reportDate: row.reportDate,
      status: row.status,
      reviewStatus: row.reviewStatus,
      results: []
    }));

    if (reports.length > 0) {
      const reportIdList = reports.map((report) => report.id).join(",");
      const resultRows = await this.queryRows<Record<string, string>>(`
SELECT procedure_result_id AS id, procedure_report_id AS reportId, COALESCE(result_code, '') AS code,
  COALESCE(result_text, '') AS text, COALESCE(units, '') AS units, COALESCE(result, '') AS result,
  COALESCE(\`range\`, '') AS resultRange, COALESCE(abnormal, '') AS abnormal, DATE(date) AS resultDate,
  COALESCE(result_status, '') AS resultStatus
FROM procedure_result
WHERE procedure_report_id IN (${reportIdList})
ORDER BY procedure_result_id;
`);

      const resultsByReport = new Map<number, ProcedureResultSummary[]>();
      for (const row of resultRows) {
        const reportId = Number(row.reportId);
        const reportResults = resultsByReport.get(reportId) ?? [];
        reportResults.push({
          id: Number(row.id),
          reportId,
          code: row.code,
          text: row.text,
          units: row.units,
          result: row.result,
          range: row.resultRange,
          abnormal: row.abnormal,
          resultDate: row.resultDate,
          resultStatus: row.resultStatus
        });
        resultsByReport.set(reportId, reportResults);
      }

      for (const report of reports) {
        report.results = resultsByReport.get(report.id) ?? [];
      }
    }

    const reportsByOrder = new Map<number, ProcedureReportSummary[]>();
    for (const report of reports) {
      const orderReports = reportsByOrder.get(report.orderId) ?? [];
      orderReports.push(report);
      reportsByOrder.set(report.orderId, orderReports);
    }

    for (const order of orders) {
      order.reports = reportsByOrder.get(order.id) ?? [];
    }

    return { patientId: pid, orders };
  }
}

function parseTabRows<T extends Record<string, string>>(stdout: string): T[] {
  const lines = stdout.split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean);
  if (lines.length === 0) {
    return [];
  }
  const headers = lines[0].split("\t");
  return lines.slice(1).map((line) => {
    const values = line.split("\t");
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])) as T;
  });
}

function nullIfDbNull(value: string | undefined) {
  if (!value || value === "NULL" || value === "\\N") {
    return null;
  }
  return value;
}

export function escapeSql(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "''");
}
