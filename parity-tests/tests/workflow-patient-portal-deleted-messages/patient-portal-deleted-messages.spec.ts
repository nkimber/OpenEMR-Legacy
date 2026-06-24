import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal secure-message deleted-folder parity @slice235 @workflow-patient-portal-deleted-messages @patients @portal", () => {
  test("shows archived patient-owned secure messages in the deleted folder", async ({ targetDb, workflow }) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    const inboundTitle = "Slice 235 deleted folder inbound";
    const sentTitle = "Slice 235 deleted folder sent";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, inboundTitle);
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, sentTitle);

    try {
      const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const inboundMessage = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        title: inboundTitle,
        body: "Slice 235 temporary deleted-folder inbound note."
      });
      const sentMessage = await workflow.composePatientPortalMessage(portalLoginUsername, portalPassword, {
        recipientId: "admin",
        title: sentTitle,
        body: "Slice 235 temporary deleted-folder sent note."
      });
      expect(sentMessage.sentMessage).toBeTruthy();

      const afterCreate = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const archivedInbound = await workflow.deletePatientPortalMessage(portalLoginUsername, portalPassword, inboundMessage.id);
      const archivedSent = await workflow.deletePatientPortalMessage(
        portalLoginUsername,
        portalPassword,
        sentMessage.sentMessage!.id
      );
      const afterArchive = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);

      expect(afterCreate.messageCount).toBe(before.messageCount + 1);
      expect(afterCreate.sentMessageCount).toBe(before.sentMessageCount + 1);
      expect(afterCreate.allMessageCount).toBe(before.allMessageCount + 2);
      expect(archivedInbound.deletedMessage).toMatchObject({
        id: inboundMessage.id,
        title: inboundTitle,
        status: "Delete",
        recipientId: portalLoginUsername
      });
      expect(archivedSent.deletedMessage).toMatchObject({
        id: sentMessage.sentMessage!.id,
        title: sentTitle,
        status: "Delete",
        senderId: portalLoginUsername
      });
      expect(afterArchive.messageCount).toBe(before.messageCount);
      expect(afterArchive.sentMessageCount).toBe(before.sentMessageCount);
      expect(afterArchive.allMessageCount).toBe(before.allMessageCount);
      expect(afterArchive.deletedMessageCount).toBe(before.deletedMessageCount + 2);
      expect(afterArchive.deletedMessages.map((message) => message.title)).toEqual(
        expect.arrayContaining([inboundTitle, sentTitle])
      );
      expect(afterArchive.messages.some((message) => message.title === inboundTitle)).toBe(false);
      expect(afterArchive.sentMessages.some((message) => message.title === sentTitle)).toBe(false);
      expect(afterArchive.allMessages.some((message) => message.title === inboundTitle || message.title === sentTitle)).toBe(false);
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, inboundTitle);
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, sentTitle);
    }
  });

  test("renders archived secure messages on the patient portal deleted surface", async ({ page, target, workflow }) => {
    test.setTimeout(240_000);

    const title = "Slice 235 UI deleted folder inbound";
    const body = "Slice 235 portal UI deleted-folder evidence.";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);

    try {
      const inboundMessage = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        title,
        body
      });

      if (target.type === "legacy-openemr") {
        await workflow.deletePatientPortalMessage(portalLoginUsername, portalPassword, inboundMessage.id);
        await openLegacyPatientPortalMessages(page, target);
        await page.getByText("Archive", { exact: false }).first().click();
        await expect(page.locator("body")).toContainText(title);
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        const card = page.locator("article.message-item").filter({ hasText: title }).first();
        await expect(card).toContainText(body);
        await card.getByRole("button", { name: "Archive message" }).click();
        await expect(page.locator("body")).toContainText(`Secure message archived for ${title}`);
        const deletedMessages = page.getByRole("region", { name: "Deleted secure messages" });
        await expect(deletedMessages.locator("article.message-item").filter({ hasText: title })).toContainText(body);
      }
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
    }
  });
});

async function openLegacyPatientPortalMessages(page: Page, target: RuntimeTarget) {
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
}
