import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import { protectedPatientPortalMessageBody } from "../../src/workflows/legacyWorkflowActions.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const encryptedTitle = "Slice 233 encrypted secure message";
const encryptedBody = "Synthetic encrypted secure-message body should not be portal-visible.";

test.describe("patient portal secure-message encrypted body parity @slice233 @workflow-patient-portal-message-encryption @patients @portal", () => {
  test("protects encrypted secure-message bodies in API and portal UI", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, encryptedTitle);

    try {
      const created = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        title: encryptedTitle,
        body: encryptedBody,
        senderId: "admin",
        senderName: "Administrator",
        isEncrypted: true
      });
      expect(created).toMatchObject({
        title: encryptedTitle,
        body: protectedPatientPortalMessageBody,
        isEncrypted: true
      });

      const portalMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      expect(portalMessages).toMatchObject({
        authenticated: true,
        username: portalLoginUsername,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        failureReason: null
      });

      const encryptedMessage = portalMessages.messages.find((message) => message.title === encryptedTitle);
      expect(encryptedMessage).toBeDefined();
      expect(encryptedMessage).toMatchObject({
        title: encryptedTitle,
        body: protectedPatientPortalMessageBody,
        status: "New",
        senderId: "admin",
        senderName: "Administrator",
        recipientId: portalLoginUsername,
        isEncrypted: true
      });
      expect(encryptedMessage?.body).not.toContain(encryptedBody);

      if (target.type === "legacy-openemr") {
        await expectLegacyEncryptedMessage(page, target, portalLoginUsername, portalPassword);
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        await expect(page.locator("body")).toContainText("Secure Messages");
        await expect(page.locator("body")).toContainText(encryptedTitle);
        await expect(page.locator("body")).toContainText("Encrypted message");
        await expect(page.locator("body")).toContainText(protectedPatientPortalMessageBody);
        await expect(page.locator("body")).not.toContainText(encryptedBody);
      }
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, encryptedTitle);
    }
  });
});

async function expectLegacyEncryptedMessage(page: Page, target: RuntimeTarget, username: string, password: string) {
  await page.context().clearCookies();
  await page.goto(`${target.publicUrl}/portal/index.php?site=default&woops=1`);
  await page.locator("#uname").fill(username);
  await page.locator("#pass").fill(password);

  const emailConfirmation = page.locator("#passaddon");
  if ((await emailConfirmation.count()) > 0 && await emailConfirmation.isVisible()) {
    await emailConfirmation.fill(username);
  }

  await page.getByRole("button", { name: "Log In" }).click();
  await expect.poll(() => page.url()).toContain("/portal/home.php");
  await page.goto(`${target.publicUrl}/portal/messaging/messages.php`);
  await expectRenderedText(page, /Secure Messaging/i);
  await expectRenderedText(page, /Inbox/i);
  await expect(page.locator("body")).toContainText(encryptedTitle);
}
