import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openEncounterDirect,
  openFeeSheetDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterBillingMutationAnchorPatientId = "MOD-PAT-0001";
const encounterBillingMutationAnchorFromDate = "2026-01-01";
const encounterBillingMutationCode = "99499";
const encounterBillingMutationFee = "42.00";
const encounterBillingMutationJustify = "E78.5";
const legacyEncounterBillingMutationJustifyVisible = "E78.";

test.describe("encounter billing linkage mutation parity @slice72 @workflow-encounter-billing @mutation", () => {
  test("created billing lines appear through encounter-linked surfaces and clean up", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterBillingMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();
    expect(encounter!.encounter).toBe(1000013);

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeLines = await targetDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
    const codeText = `Parity Encounter Billing ${workflowSuffix()}`;
    let billingLineId: number | string | null = null;

    try {
      billingLineId = await workflow.createBillingLine({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        encounter: encounter!.encounter,
        dateTime: "2026-06-18 11:35:00",
        codeType: "CPT4",
        code: encounterBillingMutationCode,
        codeText,
        fee: encounterBillingMutationFee,
        units: 1,
        justify: encounterBillingMutationJustify
      });

      const created = await workflow.getBillingLine(billingLineId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        encounter: encounter!.encounter,
        codeType: "CPT4",
        code: encounterBillingMutationCode,
        codeText,
        fee: encounterBillingMutationFee,
        justify: encounterBillingMutationJustify,
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
            codeType: "CPT4",
            code: encounterBillingMutationCode,
            codeText,
            fee: expect.stringMatching(/^42\.00(?:0+)?$/),
            justify: encounterBillingMutationJustify
          })
        ])
      );

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
        await openFeeSheetDirect(page, target, patient!.pid, encounter!.encounter);
        await expectRenderedText(page, "Selected Fee Sheet Codes and Charges");
        await expectRenderedText(page, encounterBillingMutationCode);
        await expectRenderedText(page, codeText);
        await expectRenderedText(page, legacyEncounterBillingMutationJustifyVisible);
      } else {
        const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounter!.encounter}`);
        expect(detailResponse.ok()).toBe(true);
        const detailPayload = await detailResponse.json();
        expect(detailPayload.billingLineCount).toBe(beforeLines.length + 1);
        expect(detailPayload.billingLines).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: String(billingLineId),
              code: encounterBillingMutationCode,
              codeText,
              fee: Number(encounterBillingMutationFee),
              justify: encounterBillingMutationJustify
            })
          ])
        );

        const diagnosis = detailPayload.diagnosisCodes.find(
          (item: { code: string }) => item.code === encounterBillingMutationJustify
        );
        expect(diagnosis).toBeTruthy();
        expect(diagnosis.supportingBillingCodes).toEqual(expect.arrayContaining([`CPT4 ${encounterBillingMutationCode}`]));

        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Encounters" }).click();
        await expect(page.getByRole("heading", { name: "Encounters" })).toBeVisible();

        await page.getByLabel("Encounter patient ID").fill(patient!.pubpid);
        await page.getByLabel("Encounter from date").fill(encounterBillingMutationAnchorFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const billingLinkage = page.getByLabel("Encounter billing linkage");
        await expect(billingLinkage).toBeVisible();
        await expect(billingLinkage).toContainText(encounterBillingMutationCode);
        await expect(billingLinkage).toContainText(codeText);
        await expect(billingLinkage).toContainText("$42.00");
        await expect(billingLinkage).toContainText(`Justification ${encounterBillingMutationJustify}`);

        const diagnosisLinkage = page.getByLabel("Encounter diagnosis coding linkage");
        await expect(diagnosisLinkage).toContainText(`CPT4 ${encounterBillingMutationCode}`);
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
        expect(inactiveDetail.billingLineCount).toBe(beforeLines.length);
        expect(inactiveDetail.billingLines.map((line: { id: string }) => line.id)).not.toContain(String(billingLineId));
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
