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
const primaryTitle = "Slice 242 mark all read primary";
const secondaryTitle = "Slice 242 mark all read secondary";
const messageDate = "2099-12-28";
const allTitles = [primaryTitle, secondaryTitle];

test.describe("patient portal secure-message mark-all-read parity @slice242 @workflow-patient-portal-message-mark-all-read @patients @portal @messages", () => {
  test("marks current secure-message rows read in the browser without persisting mailbox status", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    await cleanupMarkAllReadMessages(workflow);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-242-patient-portal-message-mark-all-read-precondition",
      description: "Captures the Slice 242 mark-all-read precondition: the portal anchor patient exists before temporary unread inbox rows are created.",
      expected: {
        canonicalId: portalMessageAnchorPatientId,
        portalUsername: portalLoginUsername,
        temporaryTitles: allTitles,
        initialStatus: "New",
        browserOnlyStatusChange: true,
        persistedStatusAfterRefresh: "New"
      },
      actual: {
        canonicalId: portalMessageAnchorPatientId,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        portalUsername: portalLoginUsername
      },
      context: {
        suite: "workflow-patient-portal-message-mark-all-read",
        workflow: "patient-portal-message-mark-all-read-precondition"
      }
    });
    let cleanupAttached = false;

    try {
      for (const title of allTitles) {
        await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
          title,
          body: `${title} temporary toolbar mark-all-read evidence.`,
          senderId: "admin",
          senderName: "Administrator",
          messageDate
        });
      }

      const beforeMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      for (const title of allTitles) {
        expect(beforeMessages.messages.find((message) => message.title === title)).toMatchObject({
          title,
          status: "New"
        });
      }

      if (target.type === "legacy-openemr") {
        const legacyUi = await expectLegacyMarkAllRead(page, target);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-242-patient-portal-message-mark-all-read-legacy-ui",
          description: "Captures the legacy patient portal toolbar behavior: Mark all as read changes the visible row status before a refresh reloads the persisted unread mailbox state.",
          expected: {
            primaryTitle,
            beforeActionVisibleStatus: "New",
            afterActionVisibleStatus: "Read",
            afterRefreshVisibleStatus: "New"
          },
          actual: legacyUi,
          context: {
            suite: "workflow-patient-portal-message-mark-all-read",
            workflow: "patient-portal-message-mark-all-read-legacy-ui"
          }
        });
      } else {
        const modernizedUi = await expectModernizedMarkAllRead(page, target);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-242-patient-portal-message-mark-all-read-modernized-ui",
          description: "Captures the modernized portal inbox behavior: Mark all as read mirrors the legacy browser-only visible status transition before refresh restores persisted unread state.",
          expected: {
            primaryTitle,
            beforeActionVisibleStatus: "New",
            afterActionVisibleStatus: "Read",
            afterRefreshVisibleStatus: "New"
          },
          actual: modernizedUi,
          context: {
            suite: "workflow-patient-portal-message-mark-all-read",
            workflow: "patient-portal-message-mark-all-read-modernized-ui"
          }
        });
      }

      const afterMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      for (const title of allTitles) {
        expect(afterMessages.messages.find((message) => message.title === title)).toMatchObject({
          title,
          status: "New"
        });
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-242-patient-portal-message-mark-all-read-result",
        description: "Captures the Slice 242 persisted mailbox result: temporary inbox rows remain unread after the browser-only mark-all-read action and refresh.",
        expected: {
          temporaryTitles: allTitles,
          beforeStatuses: allTitles.map((title) => ({ title, status: "New" })),
          afterRefreshStatuses: allTitles.map((title) => ({ title, status: "New" }))
        },
        actual: {
          beforeMailbox: summarizeMailbox(beforeMessages),
          afterMailbox: summarizeMailbox(afterMessages),
          beforeMessages: summarizeMessagesByTitle(beforeMessages, allTitles),
          afterMessages: summarizeMessagesByTitle(afterMessages, allTitles)
        },
        context: {
          suite: "workflow-patient-portal-message-mark-all-read",
          workflow: "patient-portal-message-mark-all-read-result"
        }
      });
    } finally {
      await cleanupMarkAllReadMessages(workflow);
      const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-242-patient-portal-message-mark-all-read-cleanup",
        description: "Captures the Slice 242 cleanup state after removing temporary mark-all-read inbox rows.",
        expected: {
          temporaryTitlesAbsentFromInbox: allTitles,
          temporaryTitlesAbsentFromAll: allTitles
        },
        actual: summarizeMarkAllReadCleanup(cleanup),
        context: {
          suite: "workflow-patient-portal-message-mark-all-read",
          workflow: "patient-portal-message-mark-all-read-cleanup"
        }
      });
      cleanupAttached = true;
    }
    expect(cleanupAttached).toBe(true);
  });
});

async function cleanupMarkAllReadMessages(workflow: {
  cleanupPatientPortalComposedMessage(portalUsername: string, title: string): Promise<void>;
}) {
  for (const title of allTitles) {
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
  }
}

async function expectLegacyMarkAllRead(page: Page, target: RuntimeTarget) {
  await openLegacyPatientPortalMessages(page, target);
  const row = page.locator("tr").filter({ hasText: primaryTitle }).first();
  await expect(row).toContainText("New");
  const beforeAction = await captureLegacyMarkAllReadState(page);

  await page.getByRole("button", { name: "Actions" }).click();
  await page.getByRole("link", { name: "Mark all as read" }).click();

  await expect(row).toContainText("Read");
  const afterAction = await captureLegacyMarkAllReadState(page);

  await page.reload();
  await expectRenderedText(page, /Secure Messaging/i);
  await expect(page.locator("tr").filter({ hasText: primaryTitle }).first()).toContainText("New");
  const afterRefresh = await captureLegacyMarkAllReadState(page);
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    beforeAction,
    afterAction,
    afterRefresh
  };
}

async function expectModernizedMarkAllRead(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const inbox = page.getByRole("region", { name: "Inbox secure messages" });
  const card = inbox.locator("article.message-item").filter({ hasText: primaryTitle }).first();
  await expect(card).toContainText(primaryTitle);
  await expect(card.locator(".status-pill")).toContainText("New");
  const beforeAction = await captureModernizedMarkAllReadState(page);

  await page.getByRole("button", { name: "Mark all as read" }).click();
  await expect(card.locator(".status-pill")).toContainText("Read");
  const afterAction = await captureModernizedMarkAllReadState(page);

  await page.getByRole("button", { name: "Refresh portal home" }).click();
  await expect(page.locator("body")).toContainText("Portal home ready");
  await expect(inbox.locator("article.message-item").filter({ hasText: primaryTitle }).first().locator(".status-pill")).toContainText("New");
  const afterRefresh = await captureModernizedMarkAllReadState(page);
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    beforeAction,
    afterAction,
    afterRefresh
  };
}

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

async function captureLegacyMarkAllReadState(page: Page) {
  const row = page.locator("tr").filter({ hasText: primaryTitle }).first();
  return {
    primaryRowText: normalizeText(await row.textContent()),
    primaryRowContainsNew: await row.evaluate((element) => element.textContent?.includes("New") ?? false),
    primaryRowContainsRead: await row.evaluate((element) => element.textContent?.includes("Read") ?? false),
    visibleTemporaryTitles: await getVisibleTitlePresence(page),
    bodyContainsSecureMessaging: await page.locator("body").evaluate((body) => body.textContent?.includes("Secure Messaging") ?? false)
  };
}

async function captureModernizedMarkAllReadState(page: Page) {
  const inbox = page.getByRole("region", { name: "Inbox secure messages" });
  const card = inbox.locator("article.message-item").filter({ hasText: primaryTitle }).first();
  return {
    primaryCardText: normalizeText(await card.textContent()),
    primaryStatusText: normalizeText(await card.locator(".status-pill").textContent()),
    visibleTemporaryTitles: await getModernizedTitlePresence(inbox),
    inboxText: normalizeText(await inbox.textContent())
  };
}

async function getVisibleTitlePresence(page: Page) {
  const presence: Record<string, boolean> = {};
  for (const title of allTitles) {
    presence[title] = await page
      .getByText(title, { exact: true })
      .first()
      .isVisible()
      .catch(() => false);
  }
  return presence;
}

async function getModernizedTitlePresence(inbox: ReturnType<Page["getByRole"]>) {
  const text = await inbox.textContent();
  return Object.fromEntries(allTitles.map((title) => [title, text?.includes(title) ?? false]));
}

function summarizeMailbox(mailbox: PatientPortalMessagesResult) {
  return {
    authenticated: mailbox.authenticated,
    portalUsername: mailbox.portalUsername,
    canonicalId: mailbox.canonicalId,
    pid: mailbox.pid,
    messageCount: mailbox.messageCount,
    allMessageCount: mailbox.allMessageCount,
    deletedMessageCount: mailbox.deletedMessageCount,
    failureReason: mailbox.failureReason,
    sessionSource: mailbox.sessionSource
  };
}

function summarizeMessagesByTitle(mailbox: PatientPortalMessagesResult, titles: string[]) {
  return titles.map((title) => summarizePortalMessage(mailbox.messages.find((message) => message.title === title)));
}

function summarizeMarkAllReadCleanup(mailbox: PatientPortalMessagesResult) {
  const inboxTitles = new Set(mailbox.messages.map((message) => message.title));
  const allMailboxTitles = new Set(mailbox.allMessages.map((message) => message.title));
  return {
    ...summarizeMailbox(mailbox),
    remainingTemporaryInboxTitles: allTitles.filter((title) => inboxTitles.has(title)),
    remainingTemporaryAllTitles: allTitles.filter((title) => allMailboxTitles.has(title))
  };
}

function summarizePortalMessage(message: PatientPortalMessageItem | undefined) {
  if (!message) {
    return null;
  }
  return {
    id: message.id,
    type: message.type,
    date: message.date,
    title: message.title,
    status: message.status,
    senderId: message.senderId,
    senderName: message.senderName,
    recipientId: message.recipientId,
    recipientName: message.recipientName,
    mailChain: message.mailChain,
    replyMailChain: message.replyMailChain,
    isEncrypted: message.isEncrypted
  };
}

function normalizeText(value: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}
