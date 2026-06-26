import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal secure-message thread parity @slice213 @workflow-patient-portal-thread @patients @portal", () => {
  test("loads a chronological secure-message thread around a portal inbox message", async ({ target, targetDb, workflow }, testInfo) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-213-patient-portal-thread-precondition",
      description: "Captures the Slice 213 portal secure-message thread precondition: the signed-in anchor patient exists for cleanup-backed chronological thread checks.",
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
        suite: "workflow-patient-portal-thread",
        workflow: "patient-portal-thread-precondition"
      }
    });

    const replyBody = "Slice 213 thread view reply body.";
    const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
    const original = before.messages.find((message) => message.title === "Portal message");
    expect(original).toBeTruthy();

    await workflow.cleanupPatientPortalMessageReply(portalLoginUsername, original!.title, replyBody);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-213-patient-portal-thread-before",
      description: "Captures the Slice 213 seeded inbox anchor and pre-reply mailbox state after defensive cleanup.",
      expected: {
        originalMessage: {
          title: "Portal message",
          body: "Patient portal question about medications."
        },
        replyBodyAbsentFromThread: replyBody
      },
      actual: {
        before,
        original,
        replyBody
      },
      context: {
        canonicalId: portalMessageAnchorPatientId,
        suite: "workflow-patient-portal-thread",
        workflow: "patient-portal-thread-before"
      }
    });
    let cleanupAttached = false;

    try {
      await workflow.replyToPatientPortalMessage(portalLoginUsername, portalPassword, original!.id, {
        body: replyBody
      });
      const thread = await workflow.getPatientPortalMessageThread(portalLoginUsername, portalPassword, original!.id);

      expect(thread).toMatchObject({
        authenticated: true,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        messageId: original!.id,
        threadId: original!.replyMailChain,
        threadMessageCount: 2,
        failureReason: null
      });
      expect(thread.anchorMessage).toMatchObject({
        id: original!.id,
        title: "Portal message",
        body: "Patient portal question about medications."
      });
      expect(thread.threadMessages.map((message) => message.body)).toEqual([
        "Patient portal question about medications.",
        replyBody
      ]);
      expect(thread.threadMessages[0]).toMatchObject({
        id: original!.id,
        senderId: original!.senderId,
        recipientId: portalLoginUsername,
        replyMailChain: original!.replyMailChain
      });
      expect(thread.threadMessages[1]).toMatchObject({
        title: original!.title,
        body: replyBody,
        senderId: portalLoginUsername,
        replyMailChain: original!.replyMailChain
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-213-patient-portal-thread-result",
        description: "Captures the Slice 213 chronological secure-message thread result after a cleanup-backed portal reply.",
        expected: {
          authenticated: true,
          portalUsername: portalLoginUsername,
          pid: patient!.pid,
          messageId: original!.id,
          threadId: original!.replyMailChain,
          threadMessageCount: 2,
          anchorMessage: {
            id: original!.id,
            title: "Portal message",
            body: "Patient portal question about medications."
          },
          threadMessageBodies: [
            "Patient portal question about medications.",
            replyBody
          ]
        },
        actual: {
          patient,
          before,
          original,
          thread,
          replyBody
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-thread",
          workflow: "patient-portal-thread-result"
        }
      });
      await workflow.cleanupPatientPortalMessageReply(portalLoginUsername, original!.title, replyBody);
      const cleanup = await workflow.getPatientPortalMessageThread(portalLoginUsername, portalPassword, original!.id);
      expect(cleanup.threadMessages.map((message) => message.body)).toEqual([
        "Patient portal question about medications."
      ]);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-213-patient-portal-thread-cleanup",
        description: "Captures the Slice 213 cleanup state after removing temporary patient-owned sent and practice-recipient reply rows from the thread.",
        expected: {
          threadMessageCount: 1,
          threadMessageBodies: [
            "Patient portal question about medications."
          ],
          replyBodyAbsentFromThread: replyBody
        },
        actual: {
          cleanup
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-thread",
          workflow: "patient-portal-thread-cleanup"
        }
      });
      cleanupAttached = true;
    } finally {
      await workflow.cleanupPatientPortalMessageReply(portalLoginUsername, original!.title, replyBody);
      if (!cleanupAttached) {
        const cleanup = await workflow.getPatientPortalMessageThread(portalLoginUsername, portalPassword, original!.id);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-213-patient-portal-thread-cleanup",
          description: "Captures the Slice 213 best-effort cleanup state after removing temporary patient-owned sent and practice-recipient reply rows from the thread.",
          expected: {
            replyBodyAbsentFromThread: replyBody
          },
          actual: {
            cleanup
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-thread",
            workflow: "patient-portal-thread-cleanup"
          }
        });
      }
    }
  });

  test("shows a secure-message thread on the patient portal surface", async ({ page, target, workflow }, testInfo) => {
    test.setTimeout(240_000);

    const replyBody = "Slice 213 portal UI thread body.";
    const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
    const original = before.messages.find((message) => message.title === "Portal message");
    expect(original).toBeTruthy();
    await workflow.cleanupPatientPortalMessageReply(portalLoginUsername, original!.title, replyBody);

    try {
      await workflow.replyToPatientPortalMessage(portalLoginUsername, portalPassword, original!.id, {
        body: replyBody
      });

      if (target.type === "legacy-openemr") {
        const legacyThreadSurface = await expectLegacyPatientPortalMessageSurfaces(page, target, original!.title);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-213-patient-portal-thread-legacy-surface",
          description: "Captures the Slice 213 legacy patient portal mailbox/thread-adjacent rendering after a cleanup-backed reply.",
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
            legacyThreadSurface
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-thread",
            workflow: "patient-portal-thread-legacy-surface"
          }
        });
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        const card = page.locator("article.message-item").filter({ hasText: "Patient portal question about medications." }).first();
        await card.getByRole("button", { name: "View thread" }).click();
        await expect(card).toContainText(`Thread ${original!.replyMailChain}`);
        await expect(card).toContainText("2 messages");
        await expect(card).toContainText("Care team message");
        await expect(card).toContainText("Patient reply");
        await expect(card).toContainText(replyBody);
        const modernizedThreadSurface = await card.innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-213-patient-portal-thread-modernized-surface",
          description: "Captures the Slice 213 modernized Portal secure-message thread rendering after browser-visible expansion.",
          expected: {
            visibleFields: [
              `Thread ${original!.replyMailChain}`,
              "2 messages",
              "Care team message",
              "Patient reply",
              replyBody
            ]
          },
          actual: {
            url: page.url(),
            title: original!.title,
            replyBody,
            modernizedThreadSurface
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-thread",
            workflow: "patient-portal-thread-modernized-surface"
          }
        });
      }
    } finally {
      await workflow.cleanupPatientPortalMessageReply(portalLoginUsername, original!.title, replyBody);
    }
  });
});

async function expectLegacyPatientPortalMessageSurfaces(page: Page, target: RuntimeTarget, title: string) {
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
  await expect(page.locator("body")).toContainText(title);
  await page.getByText("Sent", { exact: false }).first().click();
  await expect(page.locator("body")).toContainText(title);
  return page.locator("body").innerText();
}
