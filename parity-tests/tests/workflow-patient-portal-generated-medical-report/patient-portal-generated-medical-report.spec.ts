import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMedicalReportAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal generated medical report parity @slice225 @workflow-patient-portal-generated-medical-report @patients @portal @reports", () => {
  test("generates the default customized medical history report content", async ({
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
      includedSectionIds: ["demographics", "billing"],
      printableVersionAvailable: true,
      pdfDownloadAvailable: true,
      reportSectionCount: 3,
      summaryLineCount: 4,
      failureReason: null
    });

    expect(report.includedProcedureOrderIds).toHaveLength(1);
    expect(report.reportSections.map((section) => section.title)).toEqual([
      "Patient Data",
      "Billing Information",
      "Procedure Order"
    ]);

    const generatedText = report.reportSections
      .flatMap((section) => [section.title, ...section.lines])
      .join("\n");
    expect(generatedText).toContain("Patient: Kim, Nora");
    expect(generatedText).toContain("Patient ID: MOD-PAT-0004");
    expect(generatedText).toContain("Billing lines:");
    expect(generatedText).toContain("Balance:");
    expect(generatedText).toContain("Order: Hemoglobin A1c");
    expect(generatedText).toContain("Order date: 2026-02-21");
    expect(generatedText).toContain("Code: 83036");
    expect(generatedText).toContain("Diagnosis: ICD10:M54.50");
    expect(generatedText).toContain("Results: Hemoglobin A1c, Glucose, Cholesterol, HDL Cholesterol");
    expect(report.summaryLines.join("\n")).toContain("Procedure Order: Hemoglobin A1c ordered 2026-02-21 with 4 result rows.");
  });

  test("renders generated default medical report content on the portal surface", async ({
    page,
    target
  }) => {
    test.setTimeout(120_000);

    if (target.type === "legacy-openemr") {
      await expectLegacyGeneratedPatientPortalMedicalReport(page, target);
      return;
    }

    await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
    const generatedReportRegion = page.getByRole("region", { name: "Patient portal generated medical report" });
    await expect(generatedReportRegion).toContainText("Customized Medical History Report");
    await expect(generatedReportRegion).toContainText("Patient Data");
    await expect(generatedReportRegion).toContainText("Patient: Kim, Nora");
    await expect(generatedReportRegion).toContainText("Billing Information");
    await expect(generatedReportRegion).toContainText("Billing lines:");
    await expect(generatedReportRegion).toContainText("Procedure Order");
    await expect(generatedReportRegion).toContainText("Order: Hemoglobin A1c");
    await expect(generatedReportRegion).toContainText("Code: 83036");
    await expect(generatedReportRegion).toContainText("Diagnosis: ICD10:M54.50");
    await expect(generatedReportRegion).toContainText("Results: Hemoglobin A1c, Glucose, Cholesterol, HDL Cholesterol");
    await expect(generatedReportRegion).toContainText("PDF Download available");
  });
});

async function expectLegacyGeneratedPatientPortalMedicalReport(page: Page, target: RuntimeTarget) {
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

  const params = new URLSearchParams();
  params.set("include_demographics", "demographics");
  params.set("include_billing", "billing");
  params.append("procedures[]", procedureOrderId!);

  await page.goto(`${target.publicUrl}/portal/report/portal_custom_report.php?${params.toString()}`);
  await expect(page.locator("body")).toContainText("Printable Version");
  await expect(page.locator("body")).toContainText("Patient Data");
  await expect(page.locator("body")).toContainText("Billing Information");
  // Legacy renders the selected section shell here; detailed order facts are covered by the workflow result above.
  await expect(page.locator("body")).toContainText("Procedure Order");
}
