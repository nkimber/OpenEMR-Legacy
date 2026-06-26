import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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
    target,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMedicalReportAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-226-patient-portal-generated-medical-report-pdf-precondition",
      description: "Captures the Slice 226 portal generated medical-report PDF precondition: the signed-in anchor patient exists before checking PDF export readiness.",
      expected: {
        canonicalId: portalMedicalReportAnchorPatientId,
        portalUsername: portalLoginUsername
      },
      actual: {
        canonicalId: portalMedicalReportAnchorPatientId,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        portalUsername: portalLoginUsername
      },
      context: {
        suite: "workflow-patient-portal-medical-report-pdf",
        workflow: "patient-portal-medical-report-pdf-precondition"
      }
    });

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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-226-patient-portal-generated-medical-report-pdf-readiness",
      description: "Captures the Slice 226 generated medical-report PDF readiness projection, including generated report identity, selected sections, and downloadable artifact flags.",
      expected: {
        displayName: "Kim, Nora",
        title: "Customized Medical History Report",
        reportSectionTitles: [
          "Patient Data",
          "Billing Information",
          "Procedure Order"
        ],
        printableVersionAvailable: true,
        pdfDownloadAvailable: true
      },
      actual: {
        authenticated: report.authenticated,
        username: report.username,
        portalUsername: report.portalUsername,
        pid: report.pid,
        pubpid: report.pubpid,
        displayName: report.displayName,
        title: report.title,
        printableVersionAvailable: report.printableVersionAvailable,
        pdfDownloadAvailable: report.pdfDownloadAvailable,
        reportSections: report.reportSections.map((section) => ({
          title: section.title,
          lineCount: section.lines.length
        })),
        failureReason: report.failureReason
      },
      context: {
        suite: "workflow-patient-portal-medical-report-pdf",
        workflow: "patient-portal-medical-report-pdf-readiness"
      }
    });
  });

  test("exports the generated medical report as a PDF", async ({
    page,
    target
  }, testInfo) => {
    test.setTimeout(120_000);

    if (target.type === "legacy-openemr") {
      const legacyPdfExport = await expectLegacyGeneratedMedicalReportPdf(page, target);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-226-patient-portal-generated-medical-report-pdf-legacy-export",
        description: "Captures the legacy OpenEMR generated medical-report PDF export response from the portal custom-report POST path.",
        expected: {
          page: "portal/report/portal_custom_report.php",
          contentType: "application/pdf",
          pdfHeader: "%PDF",
          minimumByteLength: 1000
        },
        actual: legacyPdfExport,
        context: {
          suite: "workflow-patient-portal-medical-report-pdf",
          workflow: "patient-portal-medical-report-pdf-legacy-export"
        }
      });
      return;
    }

    const modernizedPdfExport = await expectModernizedGeneratedMedicalReportPdf(page, target);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-226-patient-portal-generated-medical-report-pdf-modernized-export",
      description: "Captures the modernized generated medical-report PDF API response and Portal download-control rendering for the signed-in patient.",
      expected: {
        endpoint: "/api/patient-portal/medical-report/pdf",
        contentType: "application/pdf",
        contentDispositionPrefix: "medical-report-MOD-PAT-0004-",
        visibleFacts: [
          "PDF Download available",
          "Download report PDF"
        ],
        pdfFacts: [
          "Customized Medical History Report",
          "Patient: Kim, Nora",
          "Patient ID: MOD-PAT-0004",
          "Billing lines:",
          "Order: Hemoglobin A1c",
          "Code: 83036",
          "Diagnosis: ICD10:M54.50"
        ]
      },
      actual: modernizedPdfExport,
      context: {
        suite: "workflow-patient-portal-medical-report-pdf",
        workflow: "patient-portal-medical-report-pdf-modernized-export"
      }
    });
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
  const pdfHeader = pdf.toString("latin1", 0, 4);
  expect(pdfHeader).toBe("%PDF");

  return {
    url: `${target.publicUrl}/portal/report/portal_custom_report.php`,
    procedureOrderId,
    contentType: pdfResponse.headers()["content-type"],
    byteLength: pdf.byteLength,
    pdfHeader
  };
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

  const pdf = await pdfResponse.body();
  const pdfText = pdf.toString("ascii");
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
  const downloadButton = page.getByRole("button", { name: "Download report PDF" });

  return {
    endpoint: `${target.apiBaseUrl}/api/patient-portal/medical-report/pdf`,
    contentType: pdfResponse.headers()["content-type"],
    contentDisposition: pdfResponse.headers()["content-disposition"],
    byteLength: pdf.byteLength,
    pdfHeader: pdfText.slice(0, 8),
    containsFacts: {
      title: pdfText.includes("Customized Medical History Report"),
      patientName: pdfText.includes("Patient: Kim, Nora"),
      patientId: pdfText.includes("Patient ID: MOD-PAT-0004"),
      billing: pdfText.includes("Billing lines:"),
      orderName: pdfText.includes("Order: Hemoglobin A1c"),
      orderCode: pdfText.includes("Code: 83036"),
      diagnosis: pdfText.includes("Diagnosis: ICD10:M54.50")
    },
    regionText: await generatedReportRegion.innerText(),
    downloadButtonVisible: await downloadButton.isVisible(),
    downloadButtonEnabled: await downloadButton.isEnabled()
  };
}
