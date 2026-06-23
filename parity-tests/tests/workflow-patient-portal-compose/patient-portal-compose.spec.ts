import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal secure-message compose parity @slice211 @workflow-patient-portal-compose @patients @portal", () => {
  test("creates a patient-owned sent secure message", async ({ targetDb, workflow }) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    const title = "Slice 211 secure message compose";
    const body = "Please review this Slice 211 secure-message compose parity note.";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);

    try {
      const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const result = await workflow.composePatientPortalMessage(portalLoginUsername, portalPassword, {
        recipientId: "admin",
        title,
        body
      });
      const after = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const sentMessage = after.sentMessages.find((message) => message.title === title);

      expect(result).toMatchObject({
        authenticated: true,
        created: true,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        recipientId: "admin",
        messageCount: before.messageCount,
        sentMessageCount: before.sentMessageCount + 1,
        failureReason: null
      });
      expect(result.sentMessage).toMatchObject({
        title,
        body,
        status: "New",
        senderId: portalLoginUsername,
        recipientId: "admin",
        isEncrypted: false
      });
      expect(result.recipientMessage).toMatchObject({
        title,
        body,
        status: "New",
        senderId: portalLoginUsername,
        recipientId: "admin"
      });
      expect(after.messageCount).toBe(before.messageCount);
      expect(after.sentMessageCount).toBe(before.sentMessageCount + 1);
      expect(sentMessage).toMatchObject({
        body,
        status: "New",
        senderId: portalLoginUsername,
        recipientId: "admin"
      });
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
    }
  });

  test("shows the composed message on the patient portal sent surface", async ({ page, target, workflow }) => {
    test.setTimeout(240_000);

    const title = "Slice 211 UI secure message";
    const body = "Modernized and legacy portal sent-folder evidence for Slice 211.";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);

    try {
      if (target.type === "legacy-openemr") {
        await workflow.composePatientPortalMessage(portalLoginUsername, portalPassword, {
          recipientId: "admin",
          title,
          body
        });
        await expectLegacyPatientPortalSentMessage(page, target, title);
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        await page.getByLabel("Secure message recipient").fill("admin");
        await page.getByLabel("Secure message subject").fill(title);
        await page.getByLabel("Secure message body").fill(body);
        await page.getByRole("button", { name: "Send secure message" }).click();
        await expect(page.locator("body")).toContainText("Secure message sent to");
        await expect(page.locator("body")).toContainText("Sent");
        await expect(page.locator("body")).toContainText(title);
        await expect(page.locator("body")).toContainText(body);
      }
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
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
