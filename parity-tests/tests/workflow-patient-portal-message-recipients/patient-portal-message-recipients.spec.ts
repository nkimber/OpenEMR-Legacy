import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalRecipientAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal secure-message recipient directory parity @slice238 @workflow-patient-portal-message-recipients @patients @portal @messages", () => {
  test("normalizes the patient portal secure-message recipient directory", async ({ targetDb, workflow }) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalRecipientAnchorPatientId);
    expect(patient).not.toBeNull();

    const directory = await workflow.getPatientPortalMessageRecipients(portalLoginUsername, portalPassword);

    expect(directory).toMatchObject({
      authenticated: true,
      portalUsername: portalLoginUsername,
      pid: patient!.pid,
      recipientCount: 1,
      failureReason: null
    });
    expect(directory.recipients).toEqual([
      {
        id: "admin",
        displayName: "Administrator",
        type: "user",
        active: true,
        fallback: true
      }
    ]);
  });

  test("renders the available secure-message route as a portal compose option", async ({ page, target, workflow }) => {
    test.setTimeout(240_000);

    const directory = await workflow.getPatientPortalMessageRecipients(portalLoginUsername, portalPassword);
    const recipient = directory.recipients[0];
    expect(recipient).toMatchObject({ id: "admin", displayName: "Administrator" });

    if (target.type === "legacy-openemr") {
      await expectLegacyPortalRecipientOption(page, target, recipient.displayName);
      return;
    }

    await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
    await expect(page.locator("body")).toContainText("Recipient Directory");
    await expect(page.locator("body")).toContainText("1 routes");
    const selector = page.getByLabel("Secure message recipient");
    await expect(selector).toBeVisible();
    await expect(selector).toHaveValue(recipient.id);
    await expect(selector).toContainText(`${recipient.displayName} (${recipient.id})`);
  });
});

async function expectLegacyPortalRecipientOption(page: Page, target: RuntimeTarget, recipientName: string) {
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
  await page.getByText("Compose Message", { exact: false }).first().click();

  const selector = page.locator("#selSendto");
  await expect(selector).toBeVisible();
  await expect(selector).toContainText(recipientName);
}
