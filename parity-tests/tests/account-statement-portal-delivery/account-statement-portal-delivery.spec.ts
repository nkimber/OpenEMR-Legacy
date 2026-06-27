import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  getModernizedAdminSessionHeaders,
  openAuthenticatedModernizedFees,
  openAuthenticatedModernizedPatientPortal
} from "../../src/ui/modernizedOpenEmr.js";
import type { StatementBatchSummary } from "../../src/db/legacyMariaDbProbe.js";

const portalPassword = "PortalPass207!";

type PortalDelivery = {
  asOfDate: string;
  portalDeliveryId: string;
  deliveredAt: string;
  candidateCount: number;
  portalEligibleCount: number;
  deliveredDocumentCount: number;
  skippedCount: number;
  totalBalanceAmount: string;
  totalPastDueAmount: string;
  totalCurrentDueAmount: string;
  entries: Array<{
    documentKey: string;
    pubpid: string;
    legacyPid: number;
    patientDisplayName: string;
    portalUsername: string;
    statementNumber: string;
    statementStatus: string;
    statementDate: string;
    dueDate: string;
    balanceDueAmount: string;
    pastDueAmount: string;
    currentDueAmount: string;
    categoryName: string;
    documentName: string;
    fileName: string;
    deliveryStatus: string;
  }>;
};

test.describe("statement portal delivery parity @slice573 @account-statement-portal-delivery @billing @portal", () => {
  test("eligible statement batch candidates publish deterministic portal documents", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const batch = await targetDb.getStatementBatchCandidates(5);
    const expectedDelivery = buildExpectedPortalDelivery(batch);
    expect(expectedDelivery.asOfDate).toBe("2026-06-18");
    expect(expectedDelivery.portalDeliveryId).toBe("STMT-PORTAL-20260618-TOP5");
    expect(expectedDelivery.deliveredDocumentCount).toBe(1);
    expect(expectedDelivery.skippedCount).toBe(4);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-573-statement-portal-delivery-source",
      description:
        "Captures the Slice 573 portal-delivery source contract: the top five statement candidates, portal-eligible recipients, deterministic portal document keys, invoice category, and skipped non-portal candidate count.",
      expected: {
        asOfDate: "2026-06-18",
        portalDeliveryId: "STMT-PORTAL-20260618-TOP5",
        deliveredDocumentCount: 1,
        skippedCount: 4,
        categoryName: "Invoices"
      },
      actual: expectedDelivery,
      context: {
        suite: "account-statement-portal-delivery",
        workflow: "statement-portal-delivery-source"
      }
    });

    if (target.type === "legacy-openemr") {
      return;
    }

    const headers = await getModernizedAdminSessionHeaders(page, target);
    const response = await page.request.post(`${target.apiBaseUrl}/api/billing/statements/batch/portal-delivery?limit=5`, {
      headers
    });
    expect(response.ok()).toBeTruthy();
    const delivery = normalizePortalDelivery(await response.json());
    expect(delivery).toEqual(expectedDelivery);

    const firstEntry = expectedDelivery.entries[0];
    const portalDocuments = await workflow.getPatientPortalDocuments(firstEntry.portalUsername, portalPassword);
    expect(portalDocuments.authenticated).toBe(true);
    expect(portalDocuments.documents.map((document) => document.name)).toContain(firstEntry.documentName);
    expect(portalDocuments.categories.map((category) => category.displayPath)).toContain("Invoices");

    await openAuthenticatedModernizedFees(page, target);
    await page.getByRole("button", { name: "Portal Delivery" }).click();
    await expect(page.getByLabel("Statement portal delivery", { exact: true })).toContainText(expectedDelivery.portalDeliveryId);
    await expect(page.getByLabel("Statement portal delivery", { exact: true })).toContainText(String(expectedDelivery.deliveredDocumentCount));
    await expect(page.getByLabel("Statement portal delivery entries", { exact: true })).toContainText(firstEntry.documentName);
    await expect(page.getByLabel("Statement portal delivery entries", { exact: true })).toContainText(firstEntry.portalUsername);

    await openAuthenticatedModernizedPatientPortal(page, target, firstEntry.portalUsername, portalPassword);
    const documentsRegion = page.getByRole("region", { name: "Patient portal documents" });
    await expect(documentsRegion).toContainText(firstEntry.documentName);
    await expect(documentsRegion).toContainText("Invoices");
  });
});

function buildExpectedPortalDelivery(batch: StatementBatchSummary): PortalDelivery {
  const packageDate = batch.asOfDate.replaceAll("-", "");
  const portalDeliveryId = `STMT-PORTAL-${packageDate}-TOP${batch.candidates.length}`;
  const entries = batch.candidates
    .filter((candidate) => candidate.patientId === 100200)
    .map((candidate) => ({
      documentKey: `portal-statement-${candidate.statementNumber}`,
      pubpid: candidate.pubpid,
      legacyPid: candidate.patientId,
      patientDisplayName: candidate.patientDisplayName,
      portalUsername: `${candidate.pubpid.toLowerCase()}@example.test`,
      statementNumber: candidate.statementNumber,
      statementStatus: candidate.statementStatus,
      statementDate: candidate.statementDate,
      dueDate: candidate.dueDate,
      balanceDueAmount: formatAmount(candidate.balanceDueAmount),
      pastDueAmount: formatAmount(candidate.pastDueAmount),
      currentDueAmount: formatAmount(candidate.currentDueAmount),
      categoryName: "Invoices",
      documentName: `Patient Statement ${candidate.statementNumber}`,
      fileName: `${candidate.statementNumber}.pdf`,
      deliveryStatus: "Portal document published"
    }));

  return {
    asOfDate: batch.asOfDate,
    portalDeliveryId,
    deliveredAt: `${batch.asOfDate}T12:10:00Z`,
    candidateCount: batch.candidateCount,
    portalEligibleCount: entries.length,
    deliveredDocumentCount: entries.length,
    skippedCount: batch.candidates.length - entries.length,
    totalBalanceAmount: formatAmount(batch.totalBalanceAmount),
    totalPastDueAmount: formatAmount(batch.totalPastDueAmount),
    totalCurrentDueAmount: formatAmount(batch.totalCurrentDueAmount),
    entries
  };
}

function normalizePortalDelivery(raw: any): PortalDelivery {
  return {
    asOfDate: raw.asOfDate,
    portalDeliveryId: raw.portalDeliveryId,
    deliveredAt: raw.deliveredAt,
    candidateCount: raw.candidateCount,
    portalEligibleCount: raw.portalEligibleCount,
    deliveredDocumentCount: raw.deliveredDocumentCount,
    skippedCount: raw.skippedCount,
    totalBalanceAmount: formatAmount(raw.totalBalanceAmount),
    totalPastDueAmount: formatAmount(raw.totalPastDueAmount),
    totalCurrentDueAmount: formatAmount(raw.totalCurrentDueAmount),
    entries: raw.entries.map((entry: any) => ({
      documentKey: entry.documentKey,
      pubpid: entry.pubpid,
      legacyPid: entry.legacyPid,
      patientDisplayName: entry.patientDisplayName,
      portalUsername: entry.portalUsername,
      statementNumber: entry.statementNumber,
      statementStatus: entry.statementStatus,
      statementDate: entry.statementDate,
      dueDate: entry.dueDate,
      balanceDueAmount: formatAmount(entry.balanceDueAmount),
      pastDueAmount: formatAmount(entry.pastDueAmount),
      currentDueAmount: formatAmount(entry.currentDueAmount),
      categoryName: entry.categoryName,
      documentName: entry.documentName,
      fileName: entry.fileName,
      deliveryStatus: entry.deliveryStatus
    }))
  };
}

function formatAmount(value: string | number) {
  return Number(value).toFixed(2);
}
