import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientNotesDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedMessages } from "../../src/ui/modernizedOpenEmr.js";

const messageContentAnchorPatientId = "MOD-PAT-0004";

test.describe("patient message content parity @slice66 @workflow-message-content @messages @mutation", () => {
  test("edits patient message title and body without changing message counts", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(messageContentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (patient === null) {
      throw new Error(`Message content anchor patient ${messageContentAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const title = `Parity Content ${workflowSuffix()}`;
    const body = "Created by the parity message content suite.";
    const editedTitle = `${title} Edited`;
    const editedBody = "Edited by the parity message content suite.";
    let messageId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-66-message-content-precondition",
        description: "Captures the Slice 66 patient-message content precondition: anchor patient, starting workflow counts, and proposed temporary pnotes-compatible message content update.",
        expected: {
          anchorCanonicalId: messageContentAnchorPatientId,
          assignedTo: "admin",
          initialStatus: "New",
          messageCountDeltaAfterCreate: 1,
          messageCountDeltaAfterEdit: 1,
          editableFields: ["title", "body"]
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
          },
          proposedEdit: {
            editedTitle,
            editedBody
          }
        },
        context: {
          suite: "workflow-message-content",
          workflow: "message-content-precondition"
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
        body,
        status: "New",
        assignedTo: "admin",
        deleted: 0
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.messages).toBe(beforeCounts.messages + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-66-message-content-created",
        description: "Captures the Slice 66 temporary message row after creation and confirms the message count increment before editing.",
        expected: {
          title,
          body,
          status: "New",
          assignedTo: "admin",
          deleted: 0,
          messageCountDelta: 1
        },
        actual: {
          messageId,
          created,
          beforeCounts,
          afterCreateCounts,
          messageCountDelta: afterCreateCounts.messages - beforeCounts.messages
        },
        context: {
          suite: "workflow-message-content",
          workflow: "message-content-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.updatePatientMessageContent(messageId, editedTitle, editedBody);
      } else {
        await openAuthenticatedModernizedMessages(page, target, patient.pubpid);

        const messageCard = page.locator(".message-item", { hasText: title });
        await expect(messageCard).toContainText(body);
        await messageCard.getByLabel(`Edit ${title} title`).fill(editedTitle);
        await messageCard.getByLabel(`Edit ${title} body`).fill(editedBody);
        await messageCard.getByRole("button", { name: "Save Edit" }).click();

        const editedMessageCard = page.locator(".message-item", { hasText: editedTitle });
        await expect(editedMessageCard).toContainText(editedBody);
      }

      const edited = await workflow.getPatientMessage(messageId);
      expect(edited).toMatchObject({
        title: editedTitle,
        body: editedBody,
        status: "New",
        assignedTo: "admin",
        deleted: 0
      });

      const afterEditCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterEditCounts.messages).toBe(beforeCounts.messages + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-66-message-content-edited",
        description: "Captures the Slice 66 edited message row and count stability after changing title and body content.",
        expected: {
          originalTitle: title,
          editedTitle,
          editedBody,
          status: "New",
          assignedTo: "admin",
          deleted: 0,
          messageCountDelta: 1,
          uiTextAnchors: [editedTitle, editedBody]
        },
        actual: {
          messageId,
          edited,
          afterCreateCounts,
          afterEditCounts,
          messageCountDeltaFromBaseline: afterEditCounts.messages - beforeCounts.messages
        },
        context: {
          suite: "workflow-message-content",
          workflow: "message-content-edited"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientNotesDirect(page, target, patient.pid);
        await expectRenderedText(page, editedTitle);
        await expectRenderedText(page, editedBody);
      }

      await workflow.softDeletePatientMessage(messageId);
      const deleted = await workflow.getPatientMessage(messageId);
      expect(deleted).toMatchObject({
        deleted: 1
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-66-message-content-soft-deleted",
        description: "Captures the Slice 66 temporary edited message after OpenEMR-compatible soft-delete/archive state is applied.",
        expected: {
          title: editedTitle,
          body: editedBody,
          deleted: 1,
          cleanupWillHardDelete: true
        },
        actual: {
          messageId,
          deleted
        },
        context: {
          suite: "workflow-message-content",
          workflow: "message-content-soft-deleted"
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
      probe: "slice-66-message-content-cleanup",
      description: "Captures the Slice 66 final cleanup state after hard-deleting the temporary edited message and restoring the baseline message count.",
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
        suite: "workflow-message-content",
        workflow: "message-content-cleanup"
      }
    });
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
