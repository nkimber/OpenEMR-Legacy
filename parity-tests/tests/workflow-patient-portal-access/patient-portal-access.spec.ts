import { test, expect } from "../../src/fixtures/parityTest.js";
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
  }) => {
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
      await expect(workflow.getPatientPortalAccountAccessState(patient!.pid)).resolves.toEqual(revoked);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDemographicsEditDirect(page, target, patient!.pid);
        await expectLegacyPortalAccessValue(page, "");
        const cmsPortalLogin = page.locator('input[name*="cmsportal_login"]').first();
        await expect(cmsPortalLogin).toHaveValue(expectedLogin);
        await expectRenderedText(page, expectedLogin);
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

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Portal Account");
        await expect(page.locator("body")).toContainText("Access disabled");
        await expect(page.locator("body")).toContainText(expectedLogin);
        await expect(page.getByRole("button", { name: "Grant portal access" })).toBeVisible();
      }

      await workflow.updatePatientPortalAccountAccessState(granted);
      await expect(workflow.getPatientPortalAccountAccessState(patient!.pid)).resolves.toEqual(granted);

      if (target.type === "legacy-openemr") {
        await openPatientDemographicsEditDirect(page, target, patient!.pid);
        await expectLegacyPortalAccessValue(page, "YES");
      } else {
        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.locator("body")).toContainText("Enabled");
        await expect(page.getByRole("button", { name: "Revoke portal access" })).toBeVisible();
      }
    } finally {
      await workflow.updatePatientPortalAccountAccessState(original);
    }

    const restored = await workflow.getPatientPortalAccountAccessState(patient!.pid);
    expect(restored).toEqual(original);
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
