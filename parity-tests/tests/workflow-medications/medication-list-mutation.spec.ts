import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedClinicalLists } from "../../src/ui/modernizedOpenEmr.js";

const medicationMutationAnchorPatientId = "MOD-PAT-0006";

test.describe("medication list mutation parity @slice32 @workflow-medications @mutation", () => {
  test("creates, renders, deactivates, and removes a medication list entry", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(medicationMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Medication ${workflowSuffix()}`;
    const diagnosis = "ICD10:Z00.00";
    const proposedMedication = {
      patientId: patient!.pid,
      title,
      dateTime: "2026-07-15 09:00:00",
      diagnosis,
      comments: "Created by the parity medication-list mutation suite."
    };
    let medicationId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-32-medication-mutation-precondition",
        description: "Captures the Slice 32 medication-list mutation anchor patient, baseline counts, and proposed temporary medication payload before create.",
        expected: {
          patient: {
            pubpid: medicationMutationAnchorPatientId,
            displayName: "Patel, Priya"
          },
          countChange: {
            createDelta: 1,
            deactivateDeltaFromBaseline: 0,
            cleanupDeltaFromBaseline: 0
          },
          proposedMedication: {
            titlePrefix: "Parity Medication ",
            type: "medication",
            diagnosis: "ICD10:Z00.00",
            date: "2026-07-15"
          }
        },
        actual: {
          patient,
          beforeCounts,
          proposedMedication
        },
        context: {
          canonicalId: medicationMutationAnchorPatientId,
          suite: "workflow-medications",
          workflow: "patient-medication-list-mutation"
        }
      });

      medicationId = await workflow.createMedication(proposedMedication);

      const created = await workflow.getMedication(medicationId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        type: "medication",
        title,
        activity: 1,
        diagnosis,
        date: "2026-07-15"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-32-medication-mutation-created",
        description: "Captures the temporary Slice 32 medication row and active medication-count increment immediately after create.",
        expected: {
          created: {
            patientId: patient!.pid,
            type: "medication",
            title,
            activity: 1,
            diagnosis,
            date: "2026-07-15"
          },
          countChange: {
            medications: beforeCounts.medications + 1
          }
        },
        actual: {
          medicationId,
          created,
          beforeCounts,
          afterCreateCounts
        },
        context: {
          canonicalId: medicationMutationAnchorPatientId,
          suite: "workflow-medications",
          workflow: "patient-medication-list-mutation"
        }
      });
      expect(afterCreateCounts.medications).toBe(beforeCounts.medications + 1);

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

      const inactiveComment = "Deactivated by the parity medication-list mutation suite.";
      await workflow.deactivateMedication(medicationId, inactiveComment);
      const inactive = await workflow.getMedication(medicationId);
      expect(inactive).toMatchObject({
        activity: 0,
        comments: inactiveComment
      });

      const afterDeactivateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-32-medication-mutation-deactivated",
        description: "Captures the temporary Slice 32 medication after deactivate mutation and the return to baseline active medication count.",
        expected: {
          inactive: {
            activity: 0,
            comments: inactiveComment
          },
          countChange: {
            medications: beforeCounts.medications
          }
        },
        actual: {
          medicationId,
          inactive,
          beforeCounts,
          afterDeactivateCounts
        },
        context: {
          canonicalId: medicationMutationAnchorPatientId,
          suite: "workflow-medications",
          workflow: "patient-medication-list-mutation"
        }
      });
      expect(afterDeactivateCounts.medications).toBe(beforeCounts.medications);
    } finally {
      if (medicationId !== null) {
        await workflow.deleteMedication(medicationId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.medications).toBe(beforeCounts.medications);
    if (medicationId !== null) {
      const afterCleanup = await workflow.getMedication(medicationId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-32-medication-mutation-cleanup",
        description: "Captures the final Slice 32 hard-delete cleanup state for the temporary medication row.",
        expected: {
          deletedMedication: null,
          countChange: {
            medications: beforeCounts.medications
          }
        },
        actual: {
          medicationId,
          afterCleanup,
          beforeCounts,
          afterCleanupCounts
        },
        context: {
          canonicalId: medicationMutationAnchorPatientId,
          suite: "workflow-medications",
          workflow: "patient-medication-list-mutation"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
