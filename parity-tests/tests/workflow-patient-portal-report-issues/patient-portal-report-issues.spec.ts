import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMedicalReportAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const selectedIssueRequests = [
  { type: "medical_problem", title: "Low back pain, unspecified" },
  { type: "allergy", title: "Latex" },
  { type: "medication", title: "Omeprazole 20 mg" }
];

test.describe("patient portal generated report issue selection parity @slice227 @workflow-patient-portal-report-issues @patients @portal @reports", () => {
  test("generates selected issue content in the customized medical history report", async ({
    targetDb,
    target,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMedicalReportAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-227-patient-portal-generated-medical-report-issue-selection-precondition",
      description: "Captures the Slice 227 portal generated-report issue-selection precondition: the signed-in anchor patient exists before resolving selectable issue rows.",
      expected: {
        canonicalId: portalMedicalReportAnchorPatientId,
        portalUsername: portalLoginUsername,
        selectedIssueRequests
      },
      actual: {
        canonicalId: portalMedicalReportAnchorPatientId,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        portalUsername: portalLoginUsername
      },
      context: {
        suite: "workflow-patient-portal-report-issues",
        workflow: "patient-portal-generated-medical-report-issue-selection-precondition"
      }
    });

    const reportBuilder = await workflow.getPatientPortalMedicalReport(portalLoginUsername, portalPassword);
    expect(reportBuilder.authenticated).toBeTruthy();

    const selectedIssues = selectedIssueRequests.map(({ type, title }) => {
      const issue = reportBuilder.issues.find((candidate) => candidate.type === type && candidate.title === title);
      expect(issue, `Expected ${type} issue ${title}`).toBeTruthy();
      return issue!;
    });
    const firstProcedureOrder = reportBuilder.procedureOrders[0];
    expect(firstProcedureOrder).toBeTruthy();

    const generated = await workflow.generatePatientPortalMedicalReport(portalLoginUsername, portalPassword, {
      sectionIds: ["demographics", "billing"],
      issueIds: selectedIssues.map((issue) => issue.id),
      procedureOrderIds: [firstProcedureOrder.id]
    });

    expect(generated).toMatchObject({
      authenticated: true,
      username: portalLoginUsername,
      portalUsername: portalLoginUsername,
      pid: patient!.pid,
      pubpid: patient!.pubpid,
      displayName: "Kim, Nora",
      title: "Customized Medical History Report",
      includedSectionIds: ["demographics", "billing"],
      includedProcedureOrderIds: [firstProcedureOrder.id],
      printableVersionAvailable: true,
      pdfDownloadAvailable: true,
      reportSectionCount: 4,
      failureReason: null
    });
    expect([...generated.includedIssueIds].sort()).toEqual([...selectedIssues.map((issue) => issue.id)].sort());
    expect(generated.reportSections.map((section) => section.title)).toEqual([
      "Patient Data",
      "Billing Information",
      "Issues",
      "Procedure Order"
    ]);

    const generatedText = generated.reportSections
      .flatMap((section) => [section.title, ...section.lines])
      .join("\n");
    expect(generatedText).toContain("Medical Problem: Low back pain, unspecified");
    expect(generatedText).toContain("Allergy: Latex");
    expect(generatedText).toContain("Medication: Omeprazole 20 mg");
    expect(generated.summaryLines.join("\n")).toContain("Issues: 3 selected for this customized report.");
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-227-patient-portal-generated-medical-report-issue-selection-result",
      description: "Captures the Slice 227 generated medical-report issue-selection projection, including selected issue IDs/titles and resulting Issues section content.",
      expected: {
        displayName: "Kim, Nora",
        selectedIssueTitles: selectedIssueRequests.map((issue) => issue.title),
        reportSectionTitles: [
          "Patient Data",
          "Billing Information",
          "Issues",
          "Procedure Order"
        ],
        summaryLine: "Issues: 3 selected for this customized report."
      },
      actual: {
        authenticated: generated.authenticated,
        username: generated.username,
        portalUsername: generated.portalUsername,
        pid: generated.pid,
        pubpid: generated.pubpid,
        displayName: generated.displayName,
        title: generated.title,
        includedSectionIds: generated.includedSectionIds,
        includedIssueIds: generated.includedIssueIds,
        includedProcedureOrderIds: generated.includedProcedureOrderIds,
        selectedIssues: selectedIssues.map((issue) => ({
          id: issue.id,
          type: issue.type,
          title: issue.title
        })),
        procedureOrder: {
          id: firstProcedureOrder.id,
          procedureCode: firstProcedureOrder.procedureCode,
          procedureName: firstProcedureOrder.procedureName
        },
        reportSectionCount: generated.reportSectionCount,
        reportSections: generated.reportSections,
        summaryLines: generated.summaryLines
      },
      context: {
        suite: "workflow-patient-portal-report-issues",
        workflow: "patient-portal-generated-medical-report-issue-selection-result"
      }
    });
  });

  test("renders selected issue content on the portal generated report surface", async ({
    page,
    target
  }, testInfo) => {
    test.setTimeout(120_000);

    if (target.type === "legacy-openemr") {
      const legacySurface = await expectLegacySelectedIssueReport(page, target);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-227-patient-portal-generated-medical-report-issue-selection-legacy-ui",
        description: "Captures the legacy OpenEMR selected-issue generated-report surface after POSTing issue checkbox selections.",
        expected: {
          page: "portal/report/portal_custom_report.php",
          visibleFacts: [
            "Issues",
            "Low back pain, unspecified",
            "Latex",
            "Omeprazole 20 mg"
          ]
        },
        actual: legacySurface,
        context: {
          suite: "workflow-patient-portal-report-issues",
          workflow: "patient-portal-generated-medical-report-issue-selection-legacy-ui"
        }
      });
      return;
    }

    const modernizedSurface = await expectModernizedSelectedIssueReport(page, target);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-227-patient-portal-generated-medical-report-issue-selection-modernized-ui",
      description: "Captures the modernized Portal selected-issue generated-report surface after checking issue selections and regenerating the report.",
      expected: {
        heading: "Patient portal generated medical report",
        selectedIssueTitles: selectedIssueRequests.map((issue) => issue.title),
        visibleFacts: [
          "Issues",
          "Medical Problem: Low back pain, unspecified",
          "Allergy: Latex",
          "Medication: Omeprazole 20 mg",
          "Issues: 3 selected for this customized report."
        ]
      },
      actual: modernizedSurface,
      context: {
        suite: "workflow-patient-portal-report-issues",
        workflow: "patient-portal-generated-medical-report-issue-selection-modernized-ui"
      }
    });
  });
});

async function expectLegacySelectedIssueReport(page: Page, target: RuntimeTarget) {
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

  const issueControls = await Promise.all(selectedIssueRequests.map(async ({ title }) => {
    const input = page.locator("label", { hasText: title }).locator("input[name^='issue_']").first();
    const name = await input.getAttribute("name");
    const value = await input.getAttribute("value");
    expect(name, `Expected issue input name for ${title}`).toBeTruthy();
    expect(value, `Expected issue input value for ${title}`).toBeTruthy();
    return { name: name!, value: value! };
  }));

  const form: Record<string, string> = {
    include_demographics: "demographics",
    include_billing: "billing",
    "procedures[]": procedureOrderId!
  };
  for (const issue of issueControls) {
    form[issue.name] = issue.value;
  }

  const reportResponse = await page.request.post(`${target.publicUrl}/portal/report/portal_custom_report.php`, {
    form
  });
  expect(reportResponse.ok()).toBeTruthy();
  const reportHtml = await reportResponse.text();
  expect(reportHtml).toContain("Issues");
  expect(reportHtml).toContain("Low back pain, unspecified");
  expect(reportHtml).toContain("Latex");
  expect(reportHtml).toContain("Omeprazole 20 mg");

  return {
    url: `${target.publicUrl}/portal/report/portal_custom_report.php`,
    procedureOrderId,
    issueControls,
    responseLength: reportHtml.length,
    containsFacts: {
      issuesHeading: reportHtml.includes("Issues"),
      medicalProblem: reportHtml.includes("Low back pain, unspecified"),
      allergy: reportHtml.includes("Latex"),
      medication: reportHtml.includes("Omeprazole 20 mg")
    }
  };
}

async function expectModernizedSelectedIssueReport(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);

  for (const { title } of selectedIssueRequests) {
    await page.getByRole("checkbox", { name: `Include ${title} in generated report` }).check();
  }

  await page.getByRole("button", { name: "Generate report" }).click();
  const generatedReportRegion = page.getByRole("region", { name: "Patient portal generated medical report" });
  await expect(generatedReportRegion).toContainText("Issues");
  await expect(generatedReportRegion).toContainText("Medical Problem: Low back pain, unspecified");
  await expect(generatedReportRegion).toContainText("Allergy: Latex");
  await expect(generatedReportRegion).toContainText("Medication: Omeprazole 20 mg");
  await expect(generatedReportRegion).toContainText("Issues: 3 selected for this customized report.");

  return {
    url: page.url(),
    selectedIssueTitles: selectedIssueRequests.map((issue) => issue.title),
    regionText: await generatedReportRegion.innerText()
  };
}
