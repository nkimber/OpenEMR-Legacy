import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMedicalReportAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal generated report lifecycle audit parity @slice231 @workflow-patient-portal-report-audit @patients @portal @reports", () => {
  test("normalizes generated medical report audit events", async ({
    targetDb,
    target,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMedicalReportAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-231-patient-portal-report-audit-precondition",
      description: "Captures the Slice 231 generated medical-report lifecycle audit precondition: the anchor patient exists before generating report audit events.",
      expected: {
        canonicalId: portalMedicalReportAnchorPatientId,
        portalUsername: portalLoginUsername,
        expectedAuditEvents: ["generated_report"]
      },
      actual: {
        canonicalId: portalMedicalReportAnchorPatientId,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        portalUsername: portalLoginUsername
      },
      context: {
        suite: "workflow-patient-portal-report-audit",
        workflow: "patient-portal-generated-medical-report-audit-precondition"
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
      failureReason: null
    });
    expect(generated.auditEventCount).toBe(generated.auditEvents.length);
    expect(generated.auditEventCount).toBeGreaterThanOrEqual(1);

    const generatedEvent = generated.auditEvents.find((event) => event.eventType === "generated_report");
    expect(generatedEvent).toBeTruthy();
    expect(generatedEvent).toMatchObject({
      eventLabel: "Generated report",
      reportTitle: "Customized Medical History Report",
      includedSectionIds: ["demographics", "billing"],
      includedIssueIds: [],
      includedEncounterFormIds: [],
      eventSource: generated.sessionSource
    });
    expect(generatedEvent!.eventAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(generatedEvent!.includedProcedureOrderIds).toHaveLength(1);
    expect(generatedEvent!.summary).toContain("Customized Medical History Report");
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-231-patient-portal-report-audit-result",
      description: "Captures the Slice 231 generated medical-report lifecycle audit projection after generating a demographics and billing report.",
      expected: {
        displayName: "Kim, Nora",
        auditEventTypes: ["generated_report"],
        generatedEvent: {
          eventLabel: "Generated report",
          reportTitle: "Customized Medical History Report",
          includedSectionIds: ["demographics", "billing"],
          includedIssueIds: [],
          includedEncounterFormIds: [],
          includedProcedureOrderCount: 1
        }
      },
      actual: {
        authenticated: generated.authenticated,
        username: generated.username,
        portalUsername: generated.portalUsername,
        pid: generated.pid,
        pubpid: generated.pubpid,
        displayName: generated.displayName,
        title: generated.title,
        auditEventCount: generated.auditEventCount,
        auditEvents: generated.auditEvents
      },
      context: {
        suite: "workflow-patient-portal-report-audit",
        workflow: "patient-portal-generated-medical-report-audit-result"
      }
    });
  });

  test("captures generated report artifact lifecycle events", async ({
    page,
    target,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    if (target.type === "legacy-openemr") {
      const generated = await workflow.generatePatientPortalMedicalReport(portalLoginUsername, portalPassword, {
        sectionIds: ["demographics", "billing"]
      });
      expect(generated.auditEvents.map((event) => event.eventType)).toContain("generated_report");
      const legacyLifecycle = await expectLegacyGeneratedMedicalReportLifecycleSources(page, target);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-231-patient-portal-report-audit-legacy-ui",
        description: "Captures the legacy generated medical-report lifecycle source artifacts used as the audit reference: generated-report event plus printable/PDF source artifact metadata.",
        expected: {
          auditEventTypes: ["generated_report"],
          printablePage: "portal/report/portal_custom_report.php?printable=1",
          pdfPage: "portal/report/portal_custom_report.php",
          visibleFacts: ["Modernization Family Medicine", "PATIENT:Kim, Nora"],
          pdfHeader: "%PDF"
        },
        actual: {
          auditEventTypes: generated.auditEvents.map((event) => event.eventType),
          auditEventCount: generated.auditEventCount,
          auditEvents: generated.auditEvents,
          sourceArtifacts: legacyLifecycle
        },
        context: {
          suite: "workflow-patient-portal-report-audit",
          workflow: "patient-portal-generated-medical-report-audit-legacy-ui"
        }
      });
      return;
    }

    const modernizedLifecycle = await expectModernizedGeneratedMedicalReportLifecycleAudit(page, target);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-231-patient-portal-report-audit-modernized-ui",
      description: "Captures the modernized generated medical-report lifecycle audit API and Portal surface, including generated, PDF downloaded, and package downloaded audit events.",
      expected: {
        auditEndpoint: "/api/patient-portal/medical-report/audit",
        auditEventTypes: ["generated_report", "pdf_downloaded", "package_downloaded"],
        artifactContentTypes: ["application/pdf", "application/zip"],
        visibleFacts: ["Report Audit", "Audit Events", "Generated report", "PDF downloaded", "Package downloaded"]
      },
      actual: modernizedLifecycle,
      context: {
        suite: "workflow-patient-portal-report-audit",
        workflow: "patient-portal-generated-medical-report-audit-modernized-ui"
      }
    });
  });
});

async function expectLegacyGeneratedMedicalReportLifecycleSources(page: Page, target: RuntimeTarget) {
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

  const printableParams = new URLSearchParams();
  printableParams.set("printable", "1");
  printableParams.set("include_demographics", "demographics");
  printableParams.set("include_billing", "billing");
  printableParams.append("procedures[]", procedureOrderId!);
  const printableResponse = await page.request.get(
    `${target.publicUrl}/portal/report/portal_custom_report.php?${printableParams.toString()}`
  );
  expect(printableResponse.ok()).toBeTruthy();
  const printableHtml = await printableResponse.text();
  expect(printableHtml).toContain("Modernization Family Medicine");
  expect(printableHtml).toContain("PATIENT:Kim, Nora");

  const pdfResponse = await page.request.post(`${target.publicUrl}/portal/report/portal_custom_report.php`, {
    form: {
      include_demographics: "demographics",
      include_billing: "billing",
      "procedures[]": procedureOrderId!,
      pdf: "1"
    }
  });
  expect(pdfResponse.ok()).toBeTruthy();
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");

  const pdf = await pdfResponse.body();
  expect(pdf.byteLength).toBeGreaterThan(1000);
  expect(pdf.toString("latin1").startsWith("%PDF")).toBeTruthy();

  return {
    printableUrl: `${target.publicUrl}/portal/report/portal_custom_report.php?${printableParams.toString()}`,
    pdfUrl: `${target.publicUrl}/portal/report/portal_custom_report.php`,
    procedureOrderId,
    printableResponseLength: printableHtml.length,
    pdfContentType: pdfResponse.headers()["content-type"],
    pdfByteLength: pdf.byteLength,
    pdfHeader: pdf.toString("latin1", 0, 4),
    containsFacts: {
      printableFacility: printableHtml.includes("Modernization Family Medicine"),
      printablePatientHeader: printableHtml.includes("PATIENT:Kim, Nora"),
      pdfHeader: pdf.toString("latin1").startsWith("%PDF")
    }
  };
}

async function expectModernizedGeneratedMedicalReportLifecycleAudit(page: Page, target: RuntimeTarget) {
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

  const headers = {
    "X-OpenEMR-Patient-Portal-Session": login.sessionId!
  };
  const generationInput = {
    sectionIds: ["demographics", "billing"]
  };

  const generateResponse = await page.request.post(`${target.apiBaseUrl}/api/patient-portal/medical-report/generate`, {
    headers,
    data: generationInput
  });
  expect(generateResponse.ok()).toBeTruthy();
  const generated = await generateResponse.json() as { auditEvents: Array<{ eventType: string }> };
  expect(generated.auditEvents.map((event) => event.eventType)).toContain("generated_report");

  const pdfResponse = await page.request.post(`${target.apiBaseUrl}/api/patient-portal/medical-report/pdf`, {
    headers,
    data: generationInput
  });
  expect(pdfResponse.ok()).toBeTruthy();
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");

  const packageResponse = await page.request.post(`${target.apiBaseUrl}/api/patient-portal/medical-report/package`, {
    headers,
    data: generationInput
  });
  expect(packageResponse.ok()).toBeTruthy();
  expect(packageResponse.headers()["content-type"]).toContain("application/zip");

  const auditResponse = await page.request.get(`${target.apiBaseUrl}/api/patient-portal/medical-report/audit`, {
    headers
  });
  const auditEndpoint = `${target.apiBaseUrl}/api/patient-portal/medical-report/audit`;
  expect(auditResponse.ok()).toBeTruthy();
  const audit = await auditResponse.json() as {
    authenticated: boolean;
    auditEventCount: number;
    auditEvents: Array<{
      eventType: string;
      eventLabel: string;
      artifactName: string | null;
      artifactContentType: string | null;
      includedSectionIds: string[];
      summary: string;
    }>;
  };
  expect(audit.authenticated).toBeTruthy();
  expect(audit.auditEventCount).toBe(audit.auditEvents.length);
  expect(audit.auditEvents.map((event) => event.eventType)).toEqual([
    "generated_report",
    "pdf_downloaded",
    "package_downloaded"
  ]);

  const pdfEvent = audit.auditEvents.find((event) => event.eventType === "pdf_downloaded");
  expect(pdfEvent).toMatchObject({
    eventLabel: "PDF downloaded",
    artifactContentType: "application/pdf",
    includedSectionIds: ["demographics", "billing"]
  });
  expect(pdfEvent!.artifactName).toMatch(/^medical-report-MOD-PAT-0004-\d{8}\.pdf$/);
  expect(pdfEvent!.summary).toContain("Downloaded PDF");

  const packageEvent = audit.auditEvents.find((event) => event.eventType === "package_downloaded");
  expect(packageEvent).toMatchObject({
    eventLabel: "Package downloaded",
    artifactContentType: "application/zip",
    includedSectionIds: ["demographics", "billing"]
  });
  expect(packageEvent!.artifactName).toMatch(/^medical-report-MOD-PAT-0004-\d{8}\.zip$/);
  expect(packageEvent!.summary).toContain("Downloaded package");

  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const generatedReportRegion = page.getByRole("region", { name: "Patient portal generated medical report" });
  await expect(generatedReportRegion).toContainText("Report Audit");
  await expect(generatedReportRegion).toContainText("Audit Events");
  await expect(generatedReportRegion).toContainText("Generated report");
  await expect(generatedReportRegion).toContainText("PDF downloaded");
  await expect(generatedReportRegion).toContainText("Package downloaded");
  const regionText = await generatedReportRegion.innerText();

  return {
    generatedAuditEventTypes: generated.auditEvents.map((event) => event.eventType),
    pdfContentType: pdfResponse.headers()["content-type"],
    packageContentType: packageResponse.headers()["content-type"],
    auditEndpoint,
    auditEventCount: audit.auditEventCount,
    auditEvents: audit.auditEvents,
    portalUrl: page.url(),
    regionText,
    containsFacts: {
      reportAudit: regionText.includes("Report Audit"),
      auditEvents: regionText.includes("Audit Events"),
      generatedReport: regionText.includes("Generated report"),
      pdfDownloaded: regionText.includes("PDF downloaded"),
      packageDownloaded: regionText.includes("Package downloaded")
    }
  };
}
