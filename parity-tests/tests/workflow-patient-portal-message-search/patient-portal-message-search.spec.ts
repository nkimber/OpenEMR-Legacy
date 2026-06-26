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
const matchingSearchTitle = "Slice 513 secure message searchable alpha";
const hiddenSearchTitle = "Slice 513 secure message searchable beta";
const matchingSearchBody = "Slice 513 body contains needle-513-visible for folder search parity.";
const hiddenSearchBody = "Slice 513 body contains decoy-513-hidden and should disappear after filtering.";
const messageDate = "2099-12-31";
const searchQuery = "needle-513-visible";
const searchTitles = [matchingSearchTitle, hiddenSearchTitle];

test.describe("patient portal secure-message search parity @slice513 @workflow-patient-portal-message-search @patients @portal @messages", () => {
  test("filters secure-message folders by matching message text before pagination", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();
    await cleanupSearchMessages(workflow);
    const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-513-patient-portal-message-search-precondition",
      description: "Captures the Slice 513 search precondition: the portal account exists and the temporary search titles are absent before cleanup-backed inbox rows are created.",
      expected: {
        canonicalId: portalMessageAnchorPatientId,
        portalUsername: portalLoginUsername,
        searchTitlesAbsentFromInbox: searchTitles,
        query: searchQuery
      },
      actual: {
        patient,
        mailbox: summarizeMailboxForTitles(before)
      },
      context: {
        suite: "workflow-patient-portal-message-search",
        workflow: "patient-portal-message-search-precondition"
      }
    });

    try {
      await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        title: matchingSearchTitle,
        body: matchingSearchBody,
        senderId: "admin",
        senderName: "Administrator",
        messageDate
      });
      await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        title: hiddenSearchTitle,
        body: hiddenSearchBody,
        senderId: "admin",
        senderName: "Administrator",
        messageDate
      });

      const afterCreate = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const localFiltered = filterMessagesLikePortal(afterCreate.messages, searchQuery);
      expect(afterCreate.messages.map((message) => message.title)).toEqual(expect.arrayContaining(searchTitles));
      expect(localFiltered.map((message) => message.title)).toContain(matchingSearchTitle);
      expect(localFiltered.map((message) => message.title)).not.toContain(hiddenSearchTitle);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-513-patient-portal-message-search-result",
        description: "Captures the Slice 513 data-level folder search result: the same case-insensitive substring query matches the intended temporary inbox row and excludes the decoy row.",
        expected: {
          query: searchQuery,
          matchingTitlePresentBeforeFilter: true,
          hiddenTitlePresentBeforeFilter: true,
          matchingTitlePresentAfterFilter: true,
          hiddenTitlePresentAfterFilter: false
        },
        actual: {
          mailbox: summarizeMailboxForTitles(afterCreate),
          filteredTitles: localFiltered.map((message) => message.title),
          filteredMessageCount: localFiltered.length
        },
        context: {
          suite: "workflow-patient-portal-message-search",
          workflow: "patient-portal-message-search-result"
        }
      });

      const surface = target.type === "legacy-openemr"
        ? await expectLegacyPatientPortalSearch(page, target)
        : await expectModernizedPatientPortalSearch(page, target);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: `slice-513-patient-portal-message-search-${target.type === "legacy-openemr" ? "legacy" : "modernized"}-ui`,
        description: target.type === "legacy-openemr"
          ? "Captures the Slice 513 legacy portal search baseline: this installed portal template does not expose an active search input and its rendered table remains unfiltered, while the shared data-level probe records the intended substring match."
          : "Captures the Slice 513 modernized portal search surface after applying the query: the matching row remains visible while the decoy row is removed from the active folder page.",
        expected: target.type === "legacy-openemr"
          ? {
              query: searchQuery,
              activeSearchInputExposed: false,
              renderedTableRemainsUnfiltered: true,
              dataLevelFilterVerified: true
            }
          : {
              query: searchQuery,
              matchingTitleVisibleAfterSearch: true,
              hiddenTitleVisibleAfterSearch: false
            },
        actual: surface,
        context: {
          suite: "workflow-patient-portal-message-search",
          workflow: "patient-portal-message-search-ui"
        }
      });
    } finally {
      await cleanupSearchMessages(workflow);
      const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-513-patient-portal-message-search-cleanup",
        description: "Captures the Slice 513 cleanup state after removing temporary secure-message search rows.",
        expected: {
          searchTitlesAbsentFromInbox: searchTitles,
          searchTitlesAbsentFromAll: searchTitles
        },
        actual: summarizeMailboxForTitles(cleanup),
        context: {
          suite: "workflow-patient-portal-message-search",
          workflow: "patient-portal-message-search-cleanup"
        }
      });
    }
  });
});

async function cleanupSearchMessages(workflow: {
  cleanupPatientPortalComposedMessage(portalUsername: string, title: string): Promise<void>;
}) {
  for (const title of searchTitles) {
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
  }
}

async function expectLegacyPatientPortalSearch(page: Page, target: RuntimeTarget) {
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
  await expect.poll(() => getVisibleExactTextCount(page, matchingSearchTitle)).toBeGreaterThan(0);
  await expect.poll(() => getVisibleExactTextCount(page, hiddenSearchTitle)).toBeGreaterThan(0);

  const beforeSearch = await captureLegacySearchState(page);
  const angularSearch = await applyLegacyAngularSearch(page, searchQuery);
  const afterSearch = await captureLegacySearchState(page);

  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    beforeSearch,
    angularSearch,
    afterSearch,
    activeSearchInputExposed: await page.getByLabel(/search/i).count() > 0,
    renderedTableRemainsUnfiltered: afterSearch.matchingVisibleCount > 0 && afterSearch.hiddenVisibleCount > 0,
    controllerFiltered: angularSearch.filteredTitles.includes(matchingSearchTitle) && !angularSearch.filteredTitles.includes(hiddenSearchTitle)
  };
}

async function expectModernizedPatientPortalSearch(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const inbox = page.getByRole("region", { name: "Inbox secure messages" });
  await expect(inbox).toContainText(matchingSearchTitle);
  await expect(inbox).toContainText(hiddenSearchTitle);
  const beforeSearch = await captureModernizedSearchState(page);

  await page.getByLabel("Search secure messages").fill(searchQuery);
  await expect(inbox).toContainText(matchingSearchTitle);
  await expect(inbox).not.toContainText(hiddenSearchTitle);
  const afterSearch = await captureModernizedSearchState(page);

  await page.getByLabel("Search secure messages").fill("");
  await expect(inbox).toContainText(hiddenSearchTitle);
  const afterClear = await captureModernizedSearchState(page);

  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    beforeSearch,
    afterSearch,
    afterClear
  };
}

async function applyLegacyAngularSearch(page: Page, query: string) {
  return page.evaluate(({ searchText, expectedTitle }) => {
    const angularRuntime = (window as unknown as { angular?: { element(element: Element | null): { scope(): any } } }).angular;
    if (!angularRuntime) {
      throw new Error("Legacy patient portal Angular runtime was not available.");
    }

    let scope: any = null;
    for (const element of Array.from(document.querySelectorAll("*"))) {
      const candidate = angularRuntime.element(element).scope();
      if (
        candidate &&
        typeof candidate.search === "function" &&
        Array.isArray(candidate.items) &&
        candidate.items.some((item: { title?: string }) => item.title === expectedTitle)
      ) {
        scope = candidate;
        break;
      }
    }

    if (!scope) {
      throw new Error("Legacy patient portal Angular message controller scope was not available.");
    }

    scope.$apply(() => {
      const scopes = new Set<any>();
      for (const element of Array.from(document.querySelectorAll("*"))) {
        const candidate = angularRuntime.element(element).scope();
        if (candidate) {
          scopes.add(candidate);
        }
      }
      for (const candidate of scopes) {
        candidate.query = searchText;
      }
      scope.search();
    });

    return {
      query: scope.query,
      filteredCount: scope.filteredItems.length,
      currentPage: scope.currentPage,
      filteredTitles: scope.filteredItems.map((item: { title?: string }) => item.title ?? ""),
      firstPageTitles: (scope.pagedItems[scope.currentPage] ?? []).map((item: { title?: string }) => item.title ?? "")
    };
  }, { searchText: query, expectedTitle: matchingSearchTitle });
}

async function captureLegacySearchState(page: Page) {
  return {
    matchingVisibleCount: await getVisibleExactTextCount(page, matchingSearchTitle),
    hiddenVisibleCount: await getVisibleExactTextCount(page, hiddenSearchTitle),
    bodyContainsSecureMessaging: await page.locator("body").evaluate((body) => body.textContent?.includes("Secure Messaging") ?? false)
  };
}

async function captureModernizedSearchState(page: Page) {
  const inbox = page.getByRole("region", { name: "Inbox secure messages" });
  const searchInput = page.getByLabel("Search secure messages");
  return {
    query: await searchInput.inputValue(),
    matchingTitleVisible: await inbox.evaluate((element, title) => element.textContent?.includes(title) ?? false, matchingSearchTitle),
    hiddenTitleVisible: await inbox.evaluate((element, title) => element.textContent?.includes(title) ?? false, hiddenSearchTitle),
    inboxText: normalizeText(await inbox.textContent())
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

function filterMessagesLikePortal(messages: PatientPortalMessageItem[], query: string) {
  const needle = query.toLowerCase();
  return messages.filter((message) => {
    const values = [
      message.id,
      message.type,
      message.date,
      message.title,
      message.body,
      message.status,
      message.assignedTo,
      message.senderId,
      message.senderName,
      message.recipientId,
      message.recipientName,
      message.portalRelation ?? "",
      message.isEncrypted ? "Encrypted message" : "Plain text message",
      `Attachments ${message.attachmentCount}`
    ];

    return values.some((value) => value.toLowerCase().includes(needle));
  });
}

function summarizeMailboxForTitles(mailbox: PatientPortalMessagesResult) {
  const inboxTitles = new Set(mailbox.messages.map((message) => message.title));
  const allTitles = new Set(mailbox.allMessages.map((message) => message.title));
  return {
    authenticated: mailbox.authenticated,
    canonicalId: mailbox.canonicalId,
    portalUsername: mailbox.portalUsername,
    messageCount: mailbox.messageCount,
    allMessageCount: mailbox.allMessageCount,
    matchingInboxMessages: mailbox.messages.filter((message) => searchTitles.includes(message.title)).map(summarizeMessage),
    matchingAllMessages: mailbox.allMessages.filter((message) => searchTitles.includes(message.title)).map(summarizeMessage),
    remainingSearchInboxTitles: searchTitles.filter((title) => inboxTitles.has(title)),
    remainingSearchAllTitles: searchTitles.filter((title) => allTitles.has(title))
  };
}

function summarizeMessage(message: PatientPortalMessageItem) {
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
    body: message.body
  };
}

function normalizeText(value: string | null) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}
