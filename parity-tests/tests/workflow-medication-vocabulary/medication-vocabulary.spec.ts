import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedClinicalLists } from "../../src/ui/modernizedOpenEmr.js";

const vocabularyAnchorPatientId = "MOD-PAT-0008";

test.describe("medication vocabulary lookup parity @slice586 @workflow-medication-vocabulary @clinical-lists @prescriptions", () => {
  test("finds a deterministic medication vocabulary entry and applies it to the modernized prescription form", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(vocabularyAnchorPatientId);
    expect(patient).not.toBeNull();

    const results = await workflow.searchMedicationVocabulary("metformin");
    const metformin = results.find((item) => item.rxNormCode === "860975");

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-586-medication-vocabulary-lookup",
      description:
        "Captures the Slice 586 deterministic medication vocabulary search result for metformin, including RxNorm, dose, frequency, and duration evidence.",
      expected: {
        query: "metformin",
        result: {
          rxNormCode: "860975",
          drugName: "Metformin",
          displayName: "Metformin 500 mg tablet",
          form: "tablet",
          strength: "500 mg",
          route: "oral",
          doseAmount: 500,
          doseUnit: "mg",
          frequency: "twice daily",
          durationDays: 30,
          controlledSubstanceSchedule: null
        }
      },
      actual: {
        patient,
        resultCount: results.length,
        results,
        metformin
      },
      context: {
        canonicalId: vocabularyAnchorPatientId,
        suite: "workflow-medication-vocabulary",
        workflow: "medication-vocabulary"
      }
    });

    expect(metformin).toMatchObject({
      rxNormCode: "860975",
      drugName: "Metformin",
      displayName: "Metformin 500 mg tablet",
      form: "tablet",
      strength: "500 mg",
      route: "oral",
      doseAmount: 500,
      doseUnit: "mg",
      frequency: "twice daily",
      durationDays: 30,
      controlledSubstanceSchedule: null
    });

    if (target.type === "modernized-openemr") {
      await openAuthenticatedModernizedClinicalLists(page, target, patient!.pubpid);
      await page.getByLabel("Medication vocabulary query").fill("metformin");
      await page.getByRole("button", { name: "Search Vocabulary" }).click();
      const resultsRegion = page.getByLabel("Medication vocabulary results");
      await expect(resultsRegion).toContainText("Metformin 500 mg tablet");
      await expect(resultsRegion).toContainText("RxNorm 860975");
      await resultsRegion.getByRole("button", { name: "Select" }).click();
      await expect(page.getByLabel("New prescription drug")).toHaveValue("Metformin");
      await expect(page.getByLabel("New prescription dosage")).toHaveValue("500 mg tablet");
      await expect(page.getByLabel("New prescription dose amount")).toHaveValue("500");
      await expect(page.getByLabel("New prescription dose unit")).toHaveValue("mg");
      await expect(page.getByLabel("New prescription frequency")).toHaveValue("twice daily");
      await expect(page.getByLabel("New prescription duration days")).toHaveValue("30");
    }
  });
});
