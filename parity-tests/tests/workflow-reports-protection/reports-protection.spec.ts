import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openClinicalReportsDirect,
  openPatientListReportDirect
} from "../../src/ui/legacyOpenEmr.js";

test.describe("operational reports protection parity @slice164 @reports-protection", () => {
  test("requires an active session before operational report data is visible", async ({ page, target }) => {
    if (target.type === "legacy-openemr") {
      await page.goto(`${target.publicUrl}/interface/reports/patient_list.php`);
      await expect(page.locator("body")).not.toContainText("Visits From");
      await expect(page.locator("body")).not.toContainText("Export to CSV");

      await page.goto(`${target.publicUrl}/interface/reports/clinical_reports.php`);
      await expect(page.locator("body")).not.toContainText("Problem DX");

      await loginToLegacyOpenEmr(page, target);
      await openPatientListReportDirect(page, target);
      await expectRenderedText(page, "Patient List");
      await expectRenderedText(page, "Visits From");

      await openClinicalReportsDirect(page, target);
      await expectRenderedText(page, "Report - Clinical");
      await expectRenderedText(page, "Problem DX");
      return;
    }

    const unauthenticatedReport = await page.request.get(`${target.apiBaseUrl}/api/reports/operational`);
    expect(unauthenticatedReport.status()).toBe(401);
    const unauthenticatedReportBody = await unauthenticatedReport.json();
    expect(unauthenticatedReportBody).toMatchObject({
      authenticated: false,
      sessionSource: "modernized-openemr"
    });

    const unauthenticatedExport = await page.request.get(`${target.apiBaseUrl}/api/reports/operational/export`);
    expect(unauthenticatedExport.status()).toBe(401);

    const loginResponse = await page.request.post(`${target.apiBaseUrl}/api/auth/login`, {
      data: target.credentials
    });
    expect(loginResponse.ok()).toBeTruthy();
    const login = await loginResponse.json();
    expect(login.authenticated).toBe(true);
    expect(login.sessionId).toBeTruthy();

    const authenticatedReport = await page.request.get(`${target.apiBaseUrl}/api/reports/operational`, {
      headers: { "X-OpenEMR-Session": login.sessionId }
    });
    expect(authenticatedReport.ok()).toBeTruthy();
    const report = await authenticatedReport.json();
    expect(report.counts).toMatchObject({
      patients: 1000,
      futureAppointments: 1261,
      patientDocuments: 1200
    });
    expect(report.providerActivity.some((provider: { username: string }) => provider.username === "gold-provider-02")).toBe(
      true
    );

    const authenticatedExport = await page.request.get(`${target.apiBaseUrl}/api/reports/operational/export`, {
      headers: { "X-OpenEMR-Session": login.sessionId }
    });
    expect(authenticatedExport.ok()).toBeTruthy();
    const csv = await authenticatedExport.text();
    expect(csv).toContain("Counts,Patients,Total,1000");
    expect(csv).toContain("Provider Activity,gold-provider-02,Encounters,176");

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Reports" }).click();
    await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();
    await expect(page.locator("body")).toContainText("Sign in to load operational reports");
    await expect(page.locator("body")).not.toContainText("Gold Data Snapshot");

    const accessPanel = page.locator('form[aria-label="Reports access"]');
    await accessPanel.getByLabel("Username").fill(target.credentials.username);
    await accessPanel.getByLabel("Password").fill(target.credentials.password);
    await accessPanel.getByRole("button", { name: "Verify Reports Access" }).click();

    await expect(page.locator("body")).toContainText("Gold Data Snapshot");
    await expect(page.locator("body")).toContainText("gold-provider-02");
    await expect(page.getByRole("button", { name: /CSV Export/i })).toBeVisible();
  });
});
