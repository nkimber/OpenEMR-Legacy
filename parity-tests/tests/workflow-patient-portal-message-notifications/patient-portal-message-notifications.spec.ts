import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { PatientPortalMessageItem, PatientPortalMessagesResult } from "../../src/workflows/legacyWorkflowActions.js";
import type { Page } from "@playwright/test";

const portalNotificationAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const notificationInput = {
  dueStatus: "Due Soon",
  category: "act_cat_remind",
  item: "act_appointment"
};

test.describe("patient portal secure-message notification parity @slice255 @workflow-patient-portal-message-notifications @patients @portal @messages", () => {
  test("projects active patient reminders into Inbox and All only", async ({ target, targetDb, workflow }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalNotificationAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-255-patient-portal-message-notifications-precondition",
      description: "Captures the Slice 255 portal notification precondition: the signed-in anchor patient exists before temporary patient-reminder rows are created.",
      expected: {
        canonicalId: portalNotificationAnchorPatientId,
        portalUsername: portalLoginUsername,
        notificationInput
      },
      actual: {
        canonicalId: portalNotificationAnchorPatientId,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        portalUsername: portalLoginUsername
      },
      context: {
        suite: "workflow-patient-portal-message-notifications",
        workflow: "patient-portal-message-notifications-precondition"
      }
    });

    await workflow.cleanupPatientPortalNotification(portalLoginUsername, portalPassword, notificationInput);
    const beforeMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
    expect(findNotification(beforeMessages, notificationInput.dueStatus)).toBeUndefined();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-255-patient-portal-message-notifications-before",
      description: "Captures the Slice 255 cleanup baseline before creating the active patient reminder notification.",
      expected: {
        notificationAbsentFromInbox: true,
        notificationAbsentFromAll: true,
        notificationAbsentFromSent: true,
        notificationAbsentFromDeleted: true
      },
      actual: summarizeNotificationProjection(beforeMessages, notificationInput.dueStatus),
      context: {
        suite: "workflow-patient-portal-message-notifications",
        workflow: "patient-portal-message-notifications-before"
      }
    });

    try {
      const created = await workflow.createPatientPortalNotification(portalLoginUsername, portalPassword, notificationInput);
      expect(created).toMatchObject({
        type: "Notification",
        title: notificationInput.dueStatus,
        body: "Reminder:Appointment",
        status: "",
        senderId: "",
        senderName: "Patient Reminders",
        recipientId: portalLoginUsername,
        isEncrypted: false
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-255-patient-portal-message-notifications-created",
        description: "Captures the normalized Slice 255 notification row created from an active patient_reminders record.",
        expected: {
          type: "Notification",
          title: notificationInput.dueStatus,
          body: "Reminder:Appointment",
          senderName: "Patient Reminders",
          recipientId: portalLoginUsername,
          isEncrypted: false
        },
        actual: summarizeMessage(created),
        context: {
          suite: "workflow-patient-portal-message-notifications",
          workflow: "patient-portal-message-notifications-created"
        }
      });

      const portalMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const inboxNotification = portalMessages.messages.find((message) => message.id === created.id && message.type === "Notification");
      const allNotification = portalMessages.allMessages.find((message) => message.id === created.id && message.type === "Notification");
      const sentNotification = portalMessages.sentMessages.find((message) => message.id === created.id);
      const deletedNotification = portalMessages.deletedMessages.find((message) => message.id === created.id);

      expect(inboxNotification).toMatchObject(created);
      expect(allNotification).toMatchObject(created);
      expect(sentNotification).toBeUndefined();
      expect(deletedNotification).toBeUndefined();
      expect(portalMessages.messageCount).toBe(portalMessages.messages.length);
      expect(portalMessages.allMessageCount).toBe(portalMessages.allMessages.length);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-255-patient-portal-message-notifications-projection",
        description: "Captures the Slice 255 mailbox projection: active patient reminders appear in Inbox and All but not Sent or Deleted.",
        expected: {
          notificationId: created.id,
          presentInInbox: true,
          presentInAll: true,
          presentInSent: false,
          presentInDeleted: false,
          messageCountMatchesInboxLength: true,
          allMessageCountMatchesAllLength: true
        },
        actual: summarizeNotificationProjection(portalMessages, notificationInput.dueStatus, created.id),
        context: {
          suite: "workflow-patient-portal-message-notifications",
          workflow: "patient-portal-message-notifications-projection"
        }
      });
    } finally {
      await workflow.cleanupPatientPortalNotification(portalLoginUsername, portalPassword, notificationInput);
      const cleanupMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-255-patient-portal-message-notifications-cleanup",
        description: "Captures the final Slice 255 cleanup state after removing the temporary patient-reminder notification.",
        expected: {
          notificationAbsentFromInbox: true,
          notificationAbsentFromAll: true,
          notificationAbsentFromSent: true,
          notificationAbsentFromDeleted: true
        },
        actual: summarizeNotificationProjection(cleanupMessages, notificationInput.dueStatus),
        context: {
          suite: "workflow-patient-portal-message-notifications",
          workflow: "patient-portal-message-notifications-cleanup"
        }
      });
    }
  });

  test("documents legacy UI absence and renders modernized notifications as read-only rows", async ({ page, target, workflow }, testInfo) => {
    test.setTimeout(240_000);

    await workflow.cleanupPatientPortalNotification(portalLoginUsername, portalPassword, notificationInput);

    try {
      await workflow.createPatientPortalNotification(portalLoginUsername, portalPassword, notificationInput);

      if (target.type === "legacy-openemr") {
        const legacyUi = await expectLegacyPatientPortalNotificationAbsence(page, target);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-255-patient-portal-message-notifications-legacy-ui-absence",
          description: "Captures the accepted Slice 255 legacy portal UI difference: active reminder notifications are available through the normalized projection but are absent from the legacy Secure Messaging page.",
          expected: {
            secureMessagingVisible: true,
            existingCareTeamMessageVisible: true,
            notificationTitleVisibleCount: 0,
            notificationBodyVisibleCount: 0,
            notificationSenderVisibleCount: 0
          },
          actual: legacyUi,
          context: {
            suite: "workflow-patient-portal-message-notifications",
            workflow: "patient-portal-message-notifications-legacy-ui-absence"
          }
        });
      } else {
        const modernizedUi = await expectModernizedPatientPortalNotification(page, target);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-255-patient-portal-message-notifications-modernized-ui",
          description: "Captures the modernized Slice 255 portal UI rendering: active reminder notifications appear as read-only rows without thread, archive, or reply controls.",
          expected: {
            title: notificationInput.dueStatus,
            body: "Reminder:Appointment",
            type: "Notification",
            badge: "Read-only reminder",
            viewThreadButtonCount: 0,
            archiveButtonCount: 0,
            replyTextboxCount: 0
          },
          actual: modernizedUi,
          context: {
            suite: "workflow-patient-portal-message-notifications",
            workflow: "patient-portal-message-notifications-modernized-ui"
          }
        });
      }
    } finally {
      await workflow.cleanupPatientPortalNotification(portalLoginUsername, portalPassword, notificationInput);
      const cleanupMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-255-patient-portal-message-notifications-ui-cleanup",
        description: "Captures the Slice 255 UI-test cleanup state after removing the temporary notification created for browser rendering checks.",
        expected: {
          notificationAbsentFromInbox: true,
          notificationAbsentFromAll: true
        },
        actual: summarizeNotificationProjection(cleanupMessages, notificationInput.dueStatus),
        context: {
          suite: "workflow-patient-portal-message-notifications",
          workflow: "patient-portal-message-notifications-ui-cleanup"
        }
      });
    }
  });
});

async function expectLegacyPatientPortalNotificationAbsence(page: Page, target: RuntimeTarget) {
  await page.context().clearCookies();
  await page.goto(`${target.publicUrl}/portal/index.php?site=default&woops=1`);
  await page.locator("#uname").fill(portalLoginUsername);
  await page.locator("#pass").fill(portalPassword);

  const emailConfirmation = page.locator("#passaddon");
  if ((await emailConfirmation.count()) > 0 && await emailConfirmation.isVisible()) {
    await emailConfirmation.fill(portalLoginUsername);
  }

  await page.getByRole("button", { name: "Log In" }).click();
  await expect.poll(() => page.url()).toContain("/portal/home.php");
  await page.goto(`${target.publicUrl}/portal/messaging/messages.php`);
  await expectRenderedText(page, /Secure Messaging/i);
  await expect(page.getByText("Care team follow-up", { exact: true }).first()).toBeVisible();
  const notificationTitle = page.getByText(notificationInput.dueStatus, { exact: true });
  const notificationBody = page.getByText("Reminder:Appointment", { exact: false });
  const notificationSender = page.getByText("Patient Reminders", { exact: false });
  await expect(notificationTitle).toHaveCount(0);
  await expect(notificationBody).toHaveCount(0);
  await expect(notificationSender).toHaveCount(0);
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    secureMessagingVisible: true,
    existingCareTeamMessageVisible: true,
    notificationTitleVisibleCount: await notificationTitle.count(),
    notificationBodyVisibleCount: await notificationBody.count(),
    notificationSenderVisibleCount: await notificationSender.count()
  };
}

async function expectModernizedPatientPortalNotification(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const card = page.locator("article.message-item").filter({ hasText: notificationInput.dueStatus }).first();
  await expect(card).toContainText("Reminder:Appointment");
  await expect(card).toContainText("Notification");
  await expect(card).toContainText("Read-only reminder");
  const viewThreadButton = card.getByRole("button", { name: "View thread" });
  const archiveButton = card.getByRole("button", { name: "Archive message" });
  const replyTextbox = card.getByRole("textbox", { name: `Reply to ${notificationInput.dueStatus}` });
  await expect(viewThreadButton).toHaveCount(0);
  await expect(archiveButton).toHaveCount(0);
  await expect(replyTextbox).toHaveCount(0);
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    cardText: await card.innerText(),
    viewThreadButtonCount: await viewThreadButton.count(),
    archiveButtonCount: await archiveButton.count(),
    replyTextboxCount: await replyTextbox.count()
  };
}

function summarizeNotificationProjection(
  portalMessages: PatientPortalMessagesResult,
  title: string,
  notificationId?: string
) {
  const predicate = (message: PatientPortalMessageItem) =>
    message.type === "Notification" &&
    message.title === title &&
    (notificationId === undefined || message.id === notificationId);

  const inboxNotification = portalMessages.messages.find(predicate);
  const allNotification = portalMessages.allMessages.find(predicate);
  const sentNotification = portalMessages.sentMessages.find(predicate);
  const deletedNotification = portalMessages.deletedMessages.find(predicate);

  return {
    authenticated: portalMessages.authenticated,
    canonicalId: portalMessages.canonicalId,
    portalUsername: portalMessages.portalUsername,
    counts: {
      inbox: portalMessages.messageCount,
      inboxLength: portalMessages.messages.length,
      sent: portalMessages.sentMessageCount,
      sentLength: portalMessages.sentMessages.length,
      all: portalMessages.allMessageCount,
      allLength: portalMessages.allMessages.length,
      deleted: portalMessages.deletedMessageCount,
      deletedLength: portalMessages.deletedMessages.length
    },
    notificationPresence: {
      inbox: inboxNotification ? summarizeMessage(inboxNotification) : null,
      all: allNotification ? summarizeMessage(allNotification) : null,
      sent: sentNotification ? summarizeMessage(sentNotification) : null,
      deleted: deletedNotification ? summarizeMessage(deletedNotification) : null
    }
  };
}

function findNotification(portalMessages: PatientPortalMessagesResult, title: string) {
  return portalMessages.messages.find(
    (message) =>
      message.type === "Notification" &&
      message.title === title
  );
}

function summarizeMessage(message: PatientPortalMessageItem) {
  return {
    id: message.id,
    type: message.type,
    date: message.date,
    title: message.title,
    body: message.body,
    status: message.status,
    assignedTo: message.assignedTo,
    senderId: message.senderId,
    senderName: message.senderName,
    recipientId: message.recipientId,
    recipientName: message.recipientName,
    mailChain: message.mailChain,
    replyMailChain: message.replyMailChain,
    portalRelation: message.portalRelation,
    isEncrypted: message.isEncrypted
  };
}
