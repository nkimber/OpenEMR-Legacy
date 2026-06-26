import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMedicalReportAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal medical report parity @slice224 @workflow-patient-portal-medical-report @patients @portal @reports", () => {
  test("lists signed-in portal patient report sections, issues, encounters, and procedure orders", async ({
    targetDb,
    target,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMedicalReportAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-224-patient-portal-medical-report-precondition",
      description: "Captures the Slice 224 portal medical-report precondition: the signed-in anchor patient exists before projecting report-builder sections, issues, encounters, and procedure orders.",
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
        suite: "workflow-patient-portal-medical-report",
        workflow: "patient-portal-medical-report-precondition"
      }
    });

    const report = await workflow.getPatientPortalMedicalReport(portalLoginUsername, portalPassword);
    expect(report).toMatchObject({
      authenticated: true,
      username: portalLoginUsername,
      portalUsername: portalLoginUsername,
      pid: patient!.pid,
      pubpid: patient!.pubpid,
      displayName: "Kim, Nora",
      sectionCount: 11,
      selectedSectionCount: 2,
      issueCount: 6,
      encounterCount: 3,
      procedureOrderCount: 1,
      failureReason: null
    });

    expect(report.sections.filter((section) => section.selected).map((section) => section.id)).toEqual([
      "demographics",
      "billing"
    ]);
    expect(report.sections.map((section) => section.label)).toContain("Medical Problems");
    expect(report.issues.map((issue) => issue.title)).toEqual(expect.arrayContaining([
      "Low back pain, unspecified",
      "Anxiety disorder, unspecified",
      "Latex",
      "Omeprazole 20 mg",
      "Sumatriptan 50 mg",
      "Sertraline 50 mg"
    ]));

    const procedureOrder = report.procedureOrders[0];
    expect(procedureOrder).toMatchObject({
      orderDate: "2026-02-21",
      encounter: 0,
      procedureCode: "83036",
      procedureName: "Hemoglobin A1c",
      diagnosis: "ICD10:M54.50",
      orderStatus: "complete",
      reportCount: 1,
      resultCount: 4
    });
    expect(procedureOrder.resultNames).toEqual([
      "Hemoglobin A1c",
      "Glucose",
      "Cholesterol",
      "HDL Cholesterol"
    ]);
    expect(report.reportPreview).toMatchObject({
      title: "Customized Medical History Report",
      includedSectionIds: ["demographics", "billing"],
      includedProcedureOrderIds: [procedureOrder.id],
      summaryLineCount: 4
    });
    expect(report.reportPreview.summaryLines.join("\n")).toContain("Procedure Order: Hemoglobin A1c");
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-224-patient-portal-medical-report-result",
      description: "Captures the Slice 224 portal medical-report builder projection, including sections, issues, encounters, procedure orders, and preview metadata.",
      expected: {
        displayName: "Kim, Nora",
        sectionCount: 11,
        selectedSectionIds: ["demographics", "billing"],
        issueTitles: [
          "Low back pain, unspecified",
          "Anxiety disorder, unspecified",
          "Latex",
          "Omeprazole 20 mg",
          "Sumatriptan 50 mg",
          "Sertraline 50 mg"
        ],
        procedureName: "Hemoglobin A1c",
        previewTitle: "Customized Medical History Report"
      },
      actual: {
        authenticated: report.authenticated,
        username: report.username,
        portalUsername: report.portalUsername,
        pid: report.pid,
        pubpid: report.pubpid,
        displayName: report.displayName,
        sectionCount: report.sectionCount,
        selectedSectionCount: report.selectedSectionCount,
        issueCount: report.issueCount,
        encounterCount: report.encounterCount,
        procedureOrderCount: report.procedureOrderCount,
        sections: report.sections,
        issues: report.issues,
        encounters: report.encounters,
        procedureOrders: report.procedureOrders,
        reportPreview: report.reportPreview
      },
      context: {
        suite: "workflow-patient-portal-medical-report",
        workflow: "patient-portal-medical-report-result"
      }
    });
  });

  test("renders signed-in portal patient medical report builder on the portal surface", async ({
    page,
    target
  }, testInfo) => {
    test.setTimeout(120_000);

    if (target.type === "legacy-openemr") {
      const legacySurface = await expectLegacyPatientPortalMedicalReport(page, target);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-224-patient-portal-medical-report-legacy-surface",
        description: "Captures the legacy OpenEMR portal medical-report builder surface for the signed-in patient.",
        expected: {
          page: "portal/report/portal_patient_report.php",
          visibleFacts: [
            "Demographics",
            "Billing",
            "Medical Problems",
            "Encounters & Forms",
            "Procedures",
            "Hemoglobin A1c",
            "Generate Report",
            "Download PDF"
          ]
        },
        actual: legacySurface,
        context: {
          suite: "workflow-patient-portal-medical-report",
          workflow: "patient-portal-medical-report-legacy-surface"
        }
      });
      return;
    }

    await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
    const reportsRegion = page.getByRole("region", { name: "Patient portal medical reports" });
    await expect(reportsRegion).toContainText("Medical Reports");
    await expect(reportsRegion).toContainText("Customized Medical History Report");
    await expect(reportsRegion).toContainText("Demographics");
    await expect(reportsRegion).toContainText("Billing");
    await expect(reportsRegion).toContainText("Medical Problems");
    await expect(reportsRegion).toContainText("Encounters & Forms");
    await expect(reportsRegion).toContainText("Procedure Order");
    await expect(reportsRegion).toContainText("Hemoglobin A1c");
    await expect(reportsRegion).toContainText("Patient Data: Kim, Nora");
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-224-patient-portal-medical-report-modernized-surface",
      description: "Captures the modernized Portal medical-report builder surface rendered for the signed-in patient.",
      expected: {
        heading: "Medical Reports",
        visibleFacts: [
          "Customized Medical History Report",
          "Demographics",
          "Billing",
          "Medical Problems",
          "Encounters & Forms",
          "Procedure Order",
          "Hemoglobin A1c",
          "Patient Data: Kim, Nora"
        ]
      },
      actual: {
        url: page.url(),
        regionText: await reportsRegion.innerText()
      },
      context: {
        suite: "workflow-patient-portal-medical-report",
        workflow: "patient-portal-medical-report-modernized-surface"
      }
    });
  });
});

async function expectLegacyPatientPortalMedicalReport(page: Page, target: RuntimeTarget) {
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
  await expect(page.locator("body")).toContainText("Demographics");
  await expect(page.locator("body")).toContainText("Billing");
  await expect(page.locator("body")).toContainText("Medical Problems");
  await expect(page.locator("body")).toContainText("Encounters & Forms");
  await expect(page.locator("body")).toContainText("Procedures");
  await expect(page.locator("body")).toContainText("Hemoglobin A1c");
  await expect(page.locator("body")).toContainText("Generate Report");
  await expect(page.locator("body")).toContainText("Download PDF");
  const bodyText = await page.locator("body").innerText();

  return {
    url: `${target.publicUrl}/portal/report/portal_patient_report.php`,
    bodyText
  };
}
