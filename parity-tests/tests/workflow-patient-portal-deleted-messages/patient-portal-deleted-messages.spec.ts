import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal secure-message deleted-folder parity @slice235 @workflow-patient-portal-deleted-messages @patients @portal", () => {
  test("shows archived patient-owned secure messages in the deleted folder", async ({
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    const inboundTitle = "Slice 235 deleted folder inbound";
    const sentTitle = "Slice 235 deleted folder sent";
    const inboundBody = "Slice 235 temporary deleted-folder inbound note.";
    const sentBody = "Slice 235 temporary deleted-folder sent note.";
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-235-patient-portal-deleted-messages-precondition",
      description: "Captures the Slice 235 Deleted-folder precondition: the signed-in anchor patient exists before temporary inbound and sent portal secure messages are created.",
      expected: {
        canonicalId: portalMessageAnchorPatientId,
        portalUsername: portalLoginUsername,
        inboundTitle,
        sentTitle,
        deletedStatus: "Delete"
      },
      actual: {
        canonicalId: portalMessageAnchorPatientId,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        portalUsername: portalLoginUsername
      },
      context: {
        suite: "workflow-patient-portal-deleted-messages",
        workflow: "patient-portal-deleted-messages-precondition"
      }
    });

    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, inboundTitle);
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, sentTitle);
    let cleanupAttached = false;

    try {
      const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-235-patient-portal-deleted-messages-before",
        description: "Captures the Slice 235 mailbox baseline after defensive cleanup and before temporary Deleted-folder rows are created.",
        expected: {
          titlesAbsentFromInboxSentAllAndDeleted: [inboundTitle, sentTitle],
          messageCountBaseline: before.messageCount,
          sentMessageCountBaseline: before.sentMessageCount,
          allMessageCountBaseline: before.allMessageCount,
          deletedMessageCountBaseline: before.deletedMessageCount
        },
        actual: summarizeMailbox(before),
        context: {
          suite: "workflow-patient-portal-deleted-messages",
          workflow: "patient-portal-deleted-messages-before"
        }
      });
      const inboundMessage = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        title: inboundTitle,
        body: inboundBody
      });
      const sentMessage = await workflow.composePatientPortalMessage(portalLoginUsername, portalPassword, {
        recipientId: "admin",
        title: sentTitle,
        body: sentBody
      });
      expect(sentMessage.sentMessage).toBeTruthy();

      const afterCreate = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const archivedInbound = await workflow.deletePatientPortalMessage(portalLoginUsername, portalPassword, inboundMessage.id);
      const archivedSent = await workflow.deletePatientPortalMessage(
        portalLoginUsername,
        portalPassword,
        sentMessage.sentMessage!.id
      );
      const afterArchive = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);

      expect(afterCreate.messageCount).toBe(before.messageCount + 1);
      expect(afterCreate.sentMessageCount).toBe(before.sentMessageCount + 1);
      expect(afterCreate.allMessageCount).toBe(before.allMessageCount + 2);
      expect(archivedInbound.deletedMessage).toMatchObject({
        id: inboundMessage.id,
        title: inboundTitle,
        status: "Delete",
        recipientId: portalLoginUsername
      });
      expect(archivedSent.deletedMessage).toMatchObject({
        id: sentMessage.sentMessage!.id,
        title: sentTitle,
        status: "Delete",
        senderId: portalLoginUsername
      });
      expect(afterArchive.messageCount).toBe(before.messageCount);
      expect(afterArchive.sentMessageCount).toBe(before.sentMessageCount);
      expect(afterArchive.allMessageCount).toBe(before.allMessageCount);
      expect(afterArchive.deletedMessageCount).toBe(before.deletedMessageCount + 2);
      expect(afterArchive.deletedMessages.map((message) => message.title)).toEqual(
        expect.arrayContaining([inboundTitle, sentTitle])
      );
      expect(afterArchive.messages.some((message) => message.title === inboundTitle)).toBe(false);
      expect(afterArchive.sentMessages.some((message) => message.title === sentTitle)).toBe(false);
      expect(afterArchive.allMessages.some((message) => message.title === inboundTitle || message.title === sentTitle)).toBe(false);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-235-patient-portal-deleted-messages-result",
        description: "Captures the Slice 235 Deleted-folder result: active inbox/sent rows move to Delete status, active folder counts return to baseline, and Deleted-folder count increases by two.",
        expected: {
          afterCreateMessageCount: before.messageCount + 1,
          afterCreateSentMessageCount: before.sentMessageCount + 1,
          afterCreateAllMessageCount: before.allMessageCount + 2,
          afterArchiveMessageCount: before.messageCount,
          afterArchiveSentMessageCount: before.sentMessageCount,
          afterArchiveAllMessageCount: before.allMessageCount,
          afterArchiveDeletedMessageCount: before.deletedMessageCount + 2,
          deletedTitles: [inboundTitle, sentTitle],
          hiddenFromActiveFolders: [inboundTitle, sentTitle]
        },
        actual: {
          before: summarizeMailbox(before),
          inboundMessage: summarizePortalMessage(inboundMessage),
          sentMessage: sentMessage.sentMessage ? summarizePortalMessage(sentMessage.sentMessage) : null,
          afterCreate: summarizeMailbox(afterCreate),
          archivedInbound: summarizeArchiveResult(archivedInbound),
          archivedSent: summarizeArchiveResult(archivedSent),
          afterArchive: summarizeMailbox(afterArchive)
        },
        context: {
          suite: "workflow-patient-portal-deleted-messages",
          workflow: "patient-portal-deleted-messages-result"
        }
      });
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, inboundTitle);
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, sentTitle);
      const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      expect(cleanup.deletedMessages.some((message) => message.title === inboundTitle || message.title === sentTitle)).toBe(false);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-235-patient-portal-deleted-messages-cleanup",
        description: "Captures the Slice 235 cleanup state after removing the temporary Deleted-folder rows.",
        expected: {
          titlesAbsentFromDeleted: [inboundTitle, sentTitle],
          titlesAbsentFromActiveFolders: [inboundTitle, sentTitle]
        },
        actual: summarizeMailbox(cleanup),
        context: {
          suite: "workflow-patient-portal-deleted-messages",
          workflow: "patient-portal-deleted-messages-cleanup"
        }
      });
      cleanupAttached = true;
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, inboundTitle);
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, sentTitle);
      if (!cleanupAttached) {
        const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-235-patient-portal-deleted-messages-cleanup",
          description: "Captures the Slice 235 best-effort cleanup state after removing the temporary Deleted-folder rows.",
          expected: {
            titlesAbsentFromDeleted: [inboundTitle, sentTitle],
            titlesAbsentFromActiveFolders: [inboundTitle, sentTitle]
          },
          actual: summarizeMailbox(cleanup),
          context: {
            suite: "workflow-patient-portal-deleted-messages",
            workflow: "patient-portal-deleted-messages-cleanup"
          }
        });
      }
    }
  });

  test("renders archived secure messages on the patient portal deleted surface", async ({ page, target, workflow }, testInfo) => {
    test.setTimeout(240_000);

    const title = "Slice 235 UI deleted folder inbound";
    const body = "Slice 235 portal UI deleted-folder evidence.";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);

    try {
      const inboundMessage = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        title,
        body
      });

      if (target.type === "legacy-openemr") {
        const archiveResult = await workflow.deletePatientPortalMessage(portalLoginUsername, portalPassword, inboundMessage.id);
        await openLegacyPatientPortalMessages(page, target);
        await page.getByText("Archive", { exact: false }).first().click();
        await expect(page.locator("body")).toContainText(title);
        const legacyUi = await capturePortalBody(page, {
          deletedSurface: "Archive",
          title,
          body
        });
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-235-patient-portal-deleted-messages-legacy-ui",
          description: "Captures the legacy Secure Messaging Archive-tab rendering for a temporary Deleted-folder message.",
          expected: {
            visibleFacts: ["Secure Messaging", "Archive", title],
            deletedStatus: "Delete"
          },
          actual: {
            inboundMessage: summarizePortalMessage(inboundMessage),
            archiveResult: summarizeArchiveResult(archiveResult),
            legacyUi
          },
          context: {
            suite: "workflow-patient-portal-deleted-messages",
            workflow: "patient-portal-deleted-messages-legacy-ui"
          }
        });
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        const card = page.locator("article.message-item").filter({ hasText: title }).first();
        await expect(card).toContainText(body);
        await card.getByRole("button", { name: "Archive message" }).click();
        await expect(page.locator("body")).toContainText(`Secure message archived for ${title}`);
        const deletedMessages = page.getByRole("region", { name: "Deleted secure messages" });
        await expect(deletedMessages.locator("article.message-item").filter({ hasText: title })).toContainText(body);
        const modernizedUi = await captureModernizedDeletedMessages(page, title, body);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-235-patient-portal-deleted-messages-modernized-ui",
          description: "Captures the modernized Portal Deleted secure messages rendering after browser-driven Archive message action.",
          expected: {
            visibleFacts: ["Secure Messages", "Deleted secure messages", title, body],
            successMessage: `Secure message archived for ${title}`
          },
          actual: {
            inboundMessage: summarizePortalMessage(inboundMessage),
            modernizedUi
          },
          context: {
            suite: "workflow-patient-portal-deleted-messages",
            workflow: "patient-portal-deleted-messages-modernized-ui"
          }
        });
      }
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
    }
  });
});

async function openLegacyPatientPortalMessages(page: Page, target: RuntimeTarget) {
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
}

async function capturePortalBody(page: Page, facts: Record<string, string>) {
  const bodyText = await page.locator("body").innerText();
  return {
    portalUrl: page.url(),
    bodyTextLength: bodyText.length,
    containsFacts: Object.fromEntries(Object.entries(facts).map(([key, value]) => [key, bodyText.includes(value)]))
  };
}

async function captureModernizedDeletedMessages(page: Page, title: string, body: string) {
  const deletedMessages = page.getByRole("region", { name: "Deleted secure messages" });
  const pageText = await page.locator("body").innerText();
  const deletedText = await deletedMessages.innerText();
  return {
    portalUrl: page.url(),
    pageTextLength: pageText.length,
    deletedTextLength: deletedText.length,
    containsFacts: {
      secureMessages: pageText.includes("Secure Messages"),
      successMessage: pageText.includes(`Secure message archived for ${title}`),
      deletedRegion: pageText.includes("Deleted secure messages"),
      deletedTitle: deletedText.includes(title),
      deletedBody: deletedText.includes(body)
    }
  };
}

function summarizeMailbox(mailbox: any) {
  return {
    authenticated: mailbox.authenticated,
    username: mailbox.username,
    portalUsername: mailbox.portalUsername,
    pid: mailbox.pid,
    pubpid: mailbox.pubpid,
    displayName: mailbox.displayName,
    failureReason: mailbox.failureReason,
    messageCount: mailbox.messageCount,
    sentMessageCount: mailbox.sentMessageCount,
    allMessageCount: mailbox.allMessageCount,
    deletedMessageCount: mailbox.deletedMessageCount,
    inboxTitles: summarizeTitles(mailbox.messages),
    sentTitles: summarizeTitles(mailbox.sentMessages),
    allTitles: summarizeTitles(mailbox.allMessages),
    deletedTitles: summarizeTitles(mailbox.deletedMessages)
  };
}

function summarizeArchiveResult(result: any) {
  return {
    authenticated: result.authenticated,
    deleted: result.deleted,
    portalUsername: result.portalUsername,
    pid: result.pid,
    messageId: result.messageId,
    messageCount: result.messageCount,
    sentMessageCount: result.sentMessageCount,
    deletedMessageCount: result.deletedMessageCount,
    failureReason: result.failureReason,
    deletedMessage: result.deletedMessage ? summarizePortalMessage(result.deletedMessage) : null
  };
}

function summarizePortalMessage(message: any) {
  return {
    id: message.id,
    title: message.title,
    body: message.body,
    status: message.status,
    assignedTo: message.assignedTo,
    senderId: message.senderId,
    senderName: message.senderName,
    recipientId: message.recipientId,
    recipientName: message.recipientName,
    isEncrypted: message.isEncrypted,
    deleted: message.deleted
  };
}

function summarizeTitles(messages: any[]) {
  return Array.isArray(messages) ? messages.map((message) => message.title) : [];
}
