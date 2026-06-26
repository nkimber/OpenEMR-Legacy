import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal secure-message read-status parity @slice215 @workflow-patient-portal-read @patients @portal", () => {
  test("marks a patient-owned secure message read and keeps it in the inbox", async ({ target, targetDb, workflow }, testInfo) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-215-patient-portal-read-precondition",
      description: "Captures the Slice 215 portal secure-message read-status precondition: the signed-in anchor patient exists for cleanup-backed inbound message checks.",
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
        suite: "workflow-patient-portal-read",
        workflow: "patient-portal-read-precondition"
      }
    });

    const title = "Slice 215 secure message read status";
    const body = "Slice 215 temporary secure-message read-status parity note.";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
    let cleanupAttached = false;

    try {
      const beforeHome = await workflow.getPatientPortalHomeSummary(portalLoginUsername, portalPassword);
      const beforeMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-215-patient-portal-read-before",
        description: "Captures the Slice 215 pre-read mailbox and home-summary state after defensive cleanup and before temporary inbound message creation.",
        expected: {
          titleAbsentFromInbox: title,
          newMessageBaseline: beforeHome.messages.newMessages,
          messageCountBaseline: beforeMessages.messageCount
        },
        actual: {
          beforeHome,
          beforeMessages,
          title,
          body
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-read",
          workflow: "patient-portal-read-before"
        }
      });
      const created = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        title,
        body
      });
      const afterCreateHome = await workflow.getPatientPortalHomeSummary(portalLoginUsername, portalPassword);
      const afterCreateMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const readResult = await workflow.readPatientPortalMessage(portalLoginUsername, portalPassword, created.id);
      const afterReadHome = await workflow.getPatientPortalHomeSummary(portalLoginUsername, portalPassword);
      const afterReadMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);

      expect(created).toMatchObject({
        title,
        body,
        status: "New",
        senderId: "admin",
        recipientId: portalLoginUsername
      });
      expect(afterCreateHome.messages.newMessages).toBe(beforeHome.messages.newMessages + 1);
      expect(afterCreateMessages.messageCount).toBe(beforeMessages.messageCount + 1);
      expect(readResult).toMatchObject({
        authenticated: true,
        markedRead: true,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        messageId: created.id,
        failureReason: null
      });
      expect(readResult.message).toMatchObject({
        id: created.id,
        title,
        body,
        status: "Read",
        senderId: "admin",
        recipientId: portalLoginUsername
      });
      expect(afterReadHome.messages.newMessages).toBe(beforeHome.messages.newMessages);
      expect(afterReadMessages.messageCount).toBe(beforeMessages.messageCount + 1);
      expect(afterReadMessages.messages.find((message) => message.id === created.id)).toMatchObject({
        title,
        status: "Read"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-215-patient-portal-read-result",
        description: "Captures the Slice 215 read-status result, including temporary inbound creation, New-to-Read transition, home new-message decrement, and inbox retention.",
        expected: {
          created: {
            title,
            body,
            status: "New",
            senderId: "admin",
            recipientId: portalLoginUsername
          },
          readResult: {
            authenticated: true,
            markedRead: true,
            portalUsername: portalLoginUsername,
            pid: patient!.pid,
            messageId: created.id,
            status: "Read"
          },
          afterReadHomeNewMessages: beforeHome.messages.newMessages,
          afterReadMessageCount: beforeMessages.messageCount + 1
        },
        actual: {
          patient,
          beforeHome,
          beforeMessages,
          created,
          afterCreateHome,
          afterCreateMessages,
          readResult,
          afterReadHome,
          afterReadMessages
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-read",
          workflow: "patient-portal-read-result"
        }
      });
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
      const cleanupMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      expect(cleanupMessages.messages.some((message) => message.title === title)).toBe(false);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-215-patient-portal-read-cleanup",
        description: "Captures the Slice 215 cleanup state after removing temporary inbound read-status rows.",
        expected: {
          titleAbsentFromInbox: title
        },
        actual: {
          cleanupMessages
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-read",
          workflow: "patient-portal-read-cleanup"
        }
      });
      cleanupAttached = true;
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
      if (!cleanupAttached) {
        const cleanupMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-215-patient-portal-read-cleanup",
          description: "Captures the Slice 215 best-effort cleanup state after removing temporary inbound read-status rows.",
          expected: {
            titleAbsentFromInbox: title
          },
          actual: {
            cleanupMessages
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-read",
            workflow: "patient-portal-read-cleanup"
          }
        });
      }
    }
  });

  test("marks a secure message read from the patient portal surface", async ({ page, target, workflow }, testInfo) => {
    test.setTimeout(240_000);

    const title = "Slice 215 UI secure message read status";
    const body = "Slice 215 portal UI read-status evidence.";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);

    try {
      const created = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        title,
        body
      });

      if (target.type === "legacy-openemr") {
        await openLegacyPatientPortalMessages(page, target);
        await expect(page.locator("body")).toContainText(title);
        const legacyBeforeReadSurface = await page.locator("body").innerText();
        await page.getByText(title).first().click();
        await expect.poll(async () => {
          const messages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
          return messages.messages.find((message) => message.id === created.id)?.status;
        }).toBe("Read");
        const afterReadMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
        const readMessage = afterReadMessages.messages.find((message) => message.id === created.id) ?? null;
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-215-patient-portal-read-legacy-surface",
          description: "Captures the Slice 215 legacy patient portal rendering and click-driven New-to-Read status transition.",
          expected: {
            visibleBeforeRead: [
              "Secure Messaging",
              title
            ],
            statusAfterClick: "Read"
          },
          actual: {
            url: page.url(),
            title,
            body,
            legacyBeforeReadSurface,
            readMessage
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-read",
            workflow: "patient-portal-read-legacy-surface"
          }
        });
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        const inboxRegion = page.getByRole("region", { name: "Inbox secure messages" });
        const card = inboxRegion.locator("article.message-item").filter({ hasText: title }).first();
        await expect(card).toContainText(body);
        await expect(card.locator(".status-pill")).toContainText("New");
        const modernizedBeforeReadSurface = await card.innerText();
        await card.getByRole("button", { name: "Mark read" }).click();
        await expect(page.locator("body")).toContainText(`Secure message marked read for ${title}`);
        await expect(inboxRegion.locator("article.message-item").filter({ hasText: title }).locator(".status-pill")).toContainText("Read");
        const modernizedAfterReadSurface = await inboxRegion.locator("article.message-item").filter({ hasText: title }).first().innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-215-patient-portal-read-modernized-surface",
          description: "Captures the Slice 215 modernized Portal read-status rendering before and after browser-driven Mark read action.",
          expected: {
            visibleBeforeRead: [
              title,
              body,
              "New",
              "Mark read"
            ],
            visibleAfterRead: [
              `Secure message marked read for ${title}`,
              title,
              body,
              "Read"
            ]
          },
          actual: {
            url: page.url(),
            title,
            body,
            modernizedBeforeReadSurface,
            modernizedAfterReadSurface
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-read",
            workflow: "patient-portal-read-modernized-surface"
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
