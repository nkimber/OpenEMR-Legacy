import { test, expect } from "../../src/fixtures/parityTest.js";
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
  }) => {
    const expectedQueue = await targetDb.getCollectionsWorkQueue(5);
    expect(expectedQueue.asOfDate).toBe("2026-06-18");
    expect(expectedQueue.accountCount).toBeGreaterThan(0);
    expect(expectedQueue.highPriorityCount).toBeGreaterThan(0);
    expect(expectedQueue.items).toHaveLength(5);

    const firstItem = expectedQueue.items[0];
    expect(Number(firstItem.pastDueAmount)).toBeGreaterThan(0);
    expect(firstItem.collectionTier).toBe("High");
    expect(firstItem.recommendedAction).toBe("Final notice review");

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
