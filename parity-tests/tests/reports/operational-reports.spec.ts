import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openClinicalReportsDirect,
  openPatientListReportDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedReports } from "../../src/ui/modernizedOpenEmr.js";

test.describe("operational reports parity @slice9 @reports", () => {
  test("seeded operational report facts match the gold data contract", async ({ target, targetDb }, testInfo) => {
    const reports = await targetDb.getOperationalReports();
    const provider = reports.providerActivity.find((item) => item.username === "gold-provider-02") ?? null;
    const northFacility = reports.facilityActivity.find((item) => item.code === "NORTH") ?? null;
    const asthma = reports.clinicalConditions.find((item) => item.diagnosis === "ICD10:J45.909") ?? null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-9-operational-reports-anchor",
      description: "Verifies the Slice 9 operational report gold-data counts, selected provider activity, selected facility activity, and selected clinical-condition database facts.",
      expected: {
        counts: {
          patients: 1000,
          portalPatients: 200,
          appointments: 2800,
          futureAppointments: 1261,
          currentYearAppointments: 2800,
          encounters: 2100,
          currentYearEncounters: 1100,
          billingLines: 3000,
          billingTotal: 446000,
          labReports: 700,
          patientDocuments: 1200,
          messages: 1200,
          newMessages: 1000,
          doneMessages: 200,
          facilities: 3,
          providers: 12
        },
        provider: {
          username: "gold-provider-02",
          firstName: "Jordan",
          lastName: "Morris",
          encounters: 176,
          billingLines: 253,
          billingTotal: 37422
        },
        facility: {
          code: "NORTH",
          name: "North County Clinic",
          appointments: 935,
          encounters: 701,
          billingLines: 1002,
          billingTotal: 148904
        },
        clinicalCondition: {
          diagnosis: "ICD10:J45.909",
          title: "Asthma, uncomplicated",
          patients: 188
        }
      },
      actual: {
        reports,
        selected: {
          provider,
          facility: northFacility,
          clinicalCondition: asthma
        }
      },
      context: {
        suite: "reports",
        workflow: "operational-reports"
      }
    });

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

    expect(provider).not.toBeNull();
    expect(provider).toMatchObject({
      firstName: "Jordan",
      lastName: "Morris",
      encounters: 176,
      billingLines: 253,
      billingTotal: 37422
    });

    expect(northFacility).not.toBeNull();
    expect(northFacility).toMatchObject({
      name: "North County Clinic",
      appointments: 935,
      encounters: 701,
      billingLines: 1002,
      billingTotal: 148904
    });

    expect(asthma).not.toBeNull();
    expect(asthma).toMatchObject({
      title: "Asthma, uncomplicated",
      patients: 188
    });
  });

  test("operational report surfaces are visible in the application UI", async ({ page, target, targetDb }, testInfo) => {
    const reports = await targetDb.getOperationalReports();
    const provider = reports.providerActivity.find((item) => item.username === "gold-provider-02") ?? reports.providerActivity[0] ?? null;
    const northFacility = reports.facilityActivity.find((item) => item.code === "NORTH") ?? reports.facilityActivity[0] ?? null;
    const asthma = reports.clinicalConditions.find((item) => item.diagnosis === "ICD10:J45.909") ?? reports.clinicalConditions[0] ?? null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-9-operational-reports-ui-precondition",
      description: "Captures the operational report database summary used before steering the Slice 9 operational reports UI parity flow.",
      expected: {
        counts: {
          futureAppointments: 1261,
          patientDocuments: 1200,
          billingTotal: 446000
        },
        provider: {
          username: "gold-provider-02"
        },
        facility: {
          code: "NORTH",
          name: "North County Clinic"
        },
        clinicalCondition: {
          diagnosis: "ICD10:J45.909",
          title: "Asthma, uncomplicated"
        }
      },
      actual: {
        reports,
        selected: {
          provider,
          facility: northFacility,
          clinicalCondition: asthma
        }
      },
      context: {
        suite: "reports",
        workflow: "operational-reports-ui"
      }
    });

    expect(provider).not.toBeNull();
    expect(northFacility).not.toBeNull();
    expect(asthma).not.toBeNull();

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
    await expect(page.locator("body")).toContainText(provider!.username);
    await expect(page.locator("body")).toContainText(northFacility!.name);
    await expect(page.locator("body")).toContainText(asthma!.title);
    await expect(page.locator("body")).toContainText(asthma!.diagnosis);
  });
});
