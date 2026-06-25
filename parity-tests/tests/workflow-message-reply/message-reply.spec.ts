import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientNotesDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedMessages } from "../../src/ui/modernizedOpenEmr.js";

const messageReplyAnchorPatientId = "MOD-PAT-0004";

test.describe("patient message reply parity @slice156 @workflow-message-reply @messages @mutation", () => {
  test("appends a reply to a patient message without changing message counts", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(messageReplyAnchorPatientId);
    expect(patient).not.toBeNull();
    if (patient === null) {
      throw new Error(`Message reply anchor patient ${messageReplyAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const title = `Parity Reply ${workflowSuffix()}`;
    const body = "Created by the parity message reply suite.";
    const replyBody = "Reply appended by the parity message reply suite.";
    const messagePayload = {
      patientId: patient.pid,
      title,
      body,
      assignedTo: "admin"
    };
    const replyPayload = {
      replyBody,
      repliedBy: "admin",
      expectedThreadMarker: "admin to admin"
    };
    let messageId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-156-message-reply-precondition",
        description:
          "Captures the Slice 156 patient-message reply precondition: anchor patient, starting workflow counts, proposed temporary message, and reply payload.",
        expected: {
          anchorCanonicalId: messageReplyAnchorPatientId,
          assignedTo: "admin",
          initialStatus: "New",
          messageCountDeltaAfterCreate: 1,
          messageCountDeltaAfterReply: 1,
          replyThreadMarker: "admin to admin"
        },
        actual: {
          patient,
          beforeCounts,
          proposedMessage: {
            ...messagePayload,
            pubpid: patient.pubpid
          },
          proposedReply: replyPayload
        },
        context: {
          suite: "workflow-message-reply",
          workflow: "message-reply-precondition"
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
        deleted: 0
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.messages).toBe(beforeCounts.messages + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-156-message-reply-created",
        description:
          "Captures the temporary message row after creation before the reply is appended.",
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
          suite: "workflow-message-reply",
          workflow: "message-reply-created"
        }
      });

      let preReplySurfaceFacts: Record<string, unknown> = {};

      if (target.type === "legacy-openemr") {
        await workflow.replyPatientMessage(messageId, replyBody, "admin");
      } else {
        await openAuthenticatedModernizedMessages(page, target, patient.pubpid);

        const messageCard = page.locator(".message-item", { hasText: title });
        await expect(messageCard).toContainText(body);
        preReplySurfaceFacts = {
          modernizedMessages: {
            renderedTitle: title,
            renderedBody: body,
            renderedReplyInputLabel: `Reply to ${title}`,
            renderedReplyAction: "Reply"
          }
        };
        await messageCard.getByLabel(`Reply to ${title}`).fill(replyBody);
        await messageCard.getByRole("button", { name: "Reply" }).click();
        await expect(messageCard).toContainText(replyBody);
        await expect(messageCard).toContainText("admin to admin");
      }

      const replied = await workflow.getPatientMessage(messageId);
      expect(replied).toMatchObject({
        title,
        status: "New",
        assignedTo: "admin",
        deleted: 0
      });
      expect(replied?.body).toContain(body);
      expect(replied?.body).toContain(replyBody);
      expect(replied?.body).toContain("admin to admin");

      const afterReplyCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterReplyCounts.messages).toBe(beforeCounts.messages + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-156-message-reply-replied",
        description:
          "Captures the replied message row and count stability after appending a pnotes-compatible reply.",
        expected: {
          title,
          originalBody: body,
          replyBody,
          status: "New",
          assignedTo: "admin",
          deleted: 0,
          messageCountDelta: 1,
          replyThreadMarker: "admin to admin"
        },
        actual: {
          messageId,
          replied,
          beforeCounts,
          afterCreateCounts,
          afterReplyCounts,
          messageCountDeltaFromBaseline: afterReplyCounts.messages - beforeCounts.messages,
          surfaceFactsBeforeReply: preReplySurfaceFacts
        },
        context: {
          suite: "workflow-message-reply",
          workflow: "message-reply-replied"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientNotesDirect(page, target, patient.pid);
        await expectRenderedText(page, title);
        await expectRenderedText(page, replyBody);
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-156-message-reply-rendered",
        description:
          "Captures browser/API surface evidence for the temporary message after reply text is visible.",
        expected: {
          rendersTitle: title,
          rendersReplyBody: replyBody,
          rendersThreadMarker: target.type !== "legacy-openemr" ? "admin to admin" : undefined
        },
        actual: {
          messageId,
          replied,
          surfaceFacts: target.type === "legacy-openemr"
            ? {
                legacyPatientNotes: {
                  renderedTitle: title,
                  renderedReplyBody: replyBody,
                  patientPid: patient.pid
                }
              }
            : {
                modernizedMessages: {
                  renderedTitle: title,
                  renderedReplyBody: replyBody,
                  renderedThreadMarker: "admin to admin",
                  patientPubpid: patient.pubpid
                }
              }
        },
        context: {
          suite: "workflow-message-reply",
          workflow: "message-reply-rendered"
        }
      });

      await workflow.softDeletePatientMessage(messageId);
      const deleted = await workflow.getPatientMessage(messageId);
      expect(deleted).toMatchObject({
        deleted: 1
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-156-message-reply-soft-deleted",
        description:
          "Captures the replied message after OpenEMR-compatible soft-delete/archive state is applied.",
        expected: {
          title,
          deleted: 1,
          cleanupWillHardDelete: true
        },
        actual: {
          messageId,
          deleted
        },
        context: {
          suite: "workflow-message-reply",
          workflow: "message-reply-soft-deleted"
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
      probe: "slice-156-message-reply-cleanup",
      description:
        "Captures the final cleanup state after hard-deleting the temporary replied message and restoring baseline message count.",
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
        suite: "workflow-message-reply",
        workflow: "message-reply-cleanup"
      }
    });
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
