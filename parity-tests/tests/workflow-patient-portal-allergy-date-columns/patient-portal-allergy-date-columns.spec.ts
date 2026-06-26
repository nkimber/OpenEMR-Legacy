import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { PatientPortalAllergyItem, PatientPortalClinicalSummaryResult } from "../../src/workflows/legacyWorkflowActions.js";
import type { Page } from "@playwright/test";

const portalClinicalAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const inactiveEndDate = "2026-06-18";

const expectedAllergies = [
  {
    title: "Latex",
    reportedDate: "2024-07-21",
    startDate: "2024-07-21",
    endDate: null,
    referredBy: null,
    reaction: "skin irritation",
    severity: "low"
  }
];

test.describe("patient portal allergy date-column parity @slice248 @workflow-patient-portal-allergy-date-columns @patients @portal @clinical-lists", () => {
  test("exposes allergy reported, start, end, and referrer facts in the portal clinical summary", async ({
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
      probe: "slice-248-patient-portal-allergy-date-columns-precondition",
      description: "Captures the Slice 248 allergy date-column precondition: the signed-in portal anchor patient exists before a temporary ended allergy is created.",
      expected: {
        canonicalId: portalClinicalAnchorPatientId,
        portalUsername: portalLoginUsername,
        expectedAllergyCountAfterTemporaryEndedRow: expectedAllergies.length + 1,
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
        suite: "workflow-patient-portal-allergy-date-columns",
        workflow: "patient-portal-allergy-date-columns-precondition"
      }
    });

    const endedTitle = `Portal Ended Allergy ${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let allergyId: number | string | null = null;

    try {
      allergyId = await workflow.createClinicalListEntry({
        patientId: patient!.pid,
        type: "allergy",
        title: endedTitle,
        dateTime: "2026-07-16 09:00:00",
        comments: "Created for patient portal allergy date-column parity.",
        reaction: "Hives",
        severity: "moderate",
        listOptionId: "parity-allergy"
      });

      await workflow.deactivateClinicalListEntry(
        allergyId,
        "Ended for patient portal allergy date-column parity."
      );

      const ended = await workflow.getClinicalListEntry(allergyId);
      expect(ended).toMatchObject({
        activity: 0,
        title: endedTitle
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-248-patient-portal-allergy-date-columns-ended-row",
        description: "Captures the temporary allergy row after deactivation: the row is inactive but remains visible in the portal allergy list with end-date and reaction/severity facts.",
        expected: {
          endedTitle,
          activity: 0,
          reportedDate: "2026-07-16",
          startDate: "2026-07-16",
          endDate: inactiveEndDate,
          reaction: "Hives",
          severity: "moderate"
        },
        actual: ended,
        context: {
          suite: "workflow-patient-portal-allergy-date-columns",
          workflow: "patient-portal-allergy-date-columns-ended-row"
        }
      });

      const summary = await workflow.getPatientPortalClinicalSummary(portalLoginUsername, portalPassword);
      expect(summary).toMatchObject({
        authenticated: true,
        username: portalLoginUsername,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        allergyCount: 2,
        failureReason: null
      });

      expect(summary.allergies.slice(0, expectedAllergies.length).map((allergy) => ({
        title: allergy.title,
        reportedDate: allergy.reportedDate,
        startDate: allergy.startDate,
        endDate: allergy.endDate,
        referredBy: allergy.referredBy,
        reaction: allergy.reaction,
        severity: allergy.severity
      }))).toEqual(expectedAllergies);
      expect(summary.allergies).toEqual(expect.arrayContaining([
        expect.objectContaining({
          title: endedTitle,
          reportedDate: "2026-07-16",
          startDate: "2026-07-16",
          endDate: inactiveEndDate,
          referredBy: null,
          reaction: "Hives",
          severity: "moderate"
        })
      ]));
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-248-patient-portal-allergy-date-columns-result",
        description: "Captures the Slice 248 clinical-summary projection: active allergy date/referrer columns remain stable and the ended allergy row remains visible with end-date, reaction, and severity.",
        expected: {
          activeAllergies: expectedAllergies,
          endedAllergy: {
            title: endedTitle,
            reportedDate: "2026-07-16",
            startDate: "2026-07-16",
            endDate: inactiveEndDate,
            referredBy: null,
            reaction: "Hives",
            severity: "moderate"
          }
        },
        actual: {
          summary: summarizeClinicalSummary(summary),
          allergies: summary.allergies.map(summarizeAllergy),
          endedAllergyPresent: summary.allergies.some((allergy) => allergy.title === endedTitle)
        },
        context: {
          suite: "workflow-patient-portal-allergy-date-columns",
          workflow: "patient-portal-allergy-date-columns-result"
        }
      });

      if (target.type === "legacy-openemr") {
        const legacyUi = await expectLegacyAllergyDateColumns(page, target, endedTitle);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-248-patient-portal-allergy-date-columns-legacy-ui",
          description: "Captures the legacy patient portal allergy table rendering for Reported Date, Start Date, End Date, Referrer, and the temporary ended allergy row.",
          expected: {
            headingPattern: "Title|Allergy",
            dateColumns: ["Reported Date", "Start Date", "End Date", "Referrer"],
            activeAllergies: expectedAllergies,
            endedAllergy: {
              title: endedTitle,
              endDate: inactiveEndDate
            }
          },
          actual: legacyUi,
          context: {
            suite: "workflow-patient-portal-allergy-date-columns",
            workflow: "patient-portal-allergy-date-columns-legacy-ui"
          }
        });
      } else {
        const modernizedUi = await expectModernizedAllergyDateColumns(page, target, endedTitle);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-248-patient-portal-allergy-date-columns-modernized-ui",
          description: "Captures the modernized Portal allergy cards rendering active and ended allergy date/referrer labels.",
          expected: {
            summaryCount: "2 allergies",
            activeAllergies: expectedAllergies.map((allergy) => ({
              title: allergy.title,
              reportedLabel: `Reported Date ${allergy.reportedDate}`,
              startLabel: `Start Date ${allergy.startDate}`,
              endLabel: "End Date Active",
              referrerLabel: "Referrer Not recorded"
            })),
            endedAllergy: {
              title: endedTitle,
              reportedLabel: "Reported Date 2026-07-16",
              startLabel: "Start Date 2026-07-16",
              endLabel: `End Date ${inactiveEndDate}`,
              referrerLabel: "Referrer Not recorded"
            }
          },
          actual: modernizedUi,
          context: {
            suite: "workflow-patient-portal-allergy-date-columns",
            workflow: "patient-portal-allergy-date-columns-modernized-ui"
          }
        });
      }
    } finally {
      if (allergyId !== null) {
        await workflow.deleteClinicalListEntry(allergyId);
        const cleanup = await workflow.getPatientPortalClinicalSummary(portalLoginUsername, portalPassword);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-248-patient-portal-allergy-date-columns-cleanup",
          description: "Captures the Slice 248 cleanup state after deleting the temporary ended allergy row.",
          expected: {
            temporaryAllergyDeleted: endedTitle,
            activeAllergies: expectedAllergies
          },
          actual: {
            summary: summarizeClinicalSummary(cleanup),
            allergies: cleanup.allergies.map(summarizeAllergy),
            endedAllergyPresent: cleanup.allergies.some((allergy) => allergy.title === endedTitle)
          },
          context: {
            suite: "workflow-patient-portal-allergy-date-columns",
            workflow: "patient-portal-allergy-date-columns-cleanup"
          }
        });
      }
    }
  });
});

async function expectLegacyAllergyDateColumns(page: Page, target: RuntimeTarget, endedTitle: string) {
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

  await page.goto(`${target.publicUrl}/portal/get_allergies.php`);
  await expectRenderedText(page, /Title|Allergy/i);
  await expect(page.locator("body")).toContainText("Reported Date");
  await expect(page.locator("body")).toContainText("Start Date");
  await expect(page.locator("body")).toContainText("End Date");
  await expect(page.locator("body")).toContainText("Referrer");
  for (const expected of expectedAllergies) {
    await expect(page.locator("body")).toContainText(expected.title);
    await expect(page.locator("body")).toContainText(expected.reportedDate);
    await expect(page.locator("body")).toContainText(expected.startDate);
  }
  await expect(page.locator("body")).toContainText(endedTitle);
  await expect(page.locator("body")).toContainText(inactiveEndDate);
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    bodyText: normalizeText(await page.locator("body").innerText()),
    visibleAllergies: await captureLegacyAllergyPresence(page, endedTitle)
  };
}

async function expectModernizedAllergyDateColumns(page: Page, target: RuntimeTarget, endedTitle: string) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const clinicalRegion = page.getByRole("region", { name: "Patient portal clinical summary" });
  await expect(clinicalRegion).toContainText("2 allergies");
  const allergyRegion = page.getByRole("region", { name: "Patient portal allergies" });

  for (const expected of expectedAllergies) {
    const card = allergyRegion.locator("article.clinical-item").filter({ hasText: expected.title }).first();
    await expect(card).toContainText(expected.title);
    await expect(card).toContainText(`Reported Date ${expected.reportedDate}`);
    await expect(card).toContainText(`Start Date ${expected.startDate}`);
    await expect(card).toContainText("End Date Active");
    await expect(card).toContainText("Referrer Not recorded");
  }

  const endedCard = allergyRegion.locator("article.clinical-item").filter({ hasText: endedTitle }).first();
  await expect(endedCard).toContainText(endedTitle);
  await expect(endedCard).toContainText("Reported Date 2026-07-16");
  await expect(endedCard).toContainText("Start Date 2026-07-16");
  await expect(endedCard).toContainText(`End Date ${inactiveEndDate}`);
  await expect(endedCard).toContainText("Referrer Not recorded");
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    clinicalSummaryText: normalizeText(await clinicalRegion.innerText()),
    allergyRegionText: normalizeText(await allergyRegion.innerText()),
    visibleAllergies: await captureModernizedAllergyPresence(allergyRegion, endedTitle)
  };
}

async function captureLegacyAllergyPresence(page: Page, endedTitle: string) {
  const bodyText = await page.locator("body").innerText();
  return {
    active: expectedAllergies.map((allergy) => ({
      title: allergy.title,
      reportedDate: allergy.reportedDate,
      startDate: allergy.startDate,
      endDate: allergy.endDate,
      referredBy: allergy.referredBy,
      reaction: allergy.reaction,
      severity: allergy.severity,
      titleVisible: bodyText.includes(allergy.title),
      reportedDateVisible: bodyText.includes(allergy.reportedDate),
      startDateVisible: bodyText.includes(allergy.startDate)
    })),
    endedAllergy: {
      title: endedTitle,
      reportedDate: "2026-07-16",
      startDate: "2026-07-16",
      endDate: inactiveEndDate,
      titleVisible: bodyText.includes(endedTitle),
      endDateVisible: bodyText.includes(inactiveEndDate)
    }
  };
}

async function captureModernizedAllergyPresence(allergyRegion: ReturnType<Page["getByRole"]>, endedTitle: string) {
  const regionText = await allergyRegion.innerText();
  return {
    active: expectedAllergies.map((allergy) => ({
      title: allergy.title,
      reportedDate: allergy.reportedDate,
      startDate: allergy.startDate,
      endDate: allergy.endDate,
      referredBy: allergy.referredBy,
      reaction: allergy.reaction,
      severity: allergy.severity,
      titleVisible: regionText.includes(allergy.title),
      reportedLabelVisible: regionText.includes(`Reported Date ${allergy.reportedDate}`),
      startLabelVisible: regionText.includes(`Start Date ${allergy.startDate}`),
      activeEndLabelVisible: regionText.includes("End Date Active"),
      referrerLabelVisible: regionText.includes("Referrer Not recorded")
    })),
    endedAllergy: {
      title: endedTitle,
      reportedDate: "2026-07-16",
      startDate: "2026-07-16",
      endDate: inactiveEndDate,
      titleVisible: regionText.includes(endedTitle),
      reportedLabelVisible: regionText.includes("Reported Date 2026-07-16"),
      startLabelVisible: regionText.includes("Start Date 2026-07-16"),
      endLabelVisible: regionText.includes(`End Date ${inactiveEndDate}`),
      referrerLabelVisible: regionText.includes("Referrer Not recorded")
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
    allergyCount: summary.allergyCount,
    failureReason: summary.failureReason,
    sessionSource: summary.sessionSource
  };
}

function summarizeAllergy(allergy: PatientPortalAllergyItem) {
  return {
    id: allergy.id,
    title: allergy.title,
    reportedDate: allergy.reportedDate,
    startDate: allergy.startDate,
    endDate: allergy.endDate,
    referredBy: allergy.referredBy,
    reaction: allergy.reaction,
    severity: allergy.severity
  };
}

function normalizeText(value: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}
