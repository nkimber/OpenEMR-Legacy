import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalSessionAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal session parity @slice208 @workflow-patient-portal-session @mutation @patients", () => {
  test("ends a portal session and rejects reuse", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(portalSessionAnchorPatientId);
    expect(patient).not.toBeNull();

    const access = await workflow.getPatientPortalAccountAccessState(patient!.pid);
    const reset = await workflow.getPatientPortalAccountResetState(patient!.pid);
    expect(access).toMatchObject({
      portalEnabled: true,
      accessStatusLabel: "Enabled",
      cmsPortalLogin: portalLoginUsername,
      hasAccount: true
    });
    expect(reset).toMatchObject({
      passwordStatus: 1,
      passwordStatusLabel: "Patient-managed password",
      oneTimeLinkPending: false,
      resetStatusLabel: "No reset pending"
    });

    const login = await workflow.verifyPatientPortalLogin(portalLoginUsername, portalPassword);
    expect(login).toMatchObject({
      authenticated: true,
      username: portalLoginUsername,
      pid: patient!.pid,
      pubpid: patient!.pubpid,
      failureReason: null
    });

    if (target.type === "modernized-openemr") {
      expect(login.sessionId).toBeTruthy();
      const active = await workflow.getPatientPortalSession(login.sessionId!);
      expect(active).toMatchObject({
        authenticated: true,
        sessionId: login.sessionId,
        username: portalLoginUsername,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        failureReason: null
      });

      const ended = await workflow.endPatientPortalSession(login.sessionId!);
      expect(ended).toMatchObject({
        authenticated: false,
        sessionId: login.sessionId,
        username: portalLoginUsername,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        failureReason: "Session is not active."
      });
      expect(ended.endedAt).toBeTruthy();

      const inactive = await workflow.getPatientPortalSession(login.sessionId!);
      expect(inactive).toMatchObject({
        authenticated: false,
        sessionId: login.sessionId,
        failureReason: "Session is not active."
      });

      await expectModernizedPortalSessionEnd(page, target, patient!.pubpid, portalLoginUsername, portalPassword);
    } else {
      await expectLegacyPatientPortalLogout(page, target, portalLoginUsername, portalPassword);
    }
  });
});

async function expectLegacyPatientPortalLogout(page: Page, target: RuntimeTarget, username: string, password: string) {
  await fillLegacyPatientPortalCredentials(page, target, username, password);
  await page.getByRole("button", { name: "Log In" }).click();
  await expect.poll(() => page.url()).toContain("/portal/home.php");
  await expectRenderedText(page, /Portal|Appointments|Home|Medical/i);

  await page.goto(`${target.publicUrl}/portal/logout.php`);
  await expect.poll(() => page.url()).toContain("logout");
  await expectRenderedText(page, /Patient Portal Login|Portal Login|Username/i);
}

async function fillLegacyPatientPortalCredentials(page: Page, target: RuntimeTarget, username: string, password: string) {
  await page.context().clearCookies();
  await page.goto(`${target.publicUrl}/portal/index.php?site=default&woops=1`);
  await page.locator("#uname").fill(username);
  await page.locator("#pass").fill(password);

  const emailConfirmation = page.locator("#passaddon");
  if ((await emailConfirmation.count()) > 0 && await emailConfirmation.isVisible()) {
    await emailConfirmation.fill(username);
  }
}

async function expectModernizedPortalSessionEnd(
  page: Page,
  target: RuntimeTarget,
  pubpid: string,
  username: string,
  password: string
) {
  await openAuthenticatedModernizedPatient(page, target, pubpid);
  const form = page.locator('form[aria-label="Patient portal login readiness"]');
  await expect(form).toBeVisible();
  await form.getByLabel("Portal login username").fill(username);
  await form.getByLabel("Portal login password").fill(password);
  await form.getByRole("button", { name: "Verify portal sign-in" }).click();
  await expect(form).toContainText(/Portal sign-in ready/);
  await form.getByRole("button", { name: "End portal session" }).click();
  await expect(form).toContainText(/Portal session ended/);
}
