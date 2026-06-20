import type {
  AdministrationAccessControlSummary,
  AdministrationAccessGroupSummary,
  AdministrationAccessPermissionSummary,
  AdministrationAccessGroupPermissionSummary,
  AdministrationAccessUserMembershipSummary,
  AdministrationDirectorySummary,
  AdministrationFacilitySummary,
  AdministrationUserSummary,
  AppointmentSummary,
  BillingLineSummary,
  ClaimStatusSummary,
  ClinicalListsSummary,
  EncounterClinicalDetail,
  EncounterSummary,
  GoldCountMap,
  OperationalReportsSummary,
  OperationalReportExportRow,
  PatientDocumentContentSummary,
  PatientDocumentsSummary,
  PatientInsuranceCoverageSummary,
  PatientImmunizationsSummary,
  PatientMessagesSummary,
  PaymentPostingSummary,
  AccountBalanceSummary,
  AccountAgingSummary,
  AccountLedgerEntry,
  PatientStatementSummary,
  PatientRecord,
  ProcedureOrderSummary,
  ProcedureOrderWithResults,
  ProcedureReportSummary,
  ProcedureResultSummary,
  ProcedureResultsSummary,
  TemporalCoverageRow
} from "./legacyMariaDbProbe.js";
import {
  buildAccountLedgerEntries,
  buildPatientDocumentRevisionFields,
  buildPatientDocumentPreviewFields,
  buildOperationalReportExportRows,
  buildPatientStatementSummary
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
UNION ALL SELECT 'problems', COUNT(*) FROM problems WHERE activity = 1
UNION ALL SELECT 'allergies', COUNT(*) FROM allergies WHERE activity = 1
UNION ALL SELECT 'medicationListEntries', COUNT(*) FROM medications WHERE activity = 1
UNION ALL SELECT 'medicationsAndPrescriptions', COUNT(*) FROM prescriptions
UNION ALL SELECT 'immunizations', COUNT(*) FROM immunizations WHERE added_erroneously = 0
UNION ALL SELECT 'labOrders', COUNT(*) FROM lab_orders
UNION ALL SELECT 'labReports', COUNT(*) FROM lab_reports
UNION ALL SELECT 'labResults', COUNT(*) FROM lab_results
UNION ALL SELECT 'messages', COUNT(*) FROM messages
UNION ALL SELECT 'patientDocuments', COUNT(*) FROM patient_documents WHERE deleted = 0
UNION ALL SELECT 'billingLineItems', COUNT(*) FROM billing
UNION ALL SELECT 'claims', COUNT(*) FROM claims
UNION ALL SELECT 'paymentSessions', COUNT(*) FROM payment_sessions
UNION ALL SELECT 'paymentActivities', COUNT(*) FROM payment_activities WHERE deleted IS NULL
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
UNION ALL SELECT 'immunizations', COUNT(*),
  COALESCE(SUM(CASE WHEN administered_at::date >= '${yearStart}' AND administered_at::date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN administered_at::date > '${asOfDate}' AND administered_at::date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  MIN(administered_at::date), MAX(administered_at::date)
FROM immunizations WHERE added_erroneously = 0
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
FROM billing
UNION ALL SELECT 'paymentPostings', COUNT(*),
  COALESCE(SUM(CASE WHEN post_date >= '${yearStart}' AND post_date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN post_date > '${asOfDate}' AND post_date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  MIN(post_date), MAX(post_date)
FROM payment_activities WHERE deleted IS NULL
UNION ALL SELECT 'patientDocuments', COUNT(*),
  COALESCE(SUM(CASE WHEN doc_date >= '${yearStart}' AND doc_date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  COALESCE(SUM(CASE WHEN doc_date > '${asOfDate}' AND doc_date < '${nextYear}' THEN 1 ELSE 0 END), 0),
  MIN(doc_date), MAX(doc_date)
FROM patient_documents WHERE deleted = 0;
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
UNION ALL SELECT 'problems', COUNT(*) FROM problems WHERE pid = ${pid} AND activity = 1
UNION ALL SELECT 'allergies', COUNT(*) FROM allergies WHERE pid = ${pid} AND activity = 1
UNION ALL SELECT 'medications', COUNT(*) FROM medications WHERE pid = ${pid} AND activity = 1
UNION ALL SELECT 'prescriptions', COUNT(*) FROM prescriptions WHERE pid = ${pid}
UNION ALL SELECT 'immunizations', COUNT(*) FROM immunizations WHERE pid = ${pid} AND added_erroneously = 0
UNION ALL SELECT 'messages', COUNT(*) FROM messages WHERE pid = ${pid}
UNION ALL SELECT 'documents', COUNT(*) FROM patient_documents WHERE pid = ${pid} AND deleted = 0
UNION ALL SELECT 'procedureOrders', COUNT(*) FROM lab_orders WHERE pid = ${pid}
UNION ALL SELECT 'billingLineItems', COUNT(*) FROM billing WHERE pid = ${pid}
UNION ALL SELECT 'claims', COUNT(*) FROM claims WHERE pid = ${pid}
UNION ALL SELECT 'paymentSessions', COUNT(*) FROM payment_sessions WHERE pid = ${pid}
UNION ALL SELECT 'paymentActivities', COUNT(*) FROM payment_activities WHERE pid = ${pid} AND deleted IS NULL;
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
WHERE pid = ${pid} AND activity = 1
ORDER BY problem_date DESC, id;
`);
    const allergies = await this.queryRows<Record<string, string>>(`
SELECT title, COALESCE(reaction, '') AS reaction, COALESCE(severity, '') AS severity,
  allergy_date AS date, COALESCE(comments, '') AS comments
FROM allergies
WHERE pid = ${pid} AND activity = 1
ORDER BY allergy_date DESC, id;
`);
    const medications = await this.queryRows<Record<string, string>>(`
SELECT title, COALESCE(diagnosis, '') AS diagnosis, medication_date AS date, COALESCE(comments, '') AS comments
FROM medications
WHERE pid = ${pid} AND activity = 1
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

  async getPatientImmunizationsForPatient(pid: number): Promise<PatientImmunizationsSummary> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT id::text AS id,
  vaccine,
  COALESCE(cvx_code, '') AS "cvxCode",
  administered_at::date AS "administeredDate",
  COALESCE(manufacturer, '') AS manufacturer,
  COALESCE(lot_number, '') AS "lotNumber",
  COALESCE(route, '') AS route,
  COALESCE(administration_site, '') AS "administrationSite",
  COALESCE(note, '') AS note,
  COALESCE(completion_status, '') AS "completionStatus"
FROM immunizations
WHERE pid = ${pid}
  AND added_erroneously = 0
ORDER BY administered_at DESC, id;
`);

    return {
      patientId: pid,
      immunizations: rows.map((row) => ({
        id: Number(row.id),
        vaccine: row.vaccine,
        cvxCode: row.cvxCode,
        administeredDate: row.administeredDate,
        manufacturer: row.manufacturer,
        lotNumber: row.lotNumber,
        route: row.route,
        administrationSite: row.administrationSite,
        note: row.note,
        completionStatus: row.completionStatus
      }))
    };
  }

  async getPatientMessagesForPatient(pid: number): Promise<PatientMessagesSummary> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT m.title, m.body, COALESCE(m.status, '') AS status, m.message_date AS date,
  CASE WHEN p.portal_enabled THEN 'YES' ELSE 'NO' END AS "portalEnabled"
FROM messages m
INNER JOIN patients p ON p.legacy_pid = m.pid
WHERE m.pid = ${pid} AND m.deleted = 0
ORDER BY m.message_date DESC, m.id DESC;
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

  async getPatientInsuranceForPatient(pid: number): Promise<PatientInsuranceCoverageSummary> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT COALESCE(type, '') AS type,
  COALESCE(provider, '') AS provider,
  COALESCE(plan_name, '') AS "planName",
  COALESCE(policy_number, '') AS "policyNumber",
  COALESCE(group_number, '') AS "groupNumber",
  COALESCE(relationship, '') AS relationship
FROM insurance_records
WHERE pid = ${pid}
ORDER BY
  CASE lower(COALESCE(type, ''))
    WHEN 'primary' THEN 1
    WHEN 'secondary' THEN 2
    ELSE 3
  END,
  id;
`);

    return {
      patientId: pid,
      insurance: rows.map((row) => ({
        type: row.type,
        provider: row.provider,
        planName: row.planName,
        policyNumber: row.policyNumber,
        groupNumber: row.groupNumber,
        relationship: row.relationship
      }))
    };
  }

  async getPatientDocumentsForPatient(pid: number): Promise<PatientDocumentsSummary> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT id, document_key AS "documentKey", category_id AS "categoryId", category_name AS "categoryName",
  name, doc_date AS "docDate", uploaded_at AS "uploadedAt", COALESCE(mimetype, '') AS mimetype,
  uploaded_at AS "revisionAt",
  COALESCE(size_bytes::text, '0') AS "sizeBytes", COALESCE(pages::text, '0') AS pages,
  COALESCE(encounter::text, '\\N') AS encounter, COALESCE(storage_method, '') AS "storageMethod",
  COALESCE(file_name, name) AS "fileName", COALESCE(url, '') AS url, COALESCE(hash, '') AS hash,
  COALESCE(notes, '') AS notes,
  case
    when content_bytes is not null then left(coalesce(content, ''), 260)
    else left(regexp_replace(coalesce(content, ''), E'[\\r\\n]+', ' ', 'g'), 260)
  end AS "contentPreview"
FROM patient_documents
WHERE pid = ${pid} AND deleted = 0
ORDER BY doc_date DESC, id DESC;
`);

    return {
      patientId: pid,
      documents: rows.map((row) => {
        const document = {
          id: Number(row.id),
          documentKey: row.documentKey,
          categoryId: Number(row.categoryId),
          categoryName: row.categoryName,
          name: row.name,
          docDate: row.docDate,
          uploadedAt: row.uploadedAt,
          revisionAt: row.revisionAt,
          mimetype: row.mimetype,
          sizeBytes: Number(row.sizeBytes),
          pages: Number(row.pages),
          encounter: nullIfDbNull(row.encounter) === null ? null : Number(row.encounter),
          storageMethod: row.storageMethod,
          fileName: row.fileName,
          url: row.url,
          hash: row.hash,
          notes: row.notes,
          contentPreview: row.contentPreview
        };

        return {
          ...document,
          ...buildPatientDocumentRevisionFields(document),
          ...buildPatientDocumentPreviewFields(document)
        };
      })
    };
  }

  async getPatientDocumentContent(documentId: number): Promise<PatientDocumentContentSummary | null> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT id, document_key AS "documentKey", category_id AS "categoryId", category_name AS "categoryName",
  name, doc_date AS "docDate", uploaded_at AS "uploadedAt", COALESCE(mimetype, '') AS mimetype,
  uploaded_at AS "revisionAt",
  COALESCE(size_bytes::text, '0') AS "sizeBytes", COALESCE(pages::text, '0') AS pages,
  COALESCE(encounter::text, '\\N') AS encounter, COALESCE(storage_method, '') AS "storageMethod",
  COALESCE(file_name, name) AS "fileName", COALESCE(url, '') AS url, COALESCE(hash, '') AS hash,
  COALESCE(notes, '') AS notes,
  case
    when content_bytes is not null then left(coalesce(content, ''), 260)
    else left(regexp_replace(coalesce(content, ''), E'[\\r\\n]+', ' ', 'g'), 260)
  end AS "contentPreview",
  case
    when content_bytes is not null then encode(content_bytes, 'hex')
    else encode(convert_to(coalesce(content, ''), 'UTF8'), 'hex')
  end AS "contentHex",
  case when content_bytes is not null then '1' else '0' end AS "isBinary"
FROM patient_documents
WHERE id = ${documentId} AND deleted = 0
LIMIT 1;
`);
    const row = rows[0];
    if (!row) {
      return null;
    }

    const document = {
      id: Number(row.id),
      documentKey: row.documentKey,
      categoryId: Number(row.categoryId),
      categoryName: row.categoryName,
      name: row.name,
      docDate: row.docDate,
      uploadedAt: row.uploadedAt,
      revisionAt: row.revisionAt,
      mimetype: row.mimetype,
      fileName: row.fileName,
      sizeBytes: Number(row.sizeBytes),
      pages: Number(row.pages),
      encounter: nullIfDbNull(row.encounter) === null ? null : Number(row.encounter),
      storageMethod: row.storageMethod,
      url: row.url,
      hash: row.hash,
      notes: row.notes,
      contentPreview: row.contentPreview,
      content: row.isBinary === "1"
        ? row.contentPreview
        : Buffer.from(row.contentHex, "hex").toString("utf8").replaceAll("\\n", "\n"),
      contentBase64: Buffer.from(row.contentHex, "hex").toString("base64"),
      isBinary: row.isBinary === "1"
    };

    return {
      ...document,
      ...buildPatientDocumentRevisionFields(document),
      ...buildPatientDocumentPreviewFields(document)
    };
  }

  async getBillingLinesForEncounter(pid: number, encounter: number): Promise<BillingLineSummary[]> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT id, encounter, code_type AS "codeType", code, code_text AS "codeText",
  COALESCE(modifier, '') AS modifier, COALESCE(fee::text, '') AS fee, COALESCE(justify, '') AS justify
FROM billing
WHERE pid = ${pid} AND encounter = ${encounter} AND activity = 1
ORDER BY id;
`);
    return rows.map((row) => ({
      id: row.id,
      encounter: Number(row.encounter),
      codeType: row.codeType,
      code: row.code,
      modifier: row.modifier,
      codeText: row.codeText,
      fee: row.fee,
      justify: row.justify
    }));
  }

  async getClaimsForPatient(pid: number): Promise<ClaimStatusSummary[]> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT pid AS "patientId", encounter, version, payer_id AS "payerId",
  COALESCE(payer_name, '') AS "payerName", payer_type AS "payerType", status,
  bill_process AS "billProcess", COALESCE(to_char(bill_time, 'YYYY-MM-DD HH24:MI:SS'), '') AS "billTime",
  COALESCE(to_char(process_time, 'YYYY-MM-DD HH24:MI:SS'), '') AS "processTime",
  COALESCE(process_file, '') AS "processFile", COALESCE(target, '') AS target,
  COALESCE(submitted_claim, '') AS "submittedClaim"
FROM claims
WHERE pid = ${pid}
ORDER BY encounter, version;
`);
    return rows.map((row) => ({
      patientId: Number(row.patientId),
      encounter: Number(row.encounter),
      version: Number(row.version),
      payerId: Number(row.payerId),
      payerName: row.payerName,
      payerType: Number(row.payerType),
      status: Number(row.status),
      statusLabel: claimStatusLabel(Number(row.status), Number(row.billProcess)),
      billProcess: Number(row.billProcess),
      billTime: row.billTime,
      processTime: row.processTime,
      processFile: row.processFile,
      target: row.target,
      submittedClaim: row.submittedClaim
    }));
  }

  async getPaymentPostingsForPatient(pid: number): Promise<PaymentPostingSummary[]> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT pa.pid AS "patientId", pa.encounter, pa.sequence_no AS "sequenceNo",
  COALESCE(pa.code_type, '') AS "codeType", COALESCE(pa.code, '') AS code,
  COALESCE(pa.modifier, '') AS modifier, pa.payer_type AS "payerType", pa.session_id AS "sessionId",
  COALESCE(ps.payer_name, '') AS "payerName", COALESCE(ps.reference, '') AS reference,
  COALESCE(ps.payment_type, '') AS "paymentType", COALESCE(ps.payment_method, '') AS "paymentMethod",
  COALESCE(ps.check_date::text, '') AS "checkDate",
  COALESCE(ps.deposit_date::text, '') AS "depositDate",
  COALESCE(pa.post_date::text, '') AS "postDate",
  COALESCE(to_char(pa.post_time, 'YYYY-MM-DD HH24:MI:SS'), '') AS "postTime",
  COALESCE(pa.pay_amount::text, '') AS "payAmount",
  COALESCE(pa.adj_amount::text, '') AS "adjustmentAmount",
  COALESCE(pa.memo, '') AS memo, COALESCE(pa.account_code, '') AS "accountCode",
  COALESCE(pa.reason_code, '') AS "reasonCode", COALESCE(pa.payer_claim_number, '') AS "payerClaimNumber"
FROM payment_activities pa
INNER JOIN payment_sessions ps ON ps.id = pa.session_id
WHERE pa.pid = ${pid} AND pa.deleted IS NULL
ORDER BY pa.encounter, pa.sequence_no;
`);
    return rows.map((row) => ({
      patientId: Number(row.patientId),
      encounter: Number(row.encounter),
      sequenceNo: Number(row.sequenceNo),
      codeType: row.codeType,
      code: row.code,
      modifier: row.modifier,
      payerType: Number(row.payerType),
      sessionId: Number(row.sessionId),
      payerName: row.payerName,
      reference: row.reference,
      paymentType: row.paymentType,
      paymentMethod: row.paymentMethod,
      checkDate: row.checkDate,
      depositDate: row.depositDate,
      postDate: row.postDate,
      postTime: row.postTime,
      payAmount: row.payAmount,
      adjustmentAmount: row.adjustmentAmount,
      memo: row.memo,
      accountCode: row.accountCode,
      reasonCode: row.reasonCode,
      payerClaimNumber: row.payerClaimNumber
    }));
  }

  async getAccountBalancesForPatient(pid: number): Promise<AccountBalanceSummary[]> {
    const rows = await this.queryRows<Record<string, string>>(`
WITH charges AS (
  SELECT pid, encounter, COUNT(*) AS "lineCount", COALESCE(SUM(fee), 0) AS "chargeAmount"
  FROM billing
  WHERE pid = ${pid} AND activity = 1
  GROUP BY pid, encounter
),
payments AS (
  SELECT pid, encounter, COUNT(*) AS "paymentCount",
    COALESCE(SUM(pay_amount), 0) AS "paymentAmount",
    COALESCE(SUM(adj_amount), 0) AS "adjustmentAmount"
  FROM payment_activities
  WHERE pid = ${pid} AND deleted IS NULL
  GROUP BY pid, encounter
)
SELECT c.pid AS "patientId", c.encounter, c."lineCount", COALESCE(p."paymentCount", 0) AS "paymentCount",
  COALESCE(c."chargeAmount"::text, '0') AS "chargeAmount",
  COALESCE(p."paymentAmount"::text, '0') AS "paymentAmount",
  COALESCE(p."adjustmentAmount"::text, '0') AS "adjustmentAmount",
  COALESCE((c."chargeAmount" - COALESCE(p."paymentAmount", 0) - COALESCE(p."adjustmentAmount", 0))::text, '0') AS "balanceAmount"
FROM charges c
LEFT JOIN payments p ON p.pid = c.pid AND p.encounter = c.encounter
UNION ALL
SELECT p.pid AS "patientId", p.encounter, 0 AS "lineCount", p."paymentCount",
  '0' AS "chargeAmount",
  COALESCE(p."paymentAmount"::text, '0') AS "paymentAmount",
  COALESCE(p."adjustmentAmount"::text, '0') AS "adjustmentAmount",
  COALESCE((0 - p."paymentAmount" - p."adjustmentAmount")::text, '0') AS "balanceAmount"
FROM payments p
LEFT JOIN charges c ON c.pid = p.pid AND c.encounter = p.encounter
WHERE c.encounter IS NULL
ORDER BY encounter;
`);
    return rows.map((row) => ({
      patientId: Number(row.patientId),
      encounter: Number(row.encounter),
      lineCount: Number(row.lineCount),
      paymentCount: Number(row.paymentCount),
      chargeAmount: row.chargeAmount,
      paymentAmount: row.paymentAmount,
      adjustmentAmount: row.adjustmentAmount,
      balanceAmount: row.balanceAmount
    }));
  }

  async getAccountAgingForPatient(pid: number, asOfDate = "2026-06-18"): Promise<AccountAgingSummary[]> {
    const safeAsOfDate = escapeSql(asOfDate);
    const rows = await this.queryRows<Record<string, string>>(`
WITH charges AS (
  SELECT pid, encounter, COUNT(*) AS "lineCount", COALESCE(SUM(fee), 0) AS "chargeAmount",
    MAX(billing_date) AS "lastBillingDate"
  FROM billing
  WHERE pid = ${pid} AND activity = 1
  GROUP BY pid, encounter
),
payments AS (
  SELECT pid, encounter, COUNT(*) AS "paymentCount",
    COALESCE(SUM(pay_amount), 0) AS "paymentAmount",
    COALESCE(SUM(adj_amount), 0) AS "adjustmentAmount"
  FROM payment_activities
  WHERE pid = ${pid} AND deleted IS NULL
  GROUP BY pid, encounter
),
aged AS (
  SELECT c.pid AS "patientId", c.encounter, c."lineCount", COALESCE(p."paymentCount", 0) AS "paymentCount",
    c."lastBillingDate"::text AS "lastBillingDate",
    GREATEST(('${safeAsOfDate}'::date - c."lastBillingDate")::int, 0) AS "ageDays",
    c."chargeAmount" - COALESCE(p."paymentAmount", 0) - COALESCE(p."adjustmentAmount", 0) AS "balanceAmount"
  FROM charges c
  LEFT JOIN payments p ON p.pid = c.pid AND p.encounter = c.encounter
  UNION ALL
  SELECT p.pid AS "patientId", p.encounter, 0 AS "lineCount", p."paymentCount",
    '${safeAsOfDate}' AS "lastBillingDate", 0 AS "ageDays",
    0 - p."paymentAmount" - p."adjustmentAmount" AS "balanceAmount"
  FROM payments p
  LEFT JOIN charges c ON c.pid = p.pid AND c.encounter = p.encounter
  WHERE c.encounter IS NULL
)
SELECT "patientId", encounter, "lastBillingDate", "ageDays", "lineCount", "paymentCount",
  COALESCE("balanceAmount"::text, '0') AS "balanceAmount",
  CASE
    WHEN "ageDays" <= 30 THEN 'Current'
    WHEN "ageDays" <= 60 THEN '31-60'
    WHEN "ageDays" <= 90 THEN '61-90'
    ELSE 'Over 90'
  END AS "agingBucket"
FROM aged
ORDER BY encounter;
`);
    return rows.map((row) => ({
      patientId: Number(row.patientId),
      encounter: Number(row.encounter),
      lastBillingDate: row.lastBillingDate,
      ageDays: Number(row.ageDays),
      lineCount: Number(row.lineCount),
      paymentCount: Number(row.paymentCount),
      balanceAmount: row.balanceAmount,
      agingBucket: row.agingBucket
    }));
  }

  async getAccountLedgerForPatient(pid: number): Promise<AccountLedgerEntry[]> {
    const rows = await this.queryRows<Record<string, string>>(`
WITH entries AS (
  SELECT b.pid AS "patientId", b.billing_date AS "entryDate", b.encounter,
    'Charge' AS "entryType", COALESCE(b.code_text, '') AS description,
    COALESCE(b.code, '') AS code, b.id::text AS reference,
    b.fee AS amount, 0 AS priority
  FROM billing b
  WHERE b.pid = ${pid} AND b.activity = 1 AND COALESCE(b.fee, 0) <> 0
  UNION ALL
  SELECT pa.pid AS "patientId", pa.post_date AS "entryDate", pa.encounter,
    'Payment' AS "entryType", COALESCE(pa.memo, '') AS description,
    COALESCE(pa.code, '') AS code, COALESCE(ps.reference, pa.session_id::text) AS reference,
    -pa.pay_amount AS amount, 1 AS priority
  FROM payment_activities pa
  INNER JOIN payment_sessions ps ON ps.id = pa.session_id
  WHERE pa.pid = ${pid} AND pa.deleted IS NULL AND pa.pay_amount <> 0
  UNION ALL
  SELECT pa.pid AS "patientId", pa.post_date AS "entryDate", pa.encounter,
    'Adjustment' AS "entryType", COALESCE(pa.memo, '') AS description,
    COALESCE(pa.code, '') AS code, COALESCE(ps.reference, pa.session_id::text) AS reference,
    -pa.adj_amount AS amount, 2 AS priority
  FROM payment_activities pa
  INNER JOIN payment_sessions ps ON ps.id = pa.session_id
  WHERE pa.pid = ${pid} AND pa.deleted IS NULL AND pa.adj_amount <> 0
)
SELECT "patientId", "entryDate", encounter, "entryType", description, code, reference,
  COALESCE(amount::text, '0') AS amount
FROM entries
ORDER BY "entryDate", encounter, priority, code, description, reference;
`);
    return buildAccountLedgerEntries(rows);
  }

  async getPatientStatementForPatient(pid: number): Promise<PatientStatementSummary | null> {
    const patientRows = await this.queryRows<Record<string, string>>(`
SELECT legacy_pid AS "patientId", first_name AS "firstName", last_name AS "lastName",
  COALESCE(street, '') AS street, COALESCE(city, '') AS city, COALESCE(state, '') AS state,
  COALESCE(postal_code, '') AS "postalCode", COALESCE(email, '') AS email,
  COALESCE(NULLIF(phone_home, ''), NULLIF(phone, ''), NULLIF(phone_cell, ''), '') AS phone
FROM patients
WHERE legacy_pid = ${pid}
LIMIT 1;
`);
    const patient = patientRows[0];
    if (!patient) {
      return null;
    }

    return buildPatientStatementSummary({
      patient,
      balances: await this.getAccountBalancesForPatient(pid),
      aging: await this.getAccountAgingForPatient(pid),
      ledger: await this.getAccountLedgerForPatient(pid)
    });
  }

  async getAdministrationDirectory(): Promise<AdministrationDirectorySummary> {
    const users = await this.queryRows<Record<string, string>>(`
SELECT s.id, s.username, s.first_name AS "firstName", s.last_name AS "lastName",
  s.role, CASE WHEN s.role = 'provider' THEN '1' ELSE '0' END AS authorized,
  CASE WHEN s.active THEN '1' ELSE '0' END AS active,
  CASE WHEN s.calendar THEN '1' ELSE '0' END AS calendar,
  COALESCE(s.facility_id::text, '0') AS "facilityId",
  COALESCE(f.name, '') AS "facilityName",
  COALESCE(s.email, '') AS email,
  COALESCE(s.npi, '') AS npi
FROM staff s
LEFT JOIN facilities f ON f.id = s.facility_id
ORDER BY s.id;
`);

    const facilities = await this.queryRows<Record<string, string>>(`
SELECT id, code, name, COALESCE(phone, '') AS phone,
  COALESCE(street, '') AS street, COALESCE(city, '') AS city, COALESCE(state, '') AS state,
  COALESCE(postal_code, '') AS "postalCode", COALESCE(color, '') AS color,
  CASE WHEN inactive THEN '0' ELSE '1' END AS active
FROM facilities
ORDER BY id;
`);

    return {
      users: users.map((row): AdministrationUserSummary => ({
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
      facilities: facilities.map((row): AdministrationFacilitySummary => ({
        id: Number(row.id),
        code: row.code,
        name: row.name,
        active: row.active === "1",
        phone: row.phone,
        street: row.street,
        city: row.city,
        state: row.state,
        postalCode: row.postalCode,
        color: row.color
      }))
    };
  }

  async getAdministrationAccessControl(): Promise<AdministrationAccessControlSummary> {
    const groups = await this.queryRows<Record<string, string>>(`
SELECT g.id, g.value, g.name, COALESCE(g.parent_id::text, '\\N') AS "parentId", COUNT(gp.*) AS "permissionCount"
FROM access_groups g
LEFT JOIN access_group_permissions gp ON gp.group_value = g.value
GROUP BY g.id, g.value, g.name, g.parent_id
ORDER BY g.id;
`);

    const permissions = await this.queryRows<Record<string, string>>(`
SELECT section_value AS "sectionValue", value, name
FROM access_permissions
ORDER BY section_value, value;
`);

    const groupPermissions = await this.queryRows<Record<string, string>>(`
SELECT group_value AS "groupValue", section_value AS "sectionValue", permission_value AS "permissionValue",
  permission_name AS "permissionName", return_value AS "returnValue"
FROM access_group_permissions
ORDER BY group_value, section_value, permission_value, return_value;
`);

    const userMemberships = await this.queryRows<Record<string, string>>(`
SELECT user_value AS "userValue", user_name AS "userName", group_value AS "groupValue", group_name AS "groupName",
  COALESCE(staff_id::text, '\\N') AS "staffId"
FROM access_user_memberships
ORDER BY group_value, user_value;
`);

    return {
      groups: groups.map((row): AdministrationAccessGroupSummary => ({
        id: Number(row.id),
        value: row.value,
        name: row.name,
        parentId: nullIfDbNull(row.parentId) === null ? null : Number(row.parentId),
        permissionCount: Number(row.permissionCount)
      })),
      permissions: permissions.map((row): AdministrationAccessPermissionSummary => ({
        sectionValue: row.sectionValue,
        value: row.value,
        name: row.name
      })),
      groupPermissions: groupPermissions.map((row): AdministrationAccessGroupPermissionSummary => ({
        groupValue: row.groupValue,
        sectionValue: row.sectionValue,
        permissionValue: row.permissionValue,
        permissionName: row.permissionName,
        returnValue: row.returnValue
      })),
      userMemberships: userMemberships.map((row): AdministrationAccessUserMembershipSummary => ({
        userValue: row.userValue,
        userName: row.userName,
        groupValue: row.groupValue,
        groupName: row.groupName,
        staffId: nullIfDbNull(row.staffId) === null ? null : Number(row.staffId)
      }))
    };
  }

  async getOperationalReports(): Promise<OperationalReportsSummary> {
    const metadataRows = await this.queryRows<Record<string, string>>(`
SELECT base_date AS "baseDate"
FROM dataset_metadata
ORDER BY generated_at DESC
LIMIT 1;
`);
    const asOfDate = metadataRows[0]?.baseDate ?? "2026-06-18";
    const currentYear = Number(asOfDate.slice(0, 4));
    const yearStart = `${currentYear}-01-01`;
    const nextYear = `${currentYear + 1}-01-01`;

    const countRows = await this.queryRows<{ name: string; value: string }>(`
SELECT 'patients' AS name, COUNT(*) AS value FROM patients
UNION ALL SELECT 'portalPatients', COUNT(*) FROM patients WHERE portal_enabled
UNION ALL SELECT 'appointments', COUNT(*) FROM appointments
UNION ALL SELECT 'futureAppointments', COUNT(*) FROM appointments WHERE appointment_date > '${asOfDate}'
UNION ALL SELECT 'currentYearAppointments', COUNT(*) FROM appointments WHERE appointment_date >= '${yearStart}' AND appointment_date < '${nextYear}'
UNION ALL SELECT 'encounters', COUNT(*) FROM encounters
UNION ALL SELECT 'currentYearEncounters', COUNT(*) FROM encounters WHERE encounter_date >= '${yearStart}' AND encounter_date < '${nextYear}'
UNION ALL SELECT 'billingLines', COUNT(*) FROM billing
UNION ALL SELECT 'billingTotal', COALESCE(SUM(fee), 0) FROM billing
UNION ALL SELECT 'labReports', COUNT(*) FROM lab_reports
UNION ALL SELECT 'patientDocuments', COUNT(*) FROM patient_documents WHERE deleted = 0
UNION ALL SELECT 'messages', COUNT(*) FROM messages
UNION ALL SELECT 'newMessages', COUNT(*) FROM messages WHERE status = 'New'
UNION ALL SELECT 'doneMessages', COUNT(*) FROM messages WHERE status = 'Done'
UNION ALL SELECT 'facilities', COUNT(*) FROM facilities
UNION ALL SELECT 'providers', COUNT(*) FROM staff WHERE role = 'provider';
`);
    const countMap = Object.fromEntries(countRows.map((row) => [row.name, Number(row.value)]));

    const providerRows = await this.queryRows<Record<string, string>>(`
WITH provider_encounters AS (
  SELECT provider_id, COUNT(*) AS encounters
  FROM encounters
  GROUP BY provider_id
),
provider_billing AS (
  SELECT provider_id, COUNT(*) AS "billingLines", COALESCE(SUM(fee), 0) AS "billingTotal"
  FROM billing
  GROUP BY provider_id
)
SELECT s.username, s.first_name AS "firstName", s.last_name AS "lastName",
  COALESCE(pe.encounters, 0) AS encounters,
  COALESCE(pb."billingLines", 0) AS "billingLines",
  COALESCE(pb."billingTotal", 0) AS "billingTotal"
FROM staff s
LEFT JOIN provider_encounters pe ON pe.provider_id = s.id
LEFT JOIN provider_billing pb ON pb.provider_id = s.id
WHERE s.role = 'provider'
ORDER BY encounters DESC, "billingTotal" DESC, s.id
LIMIT 8;
`);

    const facilityRows = await this.queryRows<Record<string, string>>(`
WITH facility_appointments AS (
  SELECT facility_id, COUNT(*) AS appointments
  FROM appointments
  GROUP BY facility_id
),
facility_encounters AS (
  SELECT facility_id, COUNT(*) AS encounters
  FROM encounters
  GROUP BY facility_id
),
facility_billing AS (
  SELECT e.facility_id, COUNT(b.*) AS "billingLines", COALESCE(SUM(b.fee), 0) AS "billingTotal"
  FROM billing b
  INNER JOIN encounters e ON e.encounter = b.encounter
  GROUP BY e.facility_id
)
SELECT f.code, f.name,
  COALESCE(fa.appointments, 0) AS appointments,
  COALESCE(fe.encounters, 0) AS encounters,
  COALESCE(fb."billingLines", 0) AS "billingLines",
  COALESCE(fb."billingTotal", 0) AS "billingTotal"
FROM facilities f
LEFT JOIN facility_appointments fa ON fa.facility_id = f.id
LEFT JOIN facility_encounters fe ON fe.facility_id = f.id
LEFT JOIN facility_billing fb ON fb.facility_id = f.id
ORDER BY f.id;
`);

    const conditionRows = await this.queryRows<Record<string, string>>(`
SELECT title, COALESCE(diagnosis, '') AS diagnosis, COUNT(*) AS patients
FROM problems
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
        patientDocuments: countMap.patientDocuments,
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

  async getOperationalReportExportRows(): Promise<OperationalReportExportRow[]> {
    return buildOperationalReportExportRows(await this.getOperationalReports());
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

  async getFutureScheduledProcedureOrderForPatient(pid: number, afterDate: string): Promise<ProcedureOrderSummary | null> {
    const rows = await this.queryRows<Record<string, string>>(`
SELECT lo.id, lo.pid AS "patientId", lo.encounter AS "encounterId", lo.order_date AS "dateOrdered",
  lo.order_status AS "orderStatus", lo.code AS "procedureCode", lo.name AS "procedureName"
FROM lab_orders lo
LEFT JOIN lab_reports lr ON lr.order_id = lo.id
WHERE lo.pid = ${pid}
  AND lo.order_date > '${escapeSql(afterDate)}'
  AND lo.order_status = 'scheduled'
  AND lr.id IS NULL
ORDER BY lo.order_date, lo.id
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
SELECT id, pid AS "patientId", encounter AS "encounterId", order_date AS "dateOrdered",
  order_status AS "orderStatus", code AS "procedureCode", name AS "procedureName"
FROM lab_orders
WHERE pid = ${pid}
ORDER BY order_date DESC, id DESC;
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
SELECT id, order_id AS "orderId", report_date::date AS "reportDate", COALESCE(status, '') AS status,
  COALESCE(review_status, status, '') AS "reviewStatus"
FROM lab_reports
WHERE order_id IN (${orderIdList})
ORDER BY report_date DESC, id DESC;
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
SELECT id, report_id AS "reportId", COALESCE(code, '') AS code, COALESCE(text, '') AS text,
  COALESCE(units, '') AS units, COALESCE(result, '') AS result, COALESCE(range, '') AS range,
  COALESCE(abnormal, '') AS abnormal, result_date::date AS "resultDate", COALESCE(result_status, '') AS "resultStatus"
FROM lab_results
WHERE report_id IN (${reportIdList})
ORDER BY id;
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
          range: row.range,
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

function claimStatusLabel(status: number, billProcess: number) {
  if (billProcess !== 0) {
    return "Queued for billing";
  }

  if (status === 1) return "Re-opened";
  if (status === 2 || status === 3) return "Marked as cleared";
  if (status === 4) return "Closed";
  if (status === 5) return "Canceled";
  if (status === 6) return "Forwarded";
  if (status === 7) return "Denied";
  return "Unsubmitted";
}

function escapeSql(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "''");
}
