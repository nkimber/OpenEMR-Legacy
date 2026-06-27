import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedClinicalLists } from "../../src/ui/modernizedOpenEmr.js";

const medicationDuplicateAnchorPatientId = "MOD-PAT-0006";
const duplicateMedicationTitle = "Duplicate Safety Medication 578";
const duplicateMedicationDiagnosis = "ICD10:Z00.00";

type QueryableDb = {
  queryRows<T extends Record<string, string>>(sql: string): Promise<T[]>;
};

type MedicationDuplicateRow = {
  normalizedTitle: string;
  displayTitle: string;
  activeCount: string;
  medicationIds: string;
  firstDate: string;
  latestDate: string;
  diagnoses: string;
};

type MedicationDuplicateSummary = {
  normalizedTitle: string;
  displayTitle: string;
  activeCount: number;
  medicationIds: string[];
  firstDate: string;
  latestDate: string;
  diagnoses: string[];
};

test.describe("medication duplicate detection parity @slice578 @workflow-medication-duplicate-detection @clinical-lists @medications", () => {
  test("surfaces active duplicate medication-list safety evidence", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(medicationDuplicateAnchorPatientId);
    expect(patient).not.toBeNull();
    const createdMedicationIds: Array<number | string> = [];

    try {
      createdMedicationIds.push(await workflow.createMedication({
        patientId: patient!.pid,
        title: duplicateMedicationTitle,
        dateTime: "2026-08-03 09:00:00",
        diagnosis: duplicateMedicationDiagnosis,
        comments: "First temporary duplicate medication for Slice 578."
      }));
      createdMedicationIds.push(await workflow.createMedication({
        patientId: patient!.pid,
        title: `  ${duplicateMedicationTitle.toUpperCase()}  `,
        dateTime: "2026-08-04 09:00:00",
        diagnosis: duplicateMedicationDiagnosis,
        comments: "Second temporary duplicate medication for Slice 578."
      }));

      const duplicateRows = await queryDuplicateMedicationRows(
        target.type,
        targetDb as QueryableDb,
        patient!.pid,
        duplicateMedicationTitle
      );
      expect(duplicateRows).toHaveLength(1);
      const expectedDuplicate = normalizeDuplicateRow(duplicateRows[0]);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-578-medication-duplicate-detection-source",
        description:
          "Captures the Slice 578 duplicate medication-list source facts after creating two active rows with the same normalized medication title.",
        expected: {
          canonicalId: medicationDuplicateAnchorPatientId,
          normalizedTitle: normalizeMedicationTitle(duplicateMedicationTitle),
          activeCount: 2,
          diagnosis: duplicateMedicationDiagnosis,
          firstDate: "2026-08-03",
          latestDate: "2026-08-04"
        },
        actual: expectedDuplicate,
        context: {
          canonicalId: medicationDuplicateAnchorPatientId,
          suite: "workflow-medication-duplicate-detection",
          workflow: "medication-duplicate-detection"
        }
      });

      if (target.type === "legacy-openemr") {
        return;
      }

      const headers = await getModernizedAdminSessionHeaders(page, target);
      const response = await page.request.get(
        `${target.apiBaseUrl}/api/clinical-lists/${encodeURIComponent(patient!.pubpid)}`,
        { headers }
      );
      expect(response.ok()).toBeTruthy();
      const clinicalLists = await response.json() as { medicationDuplicates: unknown[] };
      const duplicate = clinicalLists.medicationDuplicates
        .map(normalizeApiDuplicate)
        .find((item) => item.normalizedTitle === expectedDuplicate.normalizedTitle);
      expect(duplicate).toEqual(expectedDuplicate);

      await openAuthenticatedModernizedClinicalLists(page, target, patient!.pubpid);
      const duplicatePanel = page.getByLabel("Medication duplicate summary");
      await expect(duplicatePanel).toContainText("Duplicate groups");
      await expect(duplicatePanel).toContainText(expectedDuplicate.displayTitle.trim());
      await expect(duplicatePanel).toContainText(`${expectedDuplicate.activeCount} active entries`);
      await expect(duplicatePanel).toContainText(expectedDuplicate.firstDate);
      await expect(duplicatePanel).toContainText(expectedDuplicate.latestDate);
      await expect(duplicatePanel).toContainText(duplicateMedicationDiagnosis);
    } finally {
      for (const medicationId of createdMedicationIds.reverse()) {
        await workflow.deleteMedication(medicationId);
      }
    }
  });
});

async function queryDuplicateMedicationRows(
  targetType: string,
  db: QueryableDb,
  pid: number,
  title: string
) {
  if (targetType === "legacy-openemr") {
    return db.queryRows<MedicationDuplicateRow>(`
SELECT
  UPPER(TRIM(REGEXP_REPLACE(title, '[[:space:]]+', ' '))) AS normalizedTitle,
  MIN(TRIM(title)) AS displayTitle,
  CAST(COUNT(*) AS CHAR) AS activeCount,
  GROUP_CONCAT(CAST(id AS CHAR) ORDER BY DATE(date), id SEPARATOR ',') AS medicationIds,
  DATE(MIN(date)) AS firstDate,
  DATE(MAX(date)) AS latestDate,
  GROUP_CONCAT(DISTINCT COALESCE(diagnosis, '') ORDER BY COALESCE(diagnosis, '') SEPARATOR ',') AS diagnoses
FROM lists
WHERE pid = ${integer(pid)}
  AND type = 'medication'
  AND activity = 1
  AND UPPER(TRIM(REGEXP_REPLACE(title, '[[:space:]]+', ' '))) = ${sqlString(normalizeMedicationTitle(title))}
GROUP BY normalizedTitle
HAVING COUNT(*) > 1;
`);
  }

  return db.queryRows<MedicationDuplicateRow>(`
SELECT
  upper(trim(regexp_replace(title, '\\s+', ' ', 'g'))) AS "normalizedTitle",
  min(trim(title)) AS "displayTitle",
  count(*)::text AS "activeCount",
  string_agg(id, ',' ORDER BY medication_date, id) AS "medicationIds",
  min(medication_date)::text AS "firstDate",
  max(medication_date)::text AS "latestDate",
  string_agg(DISTINCT COALESCE(diagnosis, ''), ',' ORDER BY COALESCE(diagnosis, '')) AS diagnoses
FROM medications
WHERE pid = ${integer(pid)}
  AND activity = 1
  AND upper(trim(regexp_replace(title, '\\s+', ' ', 'g'))) = ${sqlString(normalizeMedicationTitle(title))}
GROUP BY "normalizedTitle"
HAVING count(*) > 1;
`);
}

function normalizeDuplicateRow(row: MedicationDuplicateRow): MedicationDuplicateSummary {
  return {
    normalizedTitle: row.normalizedTitle,
    displayTitle: row.displayTitle,
    activeCount: Number(row.activeCount),
    medicationIds: row.medicationIds.split(",").filter(Boolean),
    firstDate: row.firstDate,
    latestDate: row.latestDate,
    diagnoses: row.diagnoses.split(",").filter(Boolean)
  };
}

function normalizeApiDuplicate(raw: unknown): MedicationDuplicateSummary {
  const value = raw as Record<string, unknown>;
  return {
    normalizedTitle: String(value.normalizedTitle),
    displayTitle: String(value.displayTitle),
    activeCount: Number(value.activeCount),
    medicationIds: Array.isArray(value.medicationIds) ? value.medicationIds.map(String) : [],
    firstDate: String(value.firstDate ?? ""),
    latestDate: String(value.latestDate ?? ""),
    diagnoses: Array.isArray(value.diagnoses) ? value.diagnoses.map(String) : []
  };
}

function normalizeMedicationTitle(title: string) {
  return title.trim().replace(/\s+/g, " ").toUpperCase();
}

function integer(value: number) {
  return Math.trunc(value).toString();
}

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}
