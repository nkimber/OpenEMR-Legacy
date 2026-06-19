import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";

const prescriptionMutationAnchorPatientId = "MOD-PAT-0008";

test.describe("prescription mutation parity @slice15 @workflow-prescriptions @mutation", () => {
  test("creates, renders, deactivates, and removes a prescription", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(prescriptionMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const drug = `Parity Medication ${workflowSuffix()}`;
    let prescriptionId: number | string | null = null;

    try {
      prescriptionId = await workflow.createPrescription({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        startDate: "2026-07-15",
        drug,
        rxNormCode: "1049502",
        dosage: "1 tablet daily",
        quantity: "30",
        refills: 1,
        note: "Created by the parity prescription mutation suite.",
        diagnosis: "Z00.00"
      });

      const created = await workflow.getPrescription(prescriptionId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        startDate: "2026-07-15",
        drug,
        dosage: "1 tablet daily",
        quantity: "30",
        refills: 1,
        active: 1
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.prescriptions).toBe(beforeCounts.prescriptions + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, drug);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Lists" }).click();
        await expect(page.getByRole("heading", { name: "Lists" })).toBeVisible();
        await page.getByLabel("Clinical lists patient ID").fill(patient!.pubpid);

        await expect(page.locator("body")).toContainText(drug);
        await expect(page.locator("body")).toContainText("1 tablet daily / oral / Z00.00");
        await expect(page.locator("body")).toContainText("Qty 30 / 1 refill");
      }

      const inactiveNote = "Deactivated by the parity prescription mutation suite.";
      await workflow.deactivatePrescription(prescriptionId, "2026-08-15", inactiveNote);
      const inactive = await workflow.getPrescription(prescriptionId);
      expect(inactive).toMatchObject({
        active: 0,
        endDate: "2026-08-15",
        note: inactiveNote
      });
    } finally {
      if (prescriptionId !== null) {
        await workflow.deletePrescription(prescriptionId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.prescriptions).toBe(beforeCounts.prescriptions);
    if (prescriptionId !== null) {
      await expect(workflow.getPrescription(prescriptionId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
