import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalAuthAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal authentication parity @slice207 @workflow-patient-portal-authentication @mutation @patients", () => {
  test("authenticates valid portal credentials and rejects invalid, disabled, and pending-reset accounts", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(portalAuthAnchorPatientId);
    expect(patient).not.toBeNull();

    const originalAccess = await workflow.getPatientPortalAccountAccessState(patient!.pid);
    const originalReset = await workflow.getPatientPortalAccountResetState(patient!.pid);
    if (!originalAccess || !originalReset) {
      throw new Error("Missing original patient portal account authentication state.");
    }

    expect(originalAccess).toMatchObject({
      portalEnabled: true,
      accessStatusLabel: "Enabled",
      cmsPortalLogin: portalLoginUsername,
      hasAccount: true
    });
    expect(originalReset).toMatchObject({
      passwordStatus: 1,
      passwordStatusLabel: "Patient-managed password",
      oneTimeLinkPending: false,
      resetStatusLabel: "No reset pending"
    });

    try {
      const success = await workflow.verifyPatientPortalLogin(portalLoginUsername, portalPassword);
      expect(success).toMatchObject({
        authenticated: true,
        username: portalLoginUsername,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        failureReason: null
      });

      if (target.type === "legacy-openemr") {
        await expectLegacyPatientPortalLogin(page, target, portalLoginUsername, portalPassword);
      } else {
        await expectModernizedPortalReadinessMessage(
          page,
          target,
          patient!.pubpid,
          portalLoginUsername,
          portalPassword,
          /Portal sign-in ready/
        );
      }

      const invalid = await workflow.verifyPatientPortalLogin(portalLoginUsername, "WrongPortal207!");
      expect(invalid).toMatchObject({
        authenticated: false,
        username: portalLoginUsername,
        failureReason: "Invalid username or password."
      });

      const disabled = {
        ...originalAccess,
        portalEnabled: false,
        accessStatusLabel: "Access disabled"
      };
      await workflow.updatePatientPortalAccountAccessState(disabled);
      await expect(workflow.getPatientPortalAccountAccessState(patient!.pid)).resolves.toEqual(disabled);

      const disabledLogin = await workflow.verifyPatientPortalLogin(portalLoginUsername, portalPassword);
      expect(disabledLogin).toMatchObject({
        authenticated: false,
        username: portalLoginUsername,
        failureReason: "Patient portal access is disabled."
      });

      if (target.type === "legacy-openemr") {
        await expectLegacyPatientPortalRejected(page, target, portalLoginUsername, portalPassword);
      } else {
        await expectModernizedPortalReadinessMessage(
          page,
          target,
          patient!.pubpid,
          portalLoginUsername,
          portalPassword,
          /Patient portal access is disabled\./
        );
      }

      await workflow.updatePatientPortalAccountAccessState(originalAccess);

      const pendingReset = {
        ...originalReset,
        passwordStatus: 0,
        passwordStatusLabel: "Temporary password issued",
        oneTimeLinkPending: true,
        resetStatusLabel: "One-time reset pending"
      };
      await workflow.updatePatientPortalAccountResetState(pendingReset);
      await expect(workflow.getPatientPortalAccountResetState(patient!.pid)).resolves.toEqual(pendingReset);

      const pendingResetLogin = await workflow.verifyPatientPortalLogin(portalLoginUsername, portalPassword);
      expect(pendingResetLogin).toMatchObject({
        authenticated: false,
        username: portalLoginUsername,
        failureReason: "One-time reset pending."
      });

      if (target.type === "legacy-openemr") {
        await expectLegacyPatientPortalPasswordUpdate(page, target, portalLoginUsername, portalPassword);
      } else {
        await expectModernizedPortalReadinessMessage(
          page,
          target,
          patient!.pubpid,
          portalLoginUsername,
          portalPassword,
          /One-time reset pending\./
        );
      }
    } finally {
      await workflow.updatePatientPortalAccountResetState(originalReset);
      await workflow.updatePatientPortalAccountAccessState(originalAccess);
    }

    await expect(workflow.getPatientPortalAccountResetState(patient!.pid)).resolves.toEqual(originalReset);
    await expect(workflow.getPatientPortalAccountAccessState(patient!.pid)).resolves.toEqual(originalAccess);
  });
});

async function expectLegacyPatientPortalLogin(page: Page, target: RuntimeTarget, username: string, password: string) {
  await fillLegacyPatientPortalCredentials(page, target, username, password);
  await page.getByRole("button", { name: "Log In" }).click();
  await expect.poll(() => page.url()).toContain("/portal/home.php");
  await expectRenderedText(page, /Portal|Appointments|Home|Medical/i);
}

async function expectLegacyPatientPortalRejected(page: Page, target: RuntimeTarget, username: string, password: string) {
  await fillLegacyPatientPortalCredentials(page, target, username, password);
  await page.getByRole("button", { name: "Log In" }).click();
  await expect.poll(() => page.url()).toContain("&w");
  await expectRenderedText(page, /Something went wrong|Portal Login/i);
}

async function expectLegacyPatientPortalPasswordUpdate(
  page: Page,
  target: RuntimeTarget,
  username: string,
  password: string
) {
  await fillLegacyPatientPortalCredentials(page, target, username, password);
  await page.getByRole("button", { name: "Log In" }).click();
  await expectRenderedText(page, "Please Enter New Credentials");
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

async function expectModernizedPortalReadinessMessage(
  page: Page,
  target: RuntimeTarget,
  pubpid: string,
  username: string,
  password: string,
  message: RegExp
) {
  await openAuthenticatedModernizedPatient(page, target, pubpid);
  const form = page.locator('form[aria-label="Patient portal login readiness"]');
  await expect(form).toBeVisible();
  await form.getByLabel("Portal login username").fill(username);
  await form.getByLabel("Portal login password").fill(password);
  await form.getByRole("button", { name: "Verify portal sign-in" }).click();
  await expect(form).toContainText(message);
}
