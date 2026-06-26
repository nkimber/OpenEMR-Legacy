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
const inboxTitle = "Slice 515 secure message empty-search inbox";
const sentTitle = "Slice 515 secure message empty-search sent";
const deletedTitle = "Slice 515 secure message empty-search deleted";
const inboxBody = "Slice 515 inbox folder row should return after clearing empty-search.";
const sentBody = "Slice 515 sent folder row should return after clearing empty-search.";
const deletedBody = "Slice 515 deleted folder row should return after clearing empty-search.";
const noHitQuery = "needle-515-no-results";
const searchTitles = [inboxTitle, sentTitle, deletedTitle];

test.describe("patient portal secure-message empty search parity @slice515 @workflow-patient-portal-message-empty-search @patients @portal @messages", () => {
  test("shows deterministic empty states when a secure-message search has no folder matches", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(300_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();
    await cleanupEmptySearchMessages(workflow);
    const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-515-patient-portal-message-empty-search-precondition",
      description: "Captures the Slice 515 empty-search precondition: the portal account exists and the temporary folder rows are absent before setup.",
      expected: {
        canonicalId: portalMessageAnchorPatientId,
        portalUsername: portalLoginUsername,
        titlesAbsentFromMailboxFolders: searchTitles,
        noHitQuery
      },
      actual: {
        patient,
        mailbox: summarizeMailboxForTitles(before)
      },
      context: {
        suite: "workflow-patient-portal-message-empty-search",
        workflow: "patient-portal-message-empty-search-precondition"
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
      const noHitSearch = {
        inbox: filterMessagesLikePortal(afterSetup.messages, noHitQuery),
        sent: filterMessagesLikePortal(afterSetup.sentMessages, noHitQuery),
        all: filterMessagesLikePortal(afterSetup.allMessages, noHitQuery),
        deleted: filterMessagesLikePortal(afterSetup.deletedMessages, noHitQuery)
      };

      expect(afterSetup.messages.map((message) => message.title)).toContain(inboxTitle);
      expect(afterSetup.sentMessages.map((message) => message.title)).toContain(sentTitle);
      expect(afterSetup.allMessages.map((message) => message.title)).toEqual(expect.arrayContaining([inboxTitle, sentTitle]));
      expect(afterSetup.deletedMessages.map((message) => message.title)).toContain(deletedTitle);
      expect(noHitSearch.inbox).toHaveLength(0);
      expect(noHitSearch.sent).toHaveLength(0);
      expect(noHitSearch.all).toHaveLength(0);
      expect(noHitSearch.deleted).toHaveLength(0);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-515-patient-portal-message-empty-search-result",
        description: "Captures the Slice 515 empty-search data result: cleanup-backed mailbox rows exist in Inbox, Sent, All, and Deleted while the shared no-hit query returns zero matches for every folder projection.",
        expected: {
          noHitQuery,
          inboxRowsExistBeforeSearch: true,
          sentRowsExistBeforeSearch: true,
          deletedRowsExistBeforeSearch: true,
          noHitSearchCountByFolder: {
            inbox: 0,
            sent: 0,
            all: 0,
            deleted: 0
          }
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
          noHitSearch: summarizeNoHitSearch(noHitSearch)
        },
        context: {
          suite: "workflow-patient-portal-message-empty-search",
          workflow: "patient-portal-message-empty-search-result"
        }
      });

      const surface = target.type === "legacy-openemr"
        ? await expectLegacyEmptySearchBaseline(page, target)
        : await expectModernizedEmptySearch(page, target);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: `slice-515-patient-portal-message-empty-search-${target.type === "legacy-openemr" ? "legacy" : "modernized"}-ui`,
        description: target.type === "legacy-openemr"
          ? "Captures the Slice 515 legacy portal empty-search baseline: temporary Sent/Archive rows render but the installed template exposes no active search input or empty-result affordance."
          : "Captures the Slice 515 modernized Portal empty-search UI: a no-hit query renders deterministic folder-specific empty states and clearing the search restores folder rows.",
        expected: target.type === "legacy-openemr"
          ? {
              activeSearchInputExposed: false,
              sentTitleVisible: true,
              deletedTitleVisible: true
            }
          : {
              noHitQuery,
              inboxEmptyStateVisible: true,
              sentEmptyStateVisible: true,
              allEmptyStateVisible: true,
              deletedEmptyStateVisible: true,
              rowsRestoredAfterClear: true
            },
        actual: surface,
        context: {
          suite: "workflow-patient-portal-message-empty-search",
          workflow: "patient-portal-message-empty-search-ui"
        }
      });
    } finally {
      await cleanupEmptySearchMessages(workflow);
      const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-515-patient-portal-message-empty-search-cleanup",
        description: "Captures the Slice 515 cleanup state after removing temporary empty-search mailbox rows.",
        expected: {
          searchTitlesAbsentFromMailboxFolders: searchTitles
        },
        actual: summarizeMailboxForTitles(cleanup),
        context: {
          suite: "workflow-patient-portal-message-empty-search",
          workflow: "patient-portal-message-empty-search-cleanup"
        }
      });
    }
  });
});

async function cleanupEmptySearchMessages(workflow: {
  cleanupPatientPortalComposedMessage(portalUsername: string, title: string): Promise<void>;
}) {
  for (const title of searchTitles) {
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
  }
}

async function expectLegacyEmptySearchBaseline(page: Page, target: RuntimeTarget) {
  await openLegacyPatientPortalMessages(page, target);
  const activeSearchInputExposed = await page.getByLabel(/search/i).count() > 0;
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
    sentTitleVisible: sentBodyText.includes(sentTitle),
    deletedTitleVisible: archiveBodyText.includes(deletedTitle),
    noActiveEmptySearchAffordance: activeSearchInputExposed === false,
    sentBodyText: normalizeText(sentBodyText),
    archiveBodyText: normalizeText(archiveBodyText)
  };
}

async function expectModernizedEmptySearch(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const inboxRegion = page.getByRole("region", { name: "Inbox secure messages" });
  const sentRegion = page.getByRole("region", { name: "Sent secure messages" });
  const allRegion = page.getByRole("region", { name: "All secure messages" });
  const deletedRegion = page.getByRole("region", { name: "Deleted secure messages" });
  const searchInput = page.getByLabel("Search secure messages");

  await expect(inboxRegion).toContainText(inboxTitle);
  await expect(sentRegion).toContainText(sentTitle);
  await expect(allRegion).toContainText(inboxTitle);
  await expect(allRegion).toContainText(sentTitle);
  await expect(deletedRegion).toContainText(deletedTitle);
  const beforeSearch = await captureModernizedEmptySearchState(page);

  await searchInput.fill(noHitQuery);
  await expect(page.getByLabel("Inbox secure messages empty state")).toContainText(`No inbox secure messages match "${noHitQuery}"`);
  await expect(page.getByLabel("Sent secure messages empty state")).toContainText(`No sent secure messages match "${noHitQuery}"`);
  await expect(page.getByLabel("All secure messages empty state")).toContainText(`No secure messages in All match "${noHitQuery}"`);
  await expect(page.getByLabel("Deleted secure messages empty state")).toContainText(`No deleted secure messages match "${noHitQuery}"`);
  await expect(inboxRegion).not.toContainText(inboxTitle);
  await expect(sentRegion).not.toContainText(sentTitle);
  await expect(allRegion).not.toContainText(inboxTitle);
  await expect(allRegion).not.toContainText(sentTitle);
  await expect(deletedRegion).not.toContainText(deletedTitle);
  const afterNoHitSearch = await captureModernizedEmptySearchState(page);

  await searchInput.fill("");
  await expect(inboxRegion).toContainText(inboxTitle);
  await expect(sentRegion).toContainText(sentTitle);
  await expect(allRegion).toContainText(inboxTitle);
  await expect(allRegion).toContainText(sentTitle);
  await expect(deletedRegion).toContainText(deletedTitle);
  const afterClear = await captureModernizedEmptySearchState(page);

  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    beforeSearch,
    afterNoHitSearch,
    afterClear
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

async function captureModernizedEmptySearchState(page: Page) {
  const searchInput = page.getByLabel("Search secure messages");
  const inboxText = await page.getByRole("region", { name: "Inbox secure messages" }).textContent();
  const sentText = await page.getByRole("region", { name: "Sent secure messages" }).textContent();
  const allText = await page.getByRole("region", { name: "All secure messages" }).textContent();
  const deletedText = await page.getByRole("region", { name: "Deleted secure messages" }).textContent();

  return {
    query: await searchInput.inputValue(),
    inboxTitleVisible: inboxText?.includes(inboxTitle) ?? false,
    sentTitleVisible: sentText?.includes(sentTitle) ?? false,
    inboxTitleVisibleInAll: allText?.includes(inboxTitle) ?? false,
    sentTitleVisibleInAll: allText?.includes(sentTitle) ?? false,
    deletedTitleVisible: deletedText?.includes(deletedTitle) ?? false,
    inboxEmptyStateVisible: inboxText?.includes(`No inbox secure messages match "${noHitQuery}"`) ?? false,
    sentEmptyStateVisible: sentText?.includes(`No sent secure messages match "${noHitQuery}"`) ?? false,
    allEmptyStateVisible: allText?.includes(`No secure messages in All match "${noHitQuery}"`) ?? false,
    deletedEmptyStateVisible: deletedText?.includes(`No deleted secure messages match "${noHitQuery}"`) ?? false,
    inboxText: normalizeText(inboxText),
    sentText: normalizeText(sentText),
    allText: normalizeText(allText),
    deletedText: normalizeText(deletedText)
  };
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

function summarizeNoHitSearch(noHitSearch: Record<"inbox" | "sent" | "all" | "deleted", PatientPortalMessageItem[]>) {
  return {
    inbox: { count: noHitSearch.inbox.length, titles: noHitSearch.inbox.map((message) => message.title) },
    sent: { count: noHitSearch.sent.length, titles: noHitSearch.sent.map((message) => message.title) },
    all: { count: noHitSearch.all.length, titles: noHitSearch.all.map((message) => message.title) },
    deleted: { count: noHitSearch.deleted.length, titles: noHitSearch.deleted.map((message) => message.title) }
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
