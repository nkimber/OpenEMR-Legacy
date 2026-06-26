import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientDemographicsEditDirect } from "../../src/ui/legacyOpenEmr.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const portalAccountAnchorPatientId = "MOD-PAT-0004";
const expectedLogin = "mod-pat-0004@example.test";

type PatientChartPortalAccount = {
  pubpid: string;
  portalEnabled: boolean;
  portalAccount?: {
    portalEnabled: boolean;
    accessStatusLabel: string;
    cmsPortalLogin?: string | null;
    hasAccount: boolean;
    portalUsername?: string | null;
    portalLoginUsername?: string | null;
    passwordStatus?: number | null;
    passwordStatusLabel: string;
    oneTimeLinkPending: boolean;
    resetStatusLabel: string;
  } | null;
};

test.describe("patient portal account parity @slice204 @patient-portal-account @patients", () => {
  test("renders provisioned portal account facts from the shared gold dataset", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(portalAccountAnchorPatientId);
    expect(patient).not.toBeNull();

    const portalAccount = await targetDb.getPatientPortalAccountForPatient(patient!.pid);
    const expectedPortalAccount = {
      patientId: patient!.pid,
      portalEnabled: true,
      accessStatusLabel: "Enabled",
      cmsPortalLogin: expectedLogin,
      hasAccount: true,
      portalUsername: expectedLogin,
      portalLoginUsername: expectedLogin,
      passwordStatus: 1,
      passwordStatusLabel: "Patient-managed password",
      oneTimeLinkPending: false,
      resetStatusLabel: "No reset pending"
    };
    expect(portalAccount).toEqual(expectedPortalAccount);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-204-patient-portal-account-precondition",
      description: "Captures the Slice 204 portal-account precondition: anchor patient plus seeded CMS login and onsite portal account facts.",
      expected: {
        anchorCanonicalId: portalAccountAnchorPatientId,
        cmsPortalLogin: expectedLogin,
        portalAccount: expectedPortalAccount
      },
      actual: {
        patient,
        portalAccount
      },
      context: {
        canonicalId: portalAccountAnchorPatientId,
        suite: "patient-portal-account",
        workflow: "patient-portal-account-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientDemographicsEditDirect(page, target, patient!.pid);
      const cmsPortalLogin = page.locator('input[name*="cmsportal_login"]').first();
      await expect(cmsPortalLogin).toHaveValue(expectedLogin);
      await expectRenderedText(page, expectedLogin);
      const demographicsEditText = await page.locator("body").innerText();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-204-patient-portal-account-legacy-surface",
        description: "Captures the Slice 204 legacy demographics edit evidence for the seeded CMS portal login.",
        expected: {
          cmsPortalLoginInputValue: expectedLogin,
          visibleLoginText: expectedLogin
        },
        actual: {
          patient,
          portalAccount,
          demographicsEditText
        },
        context: {
          canonicalId: portalAccountAnchorPatientId,
          suite: "patient-portal-account",
          workflow: "patient-portal-account-legacy-surface"
        }
      });
      return;
    }

    const headers = await getModernizedAdminSessionHeaders(page, target);
    const chartResponse = await page.request.get(
      `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
      { headers }
    );
    expect(chartResponse.ok()).toBeTruthy();
    const chart = (await chartResponse.json()) as PatientChartPortalAccount;
    expect(chart.pubpid).toBe(patient!.pubpid);
    expect(chart.portalEnabled).toBe(true);
    const expectedChartPortalAccount = {
      portalEnabled: true,
      accessStatusLabel: "Enabled",
      cmsPortalLogin: expectedLogin,
      hasAccount: true,
      portalUsername: expectedLogin,
      portalLoginUsername: expectedLogin,
      passwordStatus: 1,
      passwordStatusLabel: "Patient-managed password",
      oneTimeLinkPending: false,
      resetStatusLabel: "No reset pending"
    };
    expect(chart.portalAccount).toMatchObject(expectedChartPortalAccount);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-204-patient-portal-account-modernized-api",
      description: "Captures the Slice 204 modernized patient chart API response for seeded portal account facts.",
      expected: {
        pubpid: patient!.pubpid,
        portalEnabled: true,
        portalAccount: expectedChartPortalAccount
      },
      actual: {
        status: chartResponse.status(),
        chart
      },
      context: {
        canonicalId: portalAccountAnchorPatientId,
        suite: "patient-portal-account",
        workflow: "patient-portal-account-modernized-api"
      }
    });

    await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
    await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
    await expect(page.locator("body")).toContainText("Portal Account");
    await expect(page.locator("body")).toContainText("CMS login");
    await expect(page.locator("body")).toContainText(expectedLogin);
    await expect(page.locator("body")).toContainText("Provisioned");
    await expect(page.locator("body")).toContainText("Patient-managed password");
    await expect(page.locator("body")).toContainText("No reset pending");
    const patientChartText = await page.locator("body").innerText();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-204-patient-portal-account-modernized-surface",
      description: "Captures the Slice 204 modernized Patient/Client Portal Account rendering for seeded portal account facts.",
      expected: {
        heading: patient!.lname,
        visiblePortalAccountFields: [
          "Portal Account",
          "CMS login",
          expectedLogin,
          "Provisioned",
          "Patient-managed password",
          "No reset pending"
        ]
      },
      actual: {
        patient,
        portalAccount,
        patientChartText
      },
      context: {
        canonicalId: portalAccountAnchorPatientId,
        suite: "patient-portal-account",
        workflow: "patient-portal-account-modernized-surface"
      }
    });
  });
});
