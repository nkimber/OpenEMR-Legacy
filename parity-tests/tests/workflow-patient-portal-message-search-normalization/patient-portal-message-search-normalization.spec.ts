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
const matchingTitle = "Slice 518 secure message normalized search match";
const decoyTitle = "Slice 518 secure message normalized search decoy";
const matchingBody = "Slice 518 matching body contains needle-518-normalized.";
const decoyBody = "Slice 518 decoy body should not match the normalized query.";
const rawSearchQuery = "  NEEDLE-518-NORMALIZED  ";
const normalizedSearchQuery = "NEEDLE-518-NORMALIZED";
const searchTitles = [matchingTitle, decoyTitle];

test.describe("patient portal secure-message normalized search parity @slice518 @workflow-patient-portal-message-search-normalization @patients @portal @messages", () => {
  test("matches padded mixed-case secure-message search text and exposes a live result summary", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    await cleanupNormalizedSearchMessages(workflow);
    const before = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-518-patient-portal-message-search-normalization-precondition",
      description: "Captures the Slice 518 normalized-search precondition: the portal account exists and temporary inbox rows are absent before setup.",
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
        suite: "workflow-patient-portal-message-search-normalization",
        workflow: "patient-portal-message-search-normalization-precondition"
      }
    });

    try {
      const matchingMessage = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        senderName: "Administrator",
        title: matchingTitle,
        body: matchingBody
      });
      const decoyMessage = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        senderId: "admin",
        senderName: "Administrator",
        title: decoyTitle,
        body: decoyBody
      });

      const afterSetup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const filtered = filterMessagesLikePortal(afterSetup.messages, rawSearchQuery);
      expect(filtered.map((message) => message.title)).toContain(matchingTitle);
      expect(filtered.map((message) => message.title)).not.toContain(decoyTitle);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-518-patient-portal-message-search-normalization-result",
        description: "Captures the Slice 518 normalized-search data result: a padded mixed-case query is trimmed, matched case-insensitively, and keeps only the matching row.",
        expected: {
          rawSearchQuery,
          normalizedSearchQuery,
          matchingTitleVisibleAfterSearch: true,
          decoyTitleHiddenAfterSearch: true
        },
        actual: {
          setup: {
            matchingMessage: summarizeMessage(matchingMessage),
            decoyMessage: summarizeMessage(decoyMessage)
          },
          mailbox: summarizeMailboxForTitles(afterSetup),
          filteredTitles: filtered.map((message) => message.title)
        },
        context: {
          suite: "workflow-patient-portal-message-search-normalization",
          workflow: "patient-portal-message-search-normalization-result"
        }
      });

      const surface = target.type === "legacy-openemr"
        ? await expectLegacyNormalizedSearchBaseline(page, target)
        : await expectModernizedNormalizedSearch(page, target);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: `slice-518-patient-portal-message-search-normalization-${target.type === "legacy-openemr" ? "legacy" : "modernized"}-ui`,
        description: target.type === "legacy-openemr"
          ? "Captures the Slice 518 legacy portal normalized-search baseline: temporary inbox rows render but the installed template exposes no active search input or live search summary."
          : "Captures the Slice 518 modernized Portal normalized-search UI: the padded mixed-case query filters the Inbox and the result-count summary is exposed as a live status.",
        expected: target.type === "legacy-openemr"
          ? {
              activeSearchInputExposed: false,
              liveSearchSummaryExposed: false,
              bothTitlesVisible: true
            }
          : {
              matchingTitleVisibleAfterSearch: true,
              decoyTitleHiddenAfterSearch: true,
              normalizedSummaryVisible: true,
              resultSummaryRole: "status"
            },
        actual: surface,
        context: {
          suite: "workflow-patient-portal-message-search-normalization",
          workflow: "patient-portal-message-search-normalization-ui"
        }
      });
    } finally {
      await cleanupNormalizedSearchMessages(workflow);
      const cleanup = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-518-patient-portal-message-search-normalization-cleanup",
        description: "Captures the Slice 518 cleanup state after removing temporary normalized-search inbox rows.",
        expected: {
          searchTitlesAbsentFromInbox: searchTitles,
          searchTitlesAbsentFromAll: searchTitles
        },
        actual: summarizeMailboxForTitles(cleanup),
        context: {
          suite: "workflow-patient-portal-message-search-normalization",
          workflow: "patient-portal-message-search-normalization-cleanup"
        }
      });
    }
  });
});

async function cleanupNormalizedSearchMessages(workflow: {
  cleanupPatientPortalComposedMessage(portalUsername: string, title: string): Promise<void>;
}) {
  for (const title of searchTitles) {
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
  }
}

async function expectLegacyNormalizedSearchBaseline(page: Page, target: RuntimeTarget) {
  await openLegacyPatientPortalMessages(page, target);
  await expect(page.locator("body")).toContainText(matchingTitle);
  await expect(page.locator("body")).toContainText(decoyTitle);
  const bodyText = await page.locator("body").innerText();

  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    activeSearchInputExposed: await page.getByLabel(/search/i).count() > 0,
    liveSearchSummaryExposed: await page.getByRole("status", { name: /secure message search result counts/i }).count() > 0,
    bothTitlesVisible: bodyText.includes(matchingTitle) && bodyText.includes(decoyTitle),
    bodyText: normalizeText(bodyText)
  };
}

async function expectModernizedNormalizedSearch(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const inbox = page.getByRole("region", { name: "Inbox secure messages" });
  const searchInput = page.getByLabel("Search secure messages");
  const summary = page.getByRole("status", { name: "Secure message search result counts" });

  await expect(inbox).toContainText(matchingTitle);
  await expect(inbox).toContainText(decoyTitle);
  const beforeSearch = await captureModernizedNormalizedState(page);

  await searchInput.fill(rawSearchQuery);
  await expect(inbox).toContainText(matchingTitle);
  await expect(inbox).not.toContainText(decoyTitle);
  await expect(summary).toContainText(`Search "${normalizedSearchQuery}" results:`);
  const afterSearch = await captureModernizedNormalizedState(page);

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

async function captureModernizedNormalizedState(page: Page) {
  const inboxText = await page.getByRole("region", { name: "Inbox secure messages" }).textContent();
  return {
    query: await page.getByLabel("Search secure messages").inputValue(),
    summary: normalizeText(await page.getByRole("status", { name: "Secure message search result counts" }).textContent()),
    matchingTitleVisible: inboxText?.includes(matchingTitle) ?? false,
    decoyTitleVisible: inboxText?.includes(decoyTitle) ?? false,
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
