import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal secure-message all-folder parity @slice217 @workflow-patient-portal-all-messages @patients @portal", () => {
  test("shows active patient-owned inbox and sent messages in the all folder and removes archived rows", async ({
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-217-patient-portal-all-messages-precondition",
      description: "Captures the Slice 217 portal secure-message All-folder precondition: the signed-in anchor patient exists for cleanup-backed active and archived mailbox projection checks.",
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
        suite: "workflow-patient-portal-all-messages",
        workflow: "patient-portal-all-messages-precondition"
      }
    });

    const inboxTitle = "Slice 217 secure message all folder inbound";
    const sentTitle = "Slice 217 secure message all folder sent";
    const inboxBody = "Slice 217 temporary secure-message all-folder inbound note.";
    const sentBody = "Slice 217 temporary secure-message all-folder sent note.";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, inboxTitle);
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, sentTitle);
    let cleanupAttached = false;

    try {
      const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-217-patient-portal-all-messages-before",
        description: "Captures the Slice 217 pre-All-folder mailbox state after defensive cleanup and before temporary inbound/sent message creation.",
        expected: {
          titlesAbsentFromAll: [inboxTitle, sentTitle],
          messageCountBaseline: before.messageCount,
          sentMessageCountBaseline: before.sentMessageCount,
          allMessageCountBaseline: before.allMessageCount
        },
        actual: {
          before,
          requestedMessages: [
            { title: inboxTitle, body: inboxBody },
            { title: sentTitle, body: sentBody }
          ]
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-all-messages",
          workflow: "patient-portal-all-messages-before"
        }
      });
      const inboundMessage = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        title: inboxTitle,
        body: inboxBody
      });
      const sentMessage = await workflow.composePatientPortalMessage(portalLoginUsername, portalPassword, {
        recipientId: "admin",
        title: sentTitle,
        body: sentBody
      });
      const afterCreate = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const archiveResult = await workflow.archivePatientPortalMessages(portalLoginUsername, portalPassword, [
        inboundMessage.id
      ]);
      const afterArchive = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);

      expect(sentMessage).toMatchObject({
        authenticated: true,
        created: true,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        failureReason: null
      });
      expect(afterCreate.messageCount).toBe(before.messageCount + 1);
      expect(afterCreate.sentMessageCount).toBe(before.sentMessageCount + 1);
      expect(afterCreate.allMessageCount).toBe(before.allMessageCount + 2);
      expect(afterCreate.allMessages.map((message) => message.title)).toEqual(
        expect.arrayContaining([inboxTitle, sentTitle])
      );
      expect(archiveResult).toMatchObject({
        authenticated: true,
        archived: true,
        archivedMessageCount: 1,
        messageCount: before.messageCount,
        failureReason: null
      });
      expect(afterArchive.allMessageCount).toBe(before.allMessageCount + 1);
      expect(afterArchive.allMessages.some((message) => message.title === inboxTitle)).toBe(false);
      expect(afterArchive.allMessages.some((message) => message.title === sentTitle)).toBe(true);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-217-patient-portal-all-messages-result",
        description: "Captures the Slice 217 All-folder projection result, including active inbox/sent inclusion and archived inbound exclusion after Delete-status transition.",
        expected: {
          createdAllTitles: [inboxTitle, sentTitle],
          allMessageCountAfterCreate: before.allMessageCount + 2,
          allMessageCountAfterArchive: before.allMessageCount + 1,
          archivedTitleAbsentFromAll: inboxTitle,
          sentTitleRemainsInAll: sentTitle,
          archiveCount: 1
        },
        actual: {
          patient,
          before,
          inboundMessage,
          sentMessage,
          afterCreate,
          archiveResult,
          afterArchive
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-all-messages",
          workflow: "patient-portal-all-messages-result"
        }
      });
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, inboxTitle);
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, sentTitle);
      const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      expect(cleanup.allMessages.some((message) => message.title === inboxTitle || message.title === sentTitle)).toBe(false);
      expect(cleanup.deletedMessages.some((message) => message.title === inboxTitle || message.title === sentTitle)).toBe(false);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-217-patient-portal-all-messages-cleanup",
        description: "Captures the Slice 217 cleanup state after removing temporary active and archived All-folder rows.",
        expected: {
          titlesAbsentFromAll: [inboxTitle, sentTitle],
          titlesAbsentFromDeleted: [inboxTitle, sentTitle]
        },
        actual: {
          cleanup
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-all-messages",
          workflow: "patient-portal-all-messages-cleanup"
        }
      });
      cleanupAttached = true;
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, inboxTitle);
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, sentTitle);
      if (!cleanupAttached) {
        const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-217-patient-portal-all-messages-cleanup",
          description: "Captures the Slice 217 best-effort cleanup state after removing temporary active and archived All-folder rows.",
          expected: {
            titlesAbsentFromAll: [inboxTitle, sentTitle],
            titlesAbsentFromDeleted: [inboxTitle, sentTitle]
          },
          actual: {
            cleanup
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-all-messages",
            workflow: "patient-portal-all-messages-cleanup"
          }
        });
      }
    }
  });

  test("renders the active all folder on the patient portal surface", async ({ page, target, workflow }, testInfo) => {
    test.setTimeout(240_000);

    const inboxTitle = "Slice 217 UI secure message all folder inbound";
    const sentTitle = "Slice 217 UI secure message all folder sent";
    const inboxBody = "Slice 217 portal UI all-folder inbound evidence.";
    const sentBody = "Slice 217 portal UI all-folder sent evidence.";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, inboxTitle);
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, sentTitle);

    try {
      await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        title: inboxTitle,
        body: inboxBody
      });
      await workflow.composePatientPortalMessage(portalLoginUsername, portalPassword, {
        recipientId: "admin",
        title: sentTitle,
        body: sentBody
      });

      if (target.type === "legacy-openemr") {
        await openLegacyPatientPortalMessages(page, target);
        await page.locator('a[ng-click="isAllSelected()"]').click();
        await expect(page.locator("body")).toContainText(inboxTitle);
        await expect(page.locator("body")).toContainText(sentTitle);
        const legacyAllSurface = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-217-patient-portal-all-messages-legacy-surface",
          description: "Captures the Slice 217 legacy patient portal All-folder rendering for active inbound and sent secure messages.",
          expected: {
            visibleFields: [
              "Secure Messaging",
              inboxTitle,
              sentTitle
            ]
          },
          actual: {
            url: page.url(),
            inboxTitle,
            sentTitle,
            inboxBody,
            sentBody,
            legacyAllSurface
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-all-messages",
            workflow: "patient-portal-all-messages-legacy-surface"
          }
        });
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        const allMessages = page.getByRole("region", { name: "All secure messages" });
        await expect(allMessages.locator("article.message-item").filter({ hasText: inboxTitle })).toContainText(inboxBody);
        await expect(allMessages.locator("article.message-item").filter({ hasText: sentTitle })).toContainText(sentBody);
        const modernizedAllSurface = await allMessages.innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-217-patient-portal-all-messages-modernized-surface",
          description: "Captures the Slice 217 modernized Portal All secure messages rendering for active inbound and sent secure messages.",
          expected: {
            visibleFields: [
              "All secure messages",
              inboxTitle,
              sentTitle,
              inboxBody,
              sentBody
            ]
          },
          actual: {
            url: page.url(),
            inboxTitle,
            sentTitle,
            inboxBody,
            sentBody,
            modernizedAllSurface
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-all-messages",
            workflow: "patient-portal-all-messages-modernized-surface"
          }
        });
      }
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, inboxTitle);
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, sentTitle);
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
