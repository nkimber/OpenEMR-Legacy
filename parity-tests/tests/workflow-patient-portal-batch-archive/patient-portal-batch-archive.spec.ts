import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal secure-message batch archive parity @slice216 @workflow-patient-portal-batch-archive @patients @portal", () => {
  test("archives multiple patient-owned secure messages together and hides them from active folders", async ({ targetDb, workflow }) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    const firstTitle = "Slice 216 secure message batch archive A";
    const secondTitle = "Slice 216 secure message batch archive B";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, firstTitle);
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, secondTitle);

    try {
      const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const firstMessage = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        title: firstTitle,
        body: "Slice 216 temporary secure-message batch archive parity note A."
      });
      const secondMessage = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        title: secondTitle,
        body: "Slice 216 temporary secure-message batch archive parity note B."
      });
      const afterCreate = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const archiveResult = await workflow.archivePatientPortalMessages(portalLoginUsername, portalPassword, [
        firstMessage.id,
        secondMessage.id
      ]);
      const afterArchive = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);

      expect(afterCreate.messageCount).toBe(before.messageCount + 2);
      expect(archiveResult).toMatchObject({
        authenticated: true,
        archived: true,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        archivedMessageCount: 2,
        messageCount: before.messageCount,
        failureReason: null
      });
      expect(archiveResult.archivedMessages.map((message) => message.title).sort()).toEqual([firstTitle, secondTitle].sort());
      expect(archiveResult.archivedMessages.every((message) => message.status === "Delete")).toBe(true);
      expect(afterArchive.messageCount).toBe(before.messageCount);
      expect(afterArchive.messages.some((message) => message.id === firstMessage.id || message.title === firstTitle)).toBe(false);
      expect(afterArchive.messages.some((message) => message.id === secondMessage.id || message.title === secondTitle)).toBe(false);
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, firstTitle);
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, secondTitle);
    }
  });

  test("archives selected secure messages from the patient portal surface", async ({ page, target, workflow }) => {
    test.setTimeout(240_000);

    const firstTitle = "Slice 216 UI secure message batch archive A";
    const secondTitle = "Slice 216 UI secure message batch archive B";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, firstTitle);
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, secondTitle);

    try {
      await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        title: firstTitle,
        body: "Slice 216 portal UI batch archive evidence A."
      });
      await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        title: secondTitle,
        body: "Slice 216 portal UI batch archive evidence B."
      });

      if (target.type === "legacy-openemr") {
        await openLegacyPatientPortalMessages(page, target);
        await expect(page.locator("body")).toContainText(firstTitle);
        await expect(page.locator("body")).toContainText(secondTitle);
        await page.locator("tr", { hasText: firstTitle }).locator('input[type="checkbox"]').check();
        await page.locator("tr", { hasText: secondTitle }).locator('input[type="checkbox"]').check();
        page.once("dialog", (dialog) => void dialog.accept());
        await page.getByRole("button", { name: "Actions" }).click();
        await page.getByText("Send Selected to Archive", { exact: false }).click();
        await expect.poll(async () => {
          const messages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
          return messages.messages.some((message) => message.title === firstTitle || message.title === secondTitle);
        }).toBe(false);
        await page.getByText("Archive", { exact: false }).first().click();
        await expect(page.locator("body")).toContainText(firstTitle);
        await expect(page.locator("body")).toContainText(secondTitle);
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        await expect(page.locator("article.message-item").filter({ hasText: firstTitle })).toContainText("Slice 216 portal UI batch archive evidence A.");
        await expect(page.locator("article.message-item").filter({ hasText: secondTitle })).toContainText("Slice 216 portal UI batch archive evidence B.");
        await page.getByLabel(`Select secure message ${firstTitle}`).check();
        await page.getByLabel(`Select secure message ${secondTitle}`).check();
        await page.getByRole("button", { name: "Archive selected" }).click();
        await expect(page.locator("body")).toContainText("Archived 2 secure messages");
        await expect(page.locator("article.message-item").filter({ hasText: firstTitle })).toHaveCount(0);
        await expect(page.locator("article.message-item").filter({ hasText: secondTitle })).toHaveCount(0);
      }
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, firstTitle);
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, secondTitle);
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
