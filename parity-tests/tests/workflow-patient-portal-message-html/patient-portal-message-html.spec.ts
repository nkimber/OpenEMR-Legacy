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
const htmlBody =
  '<p>Slice 240 <strong>bold portal guidance</strong> before <a href="https://example.test">external link text</a><img src=x alt="blocked image"> after image.</p>';

test.describe("patient portal secure-message HTML body rendering parity @slice240 @workflow-patient-portal-message-html @patients @portal @messages", () => {
  test("preserves raw secure-message HTML bodies at the workflow boundary", async ({ target, targetDb, workflow }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    const title = "Slice 240 secure message HTML body API";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-240-patient-portal-message-html-precondition",
      description: "Captures the Slice 240 HTML-body precondition: the signed-in portal anchor patient exists before a cleanup-backed HTML secure message is created.",
      expected: {
        canonicalId: portalMessageAnchorPatientId,
        portalUsername: portalLoginUsername,
        title,
        htmlFacts: ["strong", "a href", "img", "blocked image"]
      },
      actual: {
        canonicalId: portalMessageAnchorPatientId,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        portalUsername: portalLoginUsername
      },
      context: {
        suite: "workflow-patient-portal-message-html",
        workflow: "patient-portal-message-html-precondition"
      }
    });
    let cleanupAttached = false;

    try {
      const created = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        title,
        body: htmlBody,
        senderId: "admin",
        senderName: "Administrator"
      });
      expect(created).toMatchObject({
        title,
        body: htmlBody,
        status: "New",
        senderId: "admin",
        senderName: "Administrator",
        recipientId: portalLoginUsername,
        isEncrypted: false
      });

      const portalMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const rawMessage = portalMessages.messages.find((message) => message.title === title);
      expect(rawMessage).toBeDefined();
      expect(rawMessage).toMatchObject({
        title,
        body: htmlBody,
        status: "New",
        senderId: "admin",
        senderName: "Administrator",
        recipientId: portalLoginUsername,
        isEncrypted: false
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-240-patient-portal-message-html-raw-body",
        description: "Captures the Slice 240 raw-body workflow result: the temporary secure-message row preserves HTML markup at the workflow/API boundary before UI sanitization.",
        expected: {
          title,
          body: htmlBody,
          status: "New",
          senderId: "admin",
          senderName: "Administrator",
          recipientId: portalLoginUsername,
          isEncrypted: false,
          rawHtmlPreserved: true
        },
        actual: {
          created: summarizePortalMessage(created),
          rawMessage: rawMessage ? summarizePortalMessage(rawMessage) : null,
          bodyFacts: summarizeHtmlBody(rawMessage?.body ?? "")
        },
        context: {
          suite: "workflow-patient-portal-message-html",
          workflow: "patient-portal-message-html-raw-body"
        }
      });
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
      const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-240-patient-portal-message-html-cleanup",
        description: "Captures the Slice 240 cleanup state after removing the temporary raw-HTML secure-message row.",
        expected: {
          titleAbsentFromInbox: title,
          titleAbsentFromAll: title
        },
        actual: summarizeMailbox(cleanup, title),
        context: {
          suite: "workflow-patient-portal-message-html",
          workflow: "patient-portal-message-html-cleanup"
        }
      });
      cleanupAttached = true;
    }
    expect(cleanupAttached).toBe(true);
  });

  test("renders formatted secure-message bodies without links or images", async ({ page, target, workflow }, testInfo) => {
    test.setTimeout(240_000);

    const title = "Slice 240 secure message HTML body UI";
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);

    try {
      const created = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        title,
        body: htmlBody,
        senderId: "admin",
        senderName: "Administrator"
      });

      if (target.type === "legacy-openemr") {
        const legacyUi = await expectLegacySanitizedMessageBody(page, target, title);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-240-patient-portal-message-html-legacy-ui",
          description: "Captures the legacy patient portal secure-message detail rendering for sanitized HTML body content.",
          expected: {
            visibleFacts: ["bold portal guidance", "external link text", "after image."],
            allowedMarkup: ["strong"],
            strippedMarkup: ["a", "img"],
            hiddenText: ["blocked image"]
          },
          actual: {
            created: summarizePortalMessage(created),
            legacyUi
          },
          context: {
            suite: "workflow-patient-portal-message-html",
            workflow: "patient-portal-message-html-legacy-ui"
          }
        });
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        const card = page.locator("article.message-item").filter({ hasText: title }).first();
        await expect(card).toContainText("bold portal guidance");
        await expect(card).toContainText("external link text");
        await expect(card).toContainText("after image.");

        const body = card.locator(".secure-message-body").first();
        await expect(body.locator("strong").filter({ hasText: "bold portal guidance" })).toBeVisible();
        await expect(body.locator("a")).toHaveCount(0);
        await expect(body.locator("img")).toHaveCount(0);
        await expect(card).not.toContainText("<strong>");
        await expect(card).not.toContainText("<a href");
        await expect(card).not.toContainText("blocked image");
        const modernizedUi = await captureModernizedSanitizedMessageBody(page, title);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-240-patient-portal-message-html-modernized-ui",
          description: "Captures the modernized Portal secure-message card rendering for sanitized HTML body content.",
          expected: {
            visibleFacts: ["bold portal guidance", "external link text", "after image."],
            allowedMarkup: ["strong"],
            strippedMarkup: ["a", "img"],
            hiddenText: ["blocked image"]
          },
          actual: {
            created: summarizePortalMessage(created),
            modernizedUi
          },
          context: {
            suite: "workflow-patient-portal-message-html",
            workflow: "patient-portal-message-html-modernized-ui"
          }
        });
      }
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
    }
  });
});

async function expectLegacySanitizedMessageBody(page: Page, target: RuntimeTarget, title: string) {
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
  await page.getByText(title, { exact: true }).first().click();

  const detail = page.locator(".jumbotron").filter({ hasText: "bold portal guidance" }).first();
  await expect(detail).toBeVisible();
  await expect(detail).toContainText("external link text");
  await expect(detail).toContainText("after image.");

  const body = detail.locator("[ng-bind-html]").first();
  const renderedHtml = await body.evaluate((element) => element.innerHTML);
  expect(renderedHtml).toContain("<strong>bold portal guidance</strong>");
  expect(renderedHtml).not.toContain("<a");
  expect(renderedHtml).not.toContain("<img");
  expect(renderedHtml).not.toContain("blocked image");
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    bodyText: normalizeText(await detail.textContent()),
    renderedHtml,
    bodyFacts: summarizeHtmlBody(renderedHtml),
    containsSecureMessaging: await page.locator("body").evaluate((bodyElement) =>
      bodyElement.textContent?.includes("Secure Messaging") ?? false
    )
  };
}

async function captureModernizedSanitizedMessageBody(page: Page, title: string) {
  const card = page.locator("article.message-item").filter({ hasText: title }).first();
  const body = card.locator(".secure-message-body").first();
  const renderedHtml = await body.evaluate((element) => element.innerHTML);
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    cardText: normalizeText(await card.textContent()),
    renderedHtml,
    bodyFacts: summarizeHtmlBody(renderedHtml),
    containsSecureMessages: await page.locator("body").evaluate((bodyElement) =>
      bodyElement.textContent?.includes("Secure Messages") ?? false
    )
  };
}

function summarizePortalMessage(message: PatientPortalMessageItem) {
  return {
    id: message.id,
    type: message.type,
    date: message.date,
    title: message.title,
    body: message.body,
    status: message.status,
    assignedTo: message.assignedTo,
    senderId: message.senderId,
    senderName: message.senderName,
    recipientId: message.recipientId,
    recipientName: message.recipientName,
    mailChain: message.mailChain,
    replyMailChain: message.replyMailChain,
    portalRelation: message.portalRelation,
    isEncrypted: message.isEncrypted,
    bodyFacts: summarizeHtmlBody(message.body)
  };
}

function summarizeMailbox(mailbox: PatientPortalMessagesResult, title: string) {
  return {
    authenticated: mailbox.authenticated,
    portalUsername: mailbox.portalUsername,
    canonicalId: mailbox.canonicalId,
    pid: mailbox.pid,
    messageCount: mailbox.messageCount,
    allMessageCount: mailbox.allMessageCount,
    deletedMessageCount: mailbox.deletedMessageCount,
    titlePresentInInbox: mailbox.messages.some((message) => message.title === title),
    titlePresentInAll: mailbox.allMessages.some((message) => message.title === title),
    failureReason: mailbox.failureReason,
    sessionSource: mailbox.sessionSource
  };
}

function summarizeHtmlBody(value: string) {
  return {
    length: value.length,
    containsStrong: value.includes("<strong>") || value.includes("<strong "),
    containsAnchor: value.includes("<a") || value.includes("&lt;a"),
    containsImage: value.includes("<img") || value.includes("&lt;img"),
    containsBlockedImageAlt: value.includes("blocked image"),
    containsExternalLinkText: value.includes("external link text"),
    containsAfterImageText: value.includes("after image."),
    containsLiteralStrongText: value.includes("<strong>")
  };
}

function normalizeText(value: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}
