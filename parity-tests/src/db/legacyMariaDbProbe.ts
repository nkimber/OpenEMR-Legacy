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

export type BillingLineSummary = {
  id: number;
  encounter: number;
  codeType: string;
  code: string;
  codeText: string;
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

  async getBillingLinesForEncounter(pid: number, encounter: number): Promise<BillingLineSummary[]> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT id, encounter, code_type AS codeType, code, code_text AS codeText
FROM billing
WHERE pid = ${pid} AND encounter = ${encounter} AND activity = 1
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
