import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal secure-message archive parity @slice214 @workflow-patient-portal-delete @patients @portal", () => {
  test("archives a patient-owned sent secure message and hides it from active folders", async ({ target, targetDb, workflow }, testInfo) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-214-patient-portal-delete-precondition",
      description: "Captures the Slice 214 portal secure-message archive precondition: the signed-in anchor patient exists for cleanup-backed sent-message archive checks.",
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
        suite: "workflow-patient-portal-delete",
        workflow: "patient-portal-delete-precondition"
      }
    });

    const title = "Slice 214 secure message archive";
    const body = "Slice 214 temporary secure-message archive parity note.";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
    let cleanupAttached = false;

    try {
      const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-214-patient-portal-delete-before",
        description: "Captures the Slice 214 pre-archive mailbox state after defensive cleanup and before temporary sent-message creation.",
        expected: {
          titleAbsentFromSent: title,
          titleAbsentFromDeleted: title
        },
        actual: {
          before,
          title,
          body
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-delete",
          workflow: "patient-portal-delete-before"
        }
      });
      const created = await workflow.composePatientPortalMessage(portalLoginUsername, portalPassword, {
        recipientId: "admin",
        title,
        body
      });
      expect(created.sentMessage).toBeTruthy();

      const afterCreate = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const deleteResult = await workflow.deletePatientPortalMessage(portalLoginUsername, portalPassword, created.sentMessage!.id);
      const afterDelete = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);

      expect(deleteResult).toMatchObject({
        authenticated: true,
        deleted: true,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        messageId: created.sentMessage!.id,
        deletedMessageCount: 1,
        messageCount: before.messageCount,
        sentMessageCount: before.sentMessageCount,
        failureReason: null
      });
      expect(deleteResult.deletedMessage).toMatchObject({
        id: created.sentMessage!.id,
        title,
        body,
        status: "Delete",
        senderId: portalLoginUsername,
        recipientId: "admin"
      });
      expect(afterCreate.sentMessageCount).toBe(before.sentMessageCount + 1);
      expect(afterDelete.messageCount).toBe(before.messageCount);
      expect(afterDelete.sentMessageCount).toBe(before.sentMessageCount);
      expect(afterDelete.sentMessages.some((message) => message.id === created.sentMessage!.id || message.title === title)).toBe(false);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-214-patient-portal-delete-result",
        description: "Captures the Slice 214 archive result, including temporary sent-message creation, Delete status transition, active-folder removal, and deleted-folder count.",
        expected: {
          authenticated: true,
          deleted: true,
          portalUsername: portalLoginUsername,
          pid: patient!.pid,
          messageId: created.sentMessage!.id,
          deletedMessageCount: 1,
          messageCount: before.messageCount,
          sentMessageCount: before.sentMessageCount,
          deletedMessage: {
            id: created.sentMessage!.id,
            title,
            body,
            status: "Delete",
            senderId: portalLoginUsername,
            recipientId: "admin"
          }
        },
        actual: {
          patient,
          before,
          created,
          afterCreate,
          deleteResult,
          afterDelete
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-delete",
          workflow: "patient-portal-delete-result"
        }
      });
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
      const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      expect(cleanup.sentMessages.some((message) => message.title === title)).toBe(false);
      expect(cleanup.deletedMessages.some((message) => message.title === title)).toBe(false);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-214-patient-portal-delete-cleanup",
        description: "Captures the Slice 214 cleanup state after removing the temporary archived sent-message rows.",
        expected: {
          titleAbsentFromSent: title,
          titleAbsentFromDeleted: title
        },
        actual: {
          cleanup
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-delete",
          workflow: "patient-portal-delete-cleanup"
        }
      });
      cleanupAttached = true;
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
      if (!cleanupAttached) {
        const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-214-patient-portal-delete-cleanup",
          description: "Captures the Slice 214 best-effort cleanup state after removing temporary archived sent-message rows.",
          expected: {
            titleAbsentFromSent: title,
            titleAbsentFromDeleted: title
          },
          actual: {
            cleanup
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-delete",
            workflow: "patient-portal-delete-cleanup"
          }
        });
      }
    }
  });

  test("archives a secure message from the patient portal surface", async ({ page, target, workflow }, testInfo) => {
    test.setTimeout(240_000);

    const title = "Slice 214 UI secure message archive";
    const body = "Slice 214 portal UI archive evidence.";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);

    try {
      const created = await workflow.composePatientPortalMessage(portalLoginUsername, portalPassword, {
        recipientId: "admin",
        title,
        body
      });
      expect(created.sentMessage).toBeTruthy();

      if (target.type === "legacy-openemr") {
        const legacySentSurface = await expectLegacyPatientPortalSentMessage(page, target, title);
        await workflow.deletePatientPortalMessage(portalLoginUsername, portalPassword, created.sentMessage!.id);
        const legacyArchiveSurface = await expectLegacyPatientPortalArchivedMessage(page, target, title);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-214-patient-portal-delete-legacy-surface",
          description: "Captures the Slice 214 legacy patient portal Sent-folder removal and Archive-folder rendering after a cleanup-backed archive.",
          expected: {
            visibleBeforeArchive: [
              "Secure Messaging",
              "Sent",
              title
            ],
            visibleAfterArchive: [
              "Archive",
              title
            ]
          },
          actual: {
            url: page.url(),
            title,
            body,
            legacySentSurface,
            legacyArchiveSurface
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-delete",
            workflow: "patient-portal-delete-legacy-surface"
          }
        });
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        const sentRegion = page.getByRole("region", { name: "Sent secure messages" });
        const deletedRegion = page.getByRole("region", { name: "Deleted secure messages" });
        const card = sentRegion.locator("article.message-item").filter({ hasText: title }).first();
        await expect(card).toContainText(body);
        const modernizedBeforeArchiveSurface = await card.innerText();
        await card.getByRole("button", { name: "Archive message" }).click();
        await expect(page.locator("body")).toContainText(`Secure message archived for ${title}`);
        await expect(sentRegion.locator("article.message-item").filter({ hasText: title })).toHaveCount(0);
        await expect(deletedRegion.locator("article.message-item").filter({ hasText: title })).toContainText(body);
        const modernizedAfterArchiveSurface = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-214-patient-portal-delete-modernized-surface",
          description: "Captures the Slice 214 modernized Portal archive rendering before and after browser-driven Archive message action.",
          expected: {
            visibleBeforeArchive: [
              title,
              body,
              "Archive message"
            ],
            visibleAfterArchive: [
              `Secure message archived for ${title}`,
              "Deleted",
              title,
              body
            ],
            hiddenFromSentAfterArchive: [
              title
            ]
          },
          actual: {
            url: page.url(),
            title,
            body,
            modernizedBeforeArchiveSurface,
            modernizedAfterArchiveSurface
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-delete",
            workflow: "patient-portal-delete-modernized-surface"
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

async function expectLegacyPatientPortalSentMessage(page: Page, target: RuntimeTarget, title: string) {
  await openLegacyPatientPortalMessages(page, target);
  await page.getByText("Sent", { exact: false }).first().click();
  await expect(page.locator("body")).toContainText(title);
  return page.locator("body").innerText();
}

async function expectLegacyPatientPortalArchivedMessage(page: Page, target: RuntimeTarget, title: string) {
  await openLegacyPatientPortalMessages(page, target);
  await page.getByText("Sent", { exact: false }).first().click();
  await expect(page.locator("body")).not.toContainText(title);
  await page.getByText("Archive", { exact: false }).first().click();
  await expect(page.locator("body")).toContainText(title);
  return page.locator("body").innerText();
}
