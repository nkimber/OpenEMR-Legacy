import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const htmlBody =
  '<p>Slice 240 <strong>bold portal guidance</strong> before <a href="https://example.test">external link text</a><img src=x alt="blocked image"> after image.</p>';

test.describe("patient portal secure-message HTML body rendering parity @slice240 @workflow-patient-portal-message-html @patients @portal @messages", () => {
  test("preserves raw secure-message HTML bodies at the workflow boundary", async ({ targetDb, workflow }) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    const title = "Slice 240 secure message HTML body API";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);

    try {
      const created = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        title,
        body: htmlBody,
        senderId: "admin",
        senderName: "Administrator"
      });
      expect(created).toMatchObject({
        title,
        body: htmlBody,
        status: "New",
        senderId: "admin",
        senderName: "Administrator",
        recipientId: portalLoginUsername,
        isEncrypted: false
      });

      const portalMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const rawMessage = portalMessages.messages.find((message) => message.title === title);
      expect(rawMessage).toBeDefined();
      expect(rawMessage).toMatchObject({
        title,
        body: htmlBody,
        status: "New",
        senderId: "admin",
        senderName: "Administrator",
        recipientId: portalLoginUsername,
        isEncrypted: false
      });
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
    }
  });

  test("renders formatted secure-message bodies without links or images", async ({ page, target, workflow }) => {
    test.setTimeout(240_000);

    const title = "Slice 240 secure message HTML body UI";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);

    try {
      await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        title,
        body: htmlBody,
        senderId: "admin",
        senderName: "Administrator"
      });

      if (target.type === "legacy-openemr") {
        await expectLegacySanitizedMessageBody(page, target, title);
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        const card = page.locator("article.message-item").filter({ hasText: title }).first();
        await expect(card).toContainText("bold portal guidance");
        await expect(card).toContainText("external link text");
        await expect(card).toContainText("after image.");

        const body = card.locator(".secure-message-body").first();
        await expect(body.locator("strong").filter({ hasText: "bold portal guidance" })).toBeVisible();
        await expect(body.locator("a")).toHaveCount(0);
        await expect(body.locator("img")).toHaveCount(0);
        await expect(card).not.toContainText("<strong>");
        await expect(card).not.toContainText("<a href");
        await expect(card).not.toContainText("blocked image");
      }
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
    }
  });
});

async function expectLegacySanitizedMessageBody(page: Page, target: RuntimeTarget, title: string) {
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
  await page.getByText(title, { exact: true }).first().click();

  const detail = page.locator(".jumbotron").filter({ hasText: "bold portal guidance" }).first();
  await expect(detail).toBeVisible();
  await expect(detail).toContainText("external link text");
  await expect(detail).toContainText("after image.");

  const body = detail.locator("[ng-bind-html]").first();
  const renderedHtml = await body.evaluate((element) => element.innerHTML);
  expect(renderedHtml).toContain("<strong>bold portal guidance</strong>");
  expect(renderedHtml).not.toContain("<a");
  expect(renderedHtml).not.toContain("<img");
  expect(renderedHtml).not.toContain("blocked image");
}
