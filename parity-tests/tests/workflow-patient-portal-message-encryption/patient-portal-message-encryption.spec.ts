import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import { protectedPatientPortalMessageBody } from "../../src/workflows/legacyWorkflowActions.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const encryptedTitle = "Slice 233 encrypted secure message";
const encryptedBody = "Synthetic encrypted secure-message body should not be portal-visible.";

test.describe("patient portal secure-message encrypted body parity @slice233 @workflow-patient-portal-message-encryption @patients @portal", () => {
  test("protects encrypted secure-message bodies in API and portal UI", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-233-patient-portal-message-encryption-precondition",
      description: "Captures the Slice 233 encrypted secure-message precondition: the signed-in anchor patient exists before a temporary encrypted inbox message is created.",
      expected: {
        canonicalId: portalMessageAnchorPatientId,
        portalUsername: portalLoginUsername,
        encryptedTitle,
        rawBodyMustNotRender: encryptedBody,
        protectedBody: protectedPatientPortalMessageBody
      },
      actual: {
        canonicalId: portalMessageAnchorPatientId,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        portalUsername: portalLoginUsername
      },
      context: {
        suite: "workflow-patient-portal-message-encryption",
        workflow: "patient-portal-secure-message-encryption-precondition"
      }
    });

    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, encryptedTitle);

    try {
      const created = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        title: encryptedTitle,
        body: encryptedBody,
        senderId: "admin",
        senderName: "Administrator",
        isEncrypted: true
      });
      expect(created).toMatchObject({
        title: encryptedTitle,
        body: protectedPatientPortalMessageBody,
        isEncrypted: true
      });

      const portalMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      expect(portalMessages).toMatchObject({
        authenticated: true,
        username: portalLoginUsername,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        failureReason: null
      });

      const encryptedMessage = portalMessages.messages.find((message) => message.title === encryptedTitle);
      expect(encryptedMessage).toBeDefined();
      expect(encryptedMessage).toMatchObject({
        title: encryptedTitle,
        body: protectedPatientPortalMessageBody,
        status: "New",
        senderId: "admin",
        senderName: "Administrator",
        recipientId: portalLoginUsername,
        isEncrypted: true
      });
      expect(encryptedMessage?.body).not.toContain(encryptedBody);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-233-patient-portal-message-encryption-result",
        description: "Captures the Slice 233 protected encrypted-message projection after creating a temporary encrypted inbox row and reading portal mailbox messages.",
        expected: {
          encryptedTitle,
          protectedBody: protectedPatientPortalMessageBody,
          rawBodyMustNotRender: encryptedBody,
          status: "New",
          senderId: "admin",
          senderName: "Administrator",
          isEncrypted: true
        },
        actual: {
          created: summarizeEncryptedMessage(created),
          portalIdentity: {
            authenticated: portalMessages.authenticated,
            username: portalMessages.username,
            portalUsername: portalMessages.portalUsername,
            pid: portalMessages.pid,
            pubpid: portalMessages.pubpid,
            displayName: portalMessages.displayName,
            failureReason: portalMessages.failureReason
          },
          messageCount: portalMessages.messages.length,
          encryptedMessage: encryptedMessage ? summarizeEncryptedMessage(encryptedMessage) : null,
          containsFacts: {
            protectedBodyReturned: encryptedMessage?.body === protectedPatientPortalMessageBody,
            rawBodyHidden: !(encryptedMessage?.body ?? "").includes(encryptedBody),
            encryptedFlag: encryptedMessage?.isEncrypted === true
          }
        },
        context: {
          suite: "workflow-patient-portal-message-encryption",
          workflow: "patient-portal-secure-message-encryption-result"
        }
      });

      if (target.type === "legacy-openemr") {
        const legacyUi = await expectLegacyEncryptedMessage(page, target, portalLoginUsername, portalPassword);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-233-patient-portal-message-encryption-legacy-ui",
          description: "Captures the legacy Secure Messaging portal surface for the temporary encrypted inbox message while the workflow adapter normalizes the protected body placeholder.",
          expected: {
            visibleFacts: ["Secure Messaging", "Inbox", encryptedTitle],
            protectedBody: protectedPatientPortalMessageBody,
            rawBodyMustNotRender: encryptedBody
          },
          actual: {
            selectedMessage: encryptedMessage ? summarizeEncryptedMessage(encryptedMessage) : null,
            legacyUi
          },
          context: {
            suite: "workflow-patient-portal-message-encryption",
            workflow: "patient-portal-secure-message-encryption-legacy-ui"
          }
        });
      } else {
        const modernizedUi = await expectModernizedEncryptedMessage(page, target);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-233-patient-portal-message-encryption-modernized-ui",
          description: "Captures the modernized Portal encrypted-message rendering, including protected placeholder visibility and raw synthetic body non-disclosure.",
          expected: {
            visibleFacts: ["Secure Messages", encryptedTitle, "Encrypted message", protectedPatientPortalMessageBody],
            rawBodyMustNotRender: encryptedBody
          },
          actual: {
            selectedMessage: encryptedMessage ? summarizeEncryptedMessage(encryptedMessage) : null,
            modernizedUi
          },
          context: {
            suite: "workflow-patient-portal-message-encryption",
            workflow: "patient-portal-secure-message-encryption-modernized-ui"
          }
        });
      }
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, encryptedTitle);
    }
  });
});

function summarizeEncryptedMessage(message: any) {
  return {
    id: message.id,
    title: message.title,
    body: message.body,
    status: message.status,
    senderId: message.senderId,
    senderName: message.senderName,
    recipientId: message.recipientId,
    recipientName: message.recipientName,
    isEncrypted: message.isEncrypted,
    containsRawBody: typeof message.body === "string" ? message.body.includes(encryptedBody) : false,
    bodyIsProtectedPlaceholder: message.body === protectedPatientPortalMessageBody
  };
}

async function expectLegacyEncryptedMessage(page: Page, target: RuntimeTarget, username: string, password: string) {
  await page.context().clearCookies();
  await page.goto(`${target.publicUrl}/portal/index.php?site=default&woops=1`);
  await page.locator("#uname").fill(username);
  await page.locator("#pass").fill(password);

  const emailConfirmation = page.locator("#passaddon");
  if ((await emailConfirmation.count()) > 0 && await emailConfirmation.isVisible()) {
    await emailConfirmation.fill(username);
  }

  await page.getByRole("button", { name: "Log In" }).click();
  await expect.poll(() => page.url()).toContain("/portal/home.php");
  await page.goto(`${target.publicUrl}/portal/messaging/messages.php`);
  await expectRenderedText(page, /Secure Messaging/i);
  await expectRenderedText(page, /Inbox/i);
  await expect(page.locator("body")).toContainText(encryptedTitle);
  const bodyText = await page.locator("body").innerText();
  return {
    portalUrl: page.url(),
    bodyTextLength: bodyText.length,
    containsFacts: {
      secureMessaging: /Secure Messaging/i.test(bodyText),
      inbox: /Inbox/i.test(bodyText),
      encryptedTitle: bodyText.includes(encryptedTitle)
    }
  };
}

async function expectModernizedEncryptedMessage(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const body = page.locator("body");
  await expect(body).toContainText("Secure Messages");
  await expect(body).toContainText(encryptedTitle);
  await expect(body).toContainText("Encrypted message");
  await expect(body).toContainText(protectedPatientPortalMessageBody);
  await expect(body).not.toContainText(encryptedBody);
  const bodyText = await body.innerText();
  return {
    portalUrl: page.url(),
    bodyTextLength: bodyText.length,
    containsFacts: {
      secureMessages: bodyText.includes("Secure Messages"),
      encryptedTitle: bodyText.includes(encryptedTitle),
      encryptedLabel: bodyText.includes("Encrypted message"),
      protectedBody: bodyText.includes(protectedPatientPortalMessageBody),
      rawBodyHidden: !bodyText.includes(encryptedBody)
    }
  };
}
