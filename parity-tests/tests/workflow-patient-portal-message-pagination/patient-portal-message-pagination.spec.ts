import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const secureMessagePageSize = 20;
const fillerMessageDate = "2099-12-31";
const secondPageMessageDate = "2099-12-30";
const fillerTitles = Array.from(
  { length: secureMessagePageSize },
  (_, index) => `Slice 241 paging filler ${String(index + 1).padStart(2, "0")}`
);
const secondPageTitle = "Slice 241 paging older inbox message";
const allPaginationTitles = [...fillerTitles, secondPageTitle];

test.describe("patient portal secure-message pagination parity @slice241 @workflow-patient-portal-message-pagination @patients @portal @messages", () => {
  test("shows an older inbox message only after moving past the first 20-message page", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    test.setTimeout(360_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    await cleanupPaginationMessages(workflow);

    try {
      for (const title of fillerTitles) {
        await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
          title,
          body: `${title} temporary first-page pagination evidence.`,
          senderId: "admin",
          senderName: "Administrator",
          messageDate: fillerMessageDate
        });
      }

      await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        title: secondPageTitle,
        body: "Slice 241 temporary second-page pagination evidence.",
        senderId: "admin",
        senderName: "Administrator",
        messageDate: secondPageMessageDate
      });

      const portalMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const targetIndex = portalMessages.messages.findIndex((message) => message.title === secondPageTitle);
      expect(portalMessages.messages.slice(0, secureMessagePageSize).map((message) => message.title)).toEqual(
        expect.arrayContaining(fillerTitles)
      );
      expect(targetIndex).toBeGreaterThanOrEqual(secureMessagePageSize);
      expect(targetIndex).toBeLessThan(secureMessagePageSize * 2);

      if (target.type === "legacy-openemr") {
        await expectLegacyInboxPagination(page, target);
      } else {
        await expectModernizedInboxPagination(page, target);
      }
    } finally {
      await cleanupPaginationMessages(workflow);
    }
  });
});

async function cleanupPaginationMessages(workflow: {
  cleanupPatientPortalComposedMessage(portalUsername: string, title: string): Promise<void>;
}) {
  for (const title of allPaginationTitles) {
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
  }
}

async function expectLegacyInboxPagination(page: Page, target: RuntimeTarget) {
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
  await expect.poll(() => getVisibleExactTextCount(page, fillerTitles[0])).toBeGreaterThan(0);
  await expect.poll(() => getVisibleExactTextCount(page, secondPageTitle)).toBe(0);

  await page.locator('button[ng-click="nextPage()"]').click();
  await expect.poll(() => getVisibleExactTextCount(page, secondPageTitle)).toBeGreaterThan(0);
}

async function getVisibleExactTextCount(page: Page, text: string) {
  return page.getByText(text, { exact: true }).evaluateAll((elements, expectedText) => {
    return elements.filter((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        element.textContent?.trim() === expectedText &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    }).length;
  }, text);
}

async function expectModernizedInboxPagination(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const inbox = page.getByRole("region", { name: "Inbox secure messages" });

  await expect(inbox).toContainText(fillerTitles[0]);
  await expect(inbox).not.toContainText(secondPageTitle);

  await page.getByRole("button", { name: "Next Inbox secure messages page" }).click();
  await expect(inbox).toContainText(secondPageTitle);
}
