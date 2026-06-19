import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientListReportDirect
} from "../../src/ui/legacyOpenEmr.js";

test.describe("operational reports export parity @slice24 @reports-export", () => {
  test("normalized operational report export rows match the gold data contract", async ({ targetDb }) => {
    const rows = await targetDb.getOperationalReportExportRows();

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

  test("report export affordance is visible and functional", async ({ page, target }) => {
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

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Reports" }).click();

    const exportLink = page.getByRole("link", { name: /CSV Export/i });
    await expect(exportLink).toBeVisible();
    const href = await exportLink.getAttribute("href");
    expect(href).toBe(`${target.apiBaseUrl}/api/reports/operational/export`);

    const response = await page.request.get(href!);
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
