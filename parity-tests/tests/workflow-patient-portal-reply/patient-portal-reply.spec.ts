import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal secure-message reply parity @slice212 @workflow-patient-portal-reply @patients @portal", () => {
  test("creates a threaded reply from an inbox secure message", async ({ target, targetDb, workflow }, testInfo) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-212-patient-portal-reply-precondition",
      description: "Captures the Slice 212 portal secure-message reply precondition: the signed-in anchor patient exists for cleanup-backed threaded reply checks.",
      expected: {
        anchorCanonicalId: portalMessageAnchorPatientId,
        loginUsername: portalLoginUsername,
        pubpid: portalMessageAnchorPatientId
      },
      actual: {
        patient
      },
      context: {
        canonicalId: portalMessageAnchorPatientId,
        suite: "workflow-patient-portal-reply",
        workflow: "patient-portal-reply-precondition"
      }
    });

    const replyBody = "Slice 212 reply to the portal medication question.";
    const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
    const original = before.messages.find((message) => message.title === "Portal message");
    expect(original).toBeTruthy();

    await workflow.cleanupPatientPortalMessageReply(portalLoginUsername, original!.title, replyBody);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-212-patient-portal-reply-before",
      description: "Captures the Slice 212 pre-reply mailbox state after defensive cleanup, including the seeded inbox message used as the reply anchor.",
      expected: {
        originalMessage: {
          title: "Portal message",
          body: "Patient portal question about medications."
        },
        replyBodyAbsentFromSent: replyBody,
        sentMessageCount: before.sentMessageCount
      },
      actual: {
        before,
        original,
        replyBody
      },
      context: {
        canonicalId: portalMessageAnchorPatientId,
        suite: "workflow-patient-portal-reply",
        workflow: "patient-portal-reply-before"
      }
    });
    let cleanupAttached = false;

    try {
      const result = await workflow.replyToPatientPortalMessage(portalLoginUsername, portalPassword, original!.id, {
        body: replyBody
      });
      const after = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const sentReply = after.sentMessages.find((message) => message.title === original!.title && message.body === replyBody);

      expect(result).toMatchObject({
        authenticated: true,
        created: true,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        originalMessageId: original!.id,
        messageCount: before.messageCount,
        sentMessageCount: before.sentMessageCount + 1,
        failureReason: null
      });
      expect(result.originalMessage).toMatchObject({
        id: original!.id,
        title: "Portal message",
        body: "Patient portal question about medications."
      });
      expect(result.sentMessage).toMatchObject({
        title: original!.title,
        body: replyBody,
        status: "New",
        senderId: portalLoginUsername,
        recipientId: original!.senderId || original!.assignedTo || "admin",
        replyMailChain: original!.replyMailChain
      });
      expect(result.recipientMessage).toMatchObject({
        title: original!.title,
        body: replyBody,
        replyMailChain: original!.replyMailChain
      });
      expect(after.messageCount).toBe(before.messageCount);
      expect(after.sentMessageCount).toBe(before.sentMessageCount + 1);
      expect(sentReply).toMatchObject({
        body: replyBody,
        senderId: portalLoginUsername,
        replyMailChain: original!.replyMailChain
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-212-patient-portal-reply-result",
        description: "Captures the Slice 212 threaded reply result, including original message linkage, patient-owned sent copy, and practice-recipient copy facts.",
        expected: {
          authenticated: true,
          created: true,
          portalUsername: portalLoginUsername,
          pid: patient!.pid,
          originalMessageId: original!.id,
          messageCount: before.messageCount,
          sentMessageCount: before.sentMessageCount + 1,
          originalMessage: {
            id: original!.id,
            title: "Portal message",
            body: "Patient portal question about medications."
          },
          sentMessage: {
            title: original!.title,
            body: replyBody,
            status: "New",
            senderId: portalLoginUsername,
            recipientId: original!.senderId || original!.assignedTo || "admin",
            replyMailChain: original!.replyMailChain
          },
          recipientMessage: {
            title: original!.title,
            body: replyBody,
            replyMailChain: original!.replyMailChain
          }
        },
        actual: {
          patient,
          before,
          original,
          result,
          after,
          sentReply
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-reply",
          workflow: "patient-portal-reply-result"
        }
      });
      await workflow.cleanupPatientPortalMessageReply(portalLoginUsername, original!.title, replyBody);
      const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const cleanupSentReply = cleanup.sentMessages.find((message) => message.title === original!.title && message.body === replyBody) ?? null;
      expect(cleanupSentReply).toBeNull();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-212-patient-portal-reply-cleanup",
        description: "Captures the Slice 212 cleanup state after removing temporary patient-owned sent and practice-recipient reply rows.",
        expected: {
          replyBodyAbsentFromSent: replyBody,
          sentMessageCount: before.sentMessageCount
        },
        actual: {
          cleanup,
          cleanupSentReply
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-reply",
          workflow: "patient-portal-reply-cleanup"
        }
      });
      cleanupAttached = true;
    } finally {
      await workflow.cleanupPatientPortalMessageReply(portalLoginUsername, original!.title, replyBody);
      if (!cleanupAttached) {
        const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-212-patient-portal-reply-cleanup",
          description: "Captures the Slice 212 best-effort cleanup state after removing temporary patient-owned sent and practice-recipient reply rows.",
          expected: {
            replyBodyAbsentFromSent: replyBody
          },
          actual: {
            cleanup
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-reply",
            workflow: "patient-portal-reply-cleanup"
          }
        });
      }
    }
  });

  test("shows the reply on the patient portal sent surface", async ({ page, target, workflow }, testInfo) => {
    test.setTimeout(240_000);

    const replyBody = "Slice 212 portal UI reply body.";
    const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
    const original = before.messages.find((message) => message.title === "Portal message");
    expect(original).toBeTruthy();
    await workflow.cleanupPatientPortalMessageReply(portalLoginUsername, original!.title, replyBody);

    try {
      if (target.type === "legacy-openemr") {
        await workflow.replyToPatientPortalMessage(portalLoginUsername, portalPassword, original!.id, {
          body: replyBody
        });
        const legacySentSurface = await expectLegacyPatientPortalSentMessage(page, target, original!.title);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-212-patient-portal-reply-legacy-surface",
          description: "Captures the Slice 212 legacy patient portal Sent-folder rendering after cleanup-backed reply.",
          expected: {
            urlIncludes: "/portal/messaging/messages.php",
            visibleFields: [
              "Secure Messaging",
              "Sent",
              original!.title
            ]
          },
          actual: {
            url: page.url(),
            title: original!.title,
            replyBody,
            legacySentSurface
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-reply",
            workflow: "patient-portal-reply-legacy-surface"
          }
        });
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        const replyForm = page.getByRole("form", { name: "Reply to Portal message" });
        await replyForm.getByLabel("Reply to Portal message").fill(replyBody);
        await replyForm.getByRole("button", { name: "Send reply" }).click();
        await expect(page.locator("body")).toContainText("Secure message reply sent for Portal message");
        await expect(page.locator("body")).toContainText("Sent");
        await expect(page.locator("body")).toContainText("Portal message");
        await expect(page.locator("body")).toContainText(replyBody);
        const modernizedSentSurface = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-212-patient-portal-reply-modernized-surface",
          description: "Captures the Slice 212 modernized Portal sent-folder rendering after browser-driven reply.",
          expected: {
            visibleFields: [
              "Secure message reply sent for Portal message",
              "Sent",
              "Portal message",
              replyBody
            ]
          },
          actual: {
            url: page.url(),
            title: original!.title,
            replyBody,
            modernizedSentSurface
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-reply",
            workflow: "patient-portal-reply-modernized-surface"
          }
        });
      }
    } finally {
      await workflow.cleanupPatientPortalMessageReply(portalLoginUsername, original!.title, replyBody);
    }
  });
});

async function expectLegacyPatientPortalSentMessage(page: Page, target: RuntimeTarget, title: string) {
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
  await expect(page.locator("body")).toContainText(title);
  return page.locator("body").innerText();
}
