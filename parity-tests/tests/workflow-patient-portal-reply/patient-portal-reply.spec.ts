import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal secure-message reply parity @slice212 @workflow-patient-portal-reply @patients @portal", () => {
  test("creates a threaded reply from an inbox secure message", async ({ targetDb, workflow }) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    const replyBody = "Slice 212 reply to the portal medication question.";
    const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
    const original = before.messages.find((message) => message.title === "Portal message");
    expect(original).toBeTruthy();

    await workflow.cleanupPatientPortalMessageReply(portalLoginUsername, original!.title, replyBody);

    try {
      const result = await workflow.replyToPatientPortalMessage(portalLoginUsername, portalPassword, original!.id, {
        body: replyBody
      });
      const after = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const sentReply = after.sentMessages.find((message) => message.title === original!.title && message.body === replyBody);

      expect(result).toMatchObject({
        authenticated: true,
        created: true,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        originalMessageId: original!.id,
        messageCount: before.messageCount,
        sentMessageCount: before.sentMessageCount + 1,
        failureReason: null
      });
      expect(result.originalMessage).toMatchObject({
        id: original!.id,
        title: "Portal message",
        body: "Patient portal question about medications."
      });
      expect(result.sentMessage).toMatchObject({
        title: original!.title,
        body: replyBody,
        status: "New",
        senderId: portalLoginUsername,
        recipientId: original!.senderId || original!.assignedTo || "admin",
        replyMailChain: original!.replyMailChain
      });
      expect(result.recipientMessage).toMatchObject({
        title: original!.title,
        body: replyBody,
        replyMailChain: original!.replyMailChain
      });
      expect(after.messageCount).toBe(before.messageCount);
      expect(after.sentMessageCount).toBe(before.sentMessageCount + 1);
      expect(sentReply).toMatchObject({
        body: replyBody,
        senderId: portalLoginUsername,
        replyMailChain: original!.replyMailChain
      });
    } finally {
      await workflow.cleanupPatientPortalMessageReply(portalLoginUsername, original!.title, replyBody);
    }
  });

  test("shows the reply on the patient portal sent surface", async ({ page, target, workflow }) => {
    test.setTimeout(240_000);

    const replyBody = "Slice 212 portal UI reply body.";
    const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
    const original = before.messages.find((message) => message.title === "Portal message");
    expect(original).toBeTruthy();
    await workflow.cleanupPatientPortalMessageReply(portalLoginUsername, original!.title, replyBody);

    try {
      if (target.type === "legacy-openemr") {
        await workflow.replyToPatientPortalMessage(portalLoginUsername, portalPassword, original!.id, {
          body: replyBody
        });
        await expectLegacyPatientPortalSentMessage(page, target, original!.title);
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        const replyForm = page.getByRole("form", { name: "Reply to Portal message" });
        await replyForm.getByLabel("Reply to Portal message").fill(replyBody);
        await replyForm.getByRole("button", { name: "Send reply" }).click();
        await expect(page.locator("body")).toContainText("Secure message reply sent for Portal message");
        await expect(page.locator("body")).toContainText("Sent");
        await expect(page.locator("body")).toContainText("Portal message");
        await expect(page.locator("body")).toContainText(replyBody);
      }
    } finally {
      await workflow.cleanupPatientPortalMessageReply(portalLoginUsername, original!.title, replyBody);
    }
  });
});

async function expectLegacyPatientPortalSentMessage(page: Page, target: RuntimeTarget, title: string) {
  await page.context().clearCookies();
  await page.goto(`${target.publicUrl}/portal/index.php?site=default&woops=1`);
  await page.locator("#uname").fill(portalLoginUsername);
  await page.locator("#pass").fill(portalPassword);

  const emailConfirmation = page.locator("#passaddon");
  if ((await emailConfirmation.count()) > 0 && await emailConfirmation.isVisible()) {
    await emailConfirmation.fill(portalLoginUsername);
  }

  await page.getByRole("button", { name: "Log In" }).click();
  await expect.poll(() => page.url()).toContain("/portal/home.php");
  await page.goto(`${target.publicUrl}/portal/messaging/messages.php`);
  await expectRenderedText(page, /Secure Messaging/i);
  await page.getByText("Sent", { exact: false }).first().click();
  await expect(page.locator("body")).toContainText(title);
}
