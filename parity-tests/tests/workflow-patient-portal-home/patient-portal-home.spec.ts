import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalHomeAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal home parity @slice209 @workflow-patient-portal-home @patients @portal", () => {
  test("shows portal identity, secure message summary, and upcoming appointments", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalHomeAnchorPatientId);
    expect(patient).not.toBeNull();

    const account = await workflow.getPatientPortalAccountAccessState(patient!.pid);
    expect(account).toMatchObject({
      portalEnabled: true,
      accessStatusLabel: "Enabled",
      cmsPortalLogin: portalLoginUsername,
      hasAccount: true
    });

    const home = await workflow.getPatientPortalHomeSummary(portalLoginUsername, portalPassword);
    expect(home).toMatchObject({
      authenticated: true,
      username: portalLoginUsername,
      portalUsername: portalLoginUsername,
      pid: patient!.pid,
      pubpid: patient!.pubpid,
      displayName: "Kim, Nora",
      failureReason: null
    });
    expect(home.messages).toMatchObject({
      totalMessages: 2,
      newMessages: 1,
      doneMessages: 1,
      latestMessageTitle: "Portal message"
    });
    expect(home.upcomingAppointmentCount).toBeGreaterThanOrEqual(1);
    expect(home.upcomingAppointments[0]).toMatchObject({
      date: "2026-07-28",
      startTime: "14:30",
      title: "Preventive Care",
      status: "-"
    });

    if (target.type === "legacy-openemr") {
      await expectLegacyPatientPortalHome(page, target, portalLoginUsername, portalPassword);
    } else {
      await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
      await expect(page.locator("body")).toContainText("Kim, Nora");
      await expect(page.locator("body")).toContainText("MOD-PAT-0004");
      await expect(page.locator("body")).toContainText("New messages");
      await expect(page.locator("body")).toContainText("2026-07-28");
      await expect(page.locator("body")).toContainText("Preventive Care");
    }
  });
});

async function expectLegacyPatientPortalHome(page: Page, target: RuntimeTarget, username: string, password: string) {
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
  await expectRenderedText(page, /Portal|Appointments|Secure|Messages/i);
}
