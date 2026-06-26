import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { PatientPortalClinicalSummaryResult, PatientPortalPrescriptionItem } from "../../src/workflows/legacyWorkflowActions.js";
import type { Page } from "@playwright/test";

const portalClinicalAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const inactiveEndDate = "2026-08-15";

const expectedActivePrescriptions = [
  { drug: "Omeprazole", endDate: null },
  { drug: "Sumatriptan", endDate: null },
  { drug: "Sertraline", endDate: null }
];

test.describe("patient portal prescription end-date parity @slice245 @workflow-patient-portal-prescription-end-date @patients @portal @clinical-lists", () => {
  test("excludes ended prescriptions from the portal active prescription list", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalClinicalAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-245-patient-portal-prescription-end-date-precondition",
      description: "Captures the Slice 245 prescription end-date precondition: the signed-in portal anchor patient exists before a temporary ended prescription is created.",
      expected: {
        canonicalId: portalClinicalAnchorPatientId,
        portalUsername: portalLoginUsername,
        expectedActivePrescriptionCount: expectedActivePrescriptions.length,
        inactiveEndDate
      },
      actual: {
        canonicalId: portalClinicalAnchorPatientId,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        portalUsername: portalLoginUsername
      },
      context: {
        suite: "workflow-patient-portal-prescription-end-date",
        workflow: "patient-portal-prescription-end-date-precondition"
      }
    });

    const endedDrug = `Portal Ended Prescription ${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let prescriptionId: number | string | null = null;

    try {
      prescriptionId = await workflow.createPrescription({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        startDate: "2026-07-15",
        drug: endedDrug,
        rxNormCode: "1049502",
        dosage: "1 tablet daily",
        quantity: "30",
        refills: 0,
        note: "Created for patient portal ended-prescription parity.",
        diagnosis: "Z00.00"
      });

      await workflow.deactivatePrescription(
        prescriptionId,
        inactiveEndDate,
        "Ended for patient portal active-prescription parity."
      );

      const ended = await workflow.getPrescription(prescriptionId);
      expect(ended).toMatchObject({
        active: 0,
        endDate: inactiveEndDate,
        drug: endedDrug
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-245-patient-portal-prescription-end-date-ended-row",
        description: "Captures the temporary prescription after deactivation: the source row is ended but should not appear in the active portal prescription list.",
        expected: {
          endedDrug,
          active: 0,
          endDate: inactiveEndDate
        },
        actual: ended,
        context: {
          suite: "workflow-patient-portal-prescription-end-date",
          workflow: "patient-portal-prescription-end-date-ended-row"
        }
      });

      const summary = await workflow.getPatientPortalClinicalSummary(portalLoginUsername, portalPassword);
      expect(summary).toMatchObject({
        authenticated: true,
        username: portalLoginUsername,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        prescriptionCount: 3,
        failureReason: null
      });

      expect(summary.prescriptions.map((prescription) => ({
        drug: prescription.drug,
        endDate: prescription.endDate
      }))).toEqual(expectedActivePrescriptions);
      expect(summary.prescriptions.some((prescription) => prescription.drug === endedDrug)).toBe(false);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-245-patient-portal-prescription-end-date-result",
        description: "Captures the Slice 245 clinical-summary projection: ended prescriptions are excluded while active prescriptions retain null end dates.",
        expected: {
          activePrescriptions: expectedActivePrescriptions,
          endedDrugExcluded: endedDrug
        },
        actual: {
          summary: summarizeClinicalSummary(summary),
          prescriptions: summary.prescriptions.map(summarizePrescription),
          endedDrugPresent: summary.prescriptions.some((prescription) => prescription.drug === endedDrug)
        },
        context: {
          suite: "workflow-patient-portal-prescription-end-date",
          workflow: "patient-portal-prescription-end-date-result"
        }
      });

      if (target.type === "legacy-openemr") {
        const legacyUi = await expectLegacyActivePrescriptionEndDates(page, target, endedDrug);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-245-patient-portal-prescription-end-date-legacy-ui",
          description: "Captures the legacy patient portal prescription table rendering with active prescriptions and without the temporary ended row.",
          expected: {
            headingPattern: "Drug|Prescription",
            dateColumn: "End Date",
            activePrescriptions: expectedActivePrescriptions,
            endedDrugAbsent: endedDrug
          },
          actual: legacyUi,
          context: {
            suite: "workflow-patient-portal-prescription-end-date",
            workflow: "patient-portal-prescription-end-date-legacy-ui"
          }
        });
      } else {
        const modernizedUi = await expectModernizedActivePrescriptionEndDates(page, target, endedDrug);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-245-patient-portal-prescription-end-date-modernized-ui",
          description: "Captures the modernized Portal prescription cards rendering active end-date labels while hiding the temporary ended prescription.",
          expected: {
            summaryCount: "3 prescriptions",
            activeLabels: expectedActivePrescriptions.map((prescription) => ({
              drug: prescription.drug,
              label: "End Date Active"
            })),
            endedDrugAbsent: endedDrug
          },
          actual: modernizedUi,
          context: {
            suite: "workflow-patient-portal-prescription-end-date",
            workflow: "patient-portal-prescription-end-date-modernized-ui"
          }
        });
      }
    } finally {
      if (prescriptionId !== null) {
        await workflow.deletePrescription(prescriptionId);
        const cleanup = await workflow.getPatientPortalClinicalSummary(portalLoginUsername, portalPassword);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-245-patient-portal-prescription-end-date-cleanup",
          description: "Captures the Slice 245 cleanup state after deleting the temporary ended prescription.",
          expected: {
            temporaryPrescriptionDeleted: endedDrug,
            activePrescriptions: expectedActivePrescriptions
          },
          actual: {
            summary: summarizeClinicalSummary(cleanup),
            prescriptions: cleanup.prescriptions.map(summarizePrescription),
            endedDrugPresent: cleanup.prescriptions.some((prescription) => prescription.drug === endedDrug)
          },
          context: {
            suite: "workflow-patient-portal-prescription-end-date",
            workflow: "patient-portal-prescription-end-date-cleanup"
          }
        });
      }
    }
  });
});

async function expectLegacyActivePrescriptionEndDates(page: Page, target: RuntimeTarget, endedDrug: string) {
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

  await page.goto(`${target.publicUrl}/portal/get_prescriptions.php`);
  await expectRenderedText(page, /Drug|Prescription/i);
  await expect(page.locator("body")).toContainText("End Date");
  for (const expected of expectedActivePrescriptions) {
    await expect(page.locator("body")).toContainText(expected.drug);
  }
  await expect(page.locator("body")).not.toContainText(endedDrug);
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    bodyText: normalizeText(await page.locator("body").innerText()),
    visiblePrescriptions: await captureLegacyPrescriptionPresence(page, endedDrug)
  };
}

async function expectModernizedActivePrescriptionEndDates(page: Page, target: RuntimeTarget, endedDrug: string) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const clinicalRegion = page.getByRole("region", { name: "Patient portal clinical summary" });
  await expect(clinicalRegion).toContainText("3 prescriptions");
  const prescriptionRegion = page.getByRole("region", { name: "Patient portal prescriptions" });

  for (const expected of expectedActivePrescriptions) {
    const card = prescriptionRegion.locator("article.clinical-item").filter({ hasText: expected.drug }).first();
    await expect(card).toContainText(expected.drug);
    await expect(card).toContainText("End Date Active");
  }
  await expect(prescriptionRegion).not.toContainText(endedDrug);
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    clinicalSummaryText: normalizeText(await clinicalRegion.innerText()),
    prescriptionRegionText: normalizeText(await prescriptionRegion.innerText()),
    visiblePrescriptions: await captureModernizedPrescriptionPresence(prescriptionRegion, endedDrug)
  };
}

async function captureLegacyPrescriptionPresence(page: Page, endedDrug: string) {
  const bodyText = await page.locator("body").innerText();
  return {
    active: expectedActivePrescriptions.map((prescription) => ({
      drug: prescription.drug,
      endDate: prescription.endDate,
      drugVisible: bodyText.includes(prescription.drug)
    })),
    endedDrug,
    endedDrugVisible: bodyText.includes(endedDrug)
  };
}

async function captureModernizedPrescriptionPresence(prescriptionRegion: ReturnType<Page["getByRole"]>, endedDrug: string) {
  const regionText = await prescriptionRegion.innerText();
  return {
    active: expectedActivePrescriptions.map((prescription) => ({
      drug: prescription.drug,
      endDate: prescription.endDate,
      drugVisible: regionText.includes(prescription.drug),
      activeLabelVisible: regionText.includes("End Date Active")
    })),
    endedDrug,
    endedDrugVisible: regionText.includes(endedDrug)
  };
}

function summarizeClinicalSummary(summary: PatientPortalClinicalSummaryResult) {
  return {
    authenticated: summary.authenticated,
    username: summary.username,
    portalUsername: summary.portalUsername,
    canonicalId: summary.canonicalId,
    pid: summary.pid,
    pubpid: summary.pubpid,
    displayName: summary.displayName,
    datasetVersion: summary.datasetVersion,
    asOfDate: summary.asOfDate,
    prescriptionCount: summary.prescriptionCount,
    failureReason: summary.failureReason,
    sessionSource: summary.sessionSource
  };
}

function summarizePrescription(prescription: PatientPortalPrescriptionItem) {
  return {
    id: prescription.id,
    drug: prescription.drug,
    startDate: prescription.startDate,
    modifiedDate: prescription.modifiedDate,
    endDate: prescription.endDate,
    dosage: prescription.dosage,
    quantity: prescription.quantity,
    route: prescription.route,
    note: prescription.note
  };
}

function normalizeText(value: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}
