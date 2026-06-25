import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalNotificationAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const notificationInput = {
  dueStatus: "Due Soon",
  category: "act_cat_remind",
  item: "act_appointment"
};

test.describe("patient portal secure-message notification parity @slice255 @workflow-patient-portal-message-notifications @patients @portal @messages", () => {
  test("projects active patient reminders into Inbox and All only", async ({ targetDb, workflow }) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalNotificationAnchorPatientId);
    expect(patient).not.toBeNull();

    await workflow.cleanupPatientPortalNotification(portalLoginUsername, portalPassword, notificationInput);

    try {
      const created = await workflow.createPatientPortalNotification(portalLoginUsername, portalPassword, notificationInput);
      expect(created).toMatchObject({
        type: "Notification",
        title: notificationInput.dueStatus,
        body: "Reminder:Appointment",
        status: "",
        senderId: "",
        senderName: "Patient Reminders",
        recipientId: portalLoginUsername,
        isEncrypted: false
      });

      const portalMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const inboxNotification = portalMessages.messages.find((message) => message.id === created.id && message.type === "Notification");
      const allNotification = portalMessages.allMessages.find((message) => message.id === created.id && message.type === "Notification");
      const sentNotification = portalMessages.sentMessages.find((message) => message.id === created.id);
      const deletedNotification = portalMessages.deletedMessages.find((message) => message.id === created.id);

      expect(inboxNotification).toMatchObject(created);
      expect(allNotification).toMatchObject(created);
      expect(sentNotification).toBeUndefined();
      expect(deletedNotification).toBeUndefined();
      expect(portalMessages.messageCount).toBe(portalMessages.messages.length);
      expect(portalMessages.allMessageCount).toBe(portalMessages.allMessages.length);
    } finally {
      await workflow.cleanupPatientPortalNotification(portalLoginUsername, portalPassword, notificationInput);
    }
  });

  test("documents legacy UI absence and renders modernized notifications as read-only rows", async ({ page, target, workflow }) => {
    test.setTimeout(240_000);

    await workflow.cleanupPatientPortalNotification(portalLoginUsername, portalPassword, notificationInput);

    try {
      await workflow.createPatientPortalNotification(portalLoginUsername, portalPassword, notificationInput);

      if (target.type === "legacy-openemr") {
        await expectLegacyPatientPortalNotificationAbsence(page, target);
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        const card = page.locator("article.message-item").filter({ hasText: notificationInput.dueStatus }).first();
        await expect(card).toContainText("Reminder:Appointment");
        await expect(card).toContainText("Notification");
        await expect(card).toContainText("Read-only reminder");
        await expect(card.getByRole("button", { name: "View thread" })).toHaveCount(0);
        await expect(card.getByRole("button", { name: "Archive message" })).toHaveCount(0);
        await expect(card.getByRole("textbox", { name: `Reply to ${notificationInput.dueStatus}` })).toHaveCount(0);
      }
    } finally {
      await workflow.cleanupPatientPortalNotification(portalLoginUsername, portalPassword, notificationInput);
    }
  });
});

async function expectLegacyPatientPortalNotificationAbsence(page: Page, target: RuntimeTarget) {
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
  await expect(page.getByText("Care team follow-up", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(notificationInput.dueStatus, { exact: true })).toHaveCount(0);
  await expect(page.getByText("Reminder:Appointment", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Patient Reminders", { exact: false })).toHaveCount(0);
}
