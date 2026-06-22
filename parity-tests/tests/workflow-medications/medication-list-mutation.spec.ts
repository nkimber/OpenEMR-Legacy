import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedClinicalLists } from "../../src/ui/modernizedOpenEmr.js";

const medicationMutationAnchorPatientId = "MOD-PAT-0006";

test.describe("medication list mutation parity @slice32 @workflow-medications @mutation", () => {
  test("creates, renders, deactivates, and removes a medication list entry", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(medicationMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Medication ${workflowSuffix()}`;
    const diagnosis = "ICD10:Z00.00";
    let medicationId: number | string | null = null;

    try {
      medicationId = await workflow.createMedication({
        patientId: patient!.pid,
        title,
        dateTime: "2026-07-15 09:00:00",
        diagnosis,
        comments: "Created by the parity medication-list mutation suite."
      });

      const created = await workflow.getMedication(medicationId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        type: "medication",
        title,
        activity: 1,
        diagnosis,
        date: "2026-07-15"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.medications).toBe(beforeCounts.medications + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, title);
      } else {
        await openAuthenticatedModernizedClinicalLists(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText(title);
        await expect(page.locator("body")).toContainText(diagnosis);
        await expect(page.getByRole("button", { name: "Deactivate" }).first()).toBeVisible();
      }

      const inactiveComment = "Deactivated by the parity medication-list mutation suite.";
      await workflow.deactivateMedication(medicationId, inactiveComment);
      const inactive = await workflow.getMedication(medicationId);
      expect(inactive).toMatchObject({
        activity: 0,
        comments: inactiveComment
      });

      const afterDeactivateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterDeactivateCounts.medications).toBe(beforeCounts.medications);
    } finally {
      if (medicationId !== null) {
        await workflow.deleteMedication(medicationId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.medications).toBe(beforeCounts.medications);
    if (medicationId !== null) {
      await expect(workflow.getMedication(medicationId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
