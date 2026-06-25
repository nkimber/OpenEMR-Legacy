import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openClinicalReportsDirect,
  openPatientListReportDirect
} from "../../src/ui/legacyOpenEmr.js";

type OperationalReportResponse = {
  counts: {
    patients: number;
    futureAppointments: number;
    patientDocuments: number;
  };
  providerActivity: Array<{
    username: string;
    displayName?: string;
    encounters?: number;
    billingLines?: number;
    billingTotal?: string | number;
  }>;
};

test.describe("operational reports protection parity @slice164 @reports-protection", () => {
  test("requires an active session before operational report data is visible", async ({ page, target }, testInfo) => {
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-164-reports-protection-precondition",
      description:
        "Captures the Slice 164 reports protection precondition without storing password, cookie, or session material.",
      expected: {
        username: "admin",
        legacyPatientListPath: "/interface/reports/patient_list.php",
        legacyClinicalReportsPath: "/interface/reports/clinical_reports.php",
        modernizedOperationalReportPath: "/api/reports/operational",
        modernizedOperationalExportPath: "/api/reports/operational/export",
        requiresAuthenticatedSession: true,
        secretMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true
      },
      context: {
        suite: "workflow-reports-protection",
        workflow: "reports-protection-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await page.goto(`${target.publicUrl}/interface/reports/patient_list.php`);
      await expect(page.locator("body")).not.toContainText("Visits From");
      await expect(page.locator("body")).not.toContainText("Export to CSV");
      const unauthenticatedPatientListText = await page.locator("body").textContent();

      await page.goto(`${target.publicUrl}/interface/reports/clinical_reports.php`);
      await expect(page.locator("body")).not.toContainText("Problem DX");
      const unauthenticatedClinicalReportsText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-164-reports-protection-unauthenticated",
        description:
          "Captures legacy OpenEMR operational report protection markers before an admin session is established.",
        expected: {
          patientListContainsVisitsFrom: false,
          patientListContainsExportToCsv: false,
          clinicalReportsContainsProblemDx: false
        },
        actual: {
          patientList: summarizeRenderedText(unauthenticatedPatientListText, ["Visits From", "Export to CSV"]),
          clinicalReports: summarizeRenderedText(unauthenticatedClinicalReportsText, ["Problem DX"])
        },
        context: {
          suite: "workflow-reports-protection",
          workflow: "reports-protection-unauthenticated"
        }
      });

      await loginToLegacyOpenEmr(page, target);
      await openPatientListReportDirect(page, target);
      await expectRenderedText(page, "Patient List");
      await expectRenderedText(page, "Visits From");
      const authenticatedPatientListText = await page.locator("body").textContent();

      await openClinicalReportsDirect(page, target);
      await expectRenderedText(page, "Report - Clinical");
      await expectRenderedText(page, "Problem DX");
      const authenticatedClinicalReportsText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-164-reports-protection-authenticated",
        description:
          "Captures legacy OpenEMR operational report visibility markers after an admin session is established.",
        expected: {
          patientListContainsPatientList: true,
          patientListContainsVisitsFrom: true,
          clinicalReportsContainsReportClinical: true,
          clinicalReportsContainsProblemDx: true,
          passwordMaterialRedacted: true
        },
        actual: {
          patientList: summarizeRenderedText(authenticatedPatientListText, ["Patient List", "Visits From"]),
          clinicalReports: summarizeRenderedText(authenticatedClinicalReportsText, ["Report - Clinical", "Problem DX"]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-reports-protection",
          workflow: "reports-protection-authenticated"
        }
      });
      return;
    }

    const unauthenticatedReport = await page.request.get(`${target.apiBaseUrl}/api/reports/operational`);
    expect(unauthenticatedReport.status()).toBe(401);
    const unauthenticatedReportBody = await unauthenticatedReport.json();
    expect(unauthenticatedReportBody).toMatchObject({
      authenticated: false,
      sessionSource: "modernized-openemr"
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-164-reports-protection-unauthenticated",
      description:
        "Captures modernized operational report API protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        authenticated: false,
        sessionSource: "modernized-openemr"
      },
      actual: {
        statusCode: unauthenticatedReport.status(),
        body: unauthenticatedReportBody
      },
      context: {
        suite: "workflow-reports-protection",
        workflow: "reports-protection-unauthenticated"
      }
    });

    const unauthenticatedExport = await page.request.get(`${target.apiBaseUrl}/api/reports/operational/export`);
    expect(unauthenticatedExport.status()).toBe(401);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-164-reports-protection-unauthenticated-export",
      description:
        "Captures modernized operational report export protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        exportRejected: true
      },
      actual: {
        statusCode: unauthenticatedExport.status(),
        bodyPreview: (await unauthenticatedExport.text()).slice(0, 240)
      },
      context: {
        suite: "workflow-reports-protection",
        workflow: "reports-protection-unauthenticated-export"
      }
    });

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
    const report = (await authenticatedReport.json()) as OperationalReportResponse;
    expect(report.counts).toMatchObject({
      patients: 1000,
      futureAppointments: 1261,
      patientDocuments: 1200
    });
    expect(report.providerActivity.some((provider: { username: string }) => provider.username === "gold-provider-02")).toBe(
      true
    );
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-164-reports-protection-authenticated",
      description:
        "Captures modernized operational report API visibility facts after an admin session is established, with the session identifier redacted.",
      expected: {
        loginAuthenticated: true,
        authenticatedReportStatusCode: 200,
        patients: 1000,
        futureAppointments: 1261,
        patientDocuments: 1200,
        includesGoldProvider02: true,
        sessionIdentifierRedacted: true
      },
      actual: {
        login: {
          authenticated: Boolean(login.authenticated),
          username: login.username,
          sessionIssued: Boolean(login.sessionId),
          sessionIdRedacted: true
        },
        authenticatedReport: {
          statusCode: authenticatedReport.status(),
          counts: report.counts,
          includesGoldProvider02: report.providerActivity.some((provider) => provider.username === "gold-provider-02"),
          sampleProviderActivity: report.providerActivity.slice(0, 5)
        }
      },
      context: {
        suite: "workflow-reports-protection",
        workflow: "reports-protection-authenticated"
      }
    });

    const authenticatedExport = await page.request.get(`${target.apiBaseUrl}/api/reports/operational/export`, {
      headers: { "X-OpenEMR-Session": login.sessionId }
    });
    expect(authenticatedExport.ok()).toBeTruthy();
    const csv = await authenticatedExport.text();
    expect(csv).toContain("Counts,Patients,Total,1000");
    expect(csv).toContain("Provider Activity,gold-provider-02,Encounters,176");
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-164-reports-protection-authenticated-export",
      description:
        "Captures modernized operational report CSV export visibility facts after an admin session is established.",
      expected: {
        statusCode: 200,
        containsTotalPatients: "Counts,Patients,Total,1000",
        containsProviderEncounters: "Provider Activity,gold-provider-02,Encounters,176"
      },
      actual: {
        statusCode: authenticatedExport.status(),
        containsTotalPatients: csv.includes("Counts,Patients,Total,1000"),
        containsProviderEncounters: csv.includes("Provider Activity,gold-provider-02,Encounters,176"),
        lineCount: csv.split(/\r?\n/).filter(Boolean).length,
        csvPreview: csv.split(/\r?\n/).slice(0, 8)
      },
      context: {
        suite: "workflow-reports-protection",
        workflow: "reports-protection-authenticated-export"
      }
    });

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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-164-reports-protection-rendered",
      description:
        "Captures modernized Reports-page protection rendering facts before and after login.",
      expected: {
        rendersSignedOutPrompt: "Sign in to load operational reports",
        hidesGoldDataSnapshotBeforeLogin: true,
        rendersGoldDataSnapshot: "Gold Data Snapshot",
        rendersGoldProvider02: "gold-provider-02",
        rendersCsvExportButton: true
      },
      actual: {
        surfaceFacts: {
          modernizedReportsPage: {
            renderedSignedOutPrompt: "Sign in to load operational reports",
            didNotRenderGoldDataSnapshotBeforeLogin: true,
            renderedGoldDataSnapshot: "Gold Data Snapshot",
            renderedGoldProvider02: "gold-provider-02",
            renderedCsvExportButton: true,
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-reports-protection",
        workflow: "reports-protection-rendered"
      }
    });
  });
});

function summarizeRenderedText(text: string | null, markers: string[]) {
  const body = text ?? "";
  return {
    bodyLength: body.length,
    bodyPreview: body.slice(0, 240),
    markers: Object.fromEntries(markers.map((marker) => [marker, body.includes(marker)]))
  };
}
