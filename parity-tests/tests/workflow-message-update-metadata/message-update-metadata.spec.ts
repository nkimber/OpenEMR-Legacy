import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientNotesDirect } from "../../src/ui/legacyOpenEmr.js";

const messageUpdateMetadataAnchorPatientId = "MOD-PAT-0004";

test.describe("patient message update metadata parity @slice158 @workflow-message-update-metadata @messages @mutation", () => {
  test("content edits stamp patient message update metadata without changing message counts", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(messageUpdateMetadataAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Message Update ${workflowSuffix()}`;
    const body = "Created by the parity message update metadata suite.";
    const editedTitle = `${title} Edited`;
    const editedBody = "Edited by the parity message update metadata suite.";
    let messageId: number | string | null = null;

    try {
      messageId = await workflow.createPatientMessage({
        patientId: patient!.pid,
        title,
        body,
        assignedTo: "admin"
      });

      const created = await workflow.getPatientMessage(messageId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        title,
        body,
        status: "New",
        assignedTo: "admin",
        updatedBy: "",
        updatedAt: "",
        deleted: 0
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.messages).toBe(beforeCounts.messages + 1);

      if (target.type === "legacy-openemr") {
        await workflow.updatePatientMessageContent(messageId, editedTitle, editedBody);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Messages" }).click();
        await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();
        await page.getByLabel("Messages patient ID").fill(patient!.pubpid);

        const messageCard = page.locator(".message-item", { hasText: title });
        await expect(messageCard).toContainText(body);
        await messageCard.getByLabel(`Edit ${title} title`).fill(editedTitle);
        await messageCard.getByLabel(`Edit ${title} body`).fill(editedBody);
        await messageCard.getByRole("button", { name: "Save Edit" }).click();

        const editedMessageCard = page.locator(".message-item", { hasText: editedTitle });
        await expect(editedMessageCard).toContainText(editedBody);
        await expect(editedMessageCard).toContainText("Updated by user 1");
      }

      const edited = await workflow.getPatientMessage(messageId);
      expect(edited).toMatchObject({
        title: editedTitle,
        body: editedBody,
        status: "New",
        assignedTo: "admin",
        updatedBy: "1",
        deleted: 0
      });
      expect(edited!.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

      const afterEditCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterEditCounts.messages).toBe(beforeCounts.messages + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientNotesDirect(page, target, patient!.pid);
        await expectRenderedText(page, editedTitle);
        await expectRenderedText(page, editedBody);
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
