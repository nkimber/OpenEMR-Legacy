import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientNotesDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedMessages } from "../../src/ui/modernizedOpenEmr.js";

const messageReplyAnchorPatientId = "MOD-PAT-0004";

test.describe("patient message reply parity @slice156 @workflow-message-reply @messages @mutation", () => {
  test("appends a reply to a patient message without changing message counts", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(messageReplyAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Reply ${workflowSuffix()}`;
    const body = "Created by the parity message reply suite.";
    const replyBody = "Reply appended by the parity message reply suite.";
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
        deleted: 0
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.messages).toBe(beforeCounts.messages + 1);

      if (target.type === "legacy-openemr") {
        await workflow.replyPatientMessage(messageId, replyBody, "admin");
      } else {
        await openAuthenticatedModernizedMessages(page, target, patient!.pubpid);

        const messageCard = page.locator(".message-item", { hasText: title });
        await expect(messageCard).toContainText(body);
        await messageCard.getByLabel(`Reply to ${title}`).fill(replyBody);
        await messageCard.getByRole("button", { name: "Reply" }).click();
        await expect(messageCard).toContainText(replyBody);
        await expect(messageCard).toContainText("admin to admin");
      }

      const replied = await workflow.getPatientMessage(messageId);
      expect(replied).toMatchObject({
        title,
        status: "New",
        assignedTo: "admin",
        deleted: 0
      });
      expect(replied?.body).toContain(body);
      expect(replied?.body).toContain(replyBody);
      expect(replied?.body).toContain("admin to admin");

      const afterReplyCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterReplyCounts.messages).toBe(beforeCounts.messages + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientNotesDirect(page, target, patient!.pid);
        await expectRenderedText(page, title);
        await expectRenderedText(page, replyBody);
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
