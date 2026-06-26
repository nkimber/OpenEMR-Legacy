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
const matchingTitle = "Slice 519 secure message selection search match";
const hiddenSelectedTitle = "Slice 519 secure message selection hidden";
const matchingBody = "Slice 519 matching body contains needle-519-selection.";
const hiddenSelectedBody = "Slice 519 selected row should be hidden after the search filter changes.";
const searchQuery = "needle-519-selection";
const searchTitles = [matchingTitle, hiddenSelectedTitle];

test.describe("patient portal secure-message search selection parity @slice519 @workflow-patient-portal-message-search-selection @patients @portal @messages", () => {
  test("clears selected secure-message rows when search hides them", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    await cleanupSearchSelectionMessages(workflow);
    const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-519-patient-portal-message-search-selection-precondition",
      description: "Captures the Slice 519 search-selection precondition: the portal account exists and temporary inbox rows are absent before setup.",
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
        suite: "workflow-patient-portal-message-search-selection",
        workflow: "patient-portal-message-search-selection-precondition"
      }
    });

    try {
      const matchingMessage = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        senderName: "Administrator",
        title: matchingTitle,
        body: matchingBody
      });
      const hiddenSelectedMessage = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        senderName: "Administrator",
        title: hiddenSelectedTitle,
        body: hiddenSelectedBody
      });

      const afterSetup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const filtered = filterMessagesLikePortal(afterSetup.messages, searchQuery);
      expect(filtered.map((message) => message.title)).toContain(matchingTitle);
      expect(filtered.map((message) => message.title)).not.toContain(hiddenSelectedTitle);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-519-patient-portal-message-search-selection-result",
        description: "Captures the Slice 519 data result: the shared query hides the row selected before searching and keeps only the matching row.",
        expected: {
          query: searchQuery,
          matchingTitleVisibleAfterSearch: true,
          hiddenSelectedTitleHiddenAfterSearch: true
        },
        actual: {
          setup: {
            matchingMessage: summarizeMessage(matchingMessage),
            hiddenSelectedMessage: summarizeMessage(hiddenSelectedMessage)
          },
          mailbox: summarizeMailboxForTitles(afterSetup),
          filteredTitles: filtered.map((message) => message.title)
        },
        context: {
          suite: "workflow-patient-portal-message-search-selection",
          workflow: "patient-portal-message-search-selection-result"
        }
      });

      const surface = target.type === "legacy-openemr"
        ? await expectLegacySearchSelectionBaseline(page, target)
        : await expectModernizedSearchSelection(page, target);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: `slice-519-patient-portal-message-search-selection-${target.type === "legacy-openemr" ? "legacy" : "modernized"}-ui`,
        description: target.type === "legacy-openemr"
          ? "Captures the Slice 519 legacy portal search-selection baseline: temporary inbox rows render but the installed template exposes no active search filter to hide selected rows."
          : "Captures the Slice 519 modernized Portal search-selection UI: changing search clears hidden selected rows and disables Archive selected.",
        expected: target.type === "legacy-openemr"
          ? {
              activeSearchInputExposed: false,
              bothTitlesVisible: true
            }
          : {
              selectedCountBeforeSearch: "1 selected",
              selectedCountAfterSearch: "0 selected",
              archiveSelectedDisabledAfterSearch: true,
              hiddenSelectedTitleHiddenAfterSearch: true
            },
        actual: surface,
        context: {
          suite: "workflow-patient-portal-message-search-selection",
          workflow: "patient-portal-message-search-selection-ui"
        }
      });
    } finally {
      await cleanupSearchSelectionMessages(workflow);
      const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-519-patient-portal-message-search-selection-cleanup",
        description: "Captures the Slice 519 cleanup state after removing temporary search-selection inbox rows.",
        expected: {
          searchTitlesAbsentFromInbox: searchTitles,
          searchTitlesAbsentFromAll: searchTitles
        },
        actual: summarizeMailboxForTitles(cleanup),
        context: {
          suite: "workflow-patient-portal-message-search-selection",
          workflow: "patient-portal-message-search-selection-cleanup"
        }
      });
    }
  });
});

async function cleanupSearchSelectionMessages(workflow: {
  cleanupPatientPortalComposedMessage(portalUsername: string, title: string): Promise<void>;
}) {
  for (const title of searchTitles) {
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
  }
}

async function expectLegacySearchSelectionBaseline(page: Page, target: RuntimeTarget) {
  await openLegacyPatientPortalMessages(page, target);
  await expect(page.locator("body")).toContainText(matchingTitle);
  await expect(page.locator("body")).toContainText(hiddenSelectedTitle);
  const bodyText = await page.locator("body").innerText();

  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    activeSearchInputExposed: await page.getByLabel(/search/i).count() > 0,
    bothTitlesVisible: bodyText.includes(matchingTitle) && bodyText.includes(hiddenSelectedTitle),
    bodyText: normalizeText(bodyText)
  };
}

async function expectModernizedSearchSelection(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const inbox = page.getByRole("region", { name: "Inbox secure messages" });
  const searchInput = page.getByLabel("Search secure messages");
  const batchActions = page.getByLabel("Secure message batch actions");
  const archiveSelected = page.getByRole("button", { name: "Archive selected" });
  const selectedCount = batchActions.locator(".message-selection-count");

  await expect(inbox).toContainText(matchingTitle);
  await expect(inbox).toContainText(hiddenSelectedTitle);
  await expect(archiveSelected).toBeDisabled();

  await page.getByLabel(`Select secure message ${hiddenSelectedTitle}`).check();
  await expect(selectedCount).toHaveText("1 selected");
  await expect(archiveSelected).toBeEnabled();
  const beforeSearch = await captureModernizedSelectionState(page);

  await searchInput.fill(searchQuery);
  await expect(inbox).toContainText(matchingTitle);
  await expect(inbox).not.toContainText(hiddenSelectedTitle);
  await expect(selectedCount).toHaveText("0 selected");
  await expect(archiveSelected).toBeDisabled();
  const afterSearch = await captureModernizedSelectionState(page);

  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    beforeSearch,
    afterSearch
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

async function captureModernizedSelectionState(page: Page) {
  const inboxText = await page.getByRole("region", { name: "Inbox secure messages" }).textContent();
  const batchActions = page.getByLabel("Secure message batch actions");
  const archiveSelected = page.getByRole("button", { name: "Archive selected" });
  return {
    query: await page.getByLabel("Search secure messages").inputValue(),
    selectedCount: normalizeText(await batchActions.locator(".message-selection-count").textContent()),
    archiveSelectedEnabled: await archiveSelected.isEnabled(),
    matchingTitleVisible: inboxText?.includes(matchingTitle) ?? false,
    hiddenSelectedTitleVisible: inboxText?.includes(hiddenSelectedTitle) ?? false,
    hiddenSelectedCheckboxCount: await page.getByLabel(`Select secure message ${hiddenSelectedTitle}`).count(),
    inboxText: normalizeText(inboxText)
  };
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
