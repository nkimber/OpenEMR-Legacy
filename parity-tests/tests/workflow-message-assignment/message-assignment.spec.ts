import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientNotesDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedMessages } from "../../src/ui/modernizedOpenEmr.js";

const messageAssignmentAnchorPatientId = "MOD-PAT-0004";

test.describe("patient message assignment parity @slice65 @workflow-message-assignment @messages @mutation", () => {
  test("reassigns a patient message without changing message counts", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(messageAssignmentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (patient === null) {
      throw new Error(`Message assignment anchor patient ${messageAssignmentAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const title = `Parity Assignment ${workflowSuffix()}`;
    const body = "Created by the parity message assignment suite.";
    let messageId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-65-message-assignment-precondition",
        description: "Captures the Slice 65 patient-message assignment precondition: anchor patient, starting workflow counts, and proposed temporary pnotes-compatible message payload.",
        expected: {
          anchorCanonicalId: messageAssignmentAnchorPatientId,
          initialAssignedTo: "admin",
          reassignedTo: "billing",
          initialStatus: "New",
          messageCountDeltaAfterCreate: 1,
          messageCountDeltaAfterReassign: 1
        },
        actual: {
          patient,
          beforeCounts,
          proposedMessage: {
            patientId: patient.pid,
            pubpid: patient.pubpid,
            title,
            body,
            assignedTo: "admin"
          }
        },
        context: {
          suite: "workflow-message-assignment",
          workflow: "message-assignment-precondition"
        }
      });

      messageId = await workflow.createPatientMessage({
        patientId: patient.pid,
        title,
        body,
        assignedTo: "admin"
      });

      const created = await workflow.getPatientMessage(messageId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        title,
        status: "New",
        assignedTo: "admin",
        deleted: 0
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.messages).toBe(beforeCounts.messages + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-65-message-assignment-created",
        description: "Captures the Slice 65 temporary message row after creation and confirms the message count increment.",
        expected: {
          title,
          status: "New",
          assignedTo: "admin",
          deleted: 0,
          messageCountDelta: 1,
          body
        },
        actual: {
          messageId,
          created,
          beforeCounts,
          afterCreateCounts,
          messageCountDelta: afterCreateCounts.messages - beforeCounts.messages
        },
        context: {
          suite: "workflow-message-assignment",
          workflow: "message-assignment-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.updatePatientMessageAssignment(messageId, "billing");
      } else {
        await openAuthenticatedModernizedMessages(page, target, patient.pubpid);

        const messageCard = page.locator(".message-item", { hasText: title });
        await expect(messageCard).toContainText("Assigned to admin");
        await messageCard.getByLabel(`Assign ${title} to`).fill("billing");
        await messageCard.getByRole("button", { name: "Reassign" }).click();
        await expect(messageCard).toContainText("Assigned to billing");
      }

      const reassigned = await workflow.getPatientMessage(messageId);
      expect(reassigned).toMatchObject({
        assignedTo: "billing",
        status: "New",
        deleted: 0
      });

      const afterReassignCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterReassignCounts.messages).toBe(beforeCounts.messages + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-65-message-assignment-reassigned",
        description: "Captures the Slice 65 reassigned message row and count stability after changing the assignee from admin to billing.",
        expected: {
          title,
          assignedTo: "billing",
          status: "New",
          deleted: 0,
          messageCountDelta: 1,
          uiTextAnchors: target.type === "modernized-openemr"
            ? ["Assigned to admin", "Assigned to billing"]
            : [title]
        },
        actual: {
          messageId,
          reassigned,
          afterCreateCounts,
          afterReassignCounts,
          messageCountDeltaFromBaseline: afterReassignCounts.messages - beforeCounts.messages
        },
        context: {
          suite: "workflow-message-assignment",
          workflow: "message-assignment-reassigned"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientNotesDirect(page, target, patient.pid);
        await expectRenderedText(page, title);
      }

      await workflow.softDeletePatientMessage(messageId);
      const deleted = await workflow.getPatientMessage(messageId);
      expect(deleted).toMatchObject({
        deleted: 1
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-65-message-assignment-soft-deleted",
        description: "Captures the Slice 65 temporary message after OpenEMR-compatible soft-delete/archive state is applied.",
        expected: {
          title,
          assignedTo: "billing",
          deleted: 1,
          cleanupWillHardDelete: true
        },
        actual: {
          messageId,
          deleted
        },
        context: {
          suite: "workflow-message-assignment",
          workflow: "message-assignment-soft-deleted"
        }
      });
    } finally {
      if (messageId !== null) {
        await workflow.deletePatientMessage(messageId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.messages).toBe(beforeCounts.messages);
    if (messageId !== null) {
      await expect(workflow.getPatientMessage(messageId)).resolves.toBeNull();
    }
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-65-message-assignment-cleanup",
      description: "Captures the Slice 65 final cleanup state after hard-deleting the temporary reassigned message and restoring the baseline message count.",
      expected: {
        messageCountRestored: true,
        finalMessageCount: beforeCounts.messages,
        primaryMessageRemoved: messageId !== null
      },
      actual: {
        messageId,
        beforeCounts,
        afterCleanupCounts,
        messageCountRestored: afterCleanupCounts.messages === beforeCounts.messages
      },
      context: {
        suite: "workflow-message-assignment",
        workflow: "message-assignment-cleanup"
      }
    });
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
