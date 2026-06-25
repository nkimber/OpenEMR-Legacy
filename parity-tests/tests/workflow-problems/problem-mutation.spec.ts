import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedClinicalLists } from "../../src/ui/modernizedOpenEmr.js";

const problemMutationAnchorPatientId = "MOD-PAT-0006";

test.describe("problem list mutation parity @slice31 @workflow-problems @mutation", () => {
  test("creates, renders, deactivates, and removes a problem list entry", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(problemMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Problem ${workflowSuffix()}`;
    const diagnosis = "ICD10:Z00.00";
    const proposedProblem = {
      patientId: patient!.pid,
      title,
      dateTime: "2026-06-18 09:00:00",
      diagnosis,
      comments: "Created by the parity problem-list mutation suite."
    };
    let problemId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-31-problem-mutation-precondition",
        description: "Captures the Slice 31 problem-list mutation anchor patient, baseline counts, and proposed temporary problem payload before create.",
        expected: {
          patient: {
            pubpid: problemMutationAnchorPatientId,
            displayName: "Patel, Priya"
          },
          countChange: {
            createDelta: 1,
            deactivateDeltaFromBaseline: 0,
            cleanupDeltaFromBaseline: 0
          },
          proposedProblem: {
            titlePrefix: "Parity Problem ",
            type: "medical_problem",
            diagnosis: "ICD10:Z00.00",
            date: "2026-06-18"
          }
        },
        actual: {
          patient,
          beforeCounts,
          proposedProblem
        },
        context: {
          canonicalId: problemMutationAnchorPatientId,
          suite: "workflow-problems",
          workflow: "patient-problem-list-mutation"
        }
      });

      problemId = await workflow.createProblem(proposedProblem);

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-31-problem-mutation-created",
        description: "Captures the temporary Slice 31 problem row and active problem-count increment immediately after create.",
        expected: {
          created: {
            patientId: patient!.pid,
            type: "medical_problem",
            title,
            activity: 1,
            diagnosis,
            date: "2026-06-18"
          },
          countChange: {
            problems: beforeCounts.problems + 1
          }
        },
        actual: {
          problemId,
          created,
          beforeCounts,
          afterCreateCounts
        },
        context: {
          canonicalId: problemMutationAnchorPatientId,
          suite: "workflow-problems",
          workflow: "patient-problem-list-mutation"
        }
      });
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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-31-problem-mutation-deactivated",
        description: "Captures the temporary Slice 31 problem after deactivate mutation and the return to baseline active problem count.",
        expected: {
          inactive: {
            activity: 0,
            comments: inactiveComment
          },
          countChange: {
            problems: beforeCounts.problems
          }
        },
        actual: {
          problemId,
          inactive,
          beforeCounts,
          afterDeactivateCounts
        },
        context: {
          canonicalId: problemMutationAnchorPatientId,
          suite: "workflow-problems",
          workflow: "patient-problem-list-mutation"
        }
      });
      expect(afterDeactivateCounts.problems).toBe(beforeCounts.problems);
    } finally {
      if (problemId !== null) {
        await workflow.deleteProblem(problemId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.problems).toBe(beforeCounts.problems);
    if (problemId !== null) {
      const afterCleanup = await workflow.getProblem(problemId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-31-problem-mutation-cleanup",
        description: "Captures the final Slice 31 hard-delete cleanup state for the temporary problem row.",
        expected: {
          deletedProblem: null,
          countChange: {
            problems: beforeCounts.problems
          }
        },
        actual: {
          problemId,
          afterCleanup,
          beforeCounts,
          afterCleanupCounts
        },
        context: {
          canonicalId: problemMutationAnchorPatientId,
          suite: "workflow-problems",
          workflow: "patient-problem-list-mutation"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
