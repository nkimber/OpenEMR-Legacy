import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMedicalReportAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal medical report PDF parity @slice226 @workflow-patient-portal-medical-report-pdf @patients @portal @reports", () => {
  test("generated medical report advertises PDF export readiness", async ({
    targetDb,
    workflow
  }) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMedicalReportAnchorPatientId);
    expect(patient).not.toBeNull();

    const report = await workflow.generatePatientPortalMedicalReport(portalLoginUsername, portalPassword);
    expect(report).toMatchObject({
      authenticated: true,
      username: portalLoginUsername,
      portalUsername: portalLoginUsername,
      pid: patient!.pid,
      pubpid: patient!.pubpid,
      displayName: "Kim, Nora",
      title: "Customized Medical History Report",
      printableVersionAvailable: true,
      pdfDownloadAvailable: true,
      failureReason: null
    });
    expect(report.reportSections.map((section) => section.title)).toEqual([
      "Patient Data",
      "Billing Information",
      "Procedure Order"
    ]);
  });

  test("exports the generated medical report as a PDF", async ({
    page,
    target
  }) => {
    test.setTimeout(120_000);

    if (target.type === "legacy-openemr") {
      await expectLegacyGeneratedMedicalReportPdf(page, target);
      return;
    }

    await expectModernizedGeneratedMedicalReportPdf(page, target);
  });
});

async function expectLegacyGeneratedMedicalReportPdf(page: Page, target: RuntimeTarget) {
  await page.context().clearCookies();
  await page.goto(`${target.publicUrl}/portal/index.php?site=default&woops=1`);
  await page.locator("#uname").fill(portalLoginUsername);
  await page.locator("#pass").fill(portalPassword);

  const emailConfirmation = page.locator("#passaddon");
  if ((await emailConfirmation.count()) > 0 && await emailConfirmation.isVisible()) {
    await emailConfirmation.fill(portalLoginUsername);
  }

  await page.getByRole("button", { name: "Log In" }).click();
  await expect.poll(() => page.url()).toContain("/portal/home.php");

  await page.goto(`${target.publicUrl}/portal/report/portal_patient_report.php`);
  await expectRenderedText(page, /Patient Report/i);
  const procedureOrderId = await page.locator("input[name='procedures[]']").first().getAttribute("value");
  expect(procedureOrderId).toBeTruthy();

  const pdfResponse = await page.request.post(`${target.publicUrl}/portal/report/portal_custom_report.php`, {
    form: {
      pdf: "1",
      include_demographics: "demographics",
      include_billing: "billing",
      "procedures[]": procedureOrderId!
    }
  });
  expect(pdfResponse.ok()).toBeTruthy();
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");

  const pdf = await pdfResponse.body();
  expect(pdf.byteLength).toBeGreaterThan(1000);
  expect(pdf.toString("latin1").startsWith("%PDF")).toBeTruthy();
}

async function expectModernizedGeneratedMedicalReportPdf(page: Page, target: RuntimeTarget) {
  const loginResponse = await page.request.post(`${target.apiBaseUrl}/api/patient-portal/login`, {
    data: {
      username: portalLoginUsername,
      password: portalPassword
    }
  });
  expect(loginResponse.ok()).toBeTruthy();
  const login = await loginResponse.json() as { authenticated: boolean; sessionId?: string | null };
  expect(login.authenticated).toBeTruthy();
  expect(login.sessionId).toBeTruthy();

  const pdfResponse = await page.request.post(`${target.apiBaseUrl}/api/patient-portal/medical-report/pdf`, {
    headers: {
      "X-OpenEMR-Patient-Portal-Session": login.sessionId!
    },
    data: {}
  });
  expect(pdfResponse.ok()).toBeTruthy();
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  expect(pdfResponse.headers()["content-disposition"]).toContain("medical-report-MOD-PAT-0004-");

  const pdfText = (await pdfResponse.body()).toString("ascii");
  expect(pdfText.startsWith("%PDF-1.4")).toBeTruthy();
  expect(pdfText).toContain("Customized Medical History Report");
  expect(pdfText).toContain("Patient: Kim, Nora");
  expect(pdfText).toContain("Patient ID: MOD-PAT-0004");
  expect(pdfText).toContain("Billing lines:");
  expect(pdfText).toContain("Order: Hemoglobin A1c");
  expect(pdfText).toContain("Code: 83036");
  expect(pdfText).toContain("Diagnosis: ICD10:M54.50");

  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const generatedReportRegion = page.getByRole("region", { name: "Patient portal generated medical report" });
  await expect(generatedReportRegion).toContainText("PDF Download available");
  await expect(page.getByRole("button", { name: "Download report PDF" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download report PDF" })).toBeEnabled();
}
