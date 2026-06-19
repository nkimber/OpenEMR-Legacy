import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openEncounterDirect, openFeeSheetDirect } from "../../src/ui/legacyOpenEmr.js";

const billingMutationAnchorPatientId = "MOD-PAT-0001";

test.describe("billing line mutation parity @slice16 @workflow-billing @mutation", () => {
  test("creates, renders, marks billed, deactivates, and removes a CPT billing line", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(billingMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const codeText = `Parity Billing Line ${workflowSuffix()}`;
    let billingLineId: number | string | null = null;

    try {
      const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
      expect(encounter).not.toBeNull();

      billingLineId = await workflow.createBillingLine({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        encounter: encounter!.encounter,
        dateTime: "2026-06-18 11:10:00",
        codeType: "CPT4",
        code: "99213",
        codeText,
        fee: "125.00",
        units: 1,
        justify: "Z00.00"
      });

      const created = await workflow.getBillingLine(billingLineId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        encounter: encounter!.encounter,
        codeType: "CPT4",
        code: "99213",
        codeText,
        fee: "125.00",
        units: 1,
        activity: 1,
        billed: 0
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters);
      expect(afterCreateCounts.billingLineItems).toBe(beforeCounts.billingLineItems + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
        await openFeeSheetDirect(page, target, patient!.pid, encounter!.encounter);
        await expectRenderedText(page, "99213");
        await expectRenderedText(page, codeText);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Fees" }).click();
        await expect(page.getByRole("heading", { name: "Fees" })).toBeVisible();
        await page.getByLabel("Fees patient ID").fill(patient!.pubpid);

        await expect(page.locator("body")).toContainText(codeText);
        await expect(page.locator("body")).toContainText("99213");
        await expect(page.locator("body")).toContainText("1 unit");
        await expect(page.locator("body")).toContainText("Unbilled");
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
