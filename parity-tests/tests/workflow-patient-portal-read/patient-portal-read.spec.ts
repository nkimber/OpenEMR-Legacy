import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal secure-message read-status parity @slice215 @workflow-patient-portal-read @patients @portal", () => {
  test("marks a patient-owned secure message read and keeps it in the inbox", async ({ targetDb, workflow }) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    const title = "Slice 215 secure message read status";
    const body = "Slice 215 temporary secure-message read-status parity note.";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);

    try {
      const beforeHome = await workflow.getPatientPortalHomeSummary(portalLoginUsername, portalPassword);
      const beforeMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const created = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        title,
        body
      });
      const afterCreateHome = await workflow.getPatientPortalHomeSummary(portalLoginUsername, portalPassword);
      const afterCreateMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const readResult = await workflow.readPatientPortalMessage(portalLoginUsername, portalPassword, created.id);
      const afterReadHome = await workflow.getPatientPortalHomeSummary(portalLoginUsername, portalPassword);
      const afterReadMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);

      expect(created).toMatchObject({
        title,
        body,
        status: "New",
        senderId: "admin",
        recipientId: portalLoginUsername
      });
      expect(afterCreateHome.messages.newMessages).toBe(beforeHome.messages.newMessages + 1);
      expect(afterCreateMessages.messageCount).toBe(beforeMessages.messageCount + 1);
      expect(readResult).toMatchObject({
        authenticated: true,
        markedRead: true,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        messageId: created.id,
        failureReason: null
      });
      expect(readResult.message).toMatchObject({
        id: created.id,
        title,
        body,
        status: "Read",
        senderId: "admin",
        recipientId: portalLoginUsername
      });
      expect(afterReadHome.messages.newMessages).toBe(beforeHome.messages.newMessages);
      expect(afterReadMessages.messageCount).toBe(beforeMessages.messageCount + 1);
      expect(afterReadMessages.messages.find((message) => message.id === created.id)).toMatchObject({
        title,
        status: "Read"
      });
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
    }
  });

  test("marks a secure message read from the patient portal surface", async ({ page, target, workflow }) => {
    test.setTimeout(240_000);

    const title = "Slice 215 UI secure message read status";
    const body = "Slice 215 portal UI read-status evidence.";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);

    try {
      const created = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        title,
        body
      });

      if (target.type === "legacy-openemr") {
        await openLegacyPatientPortalMessages(page, target);
        await expect(page.locator("body")).toContainText(title);
        await page.getByText(title).first().click();
        await expect.poll(async () => {
          const messages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
          return messages.messages.find((message) => message.id === created.id)?.status;
        }).toBe("Read");
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        const card = page.locator("article.message-item").filter({ hasText: title }).first();
        await expect(card).toContainText(body);
        await expect(card.locator(".status-pill")).toContainText("New");
        await card.getByRole("button", { name: "Mark read" }).click();
        await expect(page.locator("body")).toContainText(`Secure message marked read for ${title}`);
        await expect(page.locator("article.message-item").filter({ hasText: title }).locator(".status-pill")).toContainText("Read");
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
