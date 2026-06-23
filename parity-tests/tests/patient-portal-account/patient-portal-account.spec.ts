import { test, expect } from "../../src/fixtures/parityTest.js";
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
  test("renders provisioned portal account facts from the shared gold dataset", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(portalAccountAnchorPatientId);
    expect(patient).not.toBeNull();

    const portalAccount = await targetDb.getPatientPortalAccountForPatient(patient!.pid);
    expect(portalAccount).toEqual({
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
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientDemographicsEditDirect(page, target, patient!.pid);
      const cmsPortalLogin = page.locator('input[name*="cmsportal_login"]').first();
      await expect(cmsPortalLogin).toHaveValue(expectedLogin);
      await expectRenderedText(page, expectedLogin);
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
    expect(chart.portalAccount).toMatchObject({
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
    });

    await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
    await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
    await expect(page.locator("body")).toContainText("Portal Account");
    await expect(page.locator("body")).toContainText("CMS login");
    await expect(page.locator("body")).toContainText(expectedLogin);
    await expect(page.locator("body")).toContainText("Provisioned");
    await expect(page.locator("body")).toContainText("Patient-managed password");
    await expect(page.locator("body")).toContainText("No reset pending");
  });
});
