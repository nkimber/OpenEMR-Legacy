import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal secure-message batch archive parity @slice216 @workflow-patient-portal-batch-archive @patients @portal", () => {
  test("archives multiple patient-owned secure messages together and hides them from active folders", async ({ target, targetDb, workflow }, testInfo) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-216-patient-portal-batch-archive-precondition",
      description: "Captures the Slice 216 portal secure-message batch archive precondition: the signed-in anchor patient exists for cleanup-backed selected-message archive checks.",
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
        suite: "workflow-patient-portal-batch-archive",
        workflow: "patient-portal-batch-archive-precondition"
      }
    });

    const firstTitle = "Slice 216 secure message batch archive A";
    const secondTitle = "Slice 216 secure message batch archive B";
    const firstBody = "Slice 216 temporary secure-message batch archive parity note A.";
    const secondBody = "Slice 216 temporary secure-message batch archive parity note B.";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, firstTitle);
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, secondTitle);
    let cleanupAttached = false;

    try {
      const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-216-patient-portal-batch-archive-before",
        description: "Captures the Slice 216 pre-batch-archive mailbox state after defensive cleanup and before temporary inbound message creation.",
        expected: {
          titlesAbsentFromInbox: [firstTitle, secondTitle],
          messageCountBaseline: before.messageCount
        },
        actual: {
          before,
          requestedMessages: [
            { title: firstTitle, body: firstBody },
            { title: secondTitle, body: secondBody }
          ]
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-batch-archive",
          workflow: "patient-portal-batch-archive-before"
        }
      });
      const firstMessage = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        title: firstTitle,
        body: firstBody
      });
      const secondMessage = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        title: secondTitle,
        body: secondBody
      });
      const afterCreate = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const archiveResult = await workflow.archivePatientPortalMessages(portalLoginUsername, portalPassword, [
        firstMessage.id,
        secondMessage.id
      ]);
      const afterArchive = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);

      expect(afterCreate.messageCount).toBe(before.messageCount + 2);
      expect(archiveResult).toMatchObject({
        authenticated: true,
        archived: true,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        archivedMessageCount: 2,
        messageCount: before.messageCount,
        failureReason: null
      });
      expect(archiveResult.archivedMessages.map((message) => message.title).sort()).toEqual([firstTitle, secondTitle].sort());
      expect(archiveResult.archivedMessages.every((message) => message.status === "Delete")).toBe(true);
      expect(afterArchive.messageCount).toBe(before.messageCount);
      expect(afterArchive.messages.some((message) => message.id === firstMessage.id || message.title === firstTitle)).toBe(false);
      expect(afterArchive.messages.some((message) => message.id === secondMessage.id || message.title === secondTitle)).toBe(false);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-216-patient-portal-batch-archive-result",
        description: "Captures the Slice 216 batch archive result, including two temporary inbound messages, Delete status transitions, and active-folder removal.",
        expected: {
          authenticated: true,
          archived: true,
          portalUsername: portalLoginUsername,
          pid: patient!.pid,
          archivedMessageCount: 2,
          messageCount: before.messageCount,
          archivedTitles: [firstTitle, secondTitle].sort(),
          archivedStatus: "Delete"
        },
        actual: {
          patient,
          before,
          firstMessage,
          secondMessage,
          afterCreate,
          archiveResult,
          afterArchive
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-batch-archive",
          workflow: "patient-portal-batch-archive-result"
        }
      });
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, firstTitle);
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, secondTitle);
      const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      expect(cleanup.messages.some((message) => message.title === firstTitle || message.title === secondTitle)).toBe(false);
      expect(cleanup.deletedMessages.some((message) => message.title === firstTitle || message.title === secondTitle)).toBe(false);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-216-patient-portal-batch-archive-cleanup",
        description: "Captures the Slice 216 cleanup state after removing temporary batch-archived message rows.",
        expected: {
          titlesAbsentFromInbox: [firstTitle, secondTitle],
          titlesAbsentFromDeleted: [firstTitle, secondTitle]
        },
        actual: {
          cleanup
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-batch-archive",
          workflow: "patient-portal-batch-archive-cleanup"
        }
      });
      cleanupAttached = true;
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, firstTitle);
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, secondTitle);
      if (!cleanupAttached) {
        const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-216-patient-portal-batch-archive-cleanup",
          description: "Captures the Slice 216 best-effort cleanup state after removing temporary batch-archived message rows.",
          expected: {
            titlesAbsentFromInbox: [firstTitle, secondTitle],
            titlesAbsentFromDeleted: [firstTitle, secondTitle]
          },
          actual: {
            cleanup
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-batch-archive",
            workflow: "patient-portal-batch-archive-cleanup"
          }
        });
      }
    }
  });

  test("archives selected secure messages from the patient portal surface", async ({ page, target, workflow }, testInfo) => {
    test.setTimeout(240_000);

    const firstTitle = "Slice 216 UI secure message batch archive A";
    const secondTitle = "Slice 216 UI secure message batch archive B";
    const firstBody = "Slice 216 portal UI batch archive evidence A.";
    const secondBody = "Slice 216 portal UI batch archive evidence B.";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, firstTitle);
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, secondTitle);

    try {
      await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        title: firstTitle,
        body: firstBody
      });
      await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        title: secondTitle,
        body: secondBody
      });

      if (target.type === "legacy-openemr") {
        await openLegacyPatientPortalMessages(page, target);
        await expect(page.locator("body")).toContainText(firstTitle);
        await expect(page.locator("body")).toContainText(secondTitle);
        const legacyBeforeArchiveSurface = await page.locator("body").innerText();
        await page.locator("tr", { hasText: firstTitle }).locator('input[type="checkbox"]').check();
        await page.locator("tr", { hasText: secondTitle }).locator('input[type="checkbox"]').check();
        page.once("dialog", (dialog) => void dialog.accept());
        await page.getByRole("button", { name: "Actions" }).click();
        await page.getByText("Send Selected to Archive", { exact: false }).click();
        await expect.poll(async () => {
          const messages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
          return messages.messages.some((message) => message.title === firstTitle || message.title === secondTitle);
        }).toBe(false);
        await page.getByText("Archive", { exact: false }).first().click();
        await expect(page.locator("body")).toContainText(firstTitle);
        await expect(page.locator("body")).toContainText(secondTitle);
        const legacyArchiveSurface = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-216-patient-portal-batch-archive-legacy-surface",
          description: "Captures the Slice 216 legacy patient portal selected-message archive rendering before and after Send Selected to Archive.",
          expected: {
            visibleBeforeArchive: [
              "Secure Messaging",
              firstTitle,
              secondTitle
            ],
            visibleAfterArchive: [
              "Archive",
              firstTitle,
              secondTitle
            ]
          },
          actual: {
            url: page.url(),
            firstTitle,
            secondTitle,
            firstBody,
            secondBody,
            legacyBeforeArchiveSurface,
            legacyArchiveSurface
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-batch-archive",
            workflow: "patient-portal-batch-archive-legacy-surface"
          }
        });
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        const inboxRegion = page.getByRole("region", { name: "Inbox secure messages" });
        const deletedRegion = page.getByRole("region", { name: "Deleted secure messages" });
        await expect(inboxRegion.locator("article.message-item").filter({ hasText: firstTitle })).toContainText(firstBody);
        await expect(inboxRegion.locator("article.message-item").filter({ hasText: secondTitle })).toContainText(secondBody);
        const modernizedBeforeArchiveSurface = await inboxRegion.innerText();
        await page.getByLabel(`Select secure message ${firstTitle}`).check();
        await page.getByLabel(`Select secure message ${secondTitle}`).check();
        await page.getByRole("button", { name: "Archive selected" }).click();
        await expect(page.locator("body")).toContainText("Archived 2 secure messages");
        await expect(inboxRegion.locator("article.message-item").filter({ hasText: firstTitle })).toHaveCount(0);
        await expect(inboxRegion.locator("article.message-item").filter({ hasText: secondTitle })).toHaveCount(0);
        await expect(deletedRegion.locator("article.message-item").filter({ hasText: firstTitle })).toContainText(firstBody);
        await expect(deletedRegion.locator("article.message-item").filter({ hasText: secondTitle })).toContainText(secondBody);
        const modernizedAfterArchiveSurface = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-216-patient-portal-batch-archive-modernized-surface",
          description: "Captures the Slice 216 modernized Portal selected-message archive rendering before and after browser-driven Archive selected.",
          expected: {
            visibleBeforeArchive: [
              firstTitle,
              secondTitle,
              firstBody,
              secondBody,
              "Archive selected"
            ],
            visibleAfterArchive: [
              "Archived 2 secure messages",
              "Deleted",
              firstTitle,
              secondTitle
            ],
            hiddenFromInboxAfterArchive: [
              firstTitle,
              secondTitle
            ]
          },
          actual: {
            url: page.url(),
            firstTitle,
            secondTitle,
            firstBody,
            secondBody,
            modernizedBeforeArchiveSurface,
            modernizedAfterArchiveSurface
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-batch-archive",
            workflow: "patient-portal-batch-archive-modernized-surface"
          }
        });
      }
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, firstTitle);
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, secondTitle);
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
