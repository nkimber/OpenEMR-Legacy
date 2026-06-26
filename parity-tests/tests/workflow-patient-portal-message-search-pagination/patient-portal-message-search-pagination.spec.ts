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
const searchQuery = "needle-521-page-reset";
const newerNonMatchingDate = "2099-12-31";
const matchingDate = "2099-12-30";
const olderMatchingDate = "2099-12-29";
const nonMatchingTitles = Array.from(
  { length: secureMessagePageSize },
  (_, index) => `Slice 521 search paging newer filler ${String(index + 1).padStart(2, "0")}`
);
const matchingFirstPageTitles = Array.from(
  { length: secureMessagePageSize },
  (_, index) => `Slice 521 search paging match ${String(index + 1).padStart(2, "0")}`
);
const olderMatchingTitle = "Slice 521 search paging match older page";
const searchPaginationTitles = [...nonMatchingTitles, ...matchingFirstPageTitles, olderMatchingTitle];

test.describe("patient portal secure-message search pagination parity @slice521 @workflow-patient-portal-message-search-pagination @patients @portal @messages", () => {
  test("resets secure-message pagination when applying a search query", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(420_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();
    await cleanupSearchPaginationMessages(workflow);
    const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-521-patient-portal-message-search-pagination-precondition",
      description: "Captures the Slice 521 search-pagination precondition: the portal account exists and temporary search-pagination rows are absent before setup.",
      expected: {
        canonicalId: portalMessageAnchorPatientId,
        portalUsername: portalLoginUsername,
        searchPaginationTitlesAbsentFromInbox: searchPaginationTitles,
        pageSize: secureMessagePageSize,
        query: searchQuery
      },
      actual: {
        patient,
        mailbox: summarizeMailboxForTitles(before)
      },
      context: {
        suite: "workflow-patient-portal-message-search-pagination",
        workflow: "patient-portal-message-search-pagination-precondition"
      }
    });

    try {
      for (const title of nonMatchingTitles) {
        await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
          title,
          body: `${title} does not contain the Slice 521 search token.`,
          senderId: "admin",
          senderName: "Administrator",
          messageDate: newerNonMatchingDate
        });
      }

      for (const title of matchingFirstPageTitles) {
        await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
          title,
          body: `${title} body contains ${searchQuery}.`,
          senderId: "admin",
          senderName: "Administrator",
          messageDate: matchingDate
        });
      }

      await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        title: olderMatchingTitle,
        body: `${olderMatchingTitle} body contains ${searchQuery}.`,
        senderId: "admin",
        senderName: "Administrator",
        messageDate: olderMatchingDate
      });

      const afterSetup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const filteredMatches = filterMessagesLikePortal(afterSetup.messages, searchQuery);
      const unfilteredFirstPageTitles = afterSetup.messages.slice(0, secureMessagePageSize).map((message) => message.title);
      const filteredFirstPageTitles = filteredMatches.slice(0, secureMessagePageSize).map((message) => message.title);
      const filteredSecondPageTitles = filteredMatches
        .slice(secureMessagePageSize, secureMessagePageSize * 2)
        .map((message) => message.title);

      expect(unfilteredFirstPageTitles).toEqual(expect.arrayContaining(nonMatchingTitles));
      expect(filteredMatches).toHaveLength(secureMessagePageSize + 1);
      expect(filteredFirstPageTitles).toEqual(expect.arrayContaining(matchingFirstPageTitles));
      expect(filteredSecondPageTitles).toEqual([olderMatchingTitle]);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-521-patient-portal-message-search-pagination-result",
        description: "Captures the Slice 521 data-level result: newer nonmatching rows occupy the unfiltered first page, while the search query produces 21 matching rows whose first filtered page contains the expected 20 newer matches.",
        expected: {
          query: searchQuery,
          unfilteredFirstPageContainsNonMatchingFillers: true,
          filteredMatchCount: secureMessagePageSize + 1,
          filteredFirstPageContainsMatchingRows: true,
          filteredSecondPageContainsOnlyOlderMatch: true
        },
        actual: {
          mailbox: summarizeMailboxForTitles(afterSetup),
          unfilteredFirstPageTitles,
          filteredFirstPageTitles,
          filteredSecondPageTitles,
          filteredMatchCount: filteredMatches.length
        },
        context: {
          suite: "workflow-patient-portal-message-search-pagination",
          workflow: "patient-portal-message-search-pagination-result"
        }
      });

      const surface = target.type === "legacy-openemr"
        ? await expectLegacySearchPaginationBaseline(page, target)
        : await expectModernizedSearchPaginationReset(page, target);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: `slice-521-patient-portal-message-search-pagination-${target.type === "legacy-openemr" ? "legacy" : "modernized"}-ui`,
        description: target.type === "legacy-openemr"
          ? "Captures the Slice 521 legacy portal search-pagination baseline: this installed portal template exposes pager controls but no active rendered search input, while the shared data-level projection proves the filtered first-page contract."
          : "Captures the Slice 521 modernized Portal search-pagination reset: after moving to page 2, applying a search query returns the Inbox pager to the first filtered page instead of showing the older leftover match.",
        expected: target.type === "legacy-openemr"
          ? {
              activeSearchInputExposed: false,
              nextButtonAvailable: true,
              dataLevelFilterVerified: true
            }
          : {
              pageResetAfterSearch: true,
              firstFilteredMatchVisibleAfterSearch: true,
              olderSecondFilteredMatchHiddenAfterSearch: true
            },
        actual: surface,
        context: {
          suite: "workflow-patient-portal-message-search-pagination",
          workflow: "patient-portal-message-search-pagination-ui"
        }
      });
    } finally {
      await cleanupSearchPaginationMessages(workflow);
      const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-521-patient-portal-message-search-pagination-cleanup",
        description: "Captures the Slice 521 cleanup state after removing temporary search-pagination inbox rows.",
        expected: {
          searchPaginationTitlesAbsentFromInbox: searchPaginationTitles,
          searchPaginationTitlesAbsentFromAll: searchPaginationTitles
        },
        actual: summarizeMailboxForTitles(cleanup),
        context: {
          suite: "workflow-patient-portal-message-search-pagination",
          workflow: "patient-portal-message-search-pagination-cleanup"
        }
      });
    }
  });
});

async function cleanupSearchPaginationMessages(workflow: {
  cleanupPatientPortalComposedMessage(portalUsername: string, title: string): Promise<void>;
}) {
  for (const title of searchPaginationTitles) {
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
  }
}

async function expectLegacySearchPaginationBaseline(page: Page, target: RuntimeTarget) {
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
  await expect.poll(() => getVisibleExactTextCount(page, nonMatchingTitles[0])).toBeGreaterThan(0);
  await expect.poll(() => getVisibleExactTextCount(page, matchingFirstPageTitles[0])).toBe(0);
  const beforeNext = await captureLegacySearchPaginationState(page);

  await page.locator('button[ng-click="nextPage()"]').click();
  await expect.poll(() => getVisibleExactTextCount(page, matchingFirstPageTitles[0])).toBeGreaterThan(0);
  const afterNext = await captureLegacySearchPaginationState(page);
  const activeSearchInputExposed = await page.getByLabel(/search/i).count() > 0;

  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    activeSearchInputExposed,
    beforeNext,
    afterNext
  };
}

async function expectModernizedSearchPaginationReset(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const inbox = page.getByRole("region", { name: "Inbox secure messages" });
  const searchInput = page.getByLabel("Search secure messages");

  await expect(inbox).toContainText(nonMatchingTitles[0]);
  await expect(inbox).not.toContainText(matchingFirstPageTitles[0]);
  const beforeNext = await captureModernizedSearchPaginationState(page);

  await page.getByRole("button", { name: "Next Inbox secure messages page" }).click();
  await expect(inbox).toContainText(matchingFirstPageTitles[0]);
  await expect(inbox).not.toContainText(nonMatchingTitles[0]);
  const afterNext = await captureModernizedSearchPaginationState(page);

  await searchInput.fill(searchQuery);
  await expect(inbox).toContainText(matchingFirstPageTitles[0]);
  await expect(inbox).toContainText(matchingFirstPageTitles[secureMessagePageSize - 1]);
  await expect(inbox).not.toContainText(olderMatchingTitle);
  const afterSearch = await captureModernizedSearchPaginationState(page);

  await page.getByRole("button", { name: "Next Inbox secure messages page" }).click();
  await expect(inbox).toContainText(olderMatchingTitle);
  const afterFilteredNext = await captureModernizedSearchPaginationState(page);

  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    beforeNext,
    afterNext,
    afterSearch,
    afterFilteredNext
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

async function captureLegacySearchPaginationState(page: Page) {
  return {
    firstNonMatchingVisibleCount: await getVisibleExactTextCount(page, nonMatchingTitles[0]),
    firstMatchingVisibleCount: await getVisibleExactTextCount(page, matchingFirstPageTitles[0]),
    olderMatchingVisibleCount: await getVisibleExactTextCount(page, olderMatchingTitle),
    nextButtonCount: await page.locator('button[ng-click="nextPage()"]').count(),
    bodyContainsSecureMessaging: await page.locator("body").evaluate((body) => body.textContent?.includes("Secure Messaging") ?? false)
  };
}

async function captureModernizedSearchPaginationState(page: Page) {
  const inbox = page.getByRole("region", { name: "Inbox secure messages" });
  return {
    firstNonMatchingVisible: await inbox.evaluate((element, title) => element.textContent?.includes(title) ?? false, nonMatchingTitles[0]),
    firstMatchingVisible: await inbox.evaluate((element, title) => element.textContent?.includes(title) ?? false, matchingFirstPageTitles[0]),
    twentiethMatchingVisible: await inbox.evaluate((element, title) => element.textContent?.includes(title) ?? false, matchingFirstPageTitles[secureMessagePageSize - 1]),
    olderMatchingVisible: await inbox.evaluate((element, title) => element.textContent?.includes(title) ?? false, olderMatchingTitle),
    nextButtonVisible: await page.getByRole("button", { name: "Next Inbox secure messages page" }).isVisible().catch(() => false),
    summaryText: normalizeText(await page.getByLabel("Secure message search result counts").textContent()),
    inboxText: normalizeText(await inbox.textContent())
  };
}

function filterMessagesLikePortal(messages: PatientPortalMessageItem[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  return messages.filter((message) => {
    const searchable = [
      message.title,
      message.body,
      message.senderName,
      message.recipientName,
      message.status,
      message.type,
      message.date
    ].join(" ").toLowerCase();
    return searchable.includes(normalizedQuery);
  });
}

function summarizeMailboxForTitles(mailbox: PatientPortalMessagesResult) {
  const inboxTitles = new Set(mailbox.messages.map((message) => message.title));
  const allTitles = new Set(mailbox.allMessages.map((message) => message.title));
  return {
    authenticated: mailbox.authenticated,
    portalUsername: mailbox.portalUsername,
    canonicalId: mailbox.canonicalId,
    pid: mailbox.pid,
    messageCount: mailbox.messageCount,
    allMessageCount: mailbox.allMessageCount,
    deletedMessageCount: mailbox.deletedMessageCount,
    failureReason: mailbox.failureReason,
    remainingSearchPaginationInboxTitles: searchPaginationTitles.filter((title) => inboxTitles.has(title)),
    remainingSearchPaginationAllTitles: searchPaginationTitles.filter((title) => allTitles.has(title))
  };
}

function normalizeText(value: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}
