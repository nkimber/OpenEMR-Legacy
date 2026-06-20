import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openEncounterDirect,
  openFeeSheetDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterDiagnosisMutationAnchorPatientId = "MOD-PAT-0001";
const encounterDiagnosisMutationAnchorFromDate = "2026-01-01";
const encounterDiagnosisMutationCode = "R73.03";
const encounterDiagnosisMutationTextPrefix = "Parity Encounter Diagnosis";
const encounterDiagnosisMutationJustify = "R73.03";

test.describe("encounter diagnosis coding mutation parity @slice73 @workflow-encounter-diagnoses @mutation", () => {
  test("created ICD10 billing diagnoses appear through encounter diagnosis coding and clean up", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDiagnosisMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();
    expect(encounter!.encounter).toBe(1000013);

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeLines = await targetDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
    const codeText = `${encounterDiagnosisMutationTextPrefix} ${workflowSuffix()}`;
    let billingLineId: number | string | null = null;

    try {
      billingLineId = await workflow.createBillingLine({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        encounter: encounter!.encounter,
        dateTime: "2026-06-18 11:45:00",
        codeType: "ICD10",
        code: encounterDiagnosisMutationCode,
        codeText,
        fee: "0.00",
        units: 1,
        justify: encounterDiagnosisMutationJustify
      });

      const created = await workflow.getBillingLine(billingLineId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        encounter: encounter!.encounter,
        codeType: "ICD10",
        code: encounterDiagnosisMutationCode,
        codeText,
        fee: "0.00",
        justify: encounterDiagnosisMutationJustify,
        units: 1,
        activity: 1,
        billed: 0
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters);
      expect(afterCreateCounts.billingLineItems).toBe(beforeCounts.billingLineItems + 1);

      const afterCreateLines = await targetDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
      expect(afterCreateLines).toHaveLength(beforeLines.length + 1);
      expect(afterCreateLines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: String(billingLineId),
            codeType: "ICD10",
            code: encounterDiagnosisMutationCode,
            codeText,
            fee: expect.stringMatching(/^0(\.00)?$/),
            justify: encounterDiagnosisMutationJustify
          })
        ])
      );

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
        await openFeeSheetDirect(page, target, patient!.pid, encounter!.encounter);
        await expectRenderedText(page, "Selected Fee Sheet Codes and Charges");
        await expectRenderedText(page, encounterDiagnosisMutationCode);
        await expectRenderedText(page, codeText);
      } else {
        const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounter!.encounter}`);
        expect(detailResponse.ok()).toBe(true);
        const detailPayload = await detailResponse.json();
        const diagnosis = detailPayload.diagnosisCodes.find(
          (item: { code: string }) => item.code === encounterDiagnosisMutationCode
        );
        expect(diagnosis).toMatchObject({
          code: encounterDiagnosisMutationCode,
          description: codeText,
          billingLineCount: 2,
          procedureOrderCount: 0
        });
        expect(diagnosis.sources).toEqual(
          expect.arrayContaining(["Fee sheet diagnosis line", "Fee sheet justification"])
        );
        expect(diagnosis.supportingBillingCodes).toEqual(
          expect.arrayContaining([`ICD10 ${encounterDiagnosisMutationCode}`])
        );

        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Encounters" }).click();
        await expect(page.getByRole("heading", { name: "Encounters" })).toBeVisible();

        await page.getByLabel("Encounter patient ID").fill(patient!.pubpid);
        await page.getByLabel("Encounter from date").fill(encounterDiagnosisMutationAnchorFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const diagnosisLinkage = page.getByLabel("Encounter diagnosis coding linkage");
        await expect(diagnosisLinkage).toBeVisible();
        await expect(diagnosisLinkage).toContainText(encounterDiagnosisMutationCode);
        await expect(diagnosisLinkage).toContainText(codeText);
        await expect(diagnosisLinkage).toContainText("Fee sheet diagnosis line");
        await expect(diagnosisLinkage).toContainText("Fee sheet justification");
        await expect(diagnosisLinkage).toContainText(`ICD10 ${encounterDiagnosisMutationCode}`);
      }

      await workflow.updateBillingLineStatus(billingLineId, 1, 0);
      const inactive = await workflow.getBillingLine(billingLineId);
      expect(inactive).toMatchObject({
        billed: 1,
        activity: 0
      });

      const inactiveLines = await targetDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
      expect(inactiveLines.map((line) => line.id)).not.toContain(String(billingLineId));
      expect(inactiveLines).toHaveLength(beforeLines.length);

      if (target.type === "modernized-openemr") {
        const inactiveDetailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounter!.encounter}`);
        expect(inactiveDetailResponse.ok()).toBe(true);
        const inactiveDetail = await inactiveDetailResponse.json();
        expect(inactiveDetail.diagnosisCodes.map((item: { code: string }) => item.code)).not.toContain(
          encounterDiagnosisMutationCode
        );
      }
    } finally {
      if (billingLineId !== null) {
        await workflow.deleteBillingLine(billingLineId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.billingLineItems).toBe(beforeCounts.billingLineItems);
    if (billingLineId !== null) {
      await expect(workflow.getBillingLine(billingLineId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
