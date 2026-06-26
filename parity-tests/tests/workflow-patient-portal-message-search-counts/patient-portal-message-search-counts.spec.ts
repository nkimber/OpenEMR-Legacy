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
const inboxTitle = "Slice 516 secure message search-count inbox";
const sentTitle = "Slice 516 secure message search-count sent";
const deletedTitle = "Slice 516 secure message search-count deleted";
const inboxBody = "Slice 516 inbox count body contains needle-516-inbox.";
const sentBody = "Slice 516 sent count body contains needle-516-sent.";
const deletedBody = "Slice 516 deleted count body contains needle-516-deleted.";
const inboxQuery = "needle-516-inbox";
const sentQuery = "needle-516-sent";
const deletedQuery = "needle-516-deleted";
const searchTitles = [inboxTitle, sentTitle, deletedTitle];

test.describe("patient portal secure-message search count parity @slice516 @workflow-patient-portal-message-search-counts @patients @portal @messages", () => {
  test("reports visible secure-message search result counts by folder", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(300_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();
    await cleanupSearchCountMessages(workflow);
    const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-516-patient-portal-message-search-counts-precondition",
      description: "Captures the Slice 516 search-count precondition: the portal account exists and temporary search-count rows are absent before setup.",
      expected: {
        canonicalId: portalMessageAnchorPatientId,
        portalUsername: portalLoginUsername,
        searchTitlesAbsentFromMailboxFolders: searchTitles
      },
      actual: {
        patient,
        mailbox: summarizeMailboxForTitles(before)
      },
      context: {
        suite: "workflow-patient-portal-message-search-counts",
        workflow: "patient-portal-message-search-counts-precondition"
      }
    });

    try {
      const inboxMessage = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        senderName: "Administrator",
        title: inboxTitle,
        body: inboxBody
      });

      const sentCompose = await workflow.composePatientPortalMessage(portalLoginUsername, portalPassword, {
        recipientId: "admin",
        title: sentTitle,
        body: sentBody
      });
      expect(sentCompose.created).toBe(true);
      expect(sentCompose.sentMessage).toBeTruthy();

      const deletedInbox = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        senderName: "Administrator",
        title: deletedTitle,
        body: deletedBody
      });
      const archivedDeleted = await workflow.deletePatientPortalMessage(
        portalLoginUsername,
        portalPassword,
        deletedInbox.id
      );
      expect(archivedDeleted.deleted).toBe(true);

      const afterSetup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const countProjection = {
        inboxQuery: countSearchResults(afterSetup, inboxQuery),
        sentQuery: countSearchResults(afterSetup, sentQuery),
        deletedQuery: countSearchResults(afterSetup, deletedQuery)
      };

      expect(countProjection.inboxQuery.filtered).toEqual({ inbox: 1, sent: 0, all: 1, deleted: 0 });
      expect(countProjection.sentQuery.filtered).toEqual({ inbox: 0, sent: 1, all: 1, deleted: 0 });
      expect(countProjection.deletedQuery.filtered).toEqual({ inbox: 0, sent: 0, all: 0, deleted: 1 });

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-516-patient-portal-message-search-counts-result",
        description: "Captures the Slice 516 search-count data result: shared search projections expose per-folder filtered and total counts for Inbox, Sent, All, and Deleted folders.",
        expected: {
          inboxQuery: { inbox: 1, sent: 0, all: 1, deleted: 0 },
          sentQuery: { inbox: 0, sent: 1, all: 1, deleted: 0 },
          deletedQuery: { inbox: 0, sent: 0, all: 0, deleted: 1 }
        },
        actual: {
          setup: {
            inboxMessage: summarizeMessage(inboxMessage),
            sentMessage: sentCompose.sentMessage ? summarizeMessage(sentCompose.sentMessage) : null,
            archivedDeleted: {
              deleted: archivedDeleted.deleted,
              deletedMessage: archivedDeleted.deletedMessage ? summarizeMessage(archivedDeleted.deletedMessage) : null,
              failureReason: archivedDeleted.failureReason
            }
          },
          mailbox: summarizeMailboxForTitles(afterSetup),
          countProjection
        },
        context: {
          suite: "workflow-patient-portal-message-search-counts",
          workflow: "patient-portal-message-search-counts-result"
        }
      });

      const surface = target.type === "legacy-openemr"
        ? await expectLegacySearchCountBaseline(page, target)
        : await expectModernizedSearchCounts(page, target, countProjection);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: `slice-516-patient-portal-message-search-counts-${target.type === "legacy-openemr" ? "legacy" : "modernized"}-ui`,
        description: target.type === "legacy-openemr"
          ? "Captures the Slice 516 legacy portal search-count baseline: temporary Sent/Archive rows render but the installed template exposes no active search input or result-count affordance."
          : "Captures the Slice 516 modernized Portal search-count UI: the search summary reports per-folder filtered and total counts for matched Inbox, Sent, and Deleted queries.",
        expected: target.type === "legacy-openemr"
          ? {
              activeSearchInputExposed: false,
              searchCountSummaryExposed: false,
              sentTitleVisible: true,
              deletedTitleVisible: true
            }
          : {
              inboxSummaryVisible: true,
              sentSummaryVisible: true,
              deletedSummaryVisible: true
            },
        actual: surface,
        context: {
          suite: "workflow-patient-portal-message-search-counts",
          workflow: "patient-portal-message-search-counts-ui"
        }
      });
    } finally {
      await cleanupSearchCountMessages(workflow);
      const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-516-patient-portal-message-search-counts-cleanup",
        description: "Captures the Slice 516 cleanup state after removing temporary search-count mailbox rows.",
        expected: {
          searchTitlesAbsentFromMailboxFolders: searchTitles
        },
        actual: summarizeMailboxForTitles(cleanup),
        context: {
          suite: "workflow-patient-portal-message-search-counts",
          workflow: "patient-portal-message-search-counts-cleanup"
        }
      });
    }
  });
});

async function cleanupSearchCountMessages(workflow: {
  cleanupPatientPortalComposedMessage(portalUsername: string, title: string): Promise<void>;
}) {
  for (const title of searchTitles) {
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
  }
}

async function expectLegacySearchCountBaseline(page: Page, target: RuntimeTarget) {
  await openLegacyPatientPortalMessages(page, target);
  const activeSearchInputExposed = await page.getByLabel(/search/i).count() > 0;
  const searchCountSummaryExposed = await page.getByText(/Search .* results: Inbox/i).count() > 0;
  await expect(page.locator("body")).toContainText(inboxTitle);
  await page.getByText("Sent", { exact: false }).first().click();
  await expect(page.locator("body")).toContainText(sentTitle);
  const sentBodyText = await page.locator("body").innerText();
  await page.getByText("Archive", { exact: false }).first().click();
  await expect(page.locator("body")).toContainText(deletedTitle);
  const archiveBodyText = await page.locator("body").innerText();

  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    activeSearchInputExposed,
    searchCountSummaryExposed,
    sentTitleVisible: sentBodyText.includes(sentTitle),
    deletedTitleVisible: archiveBodyText.includes(deletedTitle),
    sentBodyText: normalizeText(sentBodyText),
    archiveBodyText: normalizeText(archiveBodyText)
  };
}

async function expectModernizedSearchCounts(
  page: Page,
  target: RuntimeTarget,
  countProjection: {
    inboxQuery: SearchCountProjection;
    sentQuery: SearchCountProjection;
    deletedQuery: SearchCountProjection;
  }
) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const searchInput = page.getByLabel("Search secure messages");
  const summary = page.getByLabel("Secure message search result counts");
  const inboxRegion = page.getByRole("region", { name: "Inbox secure messages" });
  const sentRegion = page.getByRole("region", { name: "Sent secure messages" });
  const allRegion = page.getByRole("region", { name: "All secure messages" });
  const deletedRegion = page.getByRole("region", { name: "Deleted secure messages" });

  await expect(inboxRegion).toContainText(inboxTitle);
  await expect(sentRegion).toContainText(sentTitle);
  await expect(allRegion).toContainText(inboxTitle);
  await expect(allRegion).toContainText(sentTitle);
  await expect(deletedRegion).toContainText(deletedTitle);
  const readySummary = await summary.textContent();

  await searchInput.fill(inboxQuery);
  const inboxSummaryText = formatSearchSummary(inboxQuery, countProjection.inboxQuery);
  await expect(summary).toContainText(inboxSummaryText);
  await expect(inboxRegion).toContainText(inboxTitle);
  await expect(sentRegion).not.toContainText(sentTitle);
  await expect(allRegion).toContainText(inboxTitle);
  await expect(deletedRegion).not.toContainText(deletedTitle);
  const inboxSummary = await captureModernizedSearchCountState(page);

  await searchInput.fill(sentQuery);
  const sentSummaryText = formatSearchSummary(sentQuery, countProjection.sentQuery);
  await expect(summary).toContainText(sentSummaryText);
  await expect(inboxRegion).not.toContainText(inboxTitle);
  await expect(sentRegion).toContainText(sentTitle);
  await expect(allRegion).toContainText(sentTitle);
  await expect(deletedRegion).not.toContainText(deletedTitle);
  const sentSummary = await captureModernizedSearchCountState(page);

  await searchInput.fill(deletedQuery);
  const deletedSummaryText = formatSearchSummary(deletedQuery, countProjection.deletedQuery);
  await expect(summary).toContainText(deletedSummaryText);
  await expect(inboxRegion).not.toContainText(inboxTitle);
  await expect(sentRegion).not.toContainText(sentTitle);
  await expect(allRegion).not.toContainText(inboxTitle);
  await expect(allRegion).not.toContainText(sentTitle);
  await expect(deletedRegion).toContainText(deletedTitle);
  const deletedSummary = await captureModernizedSearchCountState(page);

  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    readySummary: normalizeText(readySummary),
    expectedSummaries: {
      inbox: inboxSummaryText,
      sent: sentSummaryText,
      deleted: deletedSummaryText
    },
    inboxSummary,
    sentSummary,
    deletedSummary
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

async function captureModernizedSearchCountState(page: Page) {
  const searchInput = page.getByLabel("Search secure messages");
  const summary = await page.getByLabel("Secure message search result counts").textContent();
  return {
    query: await searchInput.inputValue(),
    summary: normalizeText(summary)
  };
}

function countSearchResults(mailbox: PatientPortalMessagesResult, query: string): SearchCountProjection {
  return {
    total: {
      inbox: mailbox.messages.length,
      sent: mailbox.sentMessages.length,
      all: mailbox.allMessages.length,
      deleted: mailbox.deletedMessages.length
    },
    filtered: {
      inbox: filterMessagesLikePortal(mailbox.messages, query).length,
      sent: filterMessagesLikePortal(mailbox.sentMessages, query).length,
      all: filterMessagesLikePortal(mailbox.allMessages, query).length,
      deleted: filterMessagesLikePortal(mailbox.deletedMessages, query).length
    }
  };
}

function formatSearchSummary(query: string, projection: SearchCountProjection) {
  return `Search "${query}" results: Inbox ${projection.filtered.inbox} of ${projection.total.inbox} / Sent ${projection.filtered.sent} of ${projection.total.sent} / All ${projection.filtered.all} of ${projection.total.all} / Deleted ${projection.filtered.deleted} of ${projection.total.deleted}`;
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
  const sentTitles = new Set(mailbox.sentMessages.map((message) => message.title));
  const allTitles = new Set(mailbox.allMessages.map((message) => message.title));
  const deletedTitles = new Set(mailbox.deletedMessages.map((message) => message.title));
  return {
    authenticated: mailbox.authenticated,
    canonicalId: mailbox.canonicalId,
    portalUsername: mailbox.portalUsername,
    messageCount: mailbox.messageCount,
    sentMessageCount: mailbox.sentMessageCount,
    allMessageCount: mailbox.allMessageCount,
    deletedMessageCount: mailbox.deletedMessageCount,
    matchingInboxMessages: mailbox.messages.filter((message) => searchTitles.includes(message.title)).map(summarizeMessage),
    matchingSentMessages: mailbox.sentMessages.filter((message) => searchTitles.includes(message.title)).map(summarizeMessage),
    matchingAllMessages: mailbox.allMessages.filter((message) => searchTitles.includes(message.title)).map(summarizeMessage),
    matchingDeletedMessages: mailbox.deletedMessages.filter((message) => searchTitles.includes(message.title)).map(summarizeMessage),
    remainingInboxTitles: searchTitles.filter((title) => inboxTitles.has(title)),
    remainingSentTitles: searchTitles.filter((title) => sentTitles.has(title)),
    remainingAllTitles: searchTitles.filter((title) => allTitles.has(title)),
    remainingDeletedTitles: searchTitles.filter((title) => deletedTitles.has(title))
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

type SearchCountProjection = {
  total: Record<"inbox" | "sent" | "all" | "deleted", number>;
  filtered: Record<"inbox" | "sent" | "all" | "deleted", number>;
};
