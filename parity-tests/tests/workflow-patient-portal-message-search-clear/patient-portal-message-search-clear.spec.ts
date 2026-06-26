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
const matchingTitle = "Slice 517 secure message clear-search match";
const restoredTitle = "Slice 517 secure message clear-search restored";
const matchingBody = "Slice 517 matching body contains needle-517-clear.";
const restoredBody = "Slice 517 restored body should return after clearing search.";
const searchQuery = "needle-517-clear";
const searchTitles = [matchingTitle, restoredTitle];

test.describe("patient portal secure-message clear search parity @slice517 @workflow-patient-portal-message-search-clear @patients @portal @messages", () => {
  test("clears secure-message search and restores folder rows", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();
    await cleanupClearSearchMessages(workflow);
    const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-517-patient-portal-message-search-clear-precondition",
      description: "Captures the Slice 517 clear-search precondition: the portal account exists and temporary inbox rows are absent before setup.",
      expected: {
        canonicalId: portalMessageAnchorPatientId,
        portalUsername: portalLoginUsername,
        searchTitlesAbsentFromInbox: searchTitles
      },
      actual: {
        patient,
        mailbox: summarizeMailboxForTitles(before)
      },
      context: {
        suite: "workflow-patient-portal-message-search-clear",
        workflow: "patient-portal-message-search-clear-precondition"
      }
    });

    try {
      const matchingMessage = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        senderName: "Administrator",
        title: matchingTitle,
        body: matchingBody
      });
      const restoredMessage = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        senderName: "Administrator",
        title: restoredTitle,
        body: restoredBody
      });

      const afterSetup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const filtered = filterMessagesLikePortal(afterSetup.messages, searchQuery);
      const cleared = afterSetup.messages.filter((message) => searchTitles.includes(message.title));
      expect(filtered.map((message) => message.title)).toContain(matchingTitle);
      expect(filtered.map((message) => message.title)).not.toContain(restoredTitle);
      expect(cleared.map((message) => message.title)).toEqual(expect.arrayContaining(searchTitles));

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-517-patient-portal-message-search-clear-result",
        description: "Captures the Slice 517 clear-search data result: the query narrows Inbox to the matching row and clearing search restores both cleanup-backed rows.",
        expected: {
          query: searchQuery,
          matchingTitleVisibleAfterSearch: true,
          restoredTitleHiddenAfterSearch: true,
          bothTitlesVisibleAfterClear: true
        },
        actual: {
          setup: {
            matchingMessage: summarizeMessage(matchingMessage),
            restoredMessage: summarizeMessage(restoredMessage)
          },
          mailbox: summarizeMailboxForTitles(afterSetup),
          filteredTitles: filtered.map((message) => message.title),
          clearedTitles: cleared.map((message) => message.title)
        },
        context: {
          suite: "workflow-patient-portal-message-search-clear",
          workflow: "patient-portal-message-search-clear-result"
        }
      });

      const surface = target.type === "legacy-openemr"
        ? await expectLegacySearchClearBaseline(page, target)
        : await expectModernizedSearchClear(page, target);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: `slice-517-patient-portal-message-search-clear-${target.type === "legacy-openemr" ? "legacy" : "modernized"}-ui`,
        description: target.type === "legacy-openemr"
          ? "Captures the Slice 517 legacy portal clear-search baseline: temporary inbox rows render but the installed template exposes no active search or clear-search control."
          : "Captures the Slice 517 modernized Portal clear-search UI: the Clear search button removes the query, resets the summary, and restores the inbox rows.",
        expected: target.type === "legacy-openemr"
          ? {
              activeSearchInputExposed: false,
              clearSearchControlExposed: false,
              bothTitlesVisible: true
            }
          : {
              clearButtonEnabledAfterSearch: true,
              restoredTitleHiddenAfterSearch: true,
              bothTitlesVisibleAfterClear: true,
              searchReadySummaryVisibleAfterClear: true
            },
        actual: surface,
        context: {
          suite: "workflow-patient-portal-message-search-clear",
          workflow: "patient-portal-message-search-clear-ui"
        }
      });
    } finally {
      await cleanupClearSearchMessages(workflow);
      const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-517-patient-portal-message-search-clear-cleanup",
        description: "Captures the Slice 517 cleanup state after removing temporary clear-search inbox rows.",
        expected: {
          searchTitlesAbsentFromInbox: searchTitles,
          searchTitlesAbsentFromAll: searchTitles
        },
        actual: summarizeMailboxForTitles(cleanup),
        context: {
          suite: "workflow-patient-portal-message-search-clear",
          workflow: "patient-portal-message-search-clear-cleanup"
        }
      });
    }
  });
});

async function cleanupClearSearchMessages(workflow: {
  cleanupPatientPortalComposedMessage(portalUsername: string, title: string): Promise<void>;
}) {
  for (const title of searchTitles) {
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
  }
}

async function expectLegacySearchClearBaseline(page: Page, target: RuntimeTarget) {
  await openLegacyPatientPortalMessages(page, target);
  await expect(page.locator("body")).toContainText(matchingTitle);
  await expect(page.locator("body")).toContainText(restoredTitle);
  const bodyText = await page.locator("body").innerText();

  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    activeSearchInputExposed: await page.getByLabel(/search/i).count() > 0,
    clearSearchControlExposed: await page.getByRole("button", { name: /clear search/i }).count() > 0,
    bothTitlesVisible: bodyText.includes(matchingTitle) && bodyText.includes(restoredTitle),
    bodyText: normalizeText(bodyText)
  };
}

async function expectModernizedSearchClear(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const inbox = page.getByRole("region", { name: "Inbox secure messages" });
  const searchInput = page.getByLabel("Search secure messages");
  const clearButton = page.getByRole("button", { name: "Clear secure message search" });
  const summary = page.getByLabel("Secure message search result counts");

  await expect(inbox).toContainText(matchingTitle);
  await expect(inbox).toContainText(restoredTitle);
  await expect(clearButton).toBeDisabled();
  const beforeSearch = await captureModernizedClearState(page);

  await searchInput.fill(searchQuery);
  await expect(clearButton).toBeEnabled();
  await expect(inbox).toContainText(matchingTitle);
  await expect(inbox).not.toContainText(restoredTitle);
  await expect(summary).toContainText(`Search "${searchQuery}" results:`);
  const afterSearch = await captureModernizedClearState(page);

  await clearButton.click();
  await expect(searchInput).toHaveValue("");
  await expect(clearButton).toBeDisabled();
  await expect(inbox).toContainText(matchingTitle);
  await expect(inbox).toContainText(restoredTitle);
  await expect(summary).toContainText("Search ready:");
  const afterClear = await captureModernizedClearState(page);

  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    beforeSearch,
    afterSearch,
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

async function captureModernizedClearState(page: Page) {
  const inboxText = await page.getByRole("region", { name: "Inbox secure messages" }).textContent();
  const clearButton = page.getByRole("button", { name: "Clear secure message search" });
  return {
    query: await page.getByLabel("Search secure messages").inputValue(),
    summary: normalizeText(await page.getByLabel("Secure message search result counts").textContent()),
    clearButtonEnabled: await clearButton.isEnabled(),
    matchingTitleVisible: inboxText?.includes(matchingTitle) ?? false,
    restoredTitleVisible: inboxText?.includes(restoredTitle) ?? false,
    inboxText: normalizeText(inboxText)
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
  const allTitles = new Set(mailbox.allMessages.map((message) => message.title));
  return {
    authenticated: mailbox.authenticated,
    canonicalId: mailbox.canonicalId,
    portalUsername: mailbox.portalUsername,
    messageCount: mailbox.messageCount,
    allMessageCount: mailbox.allMessageCount,
    matchingInboxMessages: mailbox.messages.filter((message) => searchTitles.includes(message.title)).map(summarizeMessage),
    matchingAllMessages: mailbox.allMessages.filter((message) => searchTitles.includes(message.title)).map(summarizeMessage),
    remainingInboxTitles: searchTitles.filter((title) => inboxTitles.has(title)),
    remainingAllTitles: searchTitles.filter((title) => allTitles.has(title))
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
