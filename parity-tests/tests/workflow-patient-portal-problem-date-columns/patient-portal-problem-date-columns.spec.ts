import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { PatientPortalClinicalSummaryResult, PatientPortalProblemItem } from "../../src/workflows/legacyWorkflowActions.js";
import type { Page } from "@playwright/test";

const portalClinicalAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const inactiveEndDate = "2026-06-18";

const expectedProblems = [
  { title: "Low back pain, unspecified", reportedDate: "2024-04-13", startDate: "2024-04-13", endDate: null },
  { title: "Anxiety disorder, unspecified", reportedDate: "2024-04-14", startDate: "2024-04-14", endDate: null }
];

test.describe("patient portal problem date-column parity @slice247 @workflow-patient-portal-problem-date-columns @patients @portal @clinical-lists", () => {
  test("exposes problem reported, start, and ended-row facts in the portal clinical summary", async ({
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
      probe: "slice-247-patient-portal-problem-date-columns-precondition",
      description: "Captures the Slice 247 problem date-column precondition: the signed-in portal anchor patient exists before a temporary ended problem is created.",
      expected: {
        canonicalId: portalClinicalAnchorPatientId,
        portalUsername: portalLoginUsername,
        expectedProblemCountAfterTemporaryEndedRow: expectedProblems.length + 1,
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
        suite: "workflow-patient-portal-problem-date-columns",
        workflow: "patient-portal-problem-date-columns-precondition"
      }
    });

    const endedTitle = `Portal Ended Problem ${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let problemId: number | string | null = null;

    try {
      problemId = await workflow.createProblem({
        patientId: patient!.pid,
        title: endedTitle,
        dateTime: "2026-07-15 09:00:00",
        diagnosis: "ICD10:Z00.00",
        comments: "Created for patient portal problem date-column parity."
      });

      await workflow.deactivateProblem(
        problemId,
        "Ended for patient portal problem date-column parity."
      );

      const ended = await workflow.getProblem(problemId);
      expect(ended).toMatchObject({
        activity: 0,
        title: endedTitle
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-247-patient-portal-problem-date-columns-ended-row",
        description: "Captures the temporary medical-problem row after deactivation: the row is inactive but remains visible in the portal problem list with an end date.",
        expected: {
          endedTitle,
          activity: 0,
          reportedDate: "2026-07-15",
          startDate: "2026-07-15",
          endDate: inactiveEndDate
        },
        actual: ended,
        context: {
          suite: "workflow-patient-portal-problem-date-columns",
          workflow: "patient-portal-problem-date-columns-ended-row"
        }
      });

      const summary = await workflow.getPatientPortalClinicalSummary(portalLoginUsername, portalPassword);
      expect(summary).toMatchObject({
        authenticated: true,
        username: portalLoginUsername,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        problemCount: 3,
        failureReason: null
      });

      expect(summary.problems.slice(0, expectedProblems.length).map((problem) => ({
        title: problem.title,
        reportedDate: problem.reportedDate,
        startDate: problem.startDate,
        endDate: problem.endDate
      }))).toEqual(expectedProblems);
      expect(summary.problems).toEqual(expect.arrayContaining([
        expect.objectContaining({
          title: endedTitle,
          reportedDate: "2026-07-15",
          startDate: "2026-07-15",
          endDate: inactiveEndDate
        })
      ]));
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-247-patient-portal-problem-date-columns-result",
        description: "Captures the Slice 247 clinical-summary projection: active problem date columns remain stable and the ended problem row remains visible with its end date.",
        expected: {
          activeProblems: expectedProblems,
          endedProblem: {
            title: endedTitle,
            reportedDate: "2026-07-15",
            startDate: "2026-07-15",
            endDate: inactiveEndDate
          }
        },
        actual: {
          summary: summarizeClinicalSummary(summary),
          problems: summary.problems.map(summarizeProblem),
          endedProblemPresent: summary.problems.some((problem) => problem.title === endedTitle)
        },
        context: {
          suite: "workflow-patient-portal-problem-date-columns",
          workflow: "patient-portal-problem-date-columns-result"
        }
      });

      if (target.type === "legacy-openemr") {
        const legacyUi = await expectLegacyProblemDateColumns(page, target, endedTitle);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-247-patient-portal-problem-date-columns-legacy-ui",
          description: "Captures the legacy patient portal problem table rendering for Reported Date, Start Date, End Date, and the temporary ended problem row.",
          expected: {
            headingPattern: "Title|Problem",
            dateColumns: ["Reported Date", "Start Date", "End Date"],
            activeProblems: expectedProblems,
            endedProblem: {
              title: endedTitle,
              endDate: inactiveEndDate
            }
          },
          actual: legacyUi,
          context: {
            suite: "workflow-patient-portal-problem-date-columns",
            workflow: "patient-portal-problem-date-columns-legacy-ui"
          }
        });
      } else {
        const modernizedUi = await expectModernizedProblemDateColumns(page, target, endedTitle);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-247-patient-portal-problem-date-columns-modernized-ui",
          description: "Captures the modernized Portal problem cards rendering active and ended problem date-column labels.",
          expected: {
            summaryCount: "3 problems",
            activeProblems: expectedProblems.map((problem) => ({
              title: problem.title,
              reportedLabel: `Reported Date ${problem.reportedDate}`,
              startLabel: `Start Date ${problem.startDate}`,
              endLabel: "End Date Active"
            })),
            endedProblem: {
              title: endedTitle,
              reportedLabel: "Reported Date 2026-07-15",
              startLabel: "Start Date 2026-07-15",
              endLabel: `End Date ${inactiveEndDate}`
            }
          },
          actual: modernizedUi,
          context: {
            suite: "workflow-patient-portal-problem-date-columns",
            workflow: "patient-portal-problem-date-columns-modernized-ui"
          }
        });
      }
    } finally {
      if (problemId !== null) {
        await workflow.deleteProblem(problemId);
        const cleanup = await workflow.getPatientPortalClinicalSummary(portalLoginUsername, portalPassword);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-247-patient-portal-problem-date-columns-cleanup",
          description: "Captures the Slice 247 cleanup state after deleting the temporary ended problem row.",
          expected: {
            temporaryProblemDeleted: endedTitle,
            activeProblems: expectedProblems
          },
          actual: {
            summary: summarizeClinicalSummary(cleanup),
            problems: cleanup.problems.map(summarizeProblem),
            endedProblemPresent: cleanup.problems.some((problem) => problem.title === endedTitle)
          },
          context: {
            suite: "workflow-patient-portal-problem-date-columns",
            workflow: "patient-portal-problem-date-columns-cleanup"
          }
        });
      }
    }
  });
});

async function expectLegacyProblemDateColumns(page: Page, target: RuntimeTarget, endedTitle: string) {
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

  await page.goto(`${target.publicUrl}/portal/get_problems.php`);
  await expectRenderedText(page, /Title|Problem/i);
  await expect(page.locator("body")).toContainText("Reported Date");
  await expect(page.locator("body")).toContainText("Start Date");
  await expect(page.locator("body")).toContainText("End Date");
  for (const expected of expectedProblems) {
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
    visibleProblems: await captureLegacyProblemPresence(page, endedTitle)
  };
}

async function expectModernizedProblemDateColumns(page: Page, target: RuntimeTarget, endedTitle: string) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const clinicalRegion = page.getByRole("region", { name: "Patient portal clinical summary" });
  await expect(clinicalRegion).toContainText("3 problems");
  const problemRegion = page.getByRole("region", { name: "Patient portal problems" });

  for (const expected of expectedProblems) {
    const card = problemRegion.locator("article.clinical-item").filter({ hasText: expected.title }).first();
    await expect(card).toContainText(expected.title);
    await expect(card).toContainText(`Reported Date ${expected.reportedDate}`);
    await expect(card).toContainText(`Start Date ${expected.startDate}`);
    await expect(card).toContainText("End Date Active");
  }

  const endedCard = problemRegion.locator("article.clinical-item").filter({ hasText: endedTitle }).first();
  await expect(endedCard).toContainText(endedTitle);
  await expect(endedCard).toContainText("Reported Date 2026-07-15");
  await expect(endedCard).toContainText("Start Date 2026-07-15");
  await expect(endedCard).toContainText(`End Date ${inactiveEndDate}`);
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    clinicalSummaryText: normalizeText(await clinicalRegion.innerText()),
    problemRegionText: normalizeText(await problemRegion.innerText()),
    visibleProblems: await captureModernizedProblemPresence(problemRegion, endedTitle)
  };
}

async function captureLegacyProblemPresence(page: Page, endedTitle: string) {
  const bodyText = await page.locator("body").innerText();
  return {
    active: expectedProblems.map((problem) => ({
      title: problem.title,
      reportedDate: problem.reportedDate,
      startDate: problem.startDate,
      endDate: problem.endDate,
      titleVisible: bodyText.includes(problem.title),
      reportedDateVisible: bodyText.includes(problem.reportedDate),
      startDateVisible: bodyText.includes(problem.startDate)
    })),
    endedProblem: {
      title: endedTitle,
      reportedDate: "2026-07-15",
      startDate: "2026-07-15",
      endDate: inactiveEndDate,
      titleVisible: bodyText.includes(endedTitle),
      endDateVisible: bodyText.includes(inactiveEndDate)
    }
  };
}

async function captureModernizedProblemPresence(problemRegion: ReturnType<Page["getByRole"]>, endedTitle: string) {
  const regionText = await problemRegion.innerText();
  return {
    active: expectedProblems.map((problem) => ({
      title: problem.title,
      reportedDate: problem.reportedDate,
      startDate: problem.startDate,
      endDate: problem.endDate,
      titleVisible: regionText.includes(problem.title),
      reportedLabelVisible: regionText.includes(`Reported Date ${problem.reportedDate}`),
      startLabelVisible: regionText.includes(`Start Date ${problem.startDate}`),
      activeEndLabelVisible: regionText.includes("End Date Active")
    })),
    endedProblem: {
      title: endedTitle,
      reportedDate: "2026-07-15",
      startDate: "2026-07-15",
      endDate: inactiveEndDate,
      titleVisible: regionText.includes(endedTitle),
      reportedLabelVisible: regionText.includes("Reported Date 2026-07-15"),
      startLabelVisible: regionText.includes("Start Date 2026-07-15"),
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
    problemCount: summary.problemCount,
    failureReason: summary.failureReason,
    sessionSource: summary.sessionSource
  };
}

function summarizeProblem(problem: PatientPortalProblemItem) {
  return {
    id: problem.id,
    title: problem.title,
    reportedDate: problem.reportedDate,
    startDate: problem.startDate,
    endDate: problem.endDate
  };
}

function normalizeText(value: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}
