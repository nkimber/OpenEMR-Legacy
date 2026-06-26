import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalSessionAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal session parity @slice208 @workflow-patient-portal-session @mutation @patients", () => {
  test("ends a portal session and rejects reuse", async ({ page, target, targetDb, workflow }, testInfo) => {
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-208-patient-portal-session-precondition",
      description: "Captures the Slice 208 session precondition: anchor patient, enabled portal access, managed password, and no pending reset.",
      expected: {
        anchorCanonicalId: portalSessionAnchorPatientId,
        loginUsername: portalLoginUsername,
        access: {
          portalEnabled: true,
          accessStatusLabel: "Enabled",
          cmsPortalLogin: portalLoginUsername,
          hasAccount: true
        },
        reset: {
          passwordStatus: 1,
          passwordStatusLabel: "Patient-managed password",
          oneTimeLinkPending: false,
          resetStatusLabel: "No reset pending"
        }
      },
      actual: {
        patient,
        access,
        reset
      },
      context: {
        canonicalId: portalSessionAnchorPatientId,
        suite: "workflow-patient-portal-session",
        workflow: "patient-portal-session-precondition"
      }
    });

    const login = await workflow.verifyPatientPortalLogin(portalLoginUsername, portalPassword);
    expect(login).toMatchObject({
      authenticated: true,
      username: portalLoginUsername,
      pid: patient!.pid,
      pubpid: patient!.pubpid,
      failureReason: null
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-208-patient-portal-session-login",
      description: "Captures the Slice 208 portal login result used to start the session lifecycle test.",
      expected: {
        authenticated: true,
        username: portalLoginUsername,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        failureReason: null
      },
      actual: {
        patient,
        login
      },
      context: {
        canonicalId: portalSessionAnchorPatientId,
        suite: "workflow-patient-portal-session",
        workflow: "patient-portal-session-login"
      }
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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-208-patient-portal-session-modernized-active",
        description: "Captures the Slice 208 modernized active-session API response before logout.",
        expected: {
          authenticated: true,
          sessionId: login.sessionId,
          username: portalLoginUsername,
          pid: patient!.pid,
          pubpid: patient!.pubpid,
          failureReason: null
        },
        actual: {
          login,
          active
        },
        context: {
          canonicalId: portalSessionAnchorPatientId,
          suite: "workflow-patient-portal-session",
          workflow: "patient-portal-session-modernized-active"
        }
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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-208-patient-portal-session-modernized-ended",
        description: "Captures the Slice 208 modernized session logout response after ending the active session.",
        expected: {
          authenticated: false,
          sessionId: login.sessionId,
          username: portalLoginUsername,
          pid: patient!.pid,
          pubpid: patient!.pubpid,
          failureReason: "Session is not active.",
          endedAtPresent: true
        },
        actual: {
          ended
        },
        context: {
          canonicalId: portalSessionAnchorPatientId,
          suite: "workflow-patient-portal-session",
          workflow: "patient-portal-session-modernized-ended"
        }
      });

      const inactive = await workflow.getPatientPortalSession(login.sessionId!);
      expect(inactive).toMatchObject({
        authenticated: false,
        sessionId: login.sessionId,
        failureReason: "Session is not active."
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-208-patient-portal-session-modernized-inactive-reuse",
        description: "Captures the Slice 208 modernized inactive-session reuse rejection after logout.",
        expected: {
          authenticated: false,
          sessionId: login.sessionId,
          failureReason: "Session is not active."
        },
        actual: {
          inactive
        },
        context: {
          canonicalId: portalSessionAnchorPatientId,
          suite: "workflow-patient-portal-session",
          workflow: "patient-portal-session-modernized-inactive-reuse"
        }
      });

      const modernizedSessionSurface = await expectModernizedPortalSessionEnd(
        page,
        target,
        patient!.pubpid,
        portalLoginUsername,
        portalPassword
      );
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-208-patient-portal-session-modernized-surface",
        description: "Captures the Slice 208 modernized Patient/Client Portal Account surface after ending a readiness session.",
        expected: {
          visibleText: [
            "Portal sign-in ready",
            "Portal session ended"
          ]
        },
        actual: {
          url: page.url(),
          modernizedSessionSurface
        },
        context: {
          canonicalId: portalSessionAnchorPatientId,
          suite: "workflow-patient-portal-session",
          workflow: "patient-portal-session-modernized-surface"
        }
      });
    } else {
      const legacyLogoutSurface = await expectLegacyPatientPortalLogout(page, target, portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-208-patient-portal-session-legacy-logout-surface",
        description: "Captures the Slice 208 legacy patient portal logout rendering after browser-cookie logout.",
        expected: {
          urlIncludes: "logout",
          visibleText: /Patient Portal Login|Portal Login|Username/i.toString()
        },
        actual: {
          url: page.url(),
          legacyLogoutSurface
        },
        context: {
          canonicalId: portalSessionAnchorPatientId,
          suite: "workflow-patient-portal-session",
          workflow: "patient-portal-session-legacy-logout-surface"
        }
      });
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
  return page.locator("body").innerText();
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
  return form.innerText();
}
