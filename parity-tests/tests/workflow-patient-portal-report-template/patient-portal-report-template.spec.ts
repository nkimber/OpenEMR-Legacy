import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMedicalReportAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const expectedTemplateMetadata = {
  facilityName: "Modernization Family Medicine",
  facilityStreet: "100 Harbor Way",
  facilityCityStatePostal: "San Diego, CA 92101",
  facilityPhone: "(619) 555-0100",
  printablePatientName: "Nora Kim",
  patientHeaderLine: "PATIENT:Kim, Nora - 05/05/2002",
  signatureLineAvailable: true
};

test.describe("patient portal generated report template metadata parity @slice229 @workflow-patient-portal-report-template @patients @portal @reports", () => {
  test("normalizes printable generated report template metadata", async ({
    targetDb,
    workflow
  }) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMedicalReportAnchorPatientId);
    expect(patient).not.toBeNull();

    const generated = await workflow.generatePatientPortalMedicalReport(portalLoginUsername, portalPassword, {
      sectionIds: ["demographics", "billing"]
    });

    expect(generated).toMatchObject({
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
    expect(generated.templateMetadata).toMatchObject(expectedTemplateMetadata);
    expect(generated.templateMetadata.generatedOnLabel).toMatch(/^Generated on: \d{2}\/\d{2}\/\d{4}$/);
  });

  test("renders printable generated report header metadata on the portal surface", async ({
    page,
    target
  }) => {
    test.setTimeout(120_000);

    if (target.type === "legacy-openemr") {
      await expectLegacyPrintableGeneratedReportHeader(page, target);
      return;
    }

    await expectModernizedGeneratedReportHeader(page, target);
  });
});

async function expectLegacyPrintableGeneratedReportHeader(page: Page, target: RuntimeTarget) {
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

  const params = new URLSearchParams();
  params.set("printable", "1");
  params.set("include_demographics", "demographics");
  params.set("include_billing", "billing");

  await page.goto(`${target.publicUrl}/portal/report/portal_custom_report.php?${params.toString()}`);
  const body = page.locator("body");
  await expect(body).toContainText(expectedTemplateMetadata.facilityName);
  await expect(body).toContainText(expectedTemplateMetadata.facilityStreet);
  await expect(body).toContainText(expectedTemplateMetadata.facilityCityStatePostal);
  await expect(body).toContainText(expectedTemplateMetadata.facilityPhone);
  await expect(body).toContainText(expectedTemplateMetadata.printablePatientName);
  await expect(body).toContainText(expectedTemplateMetadata.patientHeaderLine);
  await expect(body).toContainText("Generated on");
  await expect(body).toContainText("Signature");
}

async function expectModernizedGeneratedReportHeader(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const generatedReportRegion = page.getByRole("region", { name: "Patient portal generated medical report" });
  await expect(generatedReportRegion).toContainText(expectedTemplateMetadata.facilityName);
  await expect(generatedReportRegion).toContainText(expectedTemplateMetadata.facilityStreet);
  await expect(generatedReportRegion).toContainText(expectedTemplateMetadata.facilityCityStatePostal);
  await expect(generatedReportRegion).toContainText(expectedTemplateMetadata.facilityPhone);
  await expect(generatedReportRegion).toContainText(expectedTemplateMetadata.printablePatientName);
  await expect(generatedReportRegion).toContainText(expectedTemplateMetadata.patientHeaderLine);
  await expect(generatedReportRegion).toContainText("Generated on:");
  await expect(generatedReportRegion).toContainText("Signature Line available");
}
