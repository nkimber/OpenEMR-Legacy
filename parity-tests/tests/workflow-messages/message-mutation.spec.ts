import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientNotesDirect } from "../../src/ui/legacyOpenEmr.js";

const messageMutationAnchorPatientId = "MOD-PAT-0004";

test.describe("patient message mutation parity @slice14 @workflow-messages @mutation", () => {
  test("creates, closes, soft-deletes, and removes a patient message", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(messageMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Message ${workflowSuffix()}`;
    let messageId: number | string | null = null;

    try {
      messageId = await workflow.createPatientMessage({
        patientId: patient!.pid,
        title,
        body: "Created by the parity message mutation suite.",
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

      const closedBody = "Closed by the parity message mutation suite.";
      await workflow.updatePatientMessageStatus(messageId, "Done", closedBody);
      const closed = await workflow.getPatientMessage(messageId);
      expect(closed).toMatchObject({
        body: closedBody,
        status: "Done"
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientNotesDirect(page, target, patient!.pid);

        await expectRenderedText(page, title);
        await expectRenderedText(page, closedBody);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Messages" }).click();
        await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();
        await page.getByLabel("Messages patient ID").fill(patient!.pubpid);

        await expect(page.locator("body")).toContainText(title);
        await expect(page.locator("body")).toContainText(closedBody);
        await expect(page.locator("body")).toContainText("Done");
        await expect(page.locator("body")).toContainText("Assigned to admin");
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
