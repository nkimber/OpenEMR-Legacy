import type {
  AppointmentSummary,
  BillingLineSummary,
  ClinicalListsSummary,
  EncounterClinicalDetail,
  EncounterSummary,
  GoldCountMap,
  PatientRecord,
  ProcedureOrderSummary,
  TemporalCoverageRow
} from "./legacyMariaDbProbe.js";
import type { RuntimeTarget } from "../config/targets.js";
import { runCommand } from "../core/command.js";

export class ModernizedPostgresProbe {
  constructor(private readonly target: RuntimeTarget) {}

  async queryRows<T extends Record<string, string>>(sql: string): Promise<T[]> {
    return parsePostgresRows<T>(await this.runSql(sql));
  }

  private async runSql(sql: string): Promise<string> {
    const dbName = this.target.env.POSTGRES_DB || this.target.database.defaultDatabase;
    const dbUser = this.target.env.POSTGRES_USER || this.target.database.defaultUser;
    const command = [
      "docker",
      "compose",
      "exec",
      "-T",
      this.target.database.composeService ?? "postgres",
      "psql",
      "-U",
      dbUser,
      "-d",
      dbName,
      "-A",
      "-F",
      "\t",
      "-P",
      "footer=off",
      "-P",
      "null=\\N",
      "-c",
      sql
    ];
    const result = await runCommand(command, { cwd: this.target.workingDirectoryAbs, timeoutMs: 120_000 });
    if (result.exitCode !== 0) {
      throw new Error(`PostgreSQL query failed.\n${result.stderr || result.stdout}`);
    }
    return result.stdout;
  }

  async getGoldCounts(): Promise<GoldCountMap> {
    const rows = await this.queryRows<{ name: string; value: string }>(`
SELECT 'patients' AS name, COUNT(*) AS value FROM patients
UNION ALL SELECT 'providersAndStaff', COUNT(*) FROM staff
UNION ALL SELECT 'facilities', COUNT(*) FROM facilities
UNION ALL SELECT 'insuranceRecords', COUNT(*) FROM insurance_records
UNION ALL SELECT 'appointments', COUNT(*) FROM appointments
UNION ALL SELECT 'encounters', COUNT(*) FROM encounters
UNION ALL SELECT 'vitals', COUNT(*) FROM vitals
UNION ALL SELECT 'clinicalNotes', COUNT(*) FROM clinical_notes
UNION ALL SELECT 'problems', COUNT(*) FROM problems
UNION ALL SELECT 'allergies', COUNT(*) FROM allergies
UNION ALL SELECT 'medicationListEntries', COUNT(*) FROM medications
UNION ALL SELECT 'medicationsAndPrescriptions', COUNT(*) FROM prescriptions
UNION ALL SELECT 'labOrders', COUNT(*) FROM lab_orders
UNION ALL SELECT 'labReports', COUNT(*) FROM lab_reports
UNION ALL SELECT 'labResults', COUNT(*) FROM lab_results
UNION ALL SELECT 'messages', COUNT(*) FROM messages
UNION ALL SELECT 'billingLineItems', COUNT(*) FROM billing
UNION ALL SELECT 'portalPatients', COUNT(*) FROM patients WHERE portal_enabled = true;
`);
    return Object.fromEntries(rows.map((row) => [row.name, Number(row.value)]));
  }

  async getTemporalCoverage(asOfDate: string, currentYear: string): Promise<Record<string, TemporalCoverageRow>> {
    const yearStart = `${currentYear}-01-01`;
    const nextYear = `${Number(currentYear) + 1}-01-01`;
    const rows = await this.queryRows<Record<string, string>>(`
SELECT 'appointments' AS name, COUNT(*) AS total,
  COALESCE(SUM(CASE WHEN appointment_date >= '${yearStart}' AND appointment_date < '${nextYear}' THEN 1 ELSE 0 END), 0) AS "currentYear",
  COALESCE(SUM(CASE WHEN appointment_date > '${asOfDate}' AND appointment_date < '${nextYear}' THEN 1 ELSE 0 END), 0) AS "futureCurrentYear",
  MIN(appointment_date) AS "minDate", MAX(appointment_date) AS "maxDate"
FROM appointments
UNION ALL SELECT 'encounters', COUNT(*),
  COALESCE(SUM(CASE WHEN encounter_date >= '${yearStart}' AND encounter_date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN encounter_date > '${asOfDate}' AND encounter_date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  MIN(encounter_date), MAX(encounter_date)
FROM encounters
UNION ALL SELECT 'medicationListEntries', COUNT(*),
  COALESCE(SUM(CASE WHEN medication_date >= '${yearStart}' AND medication_date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN medication_date > '${asOfDate}' AND medication_date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  MIN(medication_date), MAX(medication_date)
FROM medications
UNION ALL SELECT 'prescriptions', COUNT(*),
  COALESCE(SUM(CASE WHEN start_date >= '${yearStart}' AND start_date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN start_date > '${asOfDate}' AND start_date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  MIN(start_date), MAX(start_date)
FROM prescriptions
UNION ALL SELECT 'procedureOrders', COUNT(*),
  COALESCE(SUM(CASE WHEN order_date >= '${yearStart}' AND order_date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN order_date > '${asOfDate}' AND order_date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  MIN(order_date), MAX(order_date)
FROM lab_orders
UNION ALL SELECT 'procedureReports', COUNT(*),
  COALESCE(SUM(CASE WHEN report_date::date >= '${yearStart}' AND report_date::date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN report_date::date > '${asOfDate}' AND report_date::date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  MIN(report_date::date), MAX(report_date::date)
FROM lab_reports
UNION ALL SELECT 'procedureResults', COUNT(*),
  COALESCE(SUM(CASE WHEN result_date::date >= '${yearStart}' AND result_date::date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN result_date::date > '${asOfDate}' AND result_date::date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  MIN(result_date::date), MAX(result_date::date)
FROM lab_results
UNION ALL SELECT 'messages', COUNT(*),
  COALESCE(SUM(CASE WHEN message_date >= '${yearStart}' AND message_date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN message_date > '${asOfDate}' AND message_date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  MIN(message_date), MAX(message_date)
FROM messages
UNION ALL SELECT 'billingLineItems', COUNT(*),
  COALESCE(SUM(CASE WHEN billing_date >= '${yearStart}' AND billing_date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN billing_date > '${asOfDate}' AND billing_date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  MIN(billing_date), MAX(billing_date)
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
SELECT legacy_pid AS pid, pubpid, first_name AS fname, last_name AS lname, date_of_birth AS dob,
  sex, provider_id AS "providerId", CASE WHEN portal_enabled THEN 'YES' ELSE 'NO' END AS "allowPatientPortal"
FROM patients
WHERE canonical_id = '${escapeSql(canonicalId)}'
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
SELECT 'appointments' AS name, COUNT(*) AS value FROM appointments WHERE pid = ${pid}
UNION ALL SELECT 'encounters', COUNT(*) FROM encounters WHERE pid = ${pid}
UNION ALL SELECT 'vitals', COUNT(*) FROM vitals WHERE pid = ${pid}
UNION ALL SELECT 'clinicalNotes', COUNT(*) FROM clinical_notes WHERE pid = ${pid}
UNION ALL SELECT 'problems', COUNT(*) FROM problems WHERE pid = ${pid}
UNION ALL SELECT 'allergies', COUNT(*) FROM allergies WHERE pid = ${pid}
UNION ALL SELECT 'medications', COUNT(*) FROM medications WHERE pid = ${pid}
UNION ALL SELECT 'prescriptions', COUNT(*) FROM prescriptions WHERE pid = ${pid}
UNION ALL SELECT 'messages', COUNT(*) FROM messages WHERE pid = ${pid}
UNION ALL SELECT 'procedureOrders', COUNT(*) FROM lab_orders WHERE pid = ${pid}
UNION ALL SELECT 'billingLineItems', COUNT(*) FROM billing WHERE pid = ${pid};
`);
    return Object.fromEntries(rows.map((row) => [row.name, Number(row.value)]));
  }

  async getFutureAppointmentForPatient(pid: number, afterDate: string): Promise<AppointmentSummary | null> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", title, appointment_date AS "eventDate", start_time AS "startTime", status
FROM appointments
WHERE pid = ${pid} AND appointment_date > '${escapeSql(afterDate)}'
ORDER BY appointment_date, start_time
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
      eventDate: row.eventDate,
      startTime: row.startTime,
      status: row.status
    };
  }

  async getLatestEncounterForPatient(pid: number): Promise<EncounterSummary | null> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT id, encounter, pid AS "patientId", encounter_date AS date, reason
FROM encounters
WHERE pid = ${pid}
ORDER BY encounter_date DESC, encounter DESC
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
SELECT e.encounter, e.pid AS "patientId", e.encounter_date AS date, e.reason,
  COALESCE(cn.subjective, '') AS subjective,
  COALESCE(cn.objective, '') AS objective,
  COALESCE(cn.assessment, '') AS assessment,
  COALESCE(cn.plan, '') AS plan,
  CONCAT(COALESCE(v.bps::text, ''), '/', COALESCE(v.bpd::text, '')) AS "bloodPressure",
  COALESCE(v.pulse::text, '') AS pulse
FROM encounters e
LEFT JOIN clinical_notes cn ON cn.pid = e.pid AND cn.encounter = e.encounter
LEFT JOIN vitals v ON v.pid = e.pid AND v.encounter = e.encounter
WHERE e.pid = ${pid} AND e.encounter = ${encounter}
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
SELECT title, COALESCE(diagnosis, '') AS diagnosis, problem_date AS date, COALESCE(comments, '') AS comments
FROM problems
WHERE pid = ${pid}
ORDER BY problem_date DESC, id;
`);
    const allergies = await this.queryRows<Record<string, string>>(`
SELECT title, COALESCE(reaction, '') AS reaction, COALESCE(severity, '') AS severity,
  allergy_date AS date, COALESCE(comments, '') AS comments
FROM allergies
WHERE pid = ${pid}
ORDER BY allergy_date DESC, id;
`);
    const medications = await this.queryRows<Record<string, string>>(`
SELECT title, COALESCE(diagnosis, '') AS diagnosis, medication_date AS date, COALESCE(comments, '') AS comments
FROM medications
WHERE pid = ${pid}
ORDER BY medication_date DESC, id;
`);
    const prescriptions = await this.queryRows<Record<string, string>>(`
SELECT drug, COALESCE(dosage, '') AS dosage, COALESCE(route, '') AS route,
  COALESCE(diagnosis, '') AS diagnosis, start_date AS "startDate"
FROM prescriptions
WHERE pid = ${pid}
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

  async getBillingLinesForEncounter(pid: number, encounter: number): Promise<BillingLineSummary[]> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT id, encounter, code_type AS "codeType", code, code_text AS "codeText"
FROM billing
WHERE pid = ${pid} AND encounter = ${encounter}
ORDER BY id;
`);
    return rows.map((row) => ({
      id: Number(row.id),
      encounter: Number(row.encounter),
      codeType: row.codeType,
      code: row.code,
      codeText: row.codeText
    }));
  }

  async getLatestProcedureOrderForPatient(pid: number): Promise<ProcedureOrderSummary | null> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT id, pid AS "patientId", encounter AS "encounterId", order_date AS "dateOrdered",
  order_status AS "orderStatus", code AS "procedureCode", name AS "procedureName"
FROM lab_orders
WHERE pid = ${pid}
ORDER BY order_date DESC, id DESC
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
}

function parsePostgresRows<T extends Record<string, string>>(stdout: string): T[] {
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
  if (!value || value === "\\N") {
    return null;
  }
  return value;
}

function escapeSql(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "''");
}
