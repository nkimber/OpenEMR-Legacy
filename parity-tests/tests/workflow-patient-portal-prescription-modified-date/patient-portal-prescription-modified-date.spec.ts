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

const expectedPrescriptions = [
  { drug: "Omeprazole", modifiedDate: "2026-03-10" },
  { drug: "Sumatriptan", modifiedDate: "2026-04-08" },
  { drug: "Sertraline", modifiedDate: "2026-05-07" }
];

test.describe("patient portal prescription modified-date parity @slice243 @workflow-patient-portal-prescription-modified-date @patients @portal @clinical-lists", () => {
  test("exposes active prescription modified dates in the portal clinical summary", async ({
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
      probe: "slice-243-patient-portal-prescription-modified-date-precondition",
      description: "Captures the Slice 243 prescription modified-date precondition: the signed-in portal anchor patient exists before projecting active prescription date columns.",
      expected: {
        canonicalId: portalClinicalAnchorPatientId,
        portalUsername: portalLoginUsername,
        expectedPrescriptionCount: expectedPrescriptions.length
      },
      actual: {
        canonicalId: portalClinicalAnchorPatientId,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        portalUsername: portalLoginUsername
      },
      context: {
        suite: "workflow-patient-portal-prescription-modified-date",
        workflow: "patient-portal-prescription-modified-date-precondition"
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
      modifiedDate: prescription.modifiedDate
    }))).toEqual(expectedPrescriptions);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-243-patient-portal-prescription-modified-date-result",
      description: "Captures the Slice 243 clinical-summary projection: active portal prescriptions expose OpenEMR-compatible last-modified dates in stable display order.",
      expected: {
        prescriptions: expectedPrescriptions
      },
      actual: {
        summary: summarizeClinicalSummary(summary),
        prescriptions: summary.prescriptions.map(summarizePrescription)
      },
      context: {
        suite: "workflow-patient-portal-prescription-modified-date",
        workflow: "patient-portal-prescription-modified-date-result"
      }
    });

    if (target.type === "legacy-openemr") {
      const legacyUi = await expectLegacyPrescriptionModifiedDates(page, target);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-243-patient-portal-prescription-modified-date-legacy-ui",
        description: "Captures the legacy patient portal prescription table rendering with the Last Modified column and expected prescription dates.",
        expected: {
          headingPattern: "Drug|Prescription",
          dateColumn: "Last Modified",
          prescriptions: expectedPrescriptions
        },
        actual: legacyUi,
        context: {
          suite: "workflow-patient-portal-prescription-modified-date",
          workflow: "patient-portal-prescription-modified-date-legacy-ui"
        }
      });
    } else {
      const modernizedUi = await expectModernizedPrescriptionModifiedDates(page, target);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-243-patient-portal-prescription-modified-date-modernized-ui",
        description: "Captures the modernized Portal prescription card rendering with modified-date labels for each expected prescription.",
        expected: {
          summaryCount: "3 prescriptions",
          prescriptions: expectedPrescriptions.map((prescription) => ({
            drug: prescription.drug,
            label: `Modified ${prescription.modifiedDate}`
          }))
        },
        actual: modernizedUi,
        context: {
          suite: "workflow-patient-portal-prescription-modified-date",
          workflow: "patient-portal-prescription-modified-date-modernized-ui"
        }
      });
    }
  });
});

async function expectLegacyPrescriptionModifiedDates(page: Page, target: RuntimeTarget) {
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
  await expect(page.locator("body")).toContainText("Last Modified");
  for (const expected of expectedPrescriptions) {
    await expect(page.locator("body")).toContainText(expected.drug);
    await expect(page.locator("body")).toContainText(expected.modifiedDate);
  }
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    bodyText: normalizeText(await page.locator("body").innerText()),
    visiblePrescriptions: await captureLegacyPrescriptionPresence(page)
  };
}

async function expectModernizedPrescriptionModifiedDates(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const clinicalRegion = page.getByRole("region", { name: "Patient portal clinical summary" });
  await expect(clinicalRegion).toContainText("3 prescriptions");
  const prescriptionRegion = page.getByRole("region", { name: "Patient portal prescriptions" });

  for (const expected of expectedPrescriptions) {
    const card = prescriptionRegion.locator("article.clinical-item").filter({ hasText: expected.drug }).first();
    await expect(card).toContainText(expected.drug);
    await expect(card).toContainText(`Modified ${expected.modifiedDate}`);
  }
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    clinicalSummaryText: normalizeText(await clinicalRegion.innerText()),
    prescriptionRegionText: normalizeText(await prescriptionRegion.innerText()),
    visiblePrescriptions: await captureModernizedPrescriptionPresence(prescriptionRegion)
  };
}

async function captureLegacyPrescriptionPresence(page: Page) {
  const bodyText = await page.locator("body").innerText();
  return expectedPrescriptions.map((prescription) => ({
    drug: prescription.drug,
    modifiedDate: prescription.modifiedDate,
    drugVisible: bodyText.includes(prescription.drug),
    modifiedDateVisible: bodyText.includes(prescription.modifiedDate)
  }));
}

async function captureModernizedPrescriptionPresence(prescriptionRegion: ReturnType<Page["getByRole"]>) {
  const regionText = await prescriptionRegion.innerText();
  return expectedPrescriptions.map((prescription) => ({
    drug: prescription.drug,
    modifiedDate: prescription.modifiedDate,
    drugVisible: regionText.includes(prescription.drug),
    modifiedLabelVisible: regionText.includes(`Modified ${prescription.modifiedDate}`)
  }));
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
