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
const secureMessagePageSize = 20;
const fillerMessageDate = "2099-12-31";
const secondPageMessageDate = "2099-12-30";
const fillerTitles = Array.from(
  { length: secureMessagePageSize },
  (_, index) => `Slice 241 paging filler ${String(index + 1).padStart(2, "0")}`
);
const secondPageTitle = "Slice 241 paging older inbox message";
const allPaginationTitles = [...fillerTitles, secondPageTitle];

test.describe("patient portal secure-message pagination parity @slice241 @workflow-patient-portal-message-pagination @patients @portal @messages", () => {
  test("shows an older inbox message only after moving past the first 20-message page", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(360_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    await cleanupPaginationMessages(workflow);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-241-patient-portal-message-pagination-precondition",
      description: "Captures the Slice 241 pagination precondition: the signed-in portal anchor patient exists before temporary first-page and older second-page inbox rows are created.",
      expected: {
        canonicalId: portalMessageAnchorPatientId,
        portalUsername: portalLoginUsername,
        pageSize: secureMessagePageSize,
        fillerCount: fillerTitles.length,
        fillerMessageDate,
        secondPageMessageDate,
        secondPageTitle
      },
      actual: {
        canonicalId: portalMessageAnchorPatientId,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        portalUsername: portalLoginUsername
      },
      context: {
        suite: "workflow-patient-portal-message-pagination",
        workflow: "patient-portal-message-pagination-precondition"
      }
    });
    let cleanupAttached = false;

    try {
      for (const title of fillerTitles) {
        await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
          title,
          body: `${title} temporary first-page pagination evidence.`,
          senderId: "admin",
          senderName: "Administrator",
          messageDate: fillerMessageDate
        });
      }

      await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        title: secondPageTitle,
        body: "Slice 241 temporary second-page pagination evidence.",
        senderId: "admin",
        senderName: "Administrator",
        messageDate: secondPageMessageDate
      });

      const portalMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const targetIndex = portalMessages.messages.findIndex((message) => message.title === secondPageTitle);
      expect(portalMessages.messages.slice(0, secureMessagePageSize).map((message) => message.title)).toEqual(
        expect.arrayContaining(fillerTitles)
      );
      expect(targetIndex).toBeGreaterThanOrEqual(secureMessagePageSize);
      expect(targetIndex).toBeLessThan(secureMessagePageSize * 2);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-241-patient-portal-message-pagination-result",
        description: "Captures the Slice 241 pagination result: 20 newer temporary inbox messages occupy page one while the older message sorts into the next page window.",
        expected: {
          pageSize: secureMessagePageSize,
          firstPageContainsAllFillerTitles: true,
          secondPageTitleIndexAtLeast: secureMessagePageSize,
          secondPageTitleIndexLessThan: secureMessagePageSize * 2,
          secondPageTitle
        },
        actual: {
          targetIndex,
          mailbox: summarizeMailbox(portalMessages),
          firstPageTitles: portalMessages.messages.slice(0, secureMessagePageSize).map((message) => message.title),
          secondPageCandidateTitles: portalMessages.messages
            .slice(secureMessagePageSize, secureMessagePageSize * 2)
            .map((message) => message.title),
          secondPageMessage: summarizePortalMessage(portalMessages.messages[targetIndex])
        },
        context: {
          suite: "workflow-patient-portal-message-pagination",
          workflow: "patient-portal-message-pagination-result"
        }
      });

      if (target.type === "legacy-openemr") {
        const legacyUi = await expectLegacyInboxPagination(page, target);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-241-patient-portal-message-pagination-legacy-ui",
          description: "Captures the legacy patient portal Secure Messaging pager after moving from the first page to the older second-page inbox row.",
          expected: {
            firstPageVisibleTitle: fillerTitles[0],
            secondPageHiddenBeforeNext: secondPageTitle,
            secondPageVisibleAfterNext: secondPageTitle
          },
          actual: legacyUi,
          context: {
            suite: "workflow-patient-portal-message-pagination",
            workflow: "patient-portal-message-pagination-legacy-ui"
          }
        });
      } else {
        const modernizedUi = await expectModernizedInboxPagination(page, target);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-241-patient-portal-message-pagination-modernized-ui",
          description: "Captures the modernized Portal Inbox pager after moving from the first page to the older second-page inbox row.",
          expected: {
            firstPageVisibleTitle: fillerTitles[0],
            secondPageHiddenBeforeNext: secondPageTitle,
            secondPageVisibleAfterNext: secondPageTitle
          },
          actual: modernizedUi,
          context: {
            suite: "workflow-patient-portal-message-pagination",
            workflow: "patient-portal-message-pagination-modernized-ui"
          }
        });
      }
    } finally {
      await cleanupPaginationMessages(workflow);
      const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-241-patient-portal-message-pagination-cleanup",
        description: "Captures the Slice 241 cleanup state after removing all temporary pagination inbox rows.",
        expected: {
          paginationTitlesAbsentFromInbox: allPaginationTitles,
          paginationTitlesAbsentFromAll: allPaginationTitles
        },
        actual: summarizePaginationCleanup(cleanup),
        context: {
          suite: "workflow-patient-portal-message-pagination",
          workflow: "patient-portal-message-pagination-cleanup"
        }
      });
      cleanupAttached = true;
    }
    expect(cleanupAttached).toBe(true);
  });
});

async function cleanupPaginationMessages(workflow: {
  cleanupPatientPortalComposedMessage(portalUsername: string, title: string): Promise<void>;
}) {
  for (const title of allPaginationTitles) {
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
  }
}

async function expectLegacyInboxPagination(page: Page, target: RuntimeTarget) {
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
  await expect.poll(() => getVisibleExactTextCount(page, fillerTitles[0])).toBeGreaterThan(0);
  await expect.poll(() => getVisibleExactTextCount(page, secondPageTitle)).toBe(0);
  const beforeNext = await captureLegacyPaginationState(page);

  await page.locator('button[ng-click="nextPage()"]').click();
  await expect.poll(() => getVisibleExactTextCount(page, secondPageTitle)).toBeGreaterThan(0);
  const afterNext = await captureLegacyPaginationState(page);
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    beforeNext,
    afterNext
  };
}

async function getVisibleExactTextCount(page: Page, text: string) {
  return page.getByText(text, { exact: true }).evaluateAll((elements, expectedText) => {
    return elements.filter((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        element.textContent?.trim() === expectedText &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    }).length;
  }, text);
}

async function expectModernizedInboxPagination(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const inbox = page.getByRole("region", { name: "Inbox secure messages" });

  await expect(inbox).toContainText(fillerTitles[0]);
  await expect(inbox).not.toContainText(secondPageTitle);
  const beforeNext = await captureModernizedPaginationState(page);

  await page.getByRole("button", { name: "Next Inbox secure messages page" }).click();
  await expect(inbox).toContainText(secondPageTitle);
  const afterNext = await captureModernizedPaginationState(page);
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    beforeNext,
    afterNext
  };
}

async function captureLegacyPaginationState(page: Page) {
  return {
    firstFillerVisibleCount: await getVisibleExactTextCount(page, fillerTitles[0]),
    secondPageVisibleCount: await getVisibleExactTextCount(page, secondPageTitle),
    nextButtonCount: await page.locator('button[ng-click="nextPage()"]').count(),
    bodyContainsSecureMessaging: await page.locator("body").evaluate((body) => body.textContent?.includes("Secure Messaging") ?? false)
  };
}

async function captureModernizedPaginationState(page: Page) {
  const inbox = page.getByRole("region", { name: "Inbox secure messages" });
  return {
    firstFillerVisible: await inbox.evaluate((element, title) => element.textContent?.includes(title) ?? false, fillerTitles[0]),
    secondPageVisible: await inbox.evaluate((element, title) => element.textContent?.includes(title) ?? false, secondPageTitle),
    nextButtonVisible: await page.getByRole("button", { name: "Next Inbox secure messages page" }).isVisible().catch(() => false),
    inboxText: normalizeText(await inbox.textContent())
  };
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

function summarizePaginationCleanup(mailbox: PatientPortalMessagesResult) {
  const inboxTitles = new Set(mailbox.messages.map((message) => message.title));
  const allTitles = new Set(mailbox.allMessages.map((message) => message.title));
  return {
    ...summarizeMailbox(mailbox),
    remainingPaginationInboxTitles: allPaginationTitles.filter((title) => inboxTitles.has(title)),
    remainingPaginationAllTitles: allPaginationTitles.filter((title) => allTitles.has(title))
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
