import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";
import type { CollectionsWorkQueueSummary } from "../../src/db/legacyMariaDbProbe.js";

type ApiCollectionsWorkQueue = {
  asOfDate: string;
  accountCount: number;
  highPriorityCount: number;
  totalBalanceAmount: number;
  totalPastDueAmount: number;
  totalOver90Amount: number;
  items: Array<{
    legacyPid: number;
    pubpid: string;
    patientDisplayName: string;
    statementNumber: string;
    statementDate: string;
    dueDate: string;
    balanceDueAmount: number;
    pastDueAmount: number;
    over90Amount: number;
    currentDueAmount: number;
    openEncounterCount: number;
    ledgerEntryCount: number;
    oldestOpenAgeDays: number;
    oldestOpenDate: string;
    collectionTier: string;
    recommendedAction: string;
    contactMethod: string;
    email?: string | null;
    phone?: string | null;
  }>;
};

test.describe("collections work queue parity @slice63 @account-collections-work-queue @billing", () => {
  test("past-due account queue matches seeded aging exposure", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
    const expectedQueue = await targetDb.getCollectionsWorkQueue(5);
    expect(expectedQueue.asOfDate).toBe("2026-06-18");
    expect(expectedQueue.accountCount).toBeGreaterThan(0);
    expect(expectedQueue.highPriorityCount).toBeGreaterThan(0);
    expect(expectedQueue.items).toHaveLength(5);

    const firstItem = expectedQueue.items[0];
    expect(Number(firstItem.pastDueAmount)).toBeGreaterThan(0);
    expect(firstItem.collectionTier).toBe("High");
    expect(firstItem.recommendedAction).toBe("Final notice review");
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-63-collections-work-queue-source",
      description: "Captures the Slice 63 collections work queue source rows: full queue totals, high-priority counts, and selected top-five past-due accounts from the shared aging ledger.",
      expected: {
        asOfDate: "2026-06-18",
        selectedQueueLimit: 5,
        minimumAccountCount: 1,
        minimumHighPriorityCount: 1,
        requiredFirstTier: "High",
        requiredFirstAction: "Final notice review",
        totals: {
          totalBalanceAmount: "positive",
          totalPastDueAmount: "positive",
          totalOver90Amount: "positive"
        }
      },
      actual: {
        queue: expectedQueue,
        firstItem
      },
      context: {
        suite: "account-collections-work-queue",
        workflow: "collections-work-queue-source"
      }
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-63-collections-work-queue-contract",
      description: "Captures the deterministic Slice 63 queue contract: ranked account fields, aging exposure, collection tier/action metadata, contact method, and UI steering anchors.",
      expected: {
        collectionTierValues: ["High", "Medium", "Low"],
        requiredFields: [
          "pubpid",
          "patientDisplayName",
          "statementNumber",
          "balanceDueAmount",
          "pastDueAmount",
          "over90Amount",
          "currentDueAmount",
          "openEncounterCount",
          "ledgerEntryCount",
          "oldestOpenAgeDays",
          "oldestOpenDate",
          "collectionTier",
          "recommendedAction",
          "contactMethod"
        ],
        uiPanelLabel: "Collections work queue",
        uiHeading: "Collections Work Queue"
      },
      actual: {
        topItems: expectedQueue.items,
        uiAnchor: {
          patientDisplayName: firstItem.patientDisplayName,
          statementNumber: firstItem.statementNumber,
          collectionTier: firstItem.collectionTier,
          recommendedAction: firstItem.recommendedAction,
          over90Amount: firstItem.over90Amount,
          contactMethod: firstItem.contactMethod
        }
      },
      context: {
        suite: "account-collections-work-queue",
        workflow: "collections-work-queue-contract"
      }
    });

    if (target.type === "legacy-openemr") {
      return;
    }

    const response = await page.request.get(`${target.apiBaseUrl}/api/billing/collections/work-queue?limit=5`, {
      headers: await getModernizedAdminSessionHeaders(page, target)
    });
    expect(response.ok()).toBeTruthy();
    const apiQueue = await response.json() as ApiCollectionsWorkQueue;
    expect(normalizeApiQueue(apiQueue)).toEqual(expectedQueue);

    await openAuthenticatedModernizedFees(page, target);
    const queuePanel = page.locator('[aria-label="Collections work queue"]');
    await expect(queuePanel.getByRole("heading", { name: "Collections Work Queue" })).toBeVisible();
    await expect(queuePanel).toContainText(firstItem.patientDisplayName);
    await expect(queuePanel).toContainText(firstItem.statementNumber);
    await expect(queuePanel).toContainText(firstItem.collectionTier);
    await expect(queuePanel).toContainText(firstItem.recommendedAction);
    await expect(queuePanel).toContainText(formatMoney(Number(firstItem.over90Amount)));

    await queuePanel.getByRole("button", { name: "Open" }).first().click();
    await expect(page.locator(".appointment-banner h2")).toContainText(firstItem.patientDisplayName);
  });
});

function normalizeApiQueue(queue: ApiCollectionsWorkQueue): CollectionsWorkQueueSummary {
  return {
    asOfDate: queue.asOfDate,
    accountCount: queue.accountCount,
    highPriorityCount: queue.highPriorityCount,
    totalBalanceAmount: formatAmount(queue.totalBalanceAmount),
    totalPastDueAmount: formatAmount(queue.totalPastDueAmount),
    totalOver90Amount: formatAmount(queue.totalOver90Amount),
    items: queue.items.map((item) => ({
      patientId: item.legacyPid,
      pubpid: item.pubpid,
      patientDisplayName: item.patientDisplayName,
      statementNumber: item.statementNumber,
      statementDate: item.statementDate,
      dueDate: item.dueDate,
      balanceDueAmount: formatAmount(item.balanceDueAmount),
      pastDueAmount: formatAmount(item.pastDueAmount),
      over90Amount: formatAmount(item.over90Amount),
      currentDueAmount: formatAmount(item.currentDueAmount),
      openEncounterCount: item.openEncounterCount,
      ledgerEntryCount: item.ledgerEntryCount,
      oldestOpenAgeDays: item.oldestOpenAgeDays,
      oldestOpenDate: item.oldestOpenDate,
      collectionTier: item.collectionTier,
      recommendedAction: item.recommendedAction,
      contactMethod: item.contactMethod,
      email: item.email ?? "",
      phone: item.phone ?? ""
    }))
  };
}

function formatAmount(value: number) {
  return value.toFixed(2);
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}
