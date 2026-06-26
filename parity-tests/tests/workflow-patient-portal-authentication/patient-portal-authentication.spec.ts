import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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
  }, testInfo) => {
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-207-patient-portal-authentication-precondition",
      description: "Captures the Slice 207 authentication precondition: anchor patient, enabled portal account, managed password, and no pending reset.",
      expected: {
        anchorCanonicalId: portalAuthAnchorPatientId,
        loginUsername: portalLoginUsername,
        originalAccess: {
          portalEnabled: true,
          accessStatusLabel: "Enabled",
          cmsPortalLogin: portalLoginUsername,
          hasAccount: true
        },
        originalReset: {
          passwordStatus: 1,
          passwordStatusLabel: "Patient-managed password",
          oneTimeLinkPending: false,
          resetStatusLabel: "No reset pending"
        }
      },
      actual: {
        patient,
        originalAccess,
        originalReset
      },
      context: {
        canonicalId: portalAuthAnchorPatientId,
        suite: "workflow-patient-portal-authentication",
        workflow: "patient-portal-authentication-precondition"
      }
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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-207-patient-portal-authentication-valid-login",
        description: "Captures the Slice 207 valid credential probe result for the seeded portal account.",
        expected: {
          authenticated: true,
          username: portalLoginUsername,
          pubpid: patient!.pubpid,
          failureReason: null
        },
        actual: {
          patient,
          success
        },
        context: {
          canonicalId: portalAuthAnchorPatientId,
          suite: "workflow-patient-portal-authentication",
          workflow: "patient-portal-authentication-valid-login"
        }
      });

      if (target.type === "legacy-openemr") {
        const legacyLoginSurface = await expectLegacyPatientPortalLogin(page, target, portalLoginUsername, portalPassword);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-207-patient-portal-authentication-legacy-valid-surface",
          description: "Captures the Slice 207 legacy patient portal home rendering after valid authentication.",
          expected: {
            urlIncludes: "/portal/home.php",
            visibleText: /Portal|Appointments|Home|Medical/i.toString()
          },
          actual: {
            url: page.url(),
            legacyLoginSurface
          },
          context: {
            canonicalId: portalAuthAnchorPatientId,
            suite: "workflow-patient-portal-authentication",
            workflow: "patient-portal-authentication-legacy-valid-surface"
          }
        });
      } else {
        const modernizedLoginSurface = await expectModernizedPortalReadinessMessage(
          page,
          target,
          patient!.pubpid,
          portalLoginUsername,
          portalPassword,
          /Portal sign-in ready/
        );
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-207-patient-portal-authentication-modernized-valid-surface",
          description: "Captures the Slice 207 modernized Patient/Client Portal Account readiness rendering after valid authentication.",
          expected: {
            message: "Portal sign-in ready"
          },
          actual: {
            url: page.url(),
            modernizedLoginSurface
          },
          context: {
            canonicalId: portalAuthAnchorPatientId,
            suite: "workflow-patient-portal-authentication",
            workflow: "patient-portal-authentication-modernized-valid-surface"
          }
        });
      }

      const invalid = await workflow.verifyPatientPortalLogin(portalLoginUsername, "WrongPortal207!");
      expect(invalid).toMatchObject({
        authenticated: false,
        username: portalLoginUsername,
        failureReason: "Invalid username or password."
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-207-patient-portal-authentication-invalid-password",
        description: "Captures the Slice 207 invalid-password rejection result for the seeded portal account.",
        expected: {
          authenticated: false,
          username: portalLoginUsername,
          failureReason: "Invalid username or password."
        },
        actual: {
          invalid
        },
        context: {
          canonicalId: portalAuthAnchorPatientId,
          suite: "workflow-patient-portal-authentication",
          workflow: "patient-portal-authentication-invalid-password"
        }
      });

      const disabled = {
        ...originalAccess,
        portalEnabled: false,
        accessStatusLabel: "Access disabled"
      };
      await workflow.updatePatientPortalAccountAccessState(disabled);
      const disabledState = await workflow.getPatientPortalAccountAccessState(patient!.pid);
      expect(disabledState).toEqual(disabled);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-207-patient-portal-authentication-disabled-state",
        description: "Captures the temporary Slice 207 disabled portal-access state before disabled-account authentication is rejected.",
        expected: {
          disabled
        },
        actual: {
          patient,
          disabledState
        },
        context: {
          canonicalId: portalAuthAnchorPatientId,
          suite: "workflow-patient-portal-authentication",
          workflow: "patient-portal-authentication-disabled-state"
        }
      });

      const disabledLogin = await workflow.verifyPatientPortalLogin(portalLoginUsername, portalPassword);
      expect(disabledLogin).toMatchObject({
        authenticated: false,
        username: portalLoginUsername,
        failureReason: "Patient portal access is disabled."
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-207-patient-portal-authentication-disabled-login",
        description: "Captures the Slice 207 disabled-account authentication rejection result.",
        expected: {
          authenticated: false,
          username: portalLoginUsername,
          failureReason: "Patient portal access is disabled."
        },
        actual: {
          disabledLogin
        },
        context: {
          canonicalId: portalAuthAnchorPatientId,
          suite: "workflow-patient-portal-authentication",
          workflow: "patient-portal-authentication-disabled-login"
        }
      });

      if (target.type === "legacy-openemr") {
        const legacyDisabledSurface = await expectLegacyPatientPortalRejected(page, target, portalLoginUsername, portalPassword);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-207-patient-portal-authentication-legacy-disabled-surface",
          description: "Captures the Slice 207 legacy portal login rejection rendering when portal access is disabled.",
          expected: {
            urlIncludes: "&w",
            visibleText: /Something went wrong|Portal Login/i.toString()
          },
          actual: {
            url: page.url(),
            legacyDisabledSurface
          },
          context: {
            canonicalId: portalAuthAnchorPatientId,
            suite: "workflow-patient-portal-authentication",
            workflow: "patient-portal-authentication-legacy-disabled-surface"
          }
        });
      } else {
        const modernizedDisabledSurface = await expectModernizedPortalReadinessMessage(
          page,
          target,
          patient!.pubpid,
          portalLoginUsername,
          portalPassword,
          /Patient portal access is disabled\./
        );
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-207-patient-portal-authentication-modernized-disabled-surface",
          description: "Captures the Slice 207 modernized readiness rendering when portal access is disabled.",
          expected: {
            message: "Patient portal access is disabled."
          },
          actual: {
            url: page.url(),
            modernizedDisabledSurface
          },
          context: {
            canonicalId: portalAuthAnchorPatientId,
            suite: "workflow-patient-portal-authentication",
            workflow: "patient-portal-authentication-modernized-disabled-surface"
          }
        });
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
      const pendingResetState = await workflow.getPatientPortalAccountResetState(patient!.pid);
      expect(pendingResetState).toEqual(pendingReset);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-207-patient-portal-authentication-pending-reset-state",
        description: "Captures the temporary Slice 207 pending-reset state before authentication is rejected.",
        expected: {
          pendingReset
        },
        actual: {
          patient,
          pendingResetState
        },
        context: {
          canonicalId: portalAuthAnchorPatientId,
          suite: "workflow-patient-portal-authentication",
          workflow: "patient-portal-authentication-pending-reset-state"
        }
      });

      const pendingResetLogin = await workflow.verifyPatientPortalLogin(portalLoginUsername, portalPassword);
      expect(pendingResetLogin).toMatchObject({
        authenticated: false,
        username: portalLoginUsername,
        failureReason: "One-time reset pending."
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-207-patient-portal-authentication-pending-reset-login",
        description: "Captures the Slice 207 pending-reset authentication rejection result.",
        expected: {
          authenticated: false,
          username: portalLoginUsername,
          failureReason: "One-time reset pending."
        },
        actual: {
          pendingResetLogin
        },
        context: {
          canonicalId: portalAuthAnchorPatientId,
          suite: "workflow-patient-portal-authentication",
          workflow: "patient-portal-authentication-pending-reset-login"
        }
      });

      if (target.type === "legacy-openemr") {
        const legacyPendingResetSurface = await expectLegacyPatientPortalPasswordUpdate(page, target, portalLoginUsername, portalPassword);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-207-patient-portal-authentication-legacy-pending-reset-surface",
          description: "Captures the Slice 207 legacy password-update rendering when one-time reset is pending.",
          expected: {
            visibleText: "Please Enter New Credentials"
          },
          actual: {
            url: page.url(),
            legacyPendingResetSurface
          },
          context: {
            canonicalId: portalAuthAnchorPatientId,
            suite: "workflow-patient-portal-authentication",
            workflow: "patient-portal-authentication-legacy-pending-reset-surface"
          }
        });
      } else {
        const modernizedPendingResetSurface = await expectModernizedPortalReadinessMessage(
          page,
          target,
          patient!.pubpid,
          portalLoginUsername,
          portalPassword,
          /One-time reset pending\./
        );
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-207-patient-portal-authentication-modernized-pending-reset-surface",
          description: "Captures the Slice 207 modernized readiness rendering when one-time reset is pending.",
          expected: {
            message: "One-time reset pending."
          },
          actual: {
            url: page.url(),
            modernizedPendingResetSurface
          },
          context: {
            canonicalId: portalAuthAnchorPatientId,
            suite: "workflow-patient-portal-authentication",
            workflow: "patient-portal-authentication-modernized-pending-reset-surface"
          }
        });
      }
    } finally {
      await workflow.updatePatientPortalAccountResetState(originalReset);
      await workflow.updatePatientPortalAccountAccessState(originalAccess);
    }

    const restoredReset = await workflow.getPatientPortalAccountResetState(patient!.pid);
    const restoredAccess = await workflow.getPatientPortalAccountAccessState(patient!.pid);
    expect(restoredReset).toEqual(originalReset);
    expect(restoredAccess).toEqual(originalAccess);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-207-patient-portal-authentication-cleanup",
      description: "Captures the Slice 207 cleanup state after restoring original portal access and reset facts.",
      expected: {
        restoredAccess: originalAccess,
        restoredReset: originalReset
      },
      actual: {
        patient,
        restoredAccess,
        restoredReset
      },
      context: {
        canonicalId: portalAuthAnchorPatientId,
        suite: "workflow-patient-portal-authentication",
        workflow: "patient-portal-authentication-cleanup"
      }
    });
  });
});

async function expectLegacyPatientPortalLogin(page: Page, target: RuntimeTarget, username: string, password: string) {
  await fillLegacyPatientPortalCredentials(page, target, username, password);
  await page.getByRole("button", { name: "Log In" }).click();
  await expect.poll(() => page.url()).toContain("/portal/home.php");
  await expectRenderedText(page, /Portal|Appointments|Home|Medical/i);
  return page.locator("body").innerText();
}

async function expectLegacyPatientPortalRejected(page: Page, target: RuntimeTarget, username: string, password: string) {
  await fillLegacyPatientPortalCredentials(page, target, username, password);
  await page.getByRole("button", { name: "Log In" }).click();
  await expect.poll(() => page.url()).toContain("&w");
  await expectRenderedText(page, /Something went wrong|Portal Login/i);
  return page.locator("body").innerText();
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
  return form.innerText();
}
