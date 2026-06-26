import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const forwardAssignedTo = "admin";

test.describe("patient portal secure-message forward-to-practice parity @slice234 @workflow-patient-portal-message-forward @patients @portal", () => {
  test("creates a practice-side patient message from a portal inbox secure message", async ({
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    const forwardTitle = "Slice 234 forward secure message API";
    const inboundBody = "Slice 234 inbound secure message for practice forwarding.";
    const forwardBody = "Slice 234 forward to practice for medication review with original context noted.";

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-234-patient-portal-message-forward-precondition",
      description: "Captures the Slice 234 forward-to-practice precondition: the signed-in anchor patient exists before a temporary inbound portal secure message is created.",
      expected: {
        canonicalId: portalMessageAnchorPatientId,
        portalUsername: portalLoginUsername,
        forwardTitle,
        inboundBody,
        forwardBody,
        assignedTo: forwardAssignedTo
      },
      actual: {
        canonicalId: portalMessageAnchorPatientId,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        portalUsername: portalLoginUsername
      },
      context: {
        suite: "workflow-patient-portal-message-forward",
        workflow: "patient-portal-secure-message-forward-precondition"
      }
    });

    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, forwardTitle);
    await workflow.cleanupPatientPortalForwardedMessage(patient!.pid, forwardTitle, forwardBody);

    try {
      const created = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        title: forwardTitle,
        body: inboundBody,
        senderId: forwardAssignedTo,
        senderName: "Administrator"
      });
      const beforeForward = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const result = await workflow.forwardPatientPortalMessage(portalLoginUsername, portalPassword, created.id, {
        body: forwardBody,
        assignedTo: forwardAssignedTo
      });
      const afterForward = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const forwardedPatientMessage = result.forwardedPatientMessage?.id
        ? await workflow.getPatientMessage(result.forwardedPatientMessage.id)
        : null;
      const forwardedPortalMessage = afterForward.messages.find((message) => message.id === created.id);

      expect(result).toMatchObject({
        authenticated: true,
        forwarded: true,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        originalMessageId: created.id,
        messageCount: beforeForward.messageCount,
        sentMessageCount: beforeForward.sentMessageCount,
        failureReason: null
      });
      expect(result.originalMessage).toMatchObject({
        id: created.id,
        title: forwardTitle,
        body: inboundBody,
        status: "Sent",
        assignedTo: forwardAssignedTo,
        senderId: forwardAssignedTo,
        recipientId: portalLoginUsername
      });
      expect(result.forwardedPatientMessage).toMatchObject({
        patientId: patient!.pid,
        title: forwardTitle,
        body: forwardBody,
        status: "New",
        assignedTo: forwardAssignedTo,
        portalRelation: "portal:forwarded",
        isEncrypted: false,
        deleted: 0
      });
      expect(forwardedPatientMessage).toMatchObject({
        patientId: patient!.pid,
        title: forwardTitle,
        body: forwardBody,
        status: "New",
        assignedTo: forwardAssignedTo,
        portalRelation: "portal:forwarded",
        isEncrypted: false,
        deleted: 0
      });
      expect(forwardedPortalMessage).toMatchObject({
        id: created.id,
        title: forwardTitle,
        status: "Sent",
        assignedTo: forwardAssignedTo
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-234-patient-portal-message-forward-result",
        description: "Captures the Slice 234 forward-to-practice projection after forwarding a temporary portal inbox message into a practice-side patient message row.",
        expected: {
          authenticated: true,
          forwarded: true,
          originalMessageStatus: "Sent",
          forwardedPatientMessageStatus: "New",
          portalRelation: "portal:forwarded",
          assignedTo: forwardAssignedTo,
          isEncrypted: false,
          deleted: 0
        },
        actual: {
          created: summarizePortalMessage(created),
          beforeForward: summarizePortalMailbox(beforeForward),
          result: summarizeForwardResult(result),
          afterForward: summarizePortalMailbox(afterForward),
          forwardedPortalMessage: forwardedPortalMessage ? summarizePortalMessage(forwardedPortalMessage) : null,
          forwardedPatientMessage: forwardedPatientMessage ? summarizeForwardedPatientMessage(forwardedPatientMessage) : null
        },
        context: {
          suite: "workflow-patient-portal-message-forward",
          workflow: "patient-portal-secure-message-forward-result"
        }
      });
    } finally {
      await workflow.cleanupPatientPortalForwardedMessage(patient!.pid, forwardTitle, forwardBody);
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, forwardTitle);
    }
  });

  test("shows and runs the forward-to-practice control on the patient portal surface", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    const forwardTitle = "Slice 234 forward secure message UI";
    const inboundBody = "Slice 234 inbound secure message for the portal forward UI.";
    const forwardBody = "Slice 234 UI forward body for the practice message queue.";

    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, forwardTitle);
    await workflow.cleanupPatientPortalForwardedMessage(patient!.pid, forwardTitle, forwardBody);

    try {
      const created = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        title: forwardTitle,
        body: inboundBody,
        senderId: forwardAssignedTo,
        senderName: "Administrator"
      });

      if (target.type === "legacy-openemr") {
        const result = await workflow.forwardPatientPortalMessage(portalLoginUsername, portalPassword, created.id, {
          body: forwardBody,
          assignedTo: forwardAssignedTo
        });
        expect(result.forwarded).toBe(true);
        const legacyUi = await expectLegacyForwardedMessage(page, target, forwardTitle);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-234-patient-portal-message-forward-legacy-ui",
          description: "Captures the legacy Secure Messaging portal surface after the temporary inbound message is forwarded to the practice queue.",
          expected: {
            visibleFacts: ["Secure Messaging", forwardTitle],
            forwarded: true,
            assignedTo: forwardAssignedTo
          },
          actual: {
            created: summarizePortalMessage(created),
            result: summarizeForwardResult(result),
            legacyUi
          },
          context: {
            suite: "workflow-patient-portal-message-forward",
            workflow: "patient-portal-secure-message-forward-legacy-ui"
          }
        });
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        const card = page.locator("article.message-item").filter({ hasText: forwardTitle }).first();
        await expect(card).toContainText(inboundBody);
        await expect(card).toContainText("Forward to practice");
        const forwardForm = card.getByRole("form", { name: `Forward ${forwardTitle} to practice` });
        await forwardForm.getByLabel(`Forward ${forwardTitle} to practice`).fill(forwardBody);
        await forwardForm.getByRole("button", { name: "Forward to practice" }).click();
        await expect(page.locator("body")).toContainText("Forwarded secure message to admin");
        await expect(page.locator("article.message-item").filter({ hasText: forwardTitle }).first()).toContainText("Sent");
        const modernizedUi = await captureModernizedForwardedMessage(page, forwardTitle, inboundBody);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-234-patient-portal-message-forward-modernized-ui",
          description: "Captures the modernized Portal forward-to-practice rendering after the temporary inbound message is forwarded.",
          expected: {
            visibleFacts: ["Secure Messages", forwardTitle, "Forwarded secure message to admin", "Sent"],
            inboundBody,
            assignedTo: forwardAssignedTo
          },
          actual: {
            created: summarizePortalMessage(created),
            modernizedUi
          },
          context: {
            suite: "workflow-patient-portal-message-forward",
            workflow: "patient-portal-secure-message-forward-modernized-ui"
          }
        });
      }
    } finally {
      await workflow.cleanupPatientPortalForwardedMessage(patient!.pid, forwardTitle, forwardBody);
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, forwardTitle);
    }
  });
});

async function expectLegacyForwardedMessage(page: Page, target: RuntimeTarget, title: string) {
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
  await expectRenderedText(page, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  const bodyText = await page.locator("body").innerText();
  return {
    portalUrl: page.url(),
    bodyTextLength: bodyText.length,
    containsFacts: {
      secureMessaging: /Secure Messaging/i.test(bodyText),
      forwardedTitle: bodyText.includes(title)
    }
  };
}

async function captureModernizedForwardedMessage(page: Page, title: string, inboundBody: string) {
  const bodyText = await page.locator("body").innerText();
  return {
    portalUrl: page.url(),
    bodyTextLength: bodyText.length,
    containsFacts: {
      secureMessages: bodyText.includes("Secure Messages"),
      forwardedTitle: bodyText.includes(title),
      inboundBody: bodyText.includes(inboundBody),
      sentStatus: bodyText.includes("Sent"),
      successMessage: bodyText.includes("Forwarded secure message to admin")
    }
  };
}

function summarizePortalMailbox(mailbox: any) {
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
    returnedMessages: Array.isArray(mailbox.messages) ? mailbox.messages.length : null
  };
}

function summarizeForwardResult(result: any) {
  return {
    authenticated: result.authenticated,
    forwarded: result.forwarded,
    portalUsername: result.portalUsername,
    pid: result.pid,
    originalMessageId: result.originalMessageId,
    messageCount: result.messageCount,
    sentMessageCount: result.sentMessageCount,
    failureReason: result.failureReason,
    originalMessage: result.originalMessage ? summarizePortalMessage(result.originalMessage) : null,
    forwardedPatientMessage: result.forwardedPatientMessage ? summarizeForwardedPatientMessage(result.forwardedPatientMessage) : null
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

function summarizeForwardedPatientMessage(message: any) {
  return {
    id: message.id,
    patientId: message.patientId,
    title: message.title,
    body: message.body,
    status: message.status,
    assignedTo: message.assignedTo,
    portalRelation: message.portalRelation,
    isEncrypted: message.isEncrypted,
    deleted: message.deleted
  };
}
