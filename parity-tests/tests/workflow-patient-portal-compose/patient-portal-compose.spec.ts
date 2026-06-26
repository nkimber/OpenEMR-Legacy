import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal secure-message compose parity @slice211 @workflow-patient-portal-compose @patients @portal", () => {
  test("creates a patient-owned sent secure message", async ({ target, targetDb, workflow }, testInfo) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-211-patient-portal-compose-precondition",
      description: "Captures the Slice 211 portal secure-message compose precondition: the signed-in anchor patient exists for cleanup-backed sent-message checks.",
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
        suite: "workflow-patient-portal-compose",
        workflow: "patient-portal-compose-precondition"
      }
    });

    const title = "Slice 211 secure message compose";
    const body = "Please review this Slice 211 secure-message compose parity note.";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
    let cleanupAttached = false;

    try {
      const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-211-patient-portal-compose-before",
        description: "Captures the Slice 211 pre-compose portal mailbox state after defensive cleanup and before creating the sent message.",
        expected: {
          titleAbsentFromSent: title,
          sentMessageCount: before.sentMessageCount
        },
        actual: {
          before,
          title
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-compose",
          workflow: "patient-portal-compose-before"
        }
      });
      const result = await workflow.composePatientPortalMessage(portalLoginUsername, portalPassword, {
        recipientId: "admin",
        title,
        body
      });
      const after = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const sentMessage = after.sentMessages.find((message) => message.title === title);

      expect(result).toMatchObject({
        authenticated: true,
        created: true,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        recipientId: "admin",
        messageCount: before.messageCount,
        sentMessageCount: before.sentMessageCount + 1,
        failureReason: null
      });
      expect(result.sentMessage).toMatchObject({
        title,
        body,
        status: "New",
        senderId: portalLoginUsername,
        recipientId: "admin",
        isEncrypted: false
      });
      expect(result.recipientMessage).toMatchObject({
        title,
        body,
        status: "New",
        senderId: portalLoginUsername,
        recipientId: "admin"
      });
      expect(after.messageCount).toBe(before.messageCount);
      expect(after.sentMessageCount).toBe(before.sentMessageCount + 1);
      expect(sentMessage).toMatchObject({
        body,
        status: "New",
        senderId: portalLoginUsername,
        recipientId: "admin"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-211-patient-portal-compose-result",
        description: "Captures the Slice 211 secure-message compose result, including patient-owned sent copy and practice-recipient copy facts.",
        expected: {
          authenticated: true,
          created: true,
          portalUsername: portalLoginUsername,
          pid: patient!.pid,
          recipientId: "admin",
          title,
          body,
          messageCount: before.messageCount,
          sentMessageCount: before.sentMessageCount + 1,
          sentMessage: {
            title,
            body,
            status: "New",
            senderId: portalLoginUsername,
            recipientId: "admin",
            isEncrypted: false
          },
          recipientMessage: {
            title,
            body,
            status: "New",
            senderId: portalLoginUsername,
            recipientId: "admin"
          }
        },
        actual: {
          patient,
          before,
          result,
          after,
          sentMessage
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-compose",
          workflow: "patient-portal-compose-result"
        }
      });
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
      const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const cleanupSentMessage = cleanup.sentMessages.find((message) => message.title === title) ?? null;
      expect(cleanupSentMessage).toBeNull();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-211-patient-portal-compose-cleanup",
        description: "Captures the Slice 211 cleanup state after removing temporary patient-owned sent and practice-recipient mailbox rows.",
        expected: {
          titleAbsentFromSent: title,
          sentMessageCount: before.sentMessageCount
        },
        actual: {
          cleanup,
          cleanupSentMessage
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-compose",
          workflow: "patient-portal-compose-cleanup"
        }
      });
      cleanupAttached = true;
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
      if (!cleanupAttached) {
        const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-211-patient-portal-compose-cleanup",
          description: "Captures the Slice 211 best-effort cleanup state after removing temporary patient-owned sent and practice-recipient mailbox rows.",
          expected: {
            titleAbsentFromSent: title
          },
          actual: {
            cleanup
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-compose",
            workflow: "patient-portal-compose-cleanup"
          }
        });
      }
    }
  });

  test("shows the composed message on the patient portal sent surface", async ({ page, target, workflow }, testInfo) => {
    test.setTimeout(240_000);

    const title = "Slice 211 UI secure message";
    const body = "Modernized and legacy portal sent-folder evidence for Slice 211.";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);

    try {
      if (target.type === "legacy-openemr") {
        await workflow.composePatientPortalMessage(portalLoginUsername, portalPassword, {
          recipientId: "admin",
          title,
          body
        });
        const legacySentSurface = await expectLegacyPatientPortalSentMessage(page, target, title);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-211-patient-portal-compose-legacy-surface",
          description: "Captures the Slice 211 legacy patient portal Sent-folder rendering after cleanup-backed compose.",
          expected: {
            urlIncludes: "/portal/messaging/messages.php",
            visibleFields: [
              "Secure Messaging",
              "Sent",
              title
            ]
          },
          actual: {
            url: page.url(),
            title,
            legacySentSurface
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-compose",
            workflow: "patient-portal-compose-legacy-surface"
          }
        });
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        await page.getByLabel("Secure message recipient").selectOption("admin");
        await page.getByLabel("Secure message subject").fill(title);
        await page.getByLabel("Secure message body").fill(body);
        await page.getByRole("button", { name: "Send secure message" }).click();
        await expect(page.locator("body")).toContainText("Secure message sent to");
        await expect(page.locator("body")).toContainText("Sent");
        await expect(page.locator("body")).toContainText(title);
        await expect(page.locator("body")).toContainText(body);
        const modernizedSentSurface = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-211-patient-portal-compose-modernized-surface",
          description: "Captures the Slice 211 modernized Portal sent-folder rendering after browser-driven compose.",
          expected: {
            visibleFields: [
              "Secure message sent to",
              "Sent",
              title,
              body
            ]
          },
          actual: {
            url: page.url(),
            title,
            body,
            modernizedSentSurface
          },
          context: {
            canonicalId: portalMessageAnchorPatientId,
            suite: "workflow-patient-portal-compose",
            workflow: "patient-portal-compose-modernized-surface"
          }
        });
      }
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
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
