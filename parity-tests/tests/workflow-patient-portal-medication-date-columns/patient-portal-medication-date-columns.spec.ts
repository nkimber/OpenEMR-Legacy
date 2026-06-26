import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { PatientPortalClinicalSummaryResult, PatientPortalMedicationItem } from "../../src/workflows/legacyWorkflowActions.js";
import type { Page } from "@playwright/test";

const portalClinicalAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const inactiveEndDate = "2026-06-18";

const expectedMedications = [
  { title: "Omeprazole 20 mg", startDate: "2026-03-10", modifiedDate: "2026-03-10", endDate: null },
  { title: "Sumatriptan 50 mg", startDate: "2026-04-08", modifiedDate: "2026-04-08", endDate: null },
  { title: "Sertraline 50 mg", startDate: "2026-05-07", modifiedDate: "2026-05-07", endDate: null }
];

test.describe("patient portal medication date-column parity @slice246 @workflow-patient-portal-medication-date-columns @patients @portal @clinical-lists", () => {
  test("exposes medication start, last-modified, and ended-row facts in the portal clinical summary", async ({
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
      probe: "slice-246-patient-portal-medication-date-columns-precondition",
      description: "Captures the Slice 246 medication date-column precondition: the signed-in portal anchor patient exists before a temporary ended medication is created.",
      expected: {
        canonicalId: portalClinicalAnchorPatientId,
        portalUsername: portalLoginUsername,
        expectedMedicationCountAfterTemporaryEndedRow: expectedMedications.length + 1,
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
        suite: "workflow-patient-portal-medication-date-columns",
        workflow: "patient-portal-medication-date-columns-precondition"
      }
    });

    const endedTitle = `Portal Ended Medication ${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let medicationId: number | string | null = null;

    try {
      medicationId = await workflow.createMedication({
        patientId: patient!.pid,
        title: endedTitle,
        dateTime: "2026-07-15 09:00:00",
        diagnosis: "ICD10:Z00.00",
        comments: "Created for patient portal medication date-column parity."
      });

      await workflow.deactivateMedication(
        medicationId,
        "Ended for patient portal medication date-column parity."
      );

      const ended = await workflow.getMedication(medicationId);
      expect(ended).toMatchObject({
        activity: 0,
        title: endedTitle
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-246-patient-portal-medication-date-columns-ended-row",
        description: "Captures the temporary medication-list row after deactivation: the row is inactive but remains visible in the portal medication list with an end date.",
        expected: {
          endedTitle,
          activity: 0,
          startDate: "2026-07-15",
          endDate: inactiveEndDate
        },
        actual: ended,
        context: {
          suite: "workflow-patient-portal-medication-date-columns",
          workflow: "patient-portal-medication-date-columns-ended-row"
        }
      });

      const summary = await workflow.getPatientPortalClinicalSummary(portalLoginUsername, portalPassword);
      expect(summary).toMatchObject({
        authenticated: true,
        username: portalLoginUsername,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        medicationCount: 4,
        failureReason: null
      });

      expect(summary.medications.slice(0, expectedMedications.length).map((medication) => ({
        title: medication.title,
        startDate: medication.startDate,
        modifiedDate: medication.modifiedDate,
        endDate: medication.endDate
      }))).toEqual(expectedMedications);
      expect(summary.medications).toEqual(expect.arrayContaining([
        expect.objectContaining({
          title: endedTitle,
          startDate: "2026-07-15",
          endDate: inactiveEndDate
        })
      ]));
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-246-patient-portal-medication-date-columns-result",
        description: "Captures the Slice 246 clinical-summary projection: active medication date columns remain stable and the ended medication row remains visible with its end date.",
        expected: {
          activeMedications: expectedMedications,
          endedMedication: {
            title: endedTitle,
            startDate: "2026-07-15",
            endDate: inactiveEndDate
          }
        },
        actual: {
          summary: summarizeClinicalSummary(summary),
          medications: summary.medications.map(summarizeMedication),
          endedMedicationPresent: summary.medications.some((medication) => medication.title === endedTitle)
        },
        context: {
          suite: "workflow-patient-portal-medication-date-columns",
          workflow: "patient-portal-medication-date-columns-result"
        }
      });

      if (target.type === "legacy-openemr") {
        const legacyUi = await expectLegacyMedicationDateColumns(page, target, endedTitle);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-246-patient-portal-medication-date-columns-legacy-ui",
          description: "Captures the legacy patient portal medication table rendering for Start Date, Last Modified, End Date, and the temporary ended medication row.",
          expected: {
            headingPattern: "Drug|Medication",
            dateColumns: ["Start Date", "Last Modified", "End Date"],
            activeMedications: expectedMedications,
            endedMedication: {
              title: endedTitle,
              endDate: inactiveEndDate
            }
          },
          actual: legacyUi,
          context: {
            suite: "workflow-patient-portal-medication-date-columns",
            workflow: "patient-portal-medication-date-columns-legacy-ui"
          }
        });
      } else {
        const modernizedUi = await expectModernizedMedicationDateColumns(page, target, endedTitle);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-246-patient-portal-medication-date-columns-modernized-ui",
          description: "Captures the modernized Portal medication cards rendering active and ended medication date-column labels.",
          expected: {
            summaryCount: "4 medications",
            activeMedications: expectedMedications.map((medication) => ({
              title: medication.title,
              startLabel: `Start ${medication.startDate}`,
              modifiedLabel: `Last Modified ${medication.modifiedDate}`,
              endLabel: "End Date Active"
            })),
            endedMedication: {
              title: endedTitle,
              startLabel: "Start 2026-07-15",
              endLabel: `End Date ${inactiveEndDate}`
            }
          },
          actual: modernizedUi,
          context: {
            suite: "workflow-patient-portal-medication-date-columns",
            workflow: "patient-portal-medication-date-columns-modernized-ui"
          }
        });
      }
    } finally {
      if (medicationId !== null) {
        await workflow.deleteMedication(medicationId);
        const cleanup = await workflow.getPatientPortalClinicalSummary(portalLoginUsername, portalPassword);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-246-patient-portal-medication-date-columns-cleanup",
          description: "Captures the Slice 246 cleanup state after deleting the temporary ended medication row.",
          expected: {
            temporaryMedicationDeleted: endedTitle,
            activeMedications: expectedMedications
          },
          actual: {
            summary: summarizeClinicalSummary(cleanup),
            medications: cleanup.medications.map(summarizeMedication),
            endedMedicationPresent: cleanup.medications.some((medication) => medication.title === endedTitle)
          },
          context: {
            suite: "workflow-patient-portal-medication-date-columns",
            workflow: "patient-portal-medication-date-columns-cleanup"
          }
        });
      }
    }
  });
});

async function expectLegacyMedicationDateColumns(page: Page, target: RuntimeTarget, endedTitle: string) {
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

  await page.goto(`${target.publicUrl}/portal/get_medications.php`);
  await expectRenderedText(page, /Drug|Medication/i);
  await expect(page.locator("body")).toContainText("Start Date");
  await expect(page.locator("body")).toContainText("Last Modified");
  await expect(page.locator("body")).toContainText("End Date");
  for (const expected of expectedMedications) {
    await expect(page.locator("body")).toContainText(expected.title);
    await expect(page.locator("body")).toContainText(expected.startDate);
    await expect(page.locator("body")).toContainText(expected.modifiedDate);
  }
  await expect(page.locator("body")).toContainText(endedTitle);
  await expect(page.locator("body")).toContainText(inactiveEndDate);
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    bodyText: normalizeText(await page.locator("body").innerText()),
    visibleMedications: await captureLegacyMedicationPresence(page, endedTitle)
  };
}

async function expectModernizedMedicationDateColumns(page: Page, target: RuntimeTarget, endedTitle: string) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const clinicalRegion = page.getByRole("region", { name: "Patient portal clinical summary" });
  await expect(clinicalRegion).toContainText("4 medications");
  const medicationRegion = page.getByRole("region", { name: "Patient portal medications" });

  for (const expected of expectedMedications) {
    const card = medicationRegion.locator("article.clinical-item").filter({ hasText: expected.title }).first();
    await expect(card).toContainText(expected.title);
    await expect(card).toContainText(`Start ${expected.startDate}`);
    await expect(card).toContainText(`Last Modified ${expected.modifiedDate}`);
    await expect(card).toContainText("End Date Active");
  }

  const endedCard = medicationRegion.locator("article.clinical-item").filter({ hasText: endedTitle }).first();
  await expect(endedCard).toContainText(endedTitle);
  await expect(endedCard).toContainText("Start 2026-07-15");
  await expect(endedCard).toContainText(`End Date ${inactiveEndDate}`);
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    clinicalSummaryText: normalizeText(await clinicalRegion.innerText()),
    medicationRegionText: normalizeText(await medicationRegion.innerText()),
    visibleMedications: await captureModernizedMedicationPresence(medicationRegion, endedTitle)
  };
}

async function captureLegacyMedicationPresence(page: Page, endedTitle: string) {
  const bodyText = await page.locator("body").innerText();
  return {
    active: expectedMedications.map((medication) => ({
      title: medication.title,
      startDate: medication.startDate,
      modifiedDate: medication.modifiedDate,
      endDate: medication.endDate,
      titleVisible: bodyText.includes(medication.title),
      startDateVisible: bodyText.includes(medication.startDate),
      modifiedDateVisible: bodyText.includes(medication.modifiedDate)
    })),
    endedMedication: {
      title: endedTitle,
      startDate: "2026-07-15",
      endDate: inactiveEndDate,
      titleVisible: bodyText.includes(endedTitle),
      endDateVisible: bodyText.includes(inactiveEndDate)
    }
  };
}

async function captureModernizedMedicationPresence(medicationRegion: ReturnType<Page["getByRole"]>, endedTitle: string) {
  const regionText = await medicationRegion.innerText();
  return {
    active: expectedMedications.map((medication) => ({
      title: medication.title,
      startDate: medication.startDate,
      modifiedDate: medication.modifiedDate,
      endDate: medication.endDate,
      titleVisible: regionText.includes(medication.title),
      startLabelVisible: regionText.includes(`Start ${medication.startDate}`),
      modifiedLabelVisible: regionText.includes(`Last Modified ${medication.modifiedDate}`),
      activeEndLabelVisible: regionText.includes("End Date Active")
    })),
    endedMedication: {
      title: endedTitle,
      startDate: "2026-07-15",
      endDate: inactiveEndDate,
      titleVisible: regionText.includes(endedTitle),
      startLabelVisible: regionText.includes("Start 2026-07-15"),
      endLabelVisible: regionText.includes(`End Date ${inactiveEndDate}`)
    }
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
    medicationCount: summary.medicationCount,
    failureReason: summary.failureReason,
    sessionSource: summary.sessionSource
  };
}

function summarizeMedication(medication: PatientPortalMedicationItem) {
  return {
    id: medication.id,
    title: medication.title,
    startDate: medication.startDate,
    modifiedDate: medication.modifiedDate,
    endDate: medication.endDate
  };
}

function normalizeText(value: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}
