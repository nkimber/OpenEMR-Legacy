import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const primaryTitle = "Slice 242 mark all read primary";
const secondaryTitle = "Slice 242 mark all read secondary";
const messageDate = "2099-12-28";
const allTitles = [primaryTitle, secondaryTitle];

test.describe("patient portal secure-message mark-all-read parity @slice242 @workflow-patient-portal-message-mark-all-read @patients @portal @messages", () => {
  test("marks current secure-message rows read in the browser without persisting mailbox status", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    await cleanupMarkAllReadMessages(workflow);

    try {
      for (const title of allTitles) {
        await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
          title,
          body: `${title} temporary toolbar mark-all-read evidence.`,
          senderId: "admin",
          senderName: "Administrator",
          messageDate
        });
      }

      const beforeMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      for (const title of allTitles) {
        expect(beforeMessages.messages.find((message) => message.title === title)).toMatchObject({
          title,
          status: "New"
        });
      }

      if (target.type === "legacy-openemr") {
        await expectLegacyMarkAllRead(page, target);
      } else {
        await expectModernizedMarkAllRead(page, target);
      }

      const afterMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      for (const title of allTitles) {
        expect(afterMessages.messages.find((message) => message.title === title)).toMatchObject({
          title,
          status: "New"
        });
      }
    } finally {
      await cleanupMarkAllReadMessages(workflow);
    }
  });
});

async function cleanupMarkAllReadMessages(workflow: {
  cleanupPatientPortalComposedMessage(portalUsername: string, title: string): Promise<void>;
}) {
  for (const title of allTitles) {
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
  }
}

async function expectLegacyMarkAllRead(page: Page, target: RuntimeTarget) {
  await openLegacyPatientPortalMessages(page, target);
  const row = page.locator("tr").filter({ hasText: primaryTitle }).first();
  await expect(row).toContainText("New");

  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("link", { name: "Mark all as read" }).click();

  await expect(row).toContainText("Read");

  await page.reload();
  await expectRenderedText(page, /Secure Messaging/i);
  await expect(page.locator("tr").filter({ hasText: primaryTitle }).first()).toContainText("New");
}

async function expectModernizedMarkAllRead(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const inbox = page.getByRole("region", { name: "Inbox secure messages" });
  const card = inbox.locator("article.message-item").filter({ hasText: primaryTitle }).first();
  await expect(card).toContainText(primaryTitle);
  await expect(card.locator(".status-pill")).toContainText("New");

  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(card.locator(".status-pill")).toContainText("Read");

  await page.getByRole("button", { name: "Refresh portal home" }).click();
  await expect(page.locator("body")).toContainText("Portal home ready");
  await expect(inbox.locator("article.message-item").filter({ hasText: primaryTitle }).first().locator(".status-pill")).toContainText("New");
}

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
