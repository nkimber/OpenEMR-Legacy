import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { PatientPortalMessagesResult } from "../../src/workflows/legacyWorkflowActions.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const unsupportedAttachmentTitle = "Slice 512 attachment unsupported policy";
const unsupportedAttachmentBody = "Slice 512 verifies secure-message attachment submissions are rejected until the legacy-compatible workflow supports them.";
const unsupportedAttachment = {
  fileName: "slice-512-portal-note.txt",
  contentType: "text/plain",
  sizeBytes: 96
};

test.describe("patient portal secure-message attachment policy parity @slice512 @workflow-patient-portal-message-attachment-policy @patients @portal @messages", () => {
  test("rejects non-empty attachment submissions without creating portal mailbox rows", async ({
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(180_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, unsupportedAttachmentTitle);
    const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-512-patient-portal-message-attachment-policy-precondition",
      description: "Captures the Slice 512 attachment-policy precondition: the portal account exists and the cleanup-backed rejected-submission title is absent before the unsupported attachment probe.",
      expected: {
        canonicalId: portalMessageAnchorPatientId,
        portalUsername: portalLoginUsername,
        titleAbsentFromMailbox: true,
        attemptedAttachment: unsupportedAttachment
      },
      actual: {
        patient,
        mailbox: summarizeMailboxForTitle(before, unsupportedAttachmentTitle)
      },
      context: {
        suite: "workflow-patient-portal-message-attachment-policy",
        workflow: "patient-portal-message-attachment-policy-precondition"
      }
    });

    try {
      const result = await workflow.composePatientPortalMessage(portalLoginUsername, portalPassword, {
        recipientId: "admin",
        title: unsupportedAttachmentTitle,
        body: unsupportedAttachmentBody,
        attachments: [unsupportedAttachment]
      });

      expect(result.authenticated).toBe(true);
      expect(result.created).toBe(false);
      expect(result.sentMessage).toBeNull();
      expect(result.recipientMessage).toBeNull();
      expect(result.failureReason ?? "").toContain("attachments are not supported");

      const after = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      expect(after.sentMessages.some((message) => message.title === unsupportedAttachmentTitle)).toBe(false);
      expect(after.messages.some((message) => message.title === unsupportedAttachmentTitle)).toBe(false);
      expect(after.allMessages.some((message) => message.title === unsupportedAttachmentTitle)).toBe(false);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-512-patient-portal-message-attachment-policy-rejected",
        description: "Captures the Slice 512 rejected attachment-submission result: both target adapters report the feature as unsupported and no sent or recipient mailbox row is created.",
        expected: {
          created: false,
          sentMessage: null,
          recipientMessage: null,
          titleAbsentFromMailbox: true,
          failureReasonIncludes: "attachments are not supported"
        },
        actual: {
          result: {
            authenticated: result.authenticated,
            created: result.created,
            recipientId: result.recipientId,
            sentMessage: result.sentMessage,
            recipientMessage: result.recipientMessage,
            failureReason: result.failureReason
          },
          mailbox: summarizeMailboxForTitle(after, unsupportedAttachmentTitle)
        },
        context: {
          suite: "workflow-patient-portal-message-attachment-policy",
          workflow: "patient-portal-message-attachment-policy-rejected"
        }
      });
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, unsupportedAttachmentTitle);
      const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-512-patient-portal-message-attachment-policy-cleanup",
        description: "Captures the Slice 512 cleanup state after the rejected attachment-submission probe.",
        expected: {
          titleAbsentFromMailbox: true
        },
        actual: summarizeMailboxForTitle(cleanup, unsupportedAttachmentTitle),
        context: {
          suite: "workflow-patient-portal-message-attachment-policy",
          workflow: "patient-portal-message-attachment-policy-cleanup"
        }
      });
    }
  });

  test("does not expose an active secure-message attachment upload control", async ({
    page,
    target
  }, testInfo) => {
    test.setTimeout(180_000);

    const surface = target.type === "legacy-openemr"
      ? await expectLegacyPortalAttachmentControls(page, target)
      : await expectModernizedPortalAttachmentControls(page, target);

    expect(surface.fileInputCount).toBe(0);
    expect(surface.attachButtonCount).toBe(0);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-512-patient-portal-message-attachment-policy-ui",
      description: "Captures the Slice 512 UI surface policy: secure-message attachment upload controls are not active on either target while the legacy-compatible workflow rejects submitted attachment payloads.",
      expected: {
        activeAttachmentUploadControls: false,
        fileInputCount: 0,
        attachButtonCount: 0
      },
      actual: surface,
      context: {
        suite: "workflow-patient-portal-message-attachment-policy",
        workflow: "patient-portal-message-attachment-policy-ui"
      }
    });
  });
});

async function expectLegacyPortalAttachmentControls(page: Page, target: RuntimeTarget) {
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
  return summarizeAttachmentControls(page);
}

async function expectModernizedPortalAttachmentControls(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  return summarizeAttachmentControls(page);
}

async function summarizeAttachmentControls(page: Page) {
  const fileInputCount = await page.locator('input[type="file"]').count();
  const attachButtonCount = await page.getByRole("button", { name: /attach|attachment|upload/i }).count();
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    fileInputCount,
    attachButtonCount,
    activeAttachmentUploadControls: fileInputCount > 0 || attachButtonCount > 0
  };
}

function summarizeMailboxForTitle(mailbox: PatientPortalMessagesResult, title: string) {
  return {
    authenticated: mailbox.authenticated,
    canonicalId: mailbox.canonicalId,
    portalUsername: mailbox.portalUsername,
    messageCount: mailbox.messageCount,
    sentMessageCount: mailbox.sentMessageCount,
    matchingInboxMessages: mailbox.messages.filter((message) => message.title === title),
    matchingSentMessages: mailbox.sentMessages.filter((message) => message.title === title),
    matchingAllMessages: mailbox.allMessages.filter((message) => message.title === title)
  };
}
