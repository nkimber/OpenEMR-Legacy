import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedClinicalLists } from "../../src/ui/modernizedOpenEmr.js";

const diagnosisInteractionAnchorPatientId = "MOD-PAT-0008";
const matchedDiagnosis = "ICD10:Z58.6";
const unmatchedDiagnosis = "ICD10:Z76.89";
const problemTitle = "Temporary social determinant problem 587";

type QueryableDb = {
  queryRows<T extends Record<string, string>>(sql: string): Promise<T[]>;
};

type DiagnosisInteractionRow = {
  diagnosis: string;
  status: string;
  problemTitle: string;
  prescriptionCount: string;
  drugs: string;
};

type DiagnosisInteractionSummary = {
  diagnosis: string;
  status: string;
  problemTitle: string | null;
  prescriptionCount: number;
  drugs: string[];
};

test.describe("prescription diagnosis interaction parity @slice587 @workflow-prescription-diagnosis-interactions @clinical-lists @prescriptions", () => {
  test("surfaces matched and unmatched active prescription diagnosis evidence", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(diagnosisInteractionAnchorPatientId);
    expect(patient).not.toBeNull();

    const createdPrescriptionIds: Array<number | string> = [];
    let problemId: number | string | null = null;
    const matchedDrug = `Diagnosis Matched Prescription ${workflowSuffix()}`;
    const unmatchedDrug = `Diagnosis Unmatched Prescription ${workflowSuffix()}`;

    try {
      problemId = await workflow.createProblem({
        patientId: patient!.pid,
        title: problemTitle,
        dateTime: "2026-08-05 09:00:00",
        diagnosis: matchedDiagnosis,
        comments: "Temporary active problem for Slice 587 prescription diagnosis interaction readiness."
      });

      createdPrescriptionIds.push(await workflow.createPrescription({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        startDate: "2026-08-13",
        drug: matchedDrug,
        rxNormCode: "slice-587-matched",
        dosage: "1 tablet",
        quantity: "30",
        doseAmount: 1,
        doseUnit: "tablet",
        frequency: "once daily",
        durationDays: 30,
        refills: 0,
        note: "Created by the Slice 587 diagnosis interaction suite.",
        diagnosis: matchedDiagnosis
      }));
      createdPrescriptionIds.push(await workflow.createPrescription({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        startDate: "2026-08-13",
        drug: unmatchedDrug,
        rxNormCode: "slice-587-unmatched",
        dosage: "1 tablet",
        quantity: "30",
        doseAmount: 1,
        doseUnit: "tablet",
        frequency: "once daily",
        durationDays: 30,
        refills: 0,
        note: "Created by the Slice 587 diagnosis interaction suite.",
        diagnosis: unmatchedDiagnosis
      }));

      const sourceRows = await queryDiagnosisInteractionRows(
        target.type,
        targetDb as QueryableDb,
        patient!.pid,
        [matchedDiagnosis, unmatchedDiagnosis]
      );
      const expectedInteractions = sourceRows.map(normalizeSourceInteraction);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-587-prescription-diagnosis-interactions-source",
        description:
          "Captures the Slice 587 active prescription diagnosis interaction facts, including one diagnosis linked to an active problem and one unmatched prescription diagnosis.",
        expected: {
          canonicalId: diagnosisInteractionAnchorPatientId,
          matchedDiagnosis,
          unmatchedDiagnosis,
          matchedDrug,
          unmatchedDrug,
          problemTitle
        },
        actual: {
          problemId,
          createdPrescriptionIds,
          interactions: expectedInteractions
        },
        context: {
          canonicalId: diagnosisInteractionAnchorPatientId,
          suite: "workflow-prescription-diagnosis-interactions",
          workflow: "prescription-diagnosis-interactions"
        }
      });

      expect(expectedInteractions).toEqual([
        {
          diagnosis: matchedDiagnosis,
          status: "matched-active-problem",
          problemTitle,
          prescriptionCount: 1,
          drugs: [matchedDrug]
        },
        {
          diagnosis: unmatchedDiagnosis,
          status: "unmatched",
          problemTitle: null,
          prescriptionCount: 1,
          drugs: [unmatchedDrug]
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
      const clinicalLists = await response.json() as { prescriptionDiagnosisInteractions: unknown[] };
      const apiInteractions = clinicalLists.prescriptionDiagnosisInteractions
        .map(normalizeApiInteraction)
        .filter((interaction) => [matchedDiagnosis, unmatchedDiagnosis].includes(interaction.diagnosis));
      expect(apiInteractions).toEqual(expectedInteractions);

      await openAuthenticatedModernizedClinicalLists(page, target, patient!.pubpid);
      const interactionPanel = page.getByLabel("Prescription diagnosis interaction summary");
      await expect(interactionPanel).toContainText("Diagnosis links");
      await expect(interactionPanel).toContainText(matchedDiagnosis);
      await expect(interactionPanel).toContainText("Matched active problem");
      await expect(interactionPanel).toContainText(problemTitle);
      await expect(interactionPanel).toContainText(matchedDrug);
      await expect(interactionPanel).toContainText(unmatchedDiagnosis);
      await expect(interactionPanel).toContainText("No active problem match");
      await expect(interactionPanel).toContainText(unmatchedDrug);
    } finally {
      for (const prescriptionId of createdPrescriptionIds.reverse()) {
        await workflow.deletePrescription(prescriptionId);
      }

      if (problemId !== null) {
        await workflow.deleteProblem(problemId);
      }
    }
  });
});

async function queryDiagnosisInteractionRows(
  targetType: string,
  db: QueryableDb,
  pid: number,
  diagnoses: string[]
) {
  const diagnosisList = diagnoses.map(sqlString).join(", ");
  if (targetType === "legacy-openemr") {
    return db.queryRows<DiagnosisInteractionRow>(`
SELECT
  UPPER(TRIM(p.diagnosis)) AS diagnosis,
  CASE WHEN MAX(l.id) IS NULL THEN 'unmatched' ELSE 'matched-active-problem' END AS status,
  COALESCE(MAX(l.title), '') AS problemTitle,
  CAST(COUNT(DISTINCT p.id) AS CHAR) AS prescriptionCount,
  GROUP_CONCAT(DISTINCT p.drug ORDER BY p.drug SEPARATOR ',') AS drugs
FROM prescriptions p
LEFT JOIN lists l
  ON l.pid = p.patient_id
 AND l.type = 'medical_problem'
 AND l.activity = 1
 AND UPPER(TRIM(l.diagnosis)) = UPPER(TRIM(p.diagnosis))
WHERE p.patient_id = ${integer(pid)}
  AND p.active = 1
  AND UPPER(TRIM(p.diagnosis)) IN (${diagnosisList})
GROUP BY UPPER(TRIM(p.diagnosis))
ORDER BY diagnosis;
`);
  }

  return db.queryRows<DiagnosisInteractionRow>(`
SELECT
  upper(trim(p.diagnosis)) AS diagnosis,
  CASE WHEN max(pr.id) IS NULL THEN 'unmatched' ELSE 'matched-active-problem' END AS status,
  COALESCE(max(pr.title), '') AS "problemTitle",
  count(DISTINCT p.id)::text AS "prescriptionCount",
  string_agg(DISTINCT p.drug, ',' ORDER BY p.drug) AS drugs
FROM prescriptions p
LEFT JOIN problems pr
  ON pr.pid = p.pid
 AND pr.activity = 1
 AND upper(trim(pr.diagnosis)) = upper(trim(p.diagnosis))
WHERE p.pid = ${integer(pid)}
  AND p.active = 1
  AND upper(trim(p.diagnosis)) IN (${diagnosisList})
GROUP BY upper(trim(p.diagnosis))
ORDER BY diagnosis;
`);
}

function normalizeSourceInteraction(row: DiagnosisInteractionRow): DiagnosisInteractionSummary {
  return {
    diagnosis: row.diagnosis,
    status: row.status,
    problemTitle: row.problemTitle || null,
    prescriptionCount: Number(row.prescriptionCount),
    drugs: row.drugs.split(",").filter(Boolean)
  };
}

function normalizeApiInteraction(raw: unknown): DiagnosisInteractionSummary {
  const value = raw as Record<string, unknown>;
  return {
    diagnosis: String(value.diagnosis),
    status: String(value.status),
    problemTitle: value.problemTitle ? String(value.problemTitle) : null,
    prescriptionCount: Number(value.prescriptionCount),
    drugs: Array.isArray(value.drugs) ? value.drugs.map(String) : []
  };
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
