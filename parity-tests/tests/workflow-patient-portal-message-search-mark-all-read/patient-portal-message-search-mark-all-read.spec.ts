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
const matchingTitle = "Slice 520 secure message search mark-all match";
const hiddenUnreadTitle = "Slice 520 secure message search mark-all hidden";
const matchingBody = "Slice 520 matching body contains needle-520-mark-all.";
const hiddenUnreadBody = "Slice 520 hidden row should stay unread when filtered away.";
const searchQuery = "needle-520-mark-all";
const searchTitles = [matchingTitle, hiddenUnreadTitle];

test.describe("patient portal secure-message search mark-all-read parity @slice520 @workflow-patient-portal-message-search-mark-all-read @patients @portal @messages", () => {
  test("marks only filtered secure-message rows read in the browser", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    await cleanupSearchMarkAllReadMessages(workflow);
    const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-520-patient-portal-message-search-mark-all-read-precondition",
      description: "Captures the Slice 520 search mark-all-read precondition: the portal account exists and temporary inbox rows are absent before setup.",
      expected: {
        canonicalId: portalMessageAnchorPatientId,
        portalUsername: portalLoginUsername,
        searchTitlesAbsentFromInbox: searchTitles,
        initialStatus: "New"
      },
      actual: {
        patient,
        mailbox: summarizeMailboxForTitles(before)
      },
      context: {
        suite: "workflow-patient-portal-message-search-mark-all-read",
        workflow: "patient-portal-message-search-mark-all-read-precondition"
      }
    });

    try {
      const matchingMessage = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        senderName: "Administrator",
        title: matchingTitle,
        body: matchingBody
      });
      const hiddenUnreadMessage = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        senderName: "Administrator",
        title: hiddenUnreadTitle,
        body: hiddenUnreadBody
      });

      const afterSetup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const filtered = filterMessagesLikePortal(afterSetup.messages, searchQuery);
      expect(filtered.map((message) => message.title)).toContain(matchingTitle);
      expect(filtered.map((message) => message.title)).not.toContain(hiddenUnreadTitle);
      for (const title of searchTitles) {
        expect(afterSetup.messages.find((message) => message.title === title)).toMatchObject({ title, status: "New" });
      }

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-520-patient-portal-message-search-mark-all-read-result",
        description: "Captures the Slice 520 data result: the shared query hides one unread row and keeps one matching unread row before the browser-only action.",
        expected: {
          query: searchQuery,
          matchingTitleVisibleAfterSearch: true,
          hiddenUnreadTitleHiddenAfterSearch: true,
          persistedStatusesRemainNew: true
        },
        actual: {
          setup: {
            matchingMessage: summarizeMessage(matchingMessage),
            hiddenUnreadMessage: summarizeMessage(hiddenUnreadMessage)
          },
          mailbox: summarizeMailboxForTitles(afterSetup),
          filteredTitles: filtered.map((message) => message.title)
        },
        context: {
          suite: "workflow-patient-portal-message-search-mark-all-read",
          workflow: "patient-portal-message-search-mark-all-read-result"
        }
      });

      const surface = target.type === "legacy-openemr"
        ? await expectLegacySearchMarkAllBaseline(page, target)
        : await expectModernizedSearchMarkAllRead(page, target);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: `slice-520-patient-portal-message-search-mark-all-read-${target.type === "legacy-openemr" ? "legacy" : "modernized"}-ui`,
        description: target.type === "legacy-openemr"
          ? "Captures the Slice 520 legacy portal search mark-all baseline: temporary unread rows render but the installed template exposes no active search filter."
          : "Captures the Slice 520 modernized Portal filtered mark-all UI: Mark all as read affects the filtered matching row while the hidden row remains New after clearing search.",
        expected: target.type === "legacy-openemr"
          ? {
              activeSearchInputExposed: false,
              bothTitlesVisible: true
            }
          : {
              matchingStatusAfterMarkAll: "Read",
              hiddenUnreadStatusAfterClear: "New",
              markAllScopedToFilteredRows: true
            },
        actual: surface,
        context: {
          suite: "workflow-patient-portal-message-search-mark-all-read",
          workflow: "patient-portal-message-search-mark-all-read-ui"
        }
      });
    } finally {
      await cleanupSearchMarkAllReadMessages(workflow);
      const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-520-patient-portal-message-search-mark-all-read-cleanup",
        description: "Captures the Slice 520 cleanup state after removing temporary search mark-all-read inbox rows.",
        expected: {
          searchTitlesAbsentFromInbox: searchTitles,
          searchTitlesAbsentFromAll: searchTitles
        },
        actual: summarizeMailboxForTitles(cleanup),
        context: {
          suite: "workflow-patient-portal-message-search-mark-all-read",
          workflow: "patient-portal-message-search-mark-all-read-cleanup"
        }
      });
    }
  });
});

async function cleanupSearchMarkAllReadMessages(workflow: {
  cleanupPatientPortalComposedMessage(portalUsername: string, title: string): Promise<void>;
}) {
  for (const title of searchTitles) {
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
  }
}

async function expectLegacySearchMarkAllBaseline(page: Page, target: RuntimeTarget) {
  await openLegacyPatientPortalMessages(page, target);
  await expect(page.locator("body")).toContainText(matchingTitle);
  await expect(page.locator("body")).toContainText(hiddenUnreadTitle);
  const bodyText = await page.locator("body").innerText();

  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    activeSearchInputExposed: await page.getByLabel(/search/i).count() > 0,
    bothTitlesVisible: bodyText.includes(matchingTitle) && bodyText.includes(hiddenUnreadTitle),
    bodyText: normalizeText(bodyText)
  };
}

async function expectModernizedSearchMarkAllRead(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const inbox = page.getByRole("region", { name: "Inbox secure messages" });
  const searchInput = page.getByLabel("Search secure messages");
  const clearSearch = page.getByRole("button", { name: "Clear secure message search" });
  const markAllRead = page.getByRole("button", { name: "Mark all as read" });

  await expect(getMessageCard(inbox, matchingTitle).locator(".status-pill")).toContainText("New");
  await expect(getMessageCard(inbox, hiddenUnreadTitle).locator(".status-pill")).toContainText("New");
  const beforeSearch = await captureModernizedMarkAllSearchState(page);

  await searchInput.fill(searchQuery);
  await expect(inbox).toContainText(matchingTitle);
  await expect(inbox).not.toContainText(hiddenUnreadTitle);
  await expect(markAllRead).toBeEnabled();
  const afterSearch = await captureModernizedMarkAllSearchState(page);

  await markAllRead.click();
  await expect(getMessageCard(inbox, matchingTitle).locator(".status-pill")).toContainText("Read");
  const afterMarkAll = await captureModernizedMarkAllSearchState(page);

  await clearSearch.click();
  await expect(inbox).toContainText(hiddenUnreadTitle);
  await expect(getMessageCard(inbox, matchingTitle).locator(".status-pill")).toContainText("Read");
  await expect(getMessageCard(inbox, hiddenUnreadTitle).locator(".status-pill")).toContainText("New");
  const afterClear = await captureModernizedMarkAllSearchState(page);

  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    beforeSearch,
    afterSearch,
    afterMarkAll,
    afterClear
  };
}

function getMessageCard(inbox: ReturnType<Page["getByRole"]>, title: string) {
  return inbox.locator("article.message-item").filter({ hasText: title }).first();
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

async function captureModernizedMarkAllSearchState(page: Page) {
  const inbox = page.getByRole("region", { name: "Inbox secure messages" });
  const matchingCard = getMessageCard(inbox, matchingTitle);
  const hiddenCard = getMessageCard(inbox, hiddenUnreadTitle);
  return {
    query: await page.getByLabel("Search secure messages").inputValue(),
    markAllReadEnabled: await page.getByRole("button", { name: "Mark all as read" }).isEnabled(),
    matchingTitleVisible: await matchingCard.count() > 0 && await matchingCard.isVisible(),
    hiddenUnreadTitleVisible: await hiddenCard.count() > 0 && await hiddenCard.isVisible(),
    matchingStatus: await getStatusText(matchingCard),
    hiddenUnreadStatus: await getStatusText(hiddenCard),
    inboxText: normalizeText(await inbox.textContent())
  };
}

async function getStatusText(card: ReturnType<Page["locator"]>) {
  if (await card.count() === 0) {
    return null;
  }

  return normalizeText(await card.locator(".status-pill").textContent());
}

function filterMessagesLikePortal(messages: PatientPortalMessageItem[], query: string) {
  const needle = query.trim().toLowerCase();
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
