import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { PatientPortalMessageItem, PatientPortalMessagesResult } from "../../src/workflows/legacyWorkflowActions.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const attachmentReadinessTitle = "Slice 510 attachment readiness";
const attachmentReadinessBody = "Slice 510 verifies the current portal secure-message attachment contract.";

test.describe("patient portal secure-message attachment readiness parity @slice510 @workflow-patient-portal-message-attachments @patients @portal @messages", () => {
  test("exposes an explicit empty attachment collection for composed portal messages", async ({
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(180_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, attachmentReadinessTitle);
    const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-510-patient-portal-message-attachments-precondition",
      description: "Captures the Slice 510 portal message attachment precondition: the anchor patient exists and the temporary composed message title is absent before the attachment-readiness probe.",
      expected: {
        canonicalId: portalMessageAnchorPatientId,
        portalUsername: portalLoginUsername,
        titleAbsentFromSent: true,
        attachmentContract: {
          attachmentCount: 0,
          attachments: []
        }
      },
      actual: {
        patient,
        mailbox: summarizeMailboxForTitle(before, attachmentReadinessTitle)
      },
      context: {
        suite: "workflow-patient-portal-message-attachments",
        workflow: "patient-portal-message-attachments-precondition"
      }
    });

    try {
      const result = await workflow.composePatientPortalMessage(portalLoginUsername, portalPassword, {
        recipientId: "admin",
        title: attachmentReadinessTitle,
        body: attachmentReadinessBody
      });
      expect(result.created).toBe(true);
      expect(result.sentMessage).toMatchObject({
        title: attachmentReadinessTitle,
        attachmentCount: 0,
        attachments: []
      });
      expect(result.recipientMessage).toMatchObject({
        title: attachmentReadinessTitle,
        attachmentCount: 0,
        attachments: []
      });

      const after = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const sentMessage = after.sentMessages.find((message) => message.title === attachmentReadinessTitle);
      expect(sentMessage).toBeTruthy();
      expect(sentMessage).toMatchObject({
        title: attachmentReadinessTitle,
        body: attachmentReadinessBody,
        attachmentCount: 0,
        attachments: []
      });

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-510-patient-portal-message-attachments-result",
        description: "Captures the Slice 510 normalized attachment contract for cleanup-backed portal secure-message compose: both target adapters expose zero attachments explicitly.",
        expected: {
          created: true,
          sentMessage: {
            title: attachmentReadinessTitle,
            body: attachmentReadinessBody,
            attachmentCount: 0,
            attachments: []
          },
          recipientMessage: {
            title: attachmentReadinessTitle,
            attachmentCount: 0,
            attachments: []
          }
        },
        actual: {
          result: summarizeComposeAttachmentResult(result.sentMessage, result.recipientMessage),
          mailbox: summarizeMailboxForTitle(after, attachmentReadinessTitle)
        },
        context: {
          suite: "workflow-patient-portal-message-attachments",
          workflow: "patient-portal-message-attachments-result"
        }
      });
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, attachmentReadinessTitle);
      const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-510-patient-portal-message-attachments-cleanup",
        description: "Captures the Slice 510 cleanup state after removing the temporary portal secure-message attachment-readiness rows.",
        expected: {
          titleAbsentFromSent: true
        },
        actual: summarizeMailboxForTitle(cleanup, attachmentReadinessTitle),
        context: {
          suite: "workflow-patient-portal-message-attachments",
          workflow: "patient-portal-message-attachments-cleanup"
        }
      });
    }
  });

  test("renders the current attachment state on the target portal sent surface", async ({
    page,
    target,
    workflow
  }, testInfo) => {
    test.setTimeout(240_000);

    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, attachmentReadinessTitle);

    try {
      await workflow.composePatientPortalMessage(portalLoginUsername, portalPassword, {
        recipientId: "admin",
        title: attachmentReadinessTitle,
        body: attachmentReadinessBody
      });

      if (target.type === "legacy-openemr") {
        const legacySurface = await expectLegacyPatientPortalSentMessage(page, target);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-510-patient-portal-message-attachments-legacy-ui",
          description: "Captures the Slice 510 legacy portal sent-message surface, which renders the composed message without a normalized attachment count control.",
          expected: {
            secureMessagingVisible: true,
            sentMessageVisible: true,
            explicitAttachmentCountVisible: false
          },
          actual: legacySurface,
          context: {
            suite: "workflow-patient-portal-message-attachments",
            workflow: "patient-portal-message-attachments-legacy-ui"
          }
        });
      } else {
        const modernizedSurface = await expectModernizedPatientPortalSentMessageAttachmentState(page, target);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-510-patient-portal-message-attachments-modernized-ui",
          description: "Captures the Slice 510 modernized Portal sent-message surface, including the explicit zero-attachment metadata rendered on the message card.",
          expected: {
            sentMessageVisible: true,
            attachmentCountLabel: "Attachments 0"
          },
          actual: modernizedSurface,
          context: {
            suite: "workflow-patient-portal-message-attachments",
            workflow: "patient-portal-message-attachments-modernized-ui"
          }
        });
      }
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, attachmentReadinessTitle);
    }
  });
});

async function expectLegacyPatientPortalSentMessage(page: Page, target: RuntimeTarget) {
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
  await page.getByText("Sent", { exact: false }).first().click();
  await expect(page.locator("body")).toContainText(attachmentReadinessTitle);
  const bodyText = await page.locator("body").innerText();
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    sentMessageVisible: bodyText.includes(attachmentReadinessTitle),
    explicitAttachmentCountVisible: bodyText.includes("Attachments 0"),
    bodyText
  };
}

async function expectModernizedPatientPortalSentMessageAttachmentState(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const sentRegion = page.getByRole("region", { name: "Sent secure messages" });
  const card = sentRegion.locator("article.message-item").filter({ hasText: attachmentReadinessTitle }).first();
  await expect(card).toContainText(attachmentReadinessBody);
  await expect(card).toContainText("Attachments 0");
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    cardText: await card.innerText(),
    sentMessageVisible: true,
    attachmentCountLabelVisible: true
  };
}

function summarizeComposeAttachmentResult(
  sentMessage: PatientPortalMessageItem | null,
  recipientMessage: PatientPortalMessageItem | null
) {
  return {
    sentMessage: sentMessage ? summarizeMessageAttachments(sentMessage) : null,
    recipientMessage: recipientMessage ? summarizeMessageAttachments(recipientMessage) : null
  };
}

function summarizeMailboxForTitle(mailbox: PatientPortalMessagesResult, title: string) {
  return {
    authenticated: mailbox.authenticated,
    canonicalId: mailbox.canonicalId,
    portalUsername: mailbox.portalUsername,
    messageCount: mailbox.messageCount,
    sentMessageCount: mailbox.sentMessageCount,
    matchingInboxMessages: mailbox.messages.filter((message) => message.title === title).map(summarizeMessageAttachments),
    matchingSentMessages: mailbox.sentMessages.filter((message) => message.title === title).map(summarizeMessageAttachments),
    matchingAllMessages: mailbox.allMessages.filter((message) => message.title === title).map(summarizeMessageAttachments)
  };
}

function summarizeMessageAttachments(message: PatientPortalMessageItem) {
  return {
    id: message.id,
    type: message.type,
    title: message.title,
    body: message.body,
    senderId: message.senderId,
    recipientId: message.recipientId,
    portalRelation: message.portalRelation,
    attachmentCount: message.attachmentCount,
    attachments: message.attachments
  };
}
