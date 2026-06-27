import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";
import type { PatientStatementSummary, StatementBatchSummary } from "../../src/db/legacyMariaDbProbe.js";

type DispatchHistory = {
  asOfDate: string;
  eventCount: number;
  entries: Array<{
    dispatchAuditId: string;
    deliveryId: string;
    dispatchId: string;
    dispatchedAt: string;
    createdAt: string;
    pubpid: string;
    legacyPid: number;
    patientDisplayName: string;
    statementNumber: string;
    statementStatus: string;
    statementDate: string;
    dueDate: string;
    balanceDueAmount: string;
    pastDueAmount: string;
    currentDueAmount: string;
    deliveryMethod: string;
    destination: string;
    fileName: string;
    queueName: string;
    dispatchStatus: string;
    externalReference: string;
  }>;
};

test.describe("statement dispatch history parity @slice572 @account-statement-dispatch-history @billing", () => {
  test("statement dispatch persists deterministic local audit history and renders it in Fees", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
    const batch = await targetDb.getStatementBatchCandidates(5);
    const expectedHistory = await buildExpectedDispatchHistory(targetDb, batch);
    expect(expectedHistory.asOfDate).toBe("2026-06-18");
    expect(expectedHistory.eventCount).toBe(5);
    expect(expectedHistory.entries[0].dispatchId).toBe("STMT-DISPATCH-20260618-TOP5");

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-572-statement-dispatch-history-source",
      description:
        "Captures the Slice 572 persisted statement dispatch audit-history contract: deterministic audit IDs, dispatch IDs, timestamps, queue names, statuses, external references, and created-at evidence.",
      expected: {
        asOfDate: "2026-06-18",
        eventCount: 5,
        dispatchId: "STMT-DISPATCH-20260618-TOP5",
        createdAt: "2026-06-18T12:05:00Z"
      },
      actual: expectedHistory,
      context: {
        suite: "account-statement-dispatch-history",
        workflow: "statement-dispatch-history-source"
      }
    });

    if (target.type === "legacy-openemr") {
      return;
    }

    const headers = await getModernizedAdminSessionHeaders(page, target);
    const dispatchResponse = await page.request.post(`${target.apiBaseUrl}/api/billing/statements/batch/dispatch?limit=5`, {
      headers
    });
    expect(dispatchResponse.ok()).toBeTruthy();

    const historyResponse = await page.request.get(`${target.apiBaseUrl}/api/billing/statements/batch/dispatch-history?limit=5`, {
      headers
    });
    expect(historyResponse.ok()).toBeTruthy();
    const history = normalizeDispatchHistory(await historyResponse.json());
    expect(history).toEqual(expectedHistory);

    await openAuthenticatedModernizedFees(page, target);
    await page.getByRole("button", { name: "Dispatch History" }).click();
    await expect(page.getByLabel("Statement dispatch history", { exact: true })).toContainText(String(expectedHistory.eventCount));
    await expect(page.getByLabel("Statement dispatch history", { exact: true })).toContainText(expectedHistory.entries[0].dispatchId);
    await expect(page.getByLabel("Statement dispatch history entries", { exact: true })).toContainText(expectedHistory.entries[0].dispatchAuditId);
    await expect(page.getByLabel("Statement dispatch history entries", { exact: true })).toContainText(expectedHistory.entries[0].externalReference);
  });
});

async function buildExpectedDispatchHistory(
  targetDb: { getPatientStatementForPatient(pid: number): Promise<PatientStatementSummary | null> },
  batch: StatementBatchSummary
): Promise<DispatchHistory> {
  const packageDate = batch.asOfDate.replaceAll("-", "");
  const deliveryId = `STMT-DELIVERY-${packageDate}-TOP${batch.candidates.length}`;
  const dispatchId = `STMT-DISPATCH-${packageDate}-TOP${batch.candidates.length}`;
  const timestamp = `${batch.asOfDate}T12:05:00Z`;
  const entries = [];

  for (const [index, candidate] of batch.candidates.entries()) {
    const statement = await targetDb.getPatientStatementForPatient(candidate.patientId);
    if (!statement) {
      continue;
    }

    const isEmail = candidate.deliveryMethod === "Email-ready";
    const channel = isEmail ? "EMAIL" : "PRINT";
    entries.push({
      dispatchAuditId: `AUD-${dispatchId}-${String(index + 1).padStart(4, "0")}`,
      deliveryId,
      dispatchId,
      dispatchedAt: timestamp,
      createdAt: timestamp,
      pubpid: candidate.pubpid,
      legacyPid: candidate.patientId,
      patientDisplayName: candidate.patientDisplayName,
      statementNumber: candidate.statementNumber,
      statementStatus: candidate.statementStatus,
      statementDate: candidate.statementDate,
      dueDate: candidate.dueDate,
      balanceDueAmount: formatAmount(candidate.balanceDueAmount),
      pastDueAmount: formatAmount(candidate.pastDueAmount),
      currentDueAmount: formatAmount(candidate.currentDueAmount),
      deliveryMethod: candidate.deliveryMethod,
      destination: isEmail && statement.email.trim()
        ? statement.email.trim()
        : statement.mailingAddressLine2.trim()
          ? `${statement.mailingAddressLine1}, ${statement.mailingAddressLine2}`
          : statement.mailingAddressLine1,
      fileName: `statements/${candidate.statementNumber}.pdf`,
      queueName: isEmail ? "patient-statement-email" : "patient-statement-print",
      dispatchStatus: isEmail ? "Email queued" : "Print queued",
      externalReference: `LOCAL-${channel}-${candidate.statementNumber}`
    });
  }

  return {
    asOfDate: batch.asOfDate,
    eventCount: entries.length,
    entries
  };
}

function normalizeDispatchHistory(raw: any): DispatchHistory {
  return {
    asOfDate: raw.asOfDate,
    eventCount: raw.eventCount,
    entries: raw.entries.map((entry: any) => ({
      dispatchAuditId: entry.dispatchAuditId,
      deliveryId: entry.deliveryId,
      dispatchId: entry.dispatchId,
      dispatchedAt: entry.dispatchedAt,
      createdAt: entry.createdAt,
      pubpid: entry.pubpid,
      legacyPid: entry.legacyPid,
      patientDisplayName: entry.patientDisplayName,
      statementNumber: entry.statementNumber,
      statementStatus: entry.statementStatus,
      statementDate: entry.statementDate,
      dueDate: entry.dueDate,
      balanceDueAmount: formatAmount(entry.balanceDueAmount),
      pastDueAmount: formatAmount(entry.pastDueAmount),
      currentDueAmount: formatAmount(entry.currentDueAmount),
      deliveryMethod: entry.deliveryMethod,
      destination: entry.destination,
      fileName: entry.fileName,
      queueName: entry.queueName,
      dispatchStatus: entry.dispatchStatus,
      externalReference: entry.externalReference
    }))
  };
}

function formatAmount(value: string | number) {
  return Number(value).toFixed(2);
}
