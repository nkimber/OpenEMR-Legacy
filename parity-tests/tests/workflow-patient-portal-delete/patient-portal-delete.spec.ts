import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal secure-message archive parity @slice214 @workflow-patient-portal-delete @patients @portal", () => {
  test("archives a patient-owned sent secure message and hides it from active folders", async ({ targetDb, workflow }) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    const title = "Slice 214 secure message archive";
    const body = "Slice 214 temporary secure-message archive parity note.";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);

    try {
      const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const created = await workflow.composePatientPortalMessage(portalLoginUsername, portalPassword, {
        recipientId: "admin",
        title,
        body
      });
      expect(created.sentMessage).toBeTruthy();

      const afterCreate = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const deleteResult = await workflow.deletePatientPortalMessage(portalLoginUsername, portalPassword, created.sentMessage!.id);
      const afterDelete = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);

      expect(deleteResult).toMatchObject({
        authenticated: true,
        deleted: true,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        messageId: created.sentMessage!.id,
        deletedMessageCount: 1,
        messageCount: before.messageCount,
        sentMessageCount: before.sentMessageCount,
        failureReason: null
      });
      expect(deleteResult.deletedMessage).toMatchObject({
        id: created.sentMessage!.id,
        title,
        body,
        status: "Delete",
        senderId: portalLoginUsername,
        recipientId: "admin"
      });
      expect(afterCreate.sentMessageCount).toBe(before.sentMessageCount + 1);
      expect(afterDelete.messageCount).toBe(before.messageCount);
      expect(afterDelete.sentMessageCount).toBe(before.sentMessageCount);
      expect(afterDelete.sentMessages.some((message) => message.id === created.sentMessage!.id || message.title === title)).toBe(false);
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
    }
  });

  test("archives a secure message from the patient portal surface", async ({ page, target, workflow }) => {
    test.setTimeout(240_000);

    const title = "Slice 214 UI secure message archive";
    const body = "Slice 214 portal UI archive evidence.";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);

    try {
      const created = await workflow.composePatientPortalMessage(portalLoginUsername, portalPassword, {
        recipientId: "admin",
        title,
        body
      });
      expect(created.sentMessage).toBeTruthy();

      if (target.type === "legacy-openemr") {
        await expectLegacyPatientPortalSentMessage(page, target, title);
        await workflow.deletePatientPortalMessage(portalLoginUsername, portalPassword, created.sentMessage!.id);
        await expectLegacyPatientPortalArchivedMessage(page, target, title);
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        const card = page.locator("article.message-item").filter({ hasText: title }).first();
        await expect(card).toContainText(body);
        await card.getByRole("button", { name: "Archive message" }).click();
        await expect(page.locator("body")).toContainText(`Secure message archived for ${title}`);
        await expect(page.locator("article.message-item").filter({ hasText: title })).toHaveCount(0);
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

async function expectLegacyPatientPortalSentMessage(page: Page, target: RuntimeTarget, title: string) {
  await openLegacyPatientPortalMessages(page, target);
  await page.getByText("Sent", { exact: false }).first().click();
  await expect(page.locator("body")).toContainText(title);
}

async function expectLegacyPatientPortalArchivedMessage(page: Page, target: RuntimeTarget, title: string) {
  await openLegacyPatientPortalMessages(page, target);
  await page.getByText("Sent", { exact: false }).first().click();
  await expect(page.locator("body")).not.toContainText(title);
  await page.getByText("Archive", { exact: false }).first().click();
  await expect(page.locator("body")).toContainText(title);
}
