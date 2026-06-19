import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openEncounterDirect, openFeeSheetDirect } from "../../src/ui/legacyOpenEmr.js";

const billingCorrectionAnchorPatientId = "MOD-PAT-0001";

test.describe("fee sheet billing correction parity @slice45 @workflow-billing-correction @mutation", () => {
  test("creates, corrects, renders, deactivates, and removes a CPT billing line", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(billingCorrectionAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const initialText = `Parity Correction CPT ${workflowSuffix()}`;
    const correctedText = `Parity Corrected CPT ${workflowSuffix()}`;
    let billingLineId: number | string | null = null;

    try {
      const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
      expect(encounter).not.toBeNull();

      billingLineId = await workflow.createBillingLine({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        encounter: encounter!.encounter,
        dateTime: "2026-06-18 10:20:00",
        codeType: "CPT4",
        code: "99213",
        codeText: initialText,
        fee: "125.00",
        units: 1,
        justify: "Z00.00"
      });

      await workflow.updateBillingLine(billingLineId, {
        codeText: correctedText,
        fee: "142.25",
        units: 3,
        justify: "E78.5"
      });

      const corrected = await workflow.getBillingLine(billingLineId);
      expect(corrected).toMatchObject({
        patientId: patient!.pid,
        encounter: encounter!.encounter,
        codeType: "CPT4",
        code: "99213",
        codeText: correctedText,
        fee: "142.25",
        justify: "E78.5",
        units: 3,
        activity: 1,
        billed: 0
      });

      const encounterLines = await targetDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
      expect(encounterLines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            codeType: "CPT4",
            code: "99213",
            codeText: correctedText,
            fee: expect.stringMatching(/^142\.25(?:0+)?$/),
            justify: "E78.5"
          })
        ])
      );

      const afterCorrectionCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCorrectionCounts.encounters).toBe(beforeCounts.encounters);
      expect(afterCorrectionCounts.billingLineItems).toBe(beforeCounts.billingLineItems + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
        await openFeeSheetDirect(page, target, patient!.pid, encounter!.encounter);
        await expectRenderedText(page, "99213");
        await expectRenderedText(page, correctedText);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Fees" }).click();
        await expect(page.getByRole("heading", { name: "Fees" })).toBeVisible();
        await page.getByLabel("Fees patient ID").fill(patient!.pubpid);

        await expect(page.locator("body")).toContainText(correctedText);
        await expect(page.locator("body")).toContainText("99213");
        await expect(page.locator("body")).toContainText("CPT4");
        await expect(page.locator("body")).toContainText("Justify E78.5");
        await expect(page.locator("body")).toContainText("3 units");
        await expect(page.locator("body")).toContainText("$142.25");
      }

      await workflow.updateBillingLineStatus(billingLineId, 1, 0);
      const inactive = await workflow.getBillingLine(billingLineId);
      expect(inactive).toMatchObject({
        billed: 1,
        activity: 0
      });
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
