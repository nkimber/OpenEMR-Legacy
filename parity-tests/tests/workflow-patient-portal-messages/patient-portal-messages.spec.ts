import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal secure-message parity @slice210 @workflow-patient-portal-messages @patients @portal", () => {
  test("shows the signed-in patient's secure-message inbox", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    const portalMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
    expect(portalMessages).toMatchObject({
      authenticated: true,
      username: portalLoginUsername,
      portalUsername: portalLoginUsername,
      pid: patient!.pid,
      pubpid: patient!.pubpid,
      displayName: "Kim, Nora",
      messageCount: 2,
      failureReason: null
    });

    const latestMessage = portalMessages.messages[0];
    const portalMessage = portalMessages.messages.find((message) => message.title === "Portal message");
    const careTeamMessage = portalMessages.messages.find((message) => message.title === "Care team follow-up");
    expect(latestMessage).toMatchObject({
      title: "Portal message",
      status: "Done",
      body: "Patient portal question about medications.",
      isEncrypted: false
    });
    expect(portalMessage).toMatchObject({
      status: "Done",
      body: "Patient portal question about medications.",
      isEncrypted: false
    });
    expect(careTeamMessage).toMatchObject({
      status: "New",
      body: "Follow-up message for Nora Kim.",
      isEncrypted: false
    });

    if (target.type === "legacy-openemr") {
      await expectLegacyPatientPortalMessages(page, target, portalLoginUsername, portalPassword);
    } else {
      await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
      await expect(page.locator("body")).toContainText("Secure Messages");
      await expect(page.locator("body")).toContainText("Inbox");
      await expect(page.locator("body")).toContainText("Portal message");
      await expect(page.locator("body")).toContainText("Patient portal question about medications.");
      await expect(page.locator("body")).toContainText("Care team follow-up");
      await expect(page.locator("body")).toContainText("Plain text message");
    }
  });
});

async function expectLegacyPatientPortalMessages(page: Page, target: RuntimeTarget, username: string, password: string) {
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
  await expect(page.locator("body")).toContainText("Portal message");
  await expect(page.locator("body")).toContainText("Care team follow-up");
}
