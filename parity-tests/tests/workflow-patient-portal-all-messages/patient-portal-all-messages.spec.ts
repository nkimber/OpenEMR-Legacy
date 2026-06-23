import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal secure-message all-folder parity @slice217 @workflow-patient-portal-all-messages @patients @portal", () => {
  test("shows active patient-owned inbox and sent messages in the all folder and removes archived rows", async ({
    targetDb,
    workflow
  }) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    const inboxTitle = "Slice 217 secure message all folder inbound";
    const sentTitle = "Slice 217 secure message all folder sent";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, inboxTitle);
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, sentTitle);

    try {
      const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const inboundMessage = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        title: inboxTitle,
        body: "Slice 217 temporary secure-message all-folder inbound note."
      });
      const sentMessage = await workflow.composePatientPortalMessage(portalLoginUsername, portalPassword, {
        recipientId: "admin",
        title: sentTitle,
        body: "Slice 217 temporary secure-message all-folder sent note."
      });
      const afterCreate = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const archiveResult = await workflow.archivePatientPortalMessages(portalLoginUsername, portalPassword, [
        inboundMessage.id
      ]);
      const afterArchive = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);

      expect(sentMessage).toMatchObject({
        authenticated: true,
        created: true,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        failureReason: null
      });
      expect(afterCreate.messageCount).toBe(before.messageCount + 1);
      expect(afterCreate.sentMessageCount).toBe(before.sentMessageCount + 1);
      expect(afterCreate.allMessageCount).toBe(before.allMessageCount + 2);
      expect(afterCreate.allMessages.map((message) => message.title)).toEqual(
        expect.arrayContaining([inboxTitle, sentTitle])
      );
      expect(archiveResult).toMatchObject({
        authenticated: true,
        archived: true,
        archivedMessageCount: 1,
        messageCount: before.messageCount,
        failureReason: null
      });
      expect(afterArchive.allMessageCount).toBe(before.allMessageCount + 1);
      expect(afterArchive.allMessages.some((message) => message.title === inboxTitle)).toBe(false);
      expect(afterArchive.allMessages.some((message) => message.title === sentTitle)).toBe(true);
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, inboxTitle);
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, sentTitle);
    }
  });

  test("renders the active all folder on the patient portal surface", async ({ page, target, workflow }) => {
    test.setTimeout(240_000);

    const inboxTitle = "Slice 217 UI secure message all folder inbound";
    const sentTitle = "Slice 217 UI secure message all folder sent";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, inboxTitle);
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, sentTitle);

    try {
      await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        title: inboxTitle,
        body: "Slice 217 portal UI all-folder inbound evidence."
      });
      await workflow.composePatientPortalMessage(portalLoginUsername, portalPassword, {
        recipientId: "admin",
        title: sentTitle,
        body: "Slice 217 portal UI all-folder sent evidence."
      });

      if (target.type === "legacy-openemr") {
        await openLegacyPatientPortalMessages(page, target);
        await page.locator('a[ng-click="isAllSelected()"]').click();
        await expect(page.locator("body")).toContainText(inboxTitle);
        await expect(page.locator("body")).toContainText(sentTitle);
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        const allMessages = page.getByRole("region", { name: "All secure messages" });
        await expect(allMessages.locator("article.message-item").filter({ hasText: inboxTitle })).toContainText(
          "Slice 217 portal UI all-folder inbound evidence."
        );
        await expect(allMessages.locator("article.message-item").filter({ hasText: sentTitle })).toContainText(
          "Slice 217 portal UI all-folder sent evidence."
        );
      }
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, inboxTitle);
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, sentTitle);
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
