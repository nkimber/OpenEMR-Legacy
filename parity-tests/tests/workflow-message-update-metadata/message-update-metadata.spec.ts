import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientNotesDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedMessages } from "../../src/ui/modernizedOpenEmr.js";

const messageUpdateMetadataAnchorPatientId = "MOD-PAT-0004";

test.describe("patient message update metadata parity @slice158 @workflow-message-update-metadata @messages @mutation", () => {
  test("content edits stamp patient message update metadata without changing message counts", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(messageUpdateMetadataAnchorPatientId);
    expect(patient).not.toBeNull();
    if (patient === null) {
      throw new Error(`Message update metadata anchor patient ${messageUpdateMetadataAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const title = `Parity Message Update ${workflowSuffix()}`;
    const body = "Created by the parity message update metadata suite.";
    const editedTitle = `${title} Edited`;
    const editedBody = "Edited by the parity message update metadata suite.";
    const messagePayload = {
      patientId: patient.pid,
      title,
      body,
      assignedTo: "admin"
    };
    const editPayload = {
      editedTitle,
      editedBody,
      expectedUpdatedBy: "1"
    };
    let messageId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-158-message-update-metadata-precondition",
        description:
          "Captures the Slice 158 patient-message update metadata precondition: anchor patient, starting workflow counts, proposed temporary message, and edit payload.",
        expected: {
          anchorCanonicalId: messageUpdateMetadataAnchorPatientId,
          assignedTo: "admin",
          initialStatus: "New",
          initialUpdatedBy: "",
          initialUpdatedAt: "",
          messageCountDeltaAfterCreate: 1,
          messageCountDeltaAfterEdit: 1,
          updatedByAfterEdit: "1"
        },
        actual: {
          patient,
          beforeCounts,
          proposedMessage: {
            ...messagePayload,
            pubpid: patient.pubpid
          },
          proposedEdit: editPayload
        },
        context: {
          suite: "workflow-message-update-metadata",
          workflow: "message-update-metadata-precondition"
        }
      });

      messageId = await workflow.createPatientMessage(messagePayload);

      const created = await workflow.getPatientMessage(messageId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        title,
        body,
        status: "New",
        assignedTo: "admin",
        updatedBy: "",
        updatedAt: "",
        deleted: 0
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.messages).toBe(beforeCounts.messages + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-158-message-update-metadata-created",
        description:
          "Captures the temporary message row after creation before content edits stamp update metadata.",
        expected: {
          title,
          body,
          status: "New",
          assignedTo: "admin",
          updatedBy: "",
          updatedAt: "",
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
          suite: "workflow-message-update-metadata",
          workflow: "message-update-metadata-created"
        }
      });

      let editSurfaceFacts: Record<string, unknown> = {};

      if (target.type === "legacy-openemr") {
        await workflow.updatePatientMessageContent(messageId, editedTitle, editedBody);
      } else {
        await openAuthenticatedModernizedMessages(page, target, patient.pubpid);

        const messageCard = page.locator(".message-item", { hasText: title });
        await expect(messageCard).toContainText(body);
        editSurfaceFacts = {
          modernizedMessages: {
            renderedTitleBeforeEdit: title,
            renderedBodyBeforeEdit: body,
            titleInputLabel: `Edit ${title} title`,
            bodyInputLabel: `Edit ${title} body`,
            saveAction: "Save Edit"
          }
        };
        await messageCard.getByLabel(`Edit ${title} title`).fill(editedTitle);
        await messageCard.getByLabel(`Edit ${title} body`).fill(editedBody);
        await messageCard.getByRole("button", { name: "Save Edit" }).click();

        const editedMessageCard = page.locator(".message-item", { hasText: editedTitle });
        await expect(editedMessageCard).toContainText(editedBody);
        await expect(editedMessageCard).toContainText("Updated by user 1");
      }

      const edited = await workflow.getPatientMessage(messageId);
      expect(edited).toMatchObject({
        title: editedTitle,
        body: editedBody,
        status: "New",
        assignedTo: "admin",
        updatedBy: "1",
        deleted: 0
      });
      expect(edited!.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

      const afterEditCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterEditCounts.messages).toBe(beforeCounts.messages + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-158-message-update-metadata-edited",
        description:
          "Captures the edited message row after content changes stamp OpenEMR-compatible update metadata.",
        expected: {
          title: editedTitle,
          body: editedBody,
          status: "New",
          assignedTo: "admin",
          updatedBy: "1",
          updatedAtPattern: "YYYY-MM-DD HH:mm:ss",
          deleted: 0,
          messageCountDelta: 1
        },
        actual: {
          messageId,
          edited,
          beforeCounts,
          afterCreateCounts,
          afterEditCounts,
          messageCountDeltaFromBaseline: afterEditCounts.messages - beforeCounts.messages,
          surfaceFactsBeforeEdit: editSurfaceFacts
        },
        context: {
          suite: "workflow-message-update-metadata",
          workflow: "message-update-metadata-edited"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientNotesDirect(page, target, patient.pid);
        await expectRenderedText(page, editedTitle);
        await expectRenderedText(page, editedBody);
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-158-message-update-metadata-rendered",
        description:
          "Captures browser/API surface evidence for the edited message after update metadata is visible or validated.",
        expected: {
          rendersEditedTitle: editedTitle,
          rendersEditedBody: editedBody,
          rendersUpdatedBy: target.type !== "legacy-openemr" ? "Updated by user 1" : undefined
        },
        actual: {
          messageId,
          edited,
          surfaceFacts: target.type === "legacy-openemr"
            ? {
                legacyPatientNotes: {
                  renderedTitle: editedTitle,
                  renderedBody: editedBody,
                  patientPid: patient.pid
                }
              }
            : {
                modernizedMessages: {
                  renderedTitle: editedTitle,
                  renderedBody: editedBody,
                  renderedUpdatedBy: "Updated by user 1",
                  patientPubpid: patient.pubpid
                }
              }
        },
        context: {
          suite: "workflow-message-update-metadata",
          workflow: "message-update-metadata-rendered"
        }
      });

      await workflow.softDeletePatientMessage(messageId);
      const deleted = await workflow.getPatientMessage(messageId);
      expect(deleted).toMatchObject({
        deleted: 1
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-158-message-update-metadata-soft-deleted",
        description:
          "Captures the edited message after OpenEMR-compatible soft-delete/archive state is applied.",
        expected: {
          title: editedTitle,
          updatedBy: "1",
          deleted: 1,
          cleanupWillHardDelete: true
        },
        actual: {
          messageId,
          deleted
        },
        context: {
          suite: "workflow-message-update-metadata",
          workflow: "message-update-metadata-soft-deleted"
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
      probe: "slice-158-message-update-metadata-cleanup",
      description:
        "Captures the final cleanup state after hard-deleting the temporary edited message and restoring baseline message count.",
      expected: {
        messageCountRestored: true,
        finalMessageCount: beforeCounts.messages,
        primaryMessageRemoved: messageId !== null
      },
      actual: {
        messageId,
        beforeCounts,
        afterCleanupCounts,
        messageCountDeltaAfterCleanup: afterCleanupCounts.messages - beforeCounts.messages,
        removedMessageLookup: messageId !== null ? await workflow.getPatientMessage(messageId) : null
      },
      context: {
        suite: "workflow-message-update-metadata",
        workflow: "message-update-metadata-cleanup"
      }
    });
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
