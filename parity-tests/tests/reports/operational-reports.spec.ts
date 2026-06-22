import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openClinicalReportsDirect,
  openPatientListReportDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedReports } from "../../src/ui/modernizedOpenEmr.js";

test.describe("operational reports parity @slice9 @reports", () => {
  test("seeded operational report facts match the gold data contract", async ({ targetDb }) => {
    const reports = await targetDb.getOperationalReports();

    expect(reports.counts.patients).toBe(1000);
    expect(reports.counts.portalPatients).toBe(200);
    expect(reports.counts.appointments).toBe(2800);
    expect(reports.counts.futureAppointments).toBe(1261);
    expect(reports.counts.currentYearAppointments).toBe(2800);
    expect(reports.counts.encounters).toBe(2100);
    expect(reports.counts.currentYearEncounters).toBe(1100);
    expect(reports.counts.billingLines).toBe(3000);
    expect(reports.counts.billingTotal).toBe(446000);
    expect(reports.counts.labReports).toBe(700);
    expect(reports.counts.patientDocuments).toBe(1200);
    expect(reports.counts.messages).toBe(1200);
    expect(reports.counts.newMessages).toBe(1000);
    expect(reports.counts.doneMessages).toBe(200);
    expect(reports.counts.facilities).toBe(3);
    expect(reports.counts.providers).toBe(12);

    const provider = reports.providerActivity.find((item) => item.username === "gold-provider-02");
    expect(provider).toMatchObject({
      firstName: "Jordan",
      lastName: "Morris",
      encounters: 176,
      billingLines: 253,
      billingTotal: 37422
    });

    const northFacility = reports.facilityActivity.find((item) => item.code === "NORTH");
    expect(northFacility).toMatchObject({
      name: "North County Clinic",
      appointments: 935,
      encounters: 701,
      billingLines: 1002,
      billingTotal: 148904
    });

    const asthma = reports.clinicalConditions.find((item) => item.diagnosis === "ICD10:J45.909");
    expect(asthma).toMatchObject({
      title: "Asthma, uncomplicated",
      patients: 188
    });
  });

  test("operational report surfaces are visible in the application UI", async ({ page, target }) => {
    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientListReportDirect(page, target);
      await expectRenderedText(page, "Patient List");
      await expectRenderedText(page, "Visits From");

      await openClinicalReportsDirect(page, target);
      await expectRenderedText(page, "Report - Clinical");
      await expectRenderedText(page, "Problem DX");
      return;
    }

    await openAuthenticatedModernizedReports(page, target);

    await expect(page.locator("body")).toContainText("Operational Reports");
    await expect(page.locator("body")).toContainText("Gold Data Snapshot");
    await expect(page.locator("body")).toContainText("Future appointments");
    await expect(page.locator("body")).toContainText("1261");
    await expect(page.locator("body")).toContainText("Documents");
    await expect(page.locator("body")).toContainText("1200");
    await expect(page.locator("body")).toContainText("$446000.00");
    await expect(page.locator("body")).toContainText("gold-provider-02");
    await expect(page.locator("body")).toContainText("North County Clinic");
    await expect(page.locator("body")).toContainText("Asthma, uncomplicated");
    await expect(page.locator("body")).toContainText("ICD10:J45.909");
  });
});
