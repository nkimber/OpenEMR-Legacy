import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal secure-message thread parity @slice213 @workflow-patient-portal-thread @patients @portal", () => {
  test("loads a chronological secure-message thread around a portal inbox message", async ({ targetDb, workflow }) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    const replyBody = "Slice 213 thread view reply body.";
    const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
    const original = before.messages.find((message) => message.title === "Portal message");
    expect(original).toBeTruthy();

    await workflow.cleanupPatientPortalMessageReply(portalLoginUsername, original!.title, replyBody);

    try {
      await workflow.replyToPatientPortalMessage(portalLoginUsername, portalPassword, original!.id, {
        body: replyBody
      });
      const thread = await workflow.getPatientPortalMessageThread(portalLoginUsername, portalPassword, original!.id);

      expect(thread).toMatchObject({
        authenticated: true,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        messageId: original!.id,
        threadId: original!.replyMailChain,
        threadMessageCount: 2,
        failureReason: null
      });
      expect(thread.anchorMessage).toMatchObject({
        id: original!.id,
        title: "Portal message",
        body: "Patient portal question about medications."
      });
      expect(thread.threadMessages.map((message) => message.body)).toEqual([
        "Patient portal question about medications.",
        replyBody
      ]);
      expect(thread.threadMessages[0]).toMatchObject({
        id: original!.id,
        senderId: original!.senderId,
        recipientId: portalLoginUsername,
        replyMailChain: original!.replyMailChain
      });
      expect(thread.threadMessages[1]).toMatchObject({
        title: original!.title,
        body: replyBody,
        senderId: portalLoginUsername,
        replyMailChain: original!.replyMailChain
      });
    } finally {
      await workflow.cleanupPatientPortalMessageReply(portalLoginUsername, original!.title, replyBody);
    }
  });

  test("shows a secure-message thread on the patient portal surface", async ({ page, target, workflow }) => {
    test.setTimeout(240_000);

    const replyBody = "Slice 213 portal UI thread body.";
    const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
    const original = before.messages.find((message) => message.title === "Portal message");
    expect(original).toBeTruthy();
    await workflow.cleanupPatientPortalMessageReply(portalLoginUsername, original!.title, replyBody);

    try {
      await workflow.replyToPatientPortalMessage(portalLoginUsername, portalPassword, original!.id, {
        body: replyBody
      });

      if (target.type === "legacy-openemr") {
        await expectLegacyPatientPortalMessageSurfaces(page, target, original!.title);
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        const card = page.locator("article.message-item").filter({ hasText: "Patient portal question about medications." }).first();
        await card.getByRole("button", { name: "View thread" }).click();
        await expect(card).toContainText(`Thread ${original!.replyMailChain}`);
        await expect(card).toContainText("2 messages");
        await expect(card).toContainText("Care team message");
        await expect(card).toContainText("Patient reply");
        await expect(card).toContainText(replyBody);
      }
    } finally {
      await workflow.cleanupPatientPortalMessageReply(portalLoginUsername, original!.title, replyBody);
    }
  });
});

async function expectLegacyPatientPortalMessageSurfaces(page: Page, target: RuntimeTarget, title: string) {
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
  await expect(page.locator("body")).toContainText(title);
  await page.getByText("Sent", { exact: false }).first().click();
  await expect(page.locator("body")).toContainText(title);
}
