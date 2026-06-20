import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientNotesDirect } from "../../src/ui/legacyOpenEmr.js";

const messageAssignmentAnchorPatientId = "MOD-PAT-0004";

test.describe("patient message assignment parity @slice65 @workflow-message-assignment @messages @mutation", () => {
  test("reassigns a patient message without changing message counts", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(messageAssignmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Assignment ${workflowSuffix()}`;
    let messageId: number | string | null = null;

    try {
      messageId = await workflow.createPatientMessage({
        patientId: patient!.pid,
        title,
        body: "Created by the parity message assignment suite.",
        assignedTo: "admin"
      });

      const created = await workflow.getPatientMessage(messageId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        title,
        status: "New",
        assignedTo: "admin",
        deleted: 0
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.messages).toBe(beforeCounts.messages + 1);

      if (target.type === "legacy-openemr") {
        await workflow.updatePatientMessageAssignment(messageId, "billing");
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Messages" }).click();
        await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();
        await page.getByLabel("Messages patient ID").fill(patient!.pubpid);

        const messageCard = page.locator(".message-item", { hasText: title });
        await expect(messageCard).toContainText("Assigned to admin");
        await messageCard.getByLabel(`Assign ${title} to`).fill("billing");
        await messageCard.getByRole("button", { name: "Reassign" }).click();
        await expect(messageCard).toContainText("Assigned to billing");
      }

      const reassigned = await workflow.getPatientMessage(messageId);
      expect(reassigned).toMatchObject({
        assignedTo: "billing",
        status: "New",
        deleted: 0
      });

      const afterReassignCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterReassignCounts.messages).toBe(beforeCounts.messages + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientNotesDirect(page, target, patient!.pid);
        await expectRenderedText(page, title);
      }

      await workflow.softDeletePatientMessage(messageId);
      const deleted = await workflow.getPatientMessage(messageId);
      expect(deleted).toMatchObject({
        deleted: 1
      });
    } finally {
      if (messageId !== null) {
        await workflow.deletePatientMessage(messageId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.messages).toBe(beforeCounts.messages);
    if (messageId !== null) {
      await expect(workflow.getPatientMessage(messageId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
