import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openEncounterDirect,
  openFeeSheetDirect,
  openProcedureResultsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterDiagnosisAnchorPatientId = "MOD-PAT-0001";
const encounterDiagnosisAnchorFromDate = "2026-01-01";
const billingAnchorEncounter = 1000013;
const procedureAnchorEncounter = 1000011;
const billingDiagnosisCode = "E78.5";
const legacyBillingDiagnosisVisibleCode = "E78.";
const billingDiagnosisText = "Hyperlipidemia, unspecified";
const procedureDiagnosisCode = "E11.9";
const procedureDiagnosisText = "Type 2 diabetes mellitus without complications";

test.describe("encounter diagnosis coding readiness parity @slice71 @encounter-diagnoses @encounters", () => {
  test("stable encounter anchors expose diagnosis coding facts", async ({ targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDiagnosisAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();
    expect(encounter!.encounter).toBe(billingAnchorEncounter);
    expect(encounter!.reason).toContain(billingDiagnosisText);

    const billingLines = await targetDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
    expect(billingLines).toHaveLength(2);
    expect(billingLines.map((line) => line.justify)).toEqual([billingDiagnosisCode, billingDiagnosisCode]);
    expect(billingLines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codeType: "CPT4", code: "99214", codeText: "Established patient office visit" }),
        expect.objectContaining({ codeType: "CPT4", code: "36415", codeText: "Routine venipuncture" })
      ])
    );

    const procedures = await targetDb.getProcedureResultsForEncounter(patient!.pid, procedureAnchorEncounter);
    expect(procedures.orders).toHaveLength(1);
    expect(procedures.orders[0]).toMatchObject({
      procedureCode: "83036",
      procedureName: "Hemoglobin A1c",
      diagnosis: procedureDiagnosisCode
    });
  });

  test("encounter diagnosis coding is reachable from the application surface", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDiagnosisAnchorPatientId);
    expect(patient).not.toBeNull();

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);

      await openEncounterDirect(page, target, patient!.pid, billingAnchorEncounter);
      await expectRenderedText(page, billingDiagnosisText);

      await openFeeSheetDirect(page, target, patient!.pid, billingAnchorEncounter);
      await expectRenderedText(page, "Selected Fee Sheet Codes and Charges");
      await expectRenderedText(page, legacyBillingDiagnosisVisibleCode);
      await expectRenderedText(page, "99214");
      await expectRenderedText(page, "36415");

      await openProcedureResultsDirect(page, target, patient!.pid);
      await expectRenderedText(page, "Hemoglobin A1c");
      await expectRenderedText(page, "4548-4");
      await expectRenderedText(page, "5.7");
      return;
    }

    const billingDetailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${billingAnchorEncounter}`);
    expect(billingDetailResponse.ok()).toBe(true);
    const billingDetailPayload = await billingDetailResponse.json();
    const billingDiagnosis = billingDetailPayload.diagnosisCodes.find(
      (diagnosis: { code: string }) => diagnosis.code === billingDiagnosisCode
    );
    expect(billingDiagnosis).toMatchObject({
      code: billingDiagnosisCode,
      description: billingDiagnosisText,
      billingLineCount: 2,
      procedureOrderCount: 0
    });
    expect(billingDiagnosis.sources).toEqual(expect.arrayContaining(["Encounter diagnosis", "Fee sheet justification"]));
    expect(billingDiagnosis.supportingBillingCodes).toEqual(expect.arrayContaining(["CPT4 99214", "CPT4 36415"]));

    const procedureDetailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${procedureAnchorEncounter}`);
    expect(procedureDetailResponse.ok()).toBe(true);
    const procedureDetailPayload = await procedureDetailResponse.json();
    const procedureDiagnosis = procedureDetailPayload.diagnosisCodes.find(
      (diagnosis: { code: string }) => diagnosis.code === procedureDiagnosisCode
    );
    expect(procedureDiagnosis).toMatchObject({
      code: procedureDiagnosisCode,
      description: procedureDiagnosisText,
      procedureOrderCount: 1
    });
    expect(procedureDiagnosis.sources).toEqual(expect.arrayContaining(["Encounter diagnosis", "Procedure order diagnosis"]));

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Encounters" }).click();
    await expect(page.getByRole("heading", { name: "Encounters" })).toBeVisible();

    await page.getByLabel("Encounter patient ID").fill(patient!.pubpid);
    await page.getByLabel("Encounter from date").fill(encounterDiagnosisAnchorFromDate);

    const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
    await expect(encounterButton).toBeVisible();
    await encounterButton.click();

    const linkage = page.getByLabel("Encounter diagnosis coding linkage");
    await expect(linkage).toBeVisible();
    await expect(linkage).toContainText("Diagnosis Coding");
    await expect(linkage).toContainText(billingDiagnosisCode);
    await expect(linkage).toContainText(billingDiagnosisText);
    await expect(linkage).toContainText("Encounter diagnosis");
    await expect(linkage).toContainText("Fee sheet justification");
    await expect(linkage).toContainText("CPT4 99214");
    await expect(linkage).toContainText("CPT4 36415");
    await expect(linkage).toContainText("2 billing links");
  });
});
