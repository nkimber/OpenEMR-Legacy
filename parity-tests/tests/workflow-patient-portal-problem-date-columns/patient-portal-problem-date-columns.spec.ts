import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
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
  }) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalClinicalAnchorPatientId);
    expect(patient).not.toBeNull();

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

      if (target.type === "legacy-openemr") {
        await expectLegacyProblemDateColumns(page, target, endedTitle);
      } else {
        await expectModernizedProblemDateColumns(page, target, endedTitle);
      }
    } finally {
      if (problemId !== null) {
        await workflow.deleteProblem(problemId);
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
}
