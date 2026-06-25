import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientListReportDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedReports } from "../../src/ui/modernizedOpenEmr.js";

test.describe("operational reports export parity @slice24 @reports-export", () => {
  test("normalized operational report export rows match the gold data contract", async ({ target, targetDb }, testInfo) => {
    const rows = await targetDb.getOperationalReportExportRows();
    const selectedRows = selectExportRows(rows);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-24-operational-reports-export-rows",
      description: "Verifies the Slice 24 normalized operational report export row set and representative gold-data CSV anchors.",
      expected: {
        rowCount: 79,
        anchors: {
          totalPatients: { section: "Counts", name: "Patients", metric: "Total", value: "1000" },
          patientDocuments: { section: "Counts", name: "Patient Documents", metric: "Total", value: "1200" },
          billingTotal: { section: "Counts", name: "Billing Total", metric: "USD", value: "446000.00" },
          providerEncounters: {
            section: "Provider Activity",
            name: "gold-provider-02",
            metric: "Encounters",
            value: "176"
          },
          providerBillingTotal: {
            section: "Provider Activity",
            name: "gold-provider-02",
            metric: "Billing Total",
            value: "37422.00"
          },
          northBillingTotal: {
            section: "Facility Activity",
            name: "NORTH",
            metric: "Billing Total",
            value: "148904.00"
          },
          asthmaTitle: {
            section: "Clinical Conditions",
            name: "ICD10:J45.909",
            metric: "Title",
            value: "Asthma, uncomplicated"
          },
          asthmaPatients: {
            section: "Clinical Conditions",
            name: "ICD10:J45.909",
            metric: "Patients",
            value: "188"
          }
        }
      },
      actual: {
        rowCount: rows.length,
        rows,
        selectedRows
      },
      context: {
        suite: "reports-export",
        workflow: "operational-reports-export-rows"
      }
    });

    expect(rows).toHaveLength(79);
    expect(rows).toContainEqual({ section: "Counts", name: "Patients", metric: "Total", value: "1000" });
    expect(rows).toContainEqual({ section: "Counts", name: "Patient Documents", metric: "Total", value: "1200" });
    expect(rows).toContainEqual({
      section: "Counts",
      name: "Billing Total",
      metric: "USD",
      value: "446000.00"
    });
    expect(rows).toContainEqual({
      section: "Provider Activity",
      name: "gold-provider-02",
      metric: "Encounters",
      value: "176"
    });
    expect(rows).toContainEqual({
      section: "Provider Activity",
      name: "gold-provider-02",
      metric: "Billing Total",
      value: "37422.00"
    });
    expect(rows).toContainEqual({
      section: "Facility Activity",
      name: "NORTH",
      metric: "Billing Total",
      value: "148904.00"
    });
    expect(rows).toContainEqual({
      section: "Clinical Conditions",
      name: "ICD10:J45.909",
      metric: "Title",
      value: "Asthma, uncomplicated"
    });
    expect(rows).toContainEqual({
      section: "Clinical Conditions",
      name: "ICD10:J45.909",
      metric: "Patients",
      value: "188"
    });
  });

  test("report export affordance is visible and functional", async ({ page, target, targetDb }, testInfo) => {
    const rows = await targetDb.getOperationalReportExportRows();
    const selectedRows = selectExportRows(rows);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-24-operational-reports-export-ui-precondition",
      description: "Captures the normalized export rows used before steering the Slice 24 CSV export UI and API affordance checks.",
      expected: {
        rowCount: 79,
        ui: {
          legacyExportLabel: "Export to CSV",
          modernizedExportButton: "CSV Export",
          csvHeader: "Section,Name,Metric,Value"
        },
        anchors: {
          totalPatients: "Counts,Patients,Total,1000",
          patientDocuments: "Counts,Patient Documents,Total,1200",
          providerEncounters: "Provider Activity,gold-provider-02,Encounters,176",
          northBillingTotal: "Facility Activity,NORTH,Billing Total,148904.00",
          asthmaTitle: "Clinical Conditions,ICD10:J45.909,Title,\"Asthma, uncomplicated\""
        }
      },
      actual: {
        rowCount: rows.length,
        selectedRows
      },
      context: {
        suite: "reports-export",
        workflow: "operational-reports-export-ui"
      }
    });

    expect(rows).toHaveLength(79);

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientListReportDirect(page, target);
      await page.evaluate(() => {
        const refreshInput = document.querySelector<HTMLInputElement>("#form_refresh");
        const form = document.querySelector<HTMLFormElement>("#theform");
        if (!refreshInput || !form) {
          throw new Error("Patient List report form controls were not found.");
        }
        refreshInput.value = "true";
        form.submit();
      });
      await page.waitForLoadState("domcontentloaded");
      await expectRenderedText(page, "Patient List");
      await expectRenderedText(page, "Export to CSV");
      return;
    }

    await openAuthenticatedModernizedReports(page, target);

    const exportButton = page.getByRole("button", { name: /CSV Export/i });
    await expect(exportButton).toBeVisible();
    await expect(exportButton).toBeEnabled();

    const loginResponse = await page.request.post(`${target.apiBaseUrl}/api/auth/login`, {
      data: target.credentials
    });
    expect(loginResponse.ok()).toBeTruthy();
    const login = await loginResponse.json();
    expect(login.authenticated).toBe(true);
    expect(login.sessionId).toBeTruthy();

    const response = await page.request.get(`${target.apiBaseUrl}/api/reports/operational/export`, {
      headers: { "X-OpenEMR-Session": login.sessionId }
    });
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("text/csv");

    const csv = await response.text();
    expect(csv).toContain("Section,Name,Metric,Value");
    expect(csv).toContain("Counts,Patients,Total,1000");
    expect(csv).toContain("Counts,Patient Documents,Total,1200");
    expect(csv).toContain("Provider Activity,gold-provider-02,Encounters,176");
    expect(csv).toContain("Facility Activity,NORTH,Billing Total,148904.00");
    expect(csv).toContain('Clinical Conditions,ICD10:J45.909,Title,"Asthma, uncomplicated"');
  });
});

function selectExportRows(rows: Array<{ section: string; name: string; metric: string; value: string }>) {
  return {
    totalPatients: rows.find((row) => row.section === "Counts" && row.name === "Patients" && row.metric === "Total") ?? null,
    patientDocuments: rows.find(
      (row) => row.section === "Counts" && row.name === "Patient Documents" && row.metric === "Total"
    ) ?? null,
    billingTotal: rows.find((row) => row.section === "Counts" && row.name === "Billing Total" && row.metric === "USD") ?? null,
    providerEncounters: rows.find(
      (row) => row.section === "Provider Activity" && row.name === "gold-provider-02" && row.metric === "Encounters"
    ) ?? null,
    providerBillingTotal: rows.find(
      (row) => row.section === "Provider Activity" && row.name === "gold-provider-02" && row.metric === "Billing Total"
    ) ?? null,
    northBillingTotal: rows.find(
      (row) => row.section === "Facility Activity" && row.name === "NORTH" && row.metric === "Billing Total"
    ) ?? null,
    asthmaTitle: rows.find(
      (row) => row.section === "Clinical Conditions" && row.name === "ICD10:J45.909" && row.metric === "Title"
    ) ?? null,
    asthmaPatients: rows.find(
      (row) => row.section === "Clinical Conditions" && row.name === "ICD10:J45.909" && row.metric === "Patients"
    ) ?? null
  };
}
