import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedClinicalLists } from "../../src/ui/modernizedOpenEmr.js";

const medicationReconciliationAnchorPatientId = "MOD-PAT-0008";
const reconciliationDiagnosis = "ICD10:Z79.899";

type QueryableDb = {
  queryRows<T extends Record<string, string>>(sql: string): Promise<T[]>;
};

type MedicationReconciliationSourceRow = {
  source: "medication" | "prescription";
  normalizedTitle: string;
  displayTitle: string;
  sourceId: string;
  diagnosis: string;
};

type MedicationReconciliationSummary = {
  normalizedTitle: string;
  displayTitle: string;
  status: string;
  medicationCount: number;
  prescriptionCount: number;
  medicationIds: string[];
  prescriptionIds: string[];
  medicationTitles: string[];
  prescriptionDrugs: string[];
  diagnoses: string[];
};

test.describe("medication reconciliation parity @slice588 @workflow-medication-reconciliation @clinical-lists @medications @prescriptions", () => {
  test("surfaces matched, medication-list-only, and prescription-only reconciliation evidence", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(medicationReconciliationAnchorPatientId);
    expect(patient).not.toBeNull();

    const createdMedicationIds: Array<number | string> = [];
    const createdPrescriptionIds: Array<number | string> = [];
    const suffix = workflowSuffix();
    const matchedTitle = `Medication Reconciliation Match ${suffix}`;
    const medicationOnlyTitle = `Medication Reconciliation List Only ${suffix}`;
    const prescriptionOnlyDrug = `Medication Reconciliation Rx Only ${suffix}`;
    const normalizedTitles = [
      normalizeMedicationTitle(matchedTitle),
      normalizeMedicationTitle(medicationOnlyTitle),
      normalizeMedicationTitle(prescriptionOnlyDrug)
    ];

    try {
      createdMedicationIds.push(await workflow.createMedication({
        patientId: patient!.pid,
        title: matchedTitle,
        dateTime: "2026-08-16 09:00:00",
        diagnosis: reconciliationDiagnosis,
        comments: "Temporary matched medication-list row for Slice 588."
      }));
      createdMedicationIds.push(await workflow.createMedication({
        patientId: patient!.pid,
        title: medicationOnlyTitle,
        dateTime: "2026-08-16 09:15:00",
        diagnosis: reconciliationDiagnosis,
        comments: "Temporary medication-list-only row for Slice 588."
      }));
      createdPrescriptionIds.push(await workflow.createPrescription({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        startDate: "2026-08-16",
        drug: matchedTitle,
        rxNormCode: "slice-588-matched",
        dosage: "1 tablet",
        quantity: "30",
        doseAmount: 1,
        doseUnit: "tablet",
        frequency: "once daily",
        durationDays: 30,
        refills: 0,
        note: "Temporary matched prescription for Slice 588.",
        diagnosis: reconciliationDiagnosis
      }));
      createdPrescriptionIds.push(await workflow.createPrescription({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        startDate: "2026-08-16",
        drug: prescriptionOnlyDrug,
        rxNormCode: "slice-588-rx-only",
        dosage: "1 tablet",
        quantity: "30",
        doseAmount: 1,
        doseUnit: "tablet",
        frequency: "once daily",
        durationDays: 30,
        refills: 0,
        note: "Temporary prescription-only row for Slice 588.",
        diagnosis: reconciliationDiagnosis
      }));

      const sourceRows = await queryMedicationReconciliationRows(
        target.type,
        targetDb as QueryableDb,
        patient!.pid,
        normalizedTitles
      );
      const expectedReconciliations = buildExpectedReconciliations(sourceRows);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-588-medication-reconciliation-source",
        description:
          "Captures the Slice 588 active medication-list and prescription source rows used to classify matched, medication-list-only, and prescription-only reconciliation states.",
        expected: {
          canonicalId: medicationReconciliationAnchorPatientId,
          matchedTitle,
          medicationOnlyTitle,
          prescriptionOnlyDrug,
          diagnosis: reconciliationDiagnosis
        },
        actual: {
          createdMedicationIds,
          createdPrescriptionIds,
          sourceRows,
          reconciliations: expectedReconciliations
        },
        context: {
          canonicalId: medicationReconciliationAnchorPatientId,
          suite: "workflow-medication-reconciliation",
          workflow: "medication-reconciliation"
        }
      });

      expect(expectedReconciliations).toEqual([
        {
          normalizedTitle: normalizeMedicationTitle(medicationOnlyTitle),
          displayTitle: medicationOnlyTitle,
          status: "medication-list-only",
          medicationCount: 1,
          prescriptionCount: 0,
          medicationIds: [String(createdMedicationIds[1])],
          prescriptionIds: [],
          medicationTitles: [medicationOnlyTitle],
          prescriptionDrugs: [],
          diagnoses: [reconciliationDiagnosis]
        },
        {
          normalizedTitle: normalizeMedicationTitle(matchedTitle),
          displayTitle: matchedTitle,
          status: "matched",
          medicationCount: 1,
          prescriptionCount: 1,
          medicationIds: [String(createdMedicationIds[0])],
          prescriptionIds: [String(createdPrescriptionIds[0])],
          medicationTitles: [matchedTitle],
          prescriptionDrugs: [matchedTitle],
          diagnoses: [reconciliationDiagnosis]
        },
        {
          normalizedTitle: normalizeMedicationTitle(prescriptionOnlyDrug),
          displayTitle: prescriptionOnlyDrug,
          status: "prescription-only",
          medicationCount: 0,
          prescriptionCount: 1,
          medicationIds: [],
          prescriptionIds: [String(createdPrescriptionIds[1])],
          medicationTitles: [],
          prescriptionDrugs: [prescriptionOnlyDrug],
          diagnoses: [reconciliationDiagnosis]
        }
      ]);

      if (target.type === "legacy-openemr") {
        return;
      }

      const headers = await getModernizedAdminSessionHeaders(page, target);
      const response = await page.request.get(
        `${target.apiBaseUrl}/api/clinical-lists/${encodeURIComponent(patient!.pubpid)}`,
        { headers }
      );
      expect(response.ok()).toBeTruthy();
      const clinicalLists = await response.json() as { medicationReconciliations: unknown[] };
      const apiReconciliations = clinicalLists.medicationReconciliations
        .map(normalizeApiReconciliation)
        .filter((item) => normalizedTitles.includes(item.normalizedTitle));
      expect(apiReconciliations).toEqual(expectedReconciliations);

      await openAuthenticatedModernizedClinicalLists(page, target, patient!.pubpid);
      const reconciliationPanel = page.getByLabel("Medication reconciliation summary");
      await expect(reconciliationPanel).toContainText("Reconciliation rows");
      await expect(reconciliationPanel).toContainText(matchedTitle);
      await expect(reconciliationPanel).toContainText("Matched active prescription");
      await expect(reconciliationPanel).toContainText(medicationOnlyTitle);
      await expect(reconciliationPanel).toContainText("Medication-list only");
      await expect(reconciliationPanel).toContainText(prescriptionOnlyDrug);
      await expect(reconciliationPanel).toContainText("Prescription without medication-list row");
      await expect(reconciliationPanel).toContainText(reconciliationDiagnosis);
    } finally {
      for (const prescriptionId of createdPrescriptionIds.reverse()) {
        await workflow.deletePrescription(prescriptionId);
      }

      for (const medicationId of createdMedicationIds.reverse()) {
        await workflow.deleteMedication(medicationId);
      }
    }
  });
});

async function queryMedicationReconciliationRows(
  targetType: string,
  db: QueryableDb,
  pid: number,
  normalizedTitles: string[]
) {
  const titleList = normalizedTitles.map(sqlString).join(", ");
  if (targetType === "legacy-openemr") {
    return db.queryRows<MedicationReconciliationSourceRow>(`
SELECT
  'medication' AS source,
  UPPER(TRIM(REGEXP_REPLACE(title, '[[:space:]]+', ' '))) AS normalizedTitle,
  TRIM(title) AS displayTitle,
  CAST(id AS CHAR) AS sourceId,
  COALESCE(diagnosis, '') AS diagnosis
FROM lists
WHERE pid = ${integer(pid)}
  AND type = 'medication'
  AND activity = 1
  AND UPPER(TRIM(REGEXP_REPLACE(title, '[[:space:]]+', ' '))) IN (${titleList})
UNION ALL
SELECT
  'prescription' AS source,
  UPPER(TRIM(REGEXP_REPLACE(drug, '[[:space:]]+', ' '))) AS normalizedTitle,
  TRIM(drug) AS displayTitle,
  CAST(id AS CHAR) AS sourceId,
  COALESCE(diagnosis, '') AS diagnosis
FROM prescriptions
WHERE patient_id = ${integer(pid)}
  AND active = 1
  AND UPPER(TRIM(REGEXP_REPLACE(drug, '[[:space:]]+', ' '))) IN (${titleList})
ORDER BY normalizedTitle, source, displayTitle, sourceId;
`);
  }

  return db.queryRows<MedicationReconciliationSourceRow>(`
SELECT
  'medication' AS source,
  upper(trim(regexp_replace(title, '\\s+', ' ', 'g'))) AS "normalizedTitle",
  trim(title) AS "displayTitle",
  id AS "sourceId",
  COALESCE(diagnosis, '') AS diagnosis
FROM medications
WHERE pid = ${integer(pid)}
  AND activity = 1
  AND upper(trim(regexp_replace(title, '\\s+', ' ', 'g'))) IN (${titleList})
UNION ALL
SELECT
  'prescription' AS source,
  upper(trim(regexp_replace(drug, '\\s+', ' ', 'g'))) AS "normalizedTitle",
  trim(drug) AS "displayTitle",
  id AS "sourceId",
  COALESCE(diagnosis, '') AS diagnosis
FROM prescriptions
WHERE pid = ${integer(pid)}
  AND active = 1
  AND upper(trim(regexp_replace(drug, '\\s+', ' ', 'g'))) IN (${titleList})
ORDER BY "normalizedTitle", source, "displayTitle", "sourceId";
`);
}

function buildExpectedReconciliations(rows: MedicationReconciliationSourceRow[]): MedicationReconciliationSummary[] {
  const groups = new Map<string, MedicationReconciliationSourceRow[]>();
  for (const row of rows) {
    const group = groups.get(row.normalizedTitle) ?? [];
    group.push(row);
    groups.set(row.normalizedTitle, group);
  }

  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([normalizedTitle, group]) => {
      const medicationRows = group.filter((row) => row.source === "medication");
      const prescriptionRows = group.filter((row) => row.source === "prescription");
      const displayTitle = group.map((row) => row.displayTitle).sort((left, right) => left.localeCompare(right))[0];
      const diagnoses = Array.from(new Set(group.map((row) => row.diagnosis).filter(Boolean))).sort((left, right) => left.localeCompare(right));
      return {
        normalizedTitle,
        displayTitle,
        status: medicationRows.length > 0 && prescriptionRows.length > 0
          ? "matched"
          : medicationRows.length > 0
            ? "medication-list-only"
            : "prescription-only",
        medicationCount: medicationRows.length,
        prescriptionCount: prescriptionRows.length,
        medicationIds: medicationRows.map((row) => row.sourceId),
        prescriptionIds: prescriptionRows.map((row) => row.sourceId),
        medicationTitles: medicationRows.map((row) => row.displayTitle),
        prescriptionDrugs: prescriptionRows.map((row) => row.displayTitle),
        diagnoses
      };
    });
}

function normalizeApiReconciliation(raw: unknown): MedicationReconciliationSummary {
  const value = raw as Record<string, unknown>;
  return {
    normalizedTitle: String(value.normalizedTitle),
    displayTitle: String(value.displayTitle),
    status: String(value.status),
    medicationCount: Number(value.medicationCount),
    prescriptionCount: Number(value.prescriptionCount),
    medicationIds: Array.isArray(value.medicationIds) ? value.medicationIds.map(String) : [],
    prescriptionIds: Array.isArray(value.prescriptionIds) ? value.prescriptionIds.map(String) : [],
    medicationTitles: Array.isArray(value.medicationTitles) ? value.medicationTitles.map(String) : [],
    prescriptionDrugs: Array.isArray(value.prescriptionDrugs) ? value.prescriptionDrugs.map(String) : [],
    diagnoses: Array.isArray(value.diagnoses) ? value.diagnoses.map(String) : []
  };
}

function normalizeMedicationTitle(title: string) {
  return title.trim().replace(/\s+/g, " ").toUpperCase();
}

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function integer(value: number) {
  return Math.trunc(value).toString();
}

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}
