import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDemographicsEditDirect
} from "../../src/ui/legacyOpenEmr.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const portalAccessAnchorPatientId = "MOD-PAT-0004";
const expectedLogin = "mod-pat-0004@example.test";

type PatientChartPortalAccess = {
  pubpid: string;
  portalEnabled: boolean;
  portalAccount?: {
    portalEnabled: boolean;
    accessStatusLabel: string;
    cmsPortalLogin?: string | null;
    hasAccount: boolean;
  } | null;
};

test.describe("patient portal access parity @slice206 @workflow-patient-portal-access @mutation @patients", () => {
  test("revokes, renders, and grants patient portal access while preserving the account", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(portalAccessAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientPortalAccountAccessState(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient portal account access state.");
    }

    expect(original).toMatchObject({
      portalEnabled: true,
      accessStatusLabel: "Enabled",
      cmsPortalLogin: expectedLogin,
      hasAccount: true
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-206-patient-portal-access-precondition",
      description: "Captures the Slice 206 portal-access precondition: anchor patient plus provisioned, enabled portal account state.",
      expected: {
        anchorCanonicalId: portalAccessAnchorPatientId,
        originalAccessState: {
          portalEnabled: true,
          accessStatusLabel: "Enabled",
          cmsPortalLogin: expectedLogin,
          hasAccount: true
        }
      },
      actual: {
        patient,
        original
      },
      context: {
        canonicalId: portalAccessAnchorPatientId,
        suite: "workflow-patient-portal-access",
        workflow: "patient-portal-access-precondition"
      }
    });

    const revoked = {
      ...original,
      portalEnabled: false,
      accessStatusLabel: "Access disabled"
    };
    const granted = {
      ...original,
      portalEnabled: true,
      accessStatusLabel: "Enabled"
    };

    try {
      await workflow.updatePatientPortalAccountAccessState(revoked);
      const revokedActual = await workflow.getPatientPortalAccountAccessState(patient!.pid);
      expect(revokedActual).toEqual(revoked);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-206-patient-portal-access-revoked",
        description: "Captures the temporary Slice 206 portal-access state immediately after revoking access while preserving the account.",
        expected: {
          revoked
        },
        actual: {
          patient,
          original,
          revokedActual
        },
        context: {
          canonicalId: portalAccessAnchorPatientId,
          suite: "workflow-patient-portal-access",
          workflow: "patient-portal-access-revoked"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDemographicsEditDirect(page, target, patient!.pid);
        await expectLegacyPortalAccessValue(page, "");
        const cmsPortalLogin = page.locator('input[name*="cmsportal_login"]').first();
        await expect(cmsPortalLogin).toHaveValue(expectedLogin);
        await expectRenderedText(page, expectedLogin);
        const legacyRevokedText = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-206-patient-portal-access-legacy-revoked-surface",
          description: "Captures the Slice 206 legacy demographics edit evidence after portal access is revoked.",
          expected: {
            allowPatientPortalValue: "",
            cmsPortalLogin: expectedLogin
          },
          actual: {
            patient,
            revokedActual,
            legacyRevokedText
          },
          context: {
            canonicalId: portalAccessAnchorPatientId,
            suite: "workflow-patient-portal-access",
            workflow: "patient-portal-access-legacy-revoked-surface"
          }
        });
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const revokedChartResponse = await page.request.get(
          `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
          { headers }
        );
        expect(revokedChartResponse.ok()).toBeTruthy();
        const revokedChart = (await revokedChartResponse.json()) as PatientChartPortalAccess;
        expect(revokedChart).toMatchObject({
          pubpid: patient!.pubpid,
          portalEnabled: false
        });
        expect(revokedChart.portalAccount).toMatchObject({
          portalEnabled: false,
          accessStatusLabel: "Access disabled",
          cmsPortalLogin: expectedLogin,
          hasAccount: true
        });
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-206-patient-portal-access-modernized-revoked-api",
          description: "Captures the Slice 206 modernized patient chart API response after portal access is revoked.",
          expected: {
            pubpid: patient!.pubpid,
            portalEnabled: false,
            portalAccount: {
              portalEnabled: false,
              accessStatusLabel: "Access disabled",
              cmsPortalLogin: expectedLogin,
              hasAccount: true
            }
          },
          actual: {
            status: revokedChartResponse.status(),
            revokedChart
          },
          context: {
            canonicalId: portalAccessAnchorPatientId,
            suite: "workflow-patient-portal-access",
            workflow: "patient-portal-access-modernized-revoked-api"
          }
        });

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Portal Account");
        await expect(page.locator("body")).toContainText("Access disabled");
        await expect(page.locator("body")).toContainText(expectedLogin);
        await expect(page.getByRole("button", { name: "Grant portal access" })).toBeVisible();
        const revokedPatientChartText = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-206-patient-portal-access-modernized-revoked-surface",
          description: "Captures the Slice 206 modernized Patient/Client Portal Account rendering after access is revoked.",
          expected: {
            visibleFields: [
              "Portal Account",
              "Access disabled",
              expectedLogin,
              "Grant portal access"
            ]
          },
          actual: {
            patient,
            revokedActual,
            revokedPatientChartText
          },
          context: {
            canonicalId: portalAccessAnchorPatientId,
            suite: "workflow-patient-portal-access",
            workflow: "patient-portal-access-modernized-revoked-surface"
          }
        });
      }

      await workflow.updatePatientPortalAccountAccessState(granted);
      const grantedActual = await workflow.getPatientPortalAccountAccessState(patient!.pid);
      expect(grantedActual).toEqual(granted);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-206-patient-portal-access-granted",
        description: "Captures the Slice 206 portal-access state immediately after granting access again.",
        expected: {
          granted
        },
        actual: {
          patient,
          revoked,
          grantedActual
        },
        context: {
          canonicalId: portalAccessAnchorPatientId,
          suite: "workflow-patient-portal-access",
          workflow: "patient-portal-access-granted"
        }
      });

      if (target.type === "legacy-openemr") {
        await openPatientDemographicsEditDirect(page, target, patient!.pid);
        await expectLegacyPortalAccessValue(page, "YES");
        const legacyGrantedText = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-206-patient-portal-access-legacy-granted-surface",
          description: "Captures the Slice 206 legacy demographics edit evidence after portal access is granted again.",
          expected: {
            allowPatientPortalValue: "YES"
          },
          actual: {
            patient,
            grantedActual,
            legacyGrantedText
          },
          context: {
            canonicalId: portalAccessAnchorPatientId,
            suite: "workflow-patient-portal-access",
            workflow: "patient-portal-access-legacy-granted-surface"
          }
        });
      } else {
        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.locator("body")).toContainText("Enabled");
        await expect(page.getByRole("button", { name: "Revoke portal access" })).toBeVisible();
        const grantedPatientChartText = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-206-patient-portal-access-modernized-granted-surface",
          description: "Captures the Slice 206 modernized Patient/Client Portal Account rendering after access is granted again.",
          expected: {
            visibleFields: [
              "Enabled",
              "Revoke portal access"
            ]
          },
          actual: {
            patient,
            grantedActual,
            grantedPatientChartText
          },
          context: {
            canonicalId: portalAccessAnchorPatientId,
            suite: "workflow-patient-portal-access",
            workflow: "patient-portal-access-modernized-granted-surface"
          }
        });
      }
    } finally {
      await workflow.updatePatientPortalAccountAccessState(original);
    }

    const restored = await workflow.getPatientPortalAccountAccessState(patient!.pid);
    expect(restored).toEqual(original);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-206-patient-portal-access-cleanup",
      description: "Captures the Slice 206 cleanup state after restoring the original enabled portal-access state.",
      expected: {
        restoredOriginal: original
      },
      actual: {
        patient,
        restored
      },
      context: {
        canonicalId: portalAccessAnchorPatientId,
        suite: "workflow-patient-portal-access",
        workflow: "patient-portal-access-cleanup"
      }
    });
  });
});

async function expectLegacyPortalAccessValue(page: import("@playwright/test").Page, expectedValue: string) {
  const accessField = page
    .locator('select[name*="allow_patient_portal"], input[name*="allow_patient_portal"]')
    .first();
  const inputType = (await accessField.getAttribute("type"))?.toLowerCase();
  if (inputType === "radio") {
    const expectedRadio = page
      .locator(`input[type="radio"][name*="allow_patient_portal"][value="${expectedValue}"]`)
      .first();
    await expect(expectedRadio).toBeChecked();
    return;
  }

  if (inputType === "checkbox") {
    if (expectedValue === "YES") {
      await expect(accessField).toBeChecked();
    } else {
      await expect(accessField).not.toBeChecked();
    }

    return;
  }

  await expect(accessField).toHaveValue(expectedValue);
}
