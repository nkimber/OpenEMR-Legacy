import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";
import type { PatientStatementSummary, StatementBatchSummary } from "../../src/db/legacyMariaDbProbe.js";

type DispatchHandoff = {
  asOfDate: string;
  deliveryId: string;
  dispatchId: string;
  dispatchedAt: string;
  candidateCount: number;
  dispatchedStatementCount: number;
  emailQueueCount: number;
  printQueueCount: number;
  totalBalanceAmount: string;
  totalPastDueAmount: string;
  totalCurrentDueAmount: string;
  entries: Array<{
    dispatchAuditId: string;
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

test.describe("statement dispatch handoff parity @slice571 @account-statement-dispatch @billing", () => {
  test("top statement candidates produce deterministic local dispatch audit handoff metadata", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
    const batch = await targetDb.getStatementBatchCandidates(5);
    const expectedDispatch = await buildExpectedDispatchHandoff(targetDb, batch);
    expect(expectedDispatch.asOfDate).toBe("2026-06-18");
    expect(expectedDispatch.deliveryId).toBe("STMT-DELIVERY-20260618-TOP5");
    expect(expectedDispatch.dispatchId).toBe("STMT-DISPATCH-20260618-TOP5");
    expect(expectedDispatch.dispatchedStatementCount).toBe(5);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-571-statement-dispatch-source",
      description:
        "Captures the Slice 571 statement dispatch source rows: delivery manifest candidates, local email/print queue names, deterministic audit IDs, external references, and dispatch statuses.",
      expected: {
        asOfDate: "2026-06-18",
        deliveryId: "STMT-DELIVERY-20260618-TOP5",
        dispatchId: "STMT-DISPATCH-20260618-TOP5",
        dispatchStatuses: ["Email queued", "Print queued"],
        queueNames: ["patient-statement-email", "patient-statement-print"]
      },
      actual: expectedDispatch,
      context: {
        suite: "account-statement-dispatch",
        workflow: "statement-dispatch-source"
      }
    });

    if (target.type === "legacy-openemr") {
      return;
    }

    const response = await page.request.post(`${target.apiBaseUrl}/api/billing/statements/batch/dispatch?limit=5`, {
      headers: await getModernizedAdminSessionHeaders(page, target)
    });
    expect(response.ok()).toBeTruthy();
    const dispatch = normalizeDispatchHandoff(await response.json());
    expect(dispatch).toEqual(expectedDispatch);

    await openAuthenticatedModernizedFees(page, target);
    await page.getByRole("button", { name: "Dispatch Handoff" }).click();
    await expect(page.getByLabel("Statement dispatch handoff")).toContainText(expectedDispatch.dispatchId);
    await expect(page.getByLabel("Statement dispatch entries")).toContainText(expectedDispatch.entries[0].dispatchAuditId);
    await expect(page.getByLabel("Statement dispatch entries")).toContainText(expectedDispatch.entries[0].dispatchStatus);
  });
});

async function buildExpectedDispatchHandoff(
  targetDb: { getPatientStatementForPatient(pid: number): Promise<PatientStatementSummary | null> },
  batch: StatementBatchSummary
): Promise<DispatchHandoff> {
  const packageDate = batch.asOfDate.replaceAll("-", "");
  const deliveryId = `STMT-DELIVERY-${packageDate}-TOP${batch.candidates.length}`;
  const dispatchId = `STMT-DISPATCH-${packageDate}-TOP${batch.candidates.length}`;
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
    deliveryId,
    dispatchId,
    dispatchedAt: `${batch.asOfDate}T12:05:00Z`,
    candidateCount: batch.candidateCount,
    dispatchedStatementCount: entries.length,
    emailQueueCount: entries.filter((entry) => entry.queueName === "patient-statement-email").length,
    printQueueCount: entries.filter((entry) => entry.queueName === "patient-statement-print").length,
    totalBalanceAmount: formatAmount(batch.totalBalanceAmount),
    totalPastDueAmount: formatAmount(batch.totalPastDueAmount),
    totalCurrentDueAmount: formatAmount(batch.totalCurrentDueAmount),
    entries
  };
}

function normalizeDispatchHandoff(raw: any): DispatchHandoff {
  return {
    asOfDate: raw.asOfDate,
    deliveryId: raw.deliveryId,
    dispatchId: raw.dispatchId,
    dispatchedAt: raw.dispatchedAt,
    candidateCount: raw.candidateCount,
    dispatchedStatementCount: raw.dispatchedStatementCount,
    emailQueueCount: raw.emailQueueCount,
    printQueueCount: raw.printQueueCount,
    totalBalanceAmount: formatAmount(raw.totalBalanceAmount),
    totalPastDueAmount: formatAmount(raw.totalPastDueAmount),
    totalCurrentDueAmount: formatAmount(raw.totalCurrentDueAmount),
    entries: raw.entries.map((entry: any) => ({
      dispatchAuditId: entry.dispatchAuditId,
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
