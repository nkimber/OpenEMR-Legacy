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
const sentSearchTitle = "Slice 514 secure message sent search";
const deletedSearchTitle = "Slice 514 secure message deleted search";
const sentSearchBody = "Slice 514 sent folder body contains needle-514-sent.";
const deletedSearchBody = "Slice 514 deleted folder body contains needle-514-deleted.";
const sentSearchQuery = "needle-514-sent";
const deletedSearchQuery = "needle-514-deleted";
const searchTitles = [sentSearchTitle, deletedSearchTitle];

test.describe("patient portal secure-message folder search parity @slice514 @workflow-patient-portal-message-folder-search @patients @portal @messages", () => {
  test("filters sent, all, and deleted secure-message folder projections", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(300_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();
    await cleanupFolderSearchMessages(workflow);
    const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-514-patient-portal-message-folder-search-precondition",
      description: "Captures the Slice 514 folder-search precondition: the portal account exists and temporary Sent/Deleted search titles are absent before cleanup-backed rows are created.",
      expected: {
        canonicalId: portalMessageAnchorPatientId,
        portalUsername: portalLoginUsername,
        titlesAbsentFromSentAllAndDeleted: searchTitles
      },
      actual: {
        patient,
        mailbox: summarizeMailboxForTitles(before)
      },
      context: {
        suite: "workflow-patient-portal-message-folder-search",
        workflow: "patient-portal-message-folder-search-precondition"
      }
    });

    try {
      const sentCompose = await workflow.composePatientPortalMessage(portalLoginUsername, portalPassword, {
        recipientId: "admin",
        title: sentSearchTitle,
        body: sentSearchBody
      });
      expect(sentCompose.created).toBe(true);
      expect(sentCompose.sentMessage).toBeTruthy();

      const deletedInbox = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        senderName: "Administrator",
        title: deletedSearchTitle,
        body: deletedSearchBody
      });
      const archivedDeleted = await workflow.deletePatientPortalMessage(
        portalLoginUsername,
        portalPassword,
        deletedInbox.id
      );
      expect(archivedDeleted.deleted).toBe(true);

      const afterSetup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const sentMatches = filterMessagesLikePortal(afterSetup.sentMessages, sentSearchQuery);
      const allMatches = filterMessagesLikePortal(afterSetup.allMessages, sentSearchQuery);
      const deletedMatches = filterMessagesLikePortal(afterSetup.deletedMessages, deletedSearchQuery);

      expect(sentMatches.map((message) => message.title)).toContain(sentSearchTitle);
      expect(allMatches.map((message) => message.title)).toContain(sentSearchTitle);
      expect(deletedMatches.map((message) => message.title)).toContain(deletedSearchTitle);
      expect(afterSetup.sentMessages.some((message) => message.title === deletedSearchTitle)).toBe(false);
      expect(afterSetup.allMessages.some((message) => message.title === deletedSearchTitle)).toBe(false);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-514-patient-portal-message-folder-search-result",
        description: "Captures the Slice 514 folder-search data result: Sent and All folder projections match the sent query while Deleted folder projections match the archived-message query.",
        expected: {
          sentQuery: sentSearchQuery,
          deletedQuery: deletedSearchQuery,
          sentTitleFoundInSentSearch: true,
          sentTitleFoundInAllSearch: true,
          deletedTitleFoundInDeletedSearch: true,
          deletedTitleAbsentFromActiveFolders: true
        },
        actual: {
          setup: {
            sentMessage: sentCompose.sentMessage ? summarizeMessage(sentCompose.sentMessage) : null,
            deletedInbox: summarizeMessage(deletedInbox),
            archivedDeleted: {
              deleted: archivedDeleted.deleted,
              deletedMessage: archivedDeleted.deletedMessage ? summarizeMessage(archivedDeleted.deletedMessage) : null,
              failureReason: archivedDeleted.failureReason
            }
          },
          mailbox: summarizeMailboxForTitles(afterSetup),
          sentSearch: summarizeSearch(sentMatches),
          allSearch: summarizeSearch(allMatches),
          deletedSearch: summarizeSearch(deletedMatches)
        },
        context: {
          suite: "workflow-patient-portal-message-folder-search",
          workflow: "patient-portal-message-folder-search-result"
        }
      });

      const surface = target.type === "legacy-openemr"
        ? await expectLegacyFolderSearchBaseline(page, target)
        : await expectModernizedFolderSearch(page, target);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: `slice-514-patient-portal-message-folder-search-${target.type === "legacy-openemr" ? "legacy" : "modernized"}-ui`,
        description: target.type === "legacy-openemr"
          ? "Captures the Slice 514 legacy portal folder-search baseline: Sent and Archive folders render the temporary rows but the installed template exposes no active search input."
          : "Captures the Slice 514 modernized Portal folder-search UI: the shared search field filters Sent, All, and Deleted folder regions by the active query.",
        expected: target.type === "legacy-openemr"
          ? {
              activeSearchInputExposed: false,
              sentTitleVisible: true,
              deletedTitleVisible: true
            }
          : {
              sentQuery: sentSearchQuery,
              deletedQuery: deletedSearchQuery,
              sentTitleVisibleInSentAndAllSearch: true,
              deletedTitleVisibleInDeletedSearch: true
            },
        actual: surface,
        context: {
          suite: "workflow-patient-portal-message-folder-search",
          workflow: "patient-portal-message-folder-search-ui"
        }
      });
    } finally {
      await cleanupFolderSearchMessages(workflow);
      const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-514-patient-portal-message-folder-search-cleanup",
        description: "Captures the Slice 514 cleanup state after removing temporary Sent and Deleted secure-message search rows.",
        expected: {
          searchTitlesAbsentFromSentAllAndDeleted: searchTitles
        },
        actual: summarizeMailboxForTitles(cleanup),
        context: {
          suite: "workflow-patient-portal-message-folder-search",
          workflow: "patient-portal-message-folder-search-cleanup"
        }
      });
    }
  });
});

async function cleanupFolderSearchMessages(workflow: {
  cleanupPatientPortalComposedMessage(portalUsername: string, title: string): Promise<void>;
}) {
  for (const title of searchTitles) {
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
  }
}

async function expectLegacyFolderSearchBaseline(page: Page, target: RuntimeTarget) {
  await openLegacyPatientPortalMessages(page, target);
  const activeSearchInputExposed = await page.getByLabel(/search/i).count() > 0;
  await page.getByText("Sent", { exact: false }).first().click();
  await expect(page.locator("body")).toContainText(sentSearchTitle);
  const sentBodyText = await page.locator("body").innerText();
  await page.getByText("Archive", { exact: false }).first().click();
  await expect(page.locator("body")).toContainText(deletedSearchTitle);
  const archiveBodyText = await page.locator("body").innerText();
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    activeSearchInputExposed,
    sentTitleVisible: sentBodyText.includes(sentSearchTitle),
    deletedTitleVisible: archiveBodyText.includes(deletedSearchTitle),
    sentBodyText: normalizeText(sentBodyText),
    archiveBodyText: normalizeText(archiveBodyText)
  };
}

async function expectModernizedFolderSearch(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const sentRegion = page.getByRole("region", { name: "Sent secure messages" });
  const allRegion = page.getByRole("region", { name: "All secure messages" });
  const deletedRegion = page.getByRole("region", { name: "Deleted secure messages" });
  const searchInput = page.getByLabel("Search secure messages");

  await expect(sentRegion).toContainText(sentSearchTitle);
  await expect(allRegion).toContainText(sentSearchTitle);
  await expect(deletedRegion).toContainText(deletedSearchTitle);

  await searchInput.fill(sentSearchQuery);
  await expect(sentRegion).toContainText(sentSearchTitle);
  await expect(allRegion).toContainText(sentSearchTitle);
  await expect(deletedRegion).not.toContainText(deletedSearchTitle);
  const sentSearchState = await captureModernizedFolderSearchState(page);

  await searchInput.fill(deletedSearchQuery);
  await expect(deletedRegion).toContainText(deletedSearchTitle);
  await expect(sentRegion).not.toContainText(sentSearchTitle);
  await expect(allRegion).not.toContainText(sentSearchTitle);
  const deletedSearchState = await captureModernizedFolderSearchState(page);

  await searchInput.fill("");
  await expect(sentRegion).toContainText(sentSearchTitle);
  await expect(deletedRegion).toContainText(deletedSearchTitle);
  const clearedState = await captureModernizedFolderSearchState(page);

  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    sentSearchState,
    deletedSearchState,
    clearedState
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

async function captureModernizedFolderSearchState(page: Page) {
  const searchInput = page.getByLabel("Search secure messages");
  const sentRegion = page.getByRole("region", { name: "Sent secure messages" });
  const allRegion = page.getByRole("region", { name: "All secure messages" });
  const deletedRegion = page.getByRole("region", { name: "Deleted secure messages" });
  const sentText = await sentRegion.textContent();
  const allText = await allRegion.textContent();
  const deletedText = await deletedRegion.textContent();
  return {
    query: await searchInput.inputValue(),
    sentTitleVisible: sentText?.includes(sentSearchTitle) ?? false,
    deletedTitleVisibleInSent: sentText?.includes(deletedSearchTitle) ?? false,
    sentTitleVisibleInAll: allText?.includes(sentSearchTitle) ?? false,
    deletedTitleVisibleInAll: allText?.includes(deletedSearchTitle) ?? false,
    sentTitleVisibleInDeleted: deletedText?.includes(sentSearchTitle) ?? false,
    deletedTitleVisible: deletedText?.includes(deletedSearchTitle) ?? false,
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
    matchingSentMessages: mailbox.sentMessages.filter((message) => searchTitles.includes(message.title)).map(summarizeMessage),
    matchingAllMessages: mailbox.allMessages.filter((message) => searchTitles.includes(message.title)).map(summarizeMessage),
    matchingDeletedMessages: mailbox.deletedMessages.filter((message) => searchTitles.includes(message.title)).map(summarizeMessage),
    remainingSentTitles: searchTitles.filter((title) => sentTitles.has(title)),
    remainingAllTitles: searchTitles.filter((title) => allTitles.has(title)),
    remainingDeletedTitles: searchTitles.filter((title) => deletedTitles.has(title))
  };
}

function summarizeSearch(messages: PatientPortalMessageItem[]) {
  return {
    count: messages.length,
    titles: messages.map((message) => message.title),
    messages: messages.filter((message) => searchTitles.includes(message.title)).map(summarizeMessage)
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
