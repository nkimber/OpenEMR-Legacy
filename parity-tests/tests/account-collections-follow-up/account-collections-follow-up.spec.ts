import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { escapeSql } from "../../src/db/legacyMariaDbProbe.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientNotesDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedFees, openAuthenticatedModernizedMessages } from "../../src/ui/modernizedOpenEmr.js";

test.describe("collections follow-up task parity @slice64 @account-collections-follow-up @billing @mutation", () => {
  test("creates, closes, renders, soft-deletes, and removes a collections follow-up task", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const queue = await targetDb.getCollectionsWorkQueue(5);
    expect(queue.items).toHaveLength(5);
    const item = queue.items[0];
    const title = `Collections follow-up: ${item.statementNumber}`;
    const note = "Created by the parity collections follow-up suite.";
    const closeBody = "Closed by the parity collections follow-up suite.";
    const beforeCounts = await targetDb.getPatientWorkflowCounts(item.patientId);
    let taskId: number | string | null = null;
    let uiTaskId: string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-64-collections-follow-up-precondition",
        description: "Captures the Slice 64 collections follow-up task precondition: selected queue account, starting patient workflow counts, and proposed pnotes-compatible task payload.",
        expected: {
          selectedQueueLimit: 5,
          requiredInitialMessages: beforeCounts.messages,
          lifecycle: ["create", "close", "render", "soft-delete", "hard-delete-cleanup"],
          assignedTo: "billing",
          statusAfterCreate: "New",
          statusAfterClose: "Done"
        },
        actual: {
          selectedQueueItem: item,
          beforeCounts,
          proposedTask: {
            patientId: item.patientId,
            pubpid: item.pubpid,
            patientDisplayName: item.patientDisplayName,
            title,
            statementNumber: item.statementNumber,
            action: item.recommendedAction,
            collectionTier: item.collectionTier,
            pastDueAmount: item.pastDueAmount,
            over90Amount: item.over90Amount,
            balanceDueAmount: item.balanceDueAmount,
            oldestOpenDate: item.oldestOpenDate,
            oldestOpenAgeDays: item.oldestOpenAgeDays,
            dueDate: item.dueDate,
            assignedTo: "billing",
            note
          }
        },
        context: {
          suite: "account-collections-follow-up",
          workflow: "collections-follow-up-precondition"
        }
      });

      taskId = await workflow.createCollectionsFollowUpTask({
        patientId: item.patientId,
        pubpid: item.pubpid,
        patientDisplayName: item.patientDisplayName,
        statementNumber: item.statementNumber,
        action: item.recommendedAction,
        collectionTier: item.collectionTier,
        pastDueAmount: item.pastDueAmount,
        over90Amount: item.over90Amount,
        balanceDueAmount: item.balanceDueAmount,
        oldestOpenDate: item.oldestOpenDate,
        oldestOpenAgeDays: item.oldestOpenAgeDays,
        dueDate: item.dueDate,
        assignedTo: "billing",
        note
      });

      const created = await workflow.getPatientMessage(taskId);
      expect(created).toMatchObject({
        patientId: item.patientId,
        title,
        status: "New",
        assignedTo: "billing",
        deleted: 0
      });
      expect(created?.body).toContain(item.statementNumber);
      expect(created?.body).toContain(`Action: ${item.recommendedAction}`);
      expect(created?.body).toContain(`Priority: ${item.collectionTier}`);
      expect(created?.body).toContain(note);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(item.patientId);
      expect(afterCreateCounts.messages).toBe(beforeCounts.messages + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-64-collections-follow-up-created",
        description: "Captures the created Slice 64 follow-up task row and confirms the patient message count increment.",
        expected: {
          title,
          status: "New",
          assignedTo: "billing",
          deleted: 0,
          messageCountDelta: 1,
          requiredBodyFragments: [item.statementNumber, `Action: ${item.recommendedAction}`, `Priority: ${item.collectionTier}`, note]
        },
        actual: {
          taskId,
          created,
          beforeCounts,
          afterCreateCounts,
          messageCountDelta: afterCreateCounts.messages - beforeCounts.messages
        },
        context: {
          suite: "account-collections-follow-up",
          workflow: "collections-follow-up-created"
        }
      });

      await workflow.updatePatientMessageStatus(taskId, "Done", closeBody);
      const closed = await workflow.getPatientMessage(taskId);
      expect(closed).toMatchObject({
        body: closeBody,
        status: "Done"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-64-collections-follow-up-closed",
        description: "Captures the closed Slice 64 follow-up task row after status/body update, before UI rendering checks.",
        expected: {
          status: "Done",
          body: closeBody,
          uiTextAnchors: [title, closeBody, "Done"]
        },
        actual: {
          taskId,
          closed,
          selectedQueueItem: {
            patientId: item.patientId,
            pubpid: item.pubpid,
            statementNumber: item.statementNumber
          }
        },
        context: {
          suite: "account-collections-follow-up",
          workflow: "collections-follow-up-closed"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientNotesDirect(page, target, item.patientId);
        await expectRenderedText(page, title);
        await expectRenderedText(page, closeBody);
      } else {
        await openAuthenticatedModernizedMessages(page, target, item.pubpid);
        await expect(page.locator("body")).toContainText(title);
        await expect(page.locator("body")).toContainText(closeBody);
        await expect(page.locator("body")).toContainText("Done");
        await expect(page.locator("body")).toContainText("Assigned to billing");

        await openAuthenticatedModernizedFees(page, target);
        const queuePanel = page.locator('[aria-label="Collections work queue"]');
        await expect(queuePanel.getByRole("heading", { name: "Collections Work Queue" })).toBeVisible();
        await queuePanel.getByRole("button", { name: "Create Task" }).first().click();
        await expect(queuePanel).toContainText(`Created ${title} assigned to billing`);
        uiTaskId = await getModernizedMessageId(targetDb, item.patientId, title, "modernized Fees collections work queue");
        if (uiTaskId === null) {
          throw new Error("Modernized Fees collections work queue did not create a follow-up task.");
        }
        const uiCreated = await workflow.getPatientMessage(uiTaskId);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-64-collections-follow-up-ui-created",
          description: "Captures the modernized Fees UI-created follow-up task row so the Workbench can compare API/UI task creation evidence.",
          expected: {
            title,
            assignedTo: "billing",
            bodyFragment: "modernized Fees collections work queue"
          },
          actual: {
            uiTaskId,
            uiCreated,
            uiAction: {
              panelLabel: "Collections work queue",
              button: "Create Task",
              confirmation: `Created ${title} assigned to billing`
            }
          },
          context: {
            suite: "account-collections-follow-up",
            workflow: "collections-follow-up-ui-created"
          }
        });
      }

      await workflow.softDeletePatientMessage(taskId);
      const deleted = await workflow.getPatientMessage(taskId);
      expect(deleted).toMatchObject({
        deleted: 1
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-64-collections-follow-up-soft-deleted",
        description: "Captures the Slice 64 follow-up task after OpenEMR-compatible soft-delete/archive state is applied.",
        expected: {
          deleted: 1,
          cleanupWillHardDelete: true
        },
        actual: {
          taskId,
          deleted,
          uiTaskId
        },
        context: {
          suite: "account-collections-follow-up",
          workflow: "collections-follow-up-soft-deleted"
        }
      });
    } finally {
      if (target.type === "modernized-openemr" && uiTaskId === null) {
        uiTaskId = await getModernizedMessageId(targetDb, item.patientId, title, "modernized Fees collections work queue");
      }
      if (uiTaskId !== null) {
        await workflow.deletePatientMessage(uiTaskId);
      }
      if (taskId !== null) {
        await workflow.deletePatientMessage(taskId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(item.patientId);
    expect(afterCleanupCounts.messages).toBe(beforeCounts.messages);
    if (taskId !== null) {
      await expect(workflow.getPatientMessage(taskId)).resolves.toBeNull();
    }
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-64-collections-follow-up-cleanup",
      description: "Captures the Slice 64 final cleanup state after hard-deleting temporary follow-up tasks and restoring the patient message count.",
      expected: {
        messageCountRestored: true,
        finalMessageCount: beforeCounts.messages,
        primaryTaskRemoved: taskId !== null,
        uiTaskRemoved: target.type === "modernized-openemr" ? uiTaskId !== null : "not-applicable"
      },
      actual: {
        taskId,
        uiTaskId,
        beforeCounts,
        afterCleanupCounts,
        messageCountRestored: afterCleanupCounts.messages === beforeCounts.messages
      },
      context: {
        suite: "account-collections-follow-up",
        workflow: "collections-follow-up-cleanup"
      }
    });
  });
});

async function getModernizedMessageId(
  targetDb: { queryRows<T extends Record<string, string>>(sql: string): Promise<T[]> },
  patientId: number,
  title: string,
  bodyFragment: string
) {
  const rows = await targetDb.queryRows<{ id: string }>(`
SELECT id
FROM messages
WHERE pid = ${patientId}
  AND title = '${escapeSql(title)}'
  AND body LIKE '%${escapeSql(bodyFragment)}%'
ORDER BY message_date DESC, id DESC
LIMIT 1;
`);
  return rows[0]?.id ?? null;
}
