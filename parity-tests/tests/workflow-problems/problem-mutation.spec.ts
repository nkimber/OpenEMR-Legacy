import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedClinicalLists } from "../../src/ui/modernizedOpenEmr.js";

const problemMutationAnchorPatientId = "MOD-PAT-0006";

test.describe("problem list mutation parity @slice31 @workflow-problems @mutation", () => {
  test("creates, renders, deactivates, and removes a problem list entry", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(problemMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Problem ${workflowSuffix()}`;
    const diagnosis = "ICD10:Z00.00";
    let problemId: number | string | null = null;

    try {
      problemId = await workflow.createProblem({
        patientId: patient!.pid,
        title,
        dateTime: "2026-06-18 09:00:00",
        diagnosis,
        comments: "Created by the parity problem-list mutation suite."
      });

      const created = await workflow.getProblem(problemId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        type: "medical_problem",
        title,
        activity: 1,
        diagnosis,
        date: "2026-06-18"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.problems).toBe(beforeCounts.problems + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, title);
      } else {
        await openAuthenticatedModernizedClinicalLists(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText(title);
        await expect(page.locator("body")).toContainText(diagnosis);
        await expect(page.getByRole("button", { name: "Deactivate" }).first()).toBeVisible();
      }

      const inactiveComment = "Deactivated by the parity problem-list mutation suite.";
      await workflow.deactivateProblem(problemId, inactiveComment);
      const inactive = await workflow.getProblem(problemId);
      expect(inactive).toMatchObject({
        activity: 0,
        comments: inactiveComment
      });

      const afterDeactivateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterDeactivateCounts.problems).toBe(beforeCounts.problems);
    } finally {
      if (problemId !== null) {
        await workflow.deleteProblem(problemId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.problems).toBe(beforeCounts.problems);
    if (problemId !== null) {
      await expect(workflow.getProblem(problemId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
