import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientNotesDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedMessages } from "../../src/ui/modernizedOpenEmr.js";

const messageMutationAnchorPatientId = "MOD-PAT-0004";

test.describe("patient message mutation parity @slice14 @workflow-messages @mutation", () => {
  test("creates, closes, soft-deletes, and removes a patient message", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(messageMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Message ${workflowSuffix()}`;
    const messageInput = {
      patientId: patient!.pid,
      title,
      body: "Created by the parity message mutation suite.",
      assignedTo: "admin"
    };
    let messageId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-14-message-mutation-precondition",
      description: "Captures the Slice 14 message mutation anchor patient, workflow counts before mutation, and proposed patient-message create payload.",
      expected: {
        patient: {
          pubpid: messageMutationAnchorPatientId
        },
        create: {
          status: "New",
          assignedTo: "admin",
          deleted: 0
        }
      },
      actual: {
        patient,
        beforeCounts,
        proposed: messageInput
      },
      context: {
        canonicalId: messageMutationAnchorPatientId,
        suite: "workflow-messages",
        workflow: "message-mutation"
      }
    });

    try {
      messageId = await workflow.createPatientMessage(messageInput);

      const created = await workflow.getPatientMessage(messageId);
      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-14-message-mutation-created",
        description: "Captures the temporary patient-message database row immediately after Slice 14 creates it, including the message-count increment.",
        expected: {
          message: {
            patientId: patient!.pid,
            title,
            body: messageInput.body,
            status: "New",
            assignedTo: "admin",
            deleted: 0
          },
          counts: {
            messages: beforeCounts.messages + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          messageId,
          created
        },
        context: {
          canonicalId: messageMutationAnchorPatientId,
          suite: "workflow-messages",
          workflow: "message-mutation-created"
        }
      });

      expect(created).toMatchObject({
        patientId: patient!.pid,
        title,
        status: "New",
        assignedTo: "admin",
        deleted: 0
      });

      expect(afterCreateCounts.messages).toBe(beforeCounts.messages + 1);

      const closedBody = "Closed by the parity message mutation suite.";
      await workflow.updatePatientMessageStatus(messageId, "Done", closedBody);
      const closed = await workflow.getPatientMessage(messageId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-14-message-mutation-closed",
        description: "Captures the temporary patient-message database row after Slice 14 closes it and before browser-visible rendering assertions.",
        expected: {
          message: {
            title,
            body: closedBody,
            status: "Done",
            assignedTo: "admin",
            deleted: 0
          }
        },
        actual: {
          patient,
          messageId,
          created,
          closed
        },
        context: {
          canonicalId: messageMutationAnchorPatientId,
          suite: "workflow-messages",
          workflow: "message-mutation-closed"
        }
      });

      expect(closed).toMatchObject({
        body: closedBody,
        status: "Done"
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientNotesDirect(page, target, patient!.pid);

        await expectRenderedText(page, title);
        await expectRenderedText(page, closedBody);
      } else {
        await openAuthenticatedModernizedMessages(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText(title);
        await expect(page.locator("body")).toContainText(closedBody);
        await expect(page.locator("body")).toContainText("Done");
        await expect(page.locator("body")).toContainText("Assigned to admin");
      }

      await workflow.softDeletePatientMessage(messageId);
      const deleted = await workflow.getPatientMessage(messageId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-14-message-mutation-soft-deleted",
        description: "Captures the temporary patient-message database row after Slice 14 soft-deletes it and before hard-delete cleanup.",
        expected: {
          message: {
            title,
            status: "Done",
            deleted: 1
          }
        },
        actual: {
          patient,
          messageId,
          closed,
          deleted
        },
        context: {
          canonicalId: messageMutationAnchorPatientId,
          suite: "workflow-messages",
          workflow: "message-mutation-soft-deleted"
        }
      });

      expect(deleted).toMatchObject({
        deleted: 1
      });
    } finally {
      if (messageId !== null) {
        await workflow.deletePatientMessage(messageId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const deletedAfterCleanup = messageId !== null ? await workflow.getPatientMessage(messageId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-14-message-mutation-cleanup",
      description: "Captures the Slice 14 cleanup state after hard-deleting the temporary patient-message row.",
      expected: {
        counts: {
          messages: beforeCounts.messages
        },
        deletedMessage: null
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        messageId,
        deletedAfterCleanup
      },
      context: {
        canonicalId: messageMutationAnchorPatientId,
        suite: "workflow-messages",
        workflow: "message-mutation-cleanup"
      }
    });

    expect(afterCleanupCounts.messages).toBe(beforeCounts.messages);
    if (messageId !== null) {
      expect(deletedAfterCleanup).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
