import { test, expect } from "../../src/fixtures/parityTest.js";
import { requestText } from "../../src/http/httpClient.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openClinicalReportsDirect,
  openPatientListReportDirect
} from "../../src/ui/legacyOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";

type ModernizedLoginResponse = {
  authenticated: boolean;
  username: string;
  displayName: string;
  role: string;
  staffId?: number | null;
  sessionId?: string | null;
};

type ModernizedAuthorizationFailure = {
  authenticated: boolean;
  authorized: boolean;
  sessionId?: string | null;
  username: string;
  role: string;
  requiredSection: string;
  requiredPermission: string;
  requiredReturnValue: string;
  failureReason?: string | null;
  sessionSource: string;
};

test.describe("operational reports authorization policy parity @workflow-reports-authorization-policy @slice174 @reports @security", () => {
  test("enforces Patient Report access for operational report APIs and UI", async ({ page, target, targetDb }) => {
    const accessControl = await targetDb.getAdministrationAccessControl();
    expect(accessControl.groupPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "admin",
          sectionValue: "patients",
          permissionValue: "pat_rep",
          returnValue: "write"
        })
      ])
    );
    expect(accessControl.groupPermissions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "front",
          sectionValue: "patients",
          permissionValue: "pat_rep"
        })
      ])
    );

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientListReportDirect(page, target);
      await expectRenderedText(page, "Patient List");
      await expectRenderedText(page, "Visits From");

      await openClinicalReportsDirect(page, target);
      await expectRenderedText(page, "Report - Clinical");
      await expectRenderedText(page, "Problem DX");
      return;
    }

    const frontDeskLogin = await modernizedLogin(target, "gold-frontdesk-01", "pass");
    expect(frontDeskLogin).toMatchObject({
      authenticated: true,
      username: "gold-frontdesk-01",
      displayName: "Parker Fleming",
      role: "frontdesk",
      staffId: 117
    });
    expect(frontDeskLogin.sessionId).toMatch(/^[0-9a-f-]{36}$/i);

    const frontDeskReport = await requestText(`${target.apiBaseUrl}/api/reports/operational`, {
      headers: {
        "X-OpenEMR-Session": frontDeskLogin.sessionId!
      }
    });
    expect(frontDeskReport.statusCode).toBe(403);
    const frontDeskFailure = JSON.parse(frontDeskReport.body) as ModernizedAuthorizationFailure;
    expect(frontDeskFailure).toMatchObject({
      authenticated: true,
      authorized: false,
      username: "gold-frontdesk-01",
      role: "frontdesk",
      requiredSection: "patients",
      requiredPermission: "pat_rep",
      requiredReturnValue: "view",
      sessionSource: "modernized-openemr"
    });
    expect(frontDeskFailure.failureReason).toMatch(/not authorized/i);

    const frontDeskExport = await requestText(`${target.apiBaseUrl}/api/reports/operational/export`, {
      headers: {
        "X-OpenEMR-Session": frontDeskLogin.sessionId!
      }
    });
    expect(frontDeskExport.statusCode).toBe(403);

    const adminLogin = await modernizedLogin(target, target.credentials.username, target.credentials.password);
    expect(adminLogin).toMatchObject({
      authenticated: true,
      username: "admin",
      role: "administrator"
    });

    const adminReport = await requestText(`${target.apiBaseUrl}/api/reports/operational`, {
      headers: {
        "X-OpenEMR-Session": adminLogin.sessionId!
      }
    });
    expect(adminReport.statusCode).toBe(200);
    const report = JSON.parse(adminReport.body) as {
      counts: { patients: number; futureAppointments: number; patientDocuments: number };
      providerActivity: Array<{ username: string; encounters: number }>;
    };
    expect(report.counts).toMatchObject({
      patients: 1000,
      futureAppointments: 1261,
      patientDocuments: 1200
    });
    expect(report.providerActivity).toEqual(
      expect.arrayContaining([expect.objectContaining({ username: "gold-provider-02", encounters: 176 })])
    );

    const adminExport = await requestText(`${target.apiBaseUrl}/api/reports/operational/export`, {
      headers: {
        "X-OpenEMR-Session": adminLogin.sessionId!
      }
    });
    expect(adminExport.statusCode).toBe(200);
    expect(adminExport.body).toContain("Counts,Patients,Total,1000");
    expect(adminExport.body).toContain("Provider Activity,gold-provider-02,Encounters,176");

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Reports" }).click();
    await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();

    const accessPanel = page.locator('form[aria-label="Reports access"]');
    await accessPanel.getByLabel("Username").fill("gold-frontdesk-01");
    await accessPanel.getByLabel("Password").fill("pass");
    await accessPanel.getByRole("button", { name: "Verify Reports Access" }).click();

    await expect(page.locator("body")).toContainText("Signed in as Parker Fleming");
    await expect(page.locator("body")).toContainText("Operational reports load requires Patient Report access");
    await expect(page.locator("body")).not.toContainText("Gold Data Snapshot");

    await accessPanel.getByLabel("Username").fill(target.credentials.username);
    await accessPanel.getByLabel("Password").fill(target.credentials.password);
    await accessPanel.getByRole("button", { name: "Verify Reports Access" }).click();

    await expect(page.locator("body")).toContainText("Gold Data Snapshot");
    await expect(page.locator("body")).toContainText("gold-provider-02");
    await expect(page.getByRole("button", { name: /CSV Export/i })).toBeVisible();
  });
});

async function modernizedLogin(target: RuntimeTarget, username: string, password: string): Promise<ModernizedLoginResponse> {
  const body = JSON.stringify({ username, password });
  const response = await requestText(`${target.apiBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(body))
    },
    body
  });

  expect(response.statusCode).toBe(200);
  return JSON.parse(response.body) as ModernizedLoginResponse;
}
