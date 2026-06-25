import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedClinicalLists } from "../../src/ui/modernizedOpenEmr.js";

const clinicalListMutationAnchorPatientId = "MOD-PAT-0006";

test.describe("clinical list mutation parity @slice13 @workflow-clinical-lists @mutation", () => {
  test("creates, renders, deactivates, and removes an allergy list entry", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(clinicalListMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Allergy ${workflowSuffix()}`;
    const allergyInput = {
      patientId: patient!.pid,
      type: "allergy" as const,
      title,
      dateTime: "2026-06-18 09:00:00",
      comments: "Created by the parity clinical-list mutation suite.",
      reaction: "Rash",
      severity: "mild",
      listOptionId: "parity-allergy"
    };
    let listEntryId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-13-clinical-list-mutation-precondition",
      description: "Captures the Slice 13 clinical-list mutation anchor patient, workflow counts before mutation, and proposed allergy create payload.",
      expected: {
        patient: {
          pubpid: clinicalListMutationAnchorPatientId
        },
        create: {
          type: "allergy",
          dateTime: "2026-06-18 09:00:00",
          reaction: "Rash",
          severity: "mild",
          listOptionId: "parity-allergy",
          activity: 1
        }
      },
      actual: {
        patient,
        beforeCounts,
        proposed: allergyInput
      },
      context: {
        canonicalId: clinicalListMutationAnchorPatientId,
        suite: "workflow-clinical-lists",
        workflow: "clinical-list-mutation"
      }
    });

    try {
      listEntryId = await workflow.createClinicalListEntry(allergyInput);

      const created = await workflow.getClinicalListEntry(listEntryId);
      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-13-clinical-list-mutation-created-allergy",
        description: "Captures the temporary allergy list database row immediately after Slice 13 creates it, including the allergy-count increment.",
        expected: {
          allergy: {
            patientId: patient!.pid,
            type: "allergy",
            title,
            activity: 1,
            reaction: "Rash",
            severity: "mild",
            listOptionId: "parity-allergy"
          },
          counts: {
            allergies: beforeCounts.allergies + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          listEntryId,
          created
        },
        context: {
          canonicalId: clinicalListMutationAnchorPatientId,
          suite: "workflow-clinical-lists",
          workflow: "clinical-list-mutation-created-allergy"
        }
      });

      expect(created).toMatchObject({
        patientId: patient!.pid,
        type: "allergy",
        title,
        activity: 1,
        reaction: "Rash",
        severity: "mild",
        listOptionId: "parity-allergy"
      });

      expect(afterCreateCounts.allergies).toBe(beforeCounts.allergies + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, title);
      } else {
        await openAuthenticatedModernizedClinicalLists(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText(title);
        await expect(page.locator("body")).toContainText("Rash / mild");
        await expect(page.getByRole("button", { name: "Deactivate" }).first()).toBeVisible();
      }

      const inactiveComment = "Deactivated by the parity clinical-list mutation suite.";
      await workflow.deactivateClinicalListEntry(listEntryId, inactiveComment);
      const inactive = await workflow.getClinicalListEntry(listEntryId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-13-clinical-list-mutation-deactivated-allergy",
        description: "Captures the temporary allergy list database row after Slice 13 deactivates it and before cleanup.",
        expected: {
          allergy: {
            activity: 0,
            comments: inactiveComment,
            title,
            reaction: "Rash",
            severity: "mild"
          }
        },
        actual: {
          patient,
          listEntryId,
          created,
          inactive
        },
        context: {
          canonicalId: clinicalListMutationAnchorPatientId,
          suite: "workflow-clinical-lists",
          workflow: "clinical-list-mutation-deactivated-allergy"
        }
      });

      expect(inactive).toMatchObject({
        activity: 0,
        comments: inactiveComment
      });
    } finally {
      if (listEntryId !== null) {
        await workflow.deleteClinicalListEntry(listEntryId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const deleted = listEntryId !== null ? await workflow.getClinicalListEntry(listEntryId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-13-clinical-list-mutation-cleanup",
      description: "Captures the Slice 13 cleanup state after deleting the temporary allergy list entry.",
      expected: {
        counts: {
          allergies: beforeCounts.allergies
        },
        deletedAllergy: null
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        listEntryId,
        deleted
      },
      context: {
        canonicalId: clinicalListMutationAnchorPatientId,
        suite: "workflow-clinical-lists",
        workflow: "clinical-list-mutation-cleanup"
      }
    });

    expect(afterCleanupCounts.allergies).toBe(beforeCounts.allergies);
    if (listEntryId !== null) {
      expect(deleted).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
