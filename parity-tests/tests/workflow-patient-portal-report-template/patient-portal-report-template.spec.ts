import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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
    target,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMedicalReportAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-229-patient-portal-report-template-precondition",
      description: "Captures the Slice 229 generated medical-report printable-template precondition: the signed-in anchor patient exists before generating printable template metadata.",
      expected: {
        canonicalId: portalMedicalReportAnchorPatientId,
        portalUsername: portalLoginUsername,
        templateFields: Object.keys(expectedTemplateMetadata)
      },
      actual: {
        canonicalId: portalMedicalReportAnchorPatientId,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        portalUsername: portalLoginUsername
      },
      context: {
        suite: "workflow-patient-portal-report-template",
        workflow: "patient-portal-generated-medical-report-template-precondition"
      }
    });

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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-229-patient-portal-report-template-result",
      description: "Captures the Slice 229 generated medical-report printable-template projection, including facility block, patient header, generated-on label, and signature-line readiness.",
      expected: {
        displayName: "Kim, Nora",
        templateMetadata: expectedTemplateMetadata,
        generatedOnLabelPattern: "^Generated on: \\d{2}/\\d{2}/\\d{4}$"
      },
      actual: {
        authenticated: generated.authenticated,
        username: generated.username,
        portalUsername: generated.portalUsername,
        pid: generated.pid,
        pubpid: generated.pubpid,
        displayName: generated.displayName,
        title: generated.title,
        printableVersionAvailable: generated.printableVersionAvailable,
        pdfDownloadAvailable: generated.pdfDownloadAvailable,
        templateMetadata: generated.templateMetadata
      },
      context: {
        suite: "workflow-patient-portal-report-template",
        workflow: "patient-portal-generated-medical-report-template-result"
      }
    });
  });

  test("renders printable generated report header metadata on the portal surface", async ({
    page,
    target
  }, testInfo) => {
    test.setTimeout(120_000);

    if (target.type === "legacy-openemr") {
      const legacySurface = await expectLegacyPrintableGeneratedReportHeader(page, target);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-229-patient-portal-report-template-legacy-ui",
        description: "Captures the legacy OpenEMR printable generated-report header surface for facility, patient, generated-on, and signature-line metadata.",
        expected: {
          page: "portal/report/portal_custom_report.php?printable=1",
          templateMetadata: expectedTemplateMetadata,
          visibleFacts: [
            expectedTemplateMetadata.facilityName,
            expectedTemplateMetadata.patientHeaderLine,
            "Generated on",
            "Signature"
          ]
        },
        actual: legacySurface,
        context: {
          suite: "workflow-patient-portal-report-template",
          workflow: "patient-portal-generated-medical-report-template-legacy-ui"
        }
      });
      return;
    }

    const modernizedSurface = await expectModernizedGeneratedReportHeader(page, target);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-229-patient-portal-report-template-modernized-ui",
      description: "Captures the modernized Portal generated-report template metadata surface for facility, patient, generated-on, and signature-line readiness.",
      expected: {
        heading: "Patient portal generated medical report",
        templateMetadata: expectedTemplateMetadata,
        visibleFacts: [
          expectedTemplateMetadata.facilityName,
          expectedTemplateMetadata.patientHeaderLine,
          "Generated on:",
          "Signature Line available"
        ]
      },
      actual: modernizedSurface,
      context: {
        suite: "workflow-patient-portal-report-template",
        workflow: "patient-portal-generated-medical-report-template-modernized-ui"
      }
    });
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

  return {
    url: page.url(),
    templateMetadata: expectedTemplateMetadata,
    responseTextLength: (await body.innerText()).length,
    containsFacts: {
      facilityName: await body.getByText(expectedTemplateMetadata.facilityName).count(),
      patientHeaderLine: await body.getByText(expectedTemplateMetadata.patientHeaderLine).count(),
      generatedOn: await body.getByText("Generated on").count(),
      signature: await body.getByText("Signature").count()
    }
  };
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

  return {
    url: page.url(),
    templateMetadata: expectedTemplateMetadata,
    regionText: await generatedReportRegion.innerText()
  };
}
