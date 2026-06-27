import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";
import type { PatientStatementSummary, StatementBatchSummary } from "../../src/db/legacyMariaDbProbe.js";

type StatementEmailOutbox = {
  asOfDate: string;
  outboxBatchId: string;
  queuedAt: string;
  candidateCount: number;
  emailEligibleCount: number;
  queuedMessageCount: number;
  skippedCount: number;
  totalBalanceAmount: string;
  totalPastDueAmount: string;
  totalCurrentDueAmount: string;
  entries: Array<{
    outboxMessageId: string;
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
    toEmail: string;
    fromEmail: string;
    subject: string;
    bodyPreview: string;
    attachmentFileName: string;
    queueName: string;
    deliveryStatus: string;
    externalReference: string;
  }>;
};

test.describe("statement email outbox parity @slice574 @account-statement-email-outbox @billing", () => {
  test("top email-ready statement candidates produce deterministic local email outbox records", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
    const batch = await targetDb.getStatementBatchCandidates(5);
    const expectedOutbox = await buildExpectedEmailOutbox(targetDb, batch);
    expect(expectedOutbox.asOfDate).toBe("2026-06-18");
    expect(expectedOutbox.outboxBatchId).toBe("STMT-EMAIL-20260618-TOP5");
    expect(expectedOutbox.queuedMessageCount).toBe(5);
    expect(expectedOutbox.skippedCount).toBe(0);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-574-statement-email-outbox-source",
      description:
        "Captures the Slice 574 statement email outbox source rows: top statement candidates, statement emails, deterministic outbox message IDs, subjects, attachments, and local delivery statuses.",
      expected: {
        asOfDate: "2026-06-18",
        outboxBatchId: "STMT-EMAIL-20260618-TOP5",
        queueName: "patient-statement-email-outbox",
        deliveryStatus: "Email outbox queued"
      },
      actual: expectedOutbox,
      context: {
        suite: "account-statement-email-outbox",
        workflow: "statement-email-outbox-source"
      }
    });

    if (target.type === "legacy-openemr") {
      return;
    }

    const response = await page.request.post(`${target.apiBaseUrl}/api/billing/statements/batch/email-outbox?limit=5`, {
      headers: await getModernizedAdminSessionHeaders(page, target)
    });
    expect(response.ok()).toBeTruthy();
    const outbox = normalizeEmailOutbox(await response.json());
    expect(outbox).toEqual(expectedOutbox);

    await openAuthenticatedModernizedFees(page, target);
    await page.getByRole("button", { name: "Email Outbox" }).click();
    await expect(page.getByLabel("Statement email outbox", { exact: true })).toContainText(expectedOutbox.outboxBatchId);
    await expect(page.getByLabel("Statement email outbox", { exact: true })).toContainText(String(expectedOutbox.queuedMessageCount));
    await expect(page.getByLabel("Statement email outbox entries")).toContainText(expectedOutbox.entries[0].outboxMessageId);
    await expect(page.getByLabel("Statement email outbox entries")).toContainText(expectedOutbox.entries[0].toEmail);
    await expect(page.getByLabel("Statement email outbox entries")).toContainText(expectedOutbox.entries[0].deliveryStatus);
  });
});

async function buildExpectedEmailOutbox(
  targetDb: { getPatientStatementForPatient(pid: number): Promise<PatientStatementSummary | null> },
  batch: StatementBatchSummary
): Promise<StatementEmailOutbox> {
  const packageDate = batch.asOfDate.replaceAll("-", "");
  const outboxBatchId = `STMT-EMAIL-${packageDate}-TOP${batch.candidates.length}`;
  const entries: StatementEmailOutbox["entries"] = [];

  for (const candidate of batch.candidates) {
    const statement = await targetDb.getPatientStatementForPatient(candidate.patientId);
    if (!statement || candidate.deliveryMethod !== "Email-ready" || !statement.email.trim()) {
      continue;
    }

    const index = entries.length + 1;
    entries.push({
      outboxMessageId: `EMAIL-${outboxBatchId}-${String(index).padStart(4, "0")}`,
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
      toEmail: statement.email.trim(),
      fromEmail: "billing@example.test",
      subject: `Statement ${candidate.statementNumber} is ready`,
      bodyPreview: `Your statement ${candidate.statementNumber} dated ${candidate.statementDate} has a balance of ${formatAmount(candidate.balanceDueAmount)}.`,
      attachmentFileName: `statements/${candidate.statementNumber}.pdf`,
      queueName: "patient-statement-email-outbox",
      deliveryStatus: "Email outbox queued",
      externalReference: `LOCAL-EMAIL-OUTBOX-${candidate.statementNumber}`
    });
  }

  return {
    asOfDate: batch.asOfDate,
    outboxBatchId,
    queuedAt: `${batch.asOfDate}T12:15:00Z`,
    candidateCount: batch.candidateCount,
    emailEligibleCount: entries.length,
    queuedMessageCount: entries.length,
    skippedCount: Math.max(0, batch.candidates.length - entries.length),
    totalBalanceAmount: formatAmount(batch.totalBalanceAmount),
    totalPastDueAmount: formatAmount(batch.totalPastDueAmount),
    totalCurrentDueAmount: formatAmount(batch.totalCurrentDueAmount),
    entries
  };
}

function normalizeEmailOutbox(raw: any): StatementEmailOutbox {
  return {
    asOfDate: raw.asOfDate,
    outboxBatchId: raw.outboxBatchId,
    queuedAt: raw.queuedAt,
    candidateCount: raw.candidateCount,
    emailEligibleCount: raw.emailEligibleCount,
    queuedMessageCount: raw.queuedMessageCount,
    skippedCount: raw.skippedCount,
    totalBalanceAmount: formatAmount(raw.totalBalanceAmount),
    totalPastDueAmount: formatAmount(raw.totalPastDueAmount),
    totalCurrentDueAmount: formatAmount(raw.totalCurrentDueAmount),
    entries: raw.entries.map((entry: any) => ({
      outboxMessageId: entry.outboxMessageId,
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
      toEmail: entry.toEmail,
      fromEmail: entry.fromEmail,
      subject: entry.subject,
      bodyPreview: entry.bodyPreview,
      attachmentFileName: entry.attachmentFileName,
      queueName: entry.queueName,
      deliveryStatus: entry.deliveryStatus,
      externalReference: entry.externalReference
    }))
  };
}

function formatAmount(value: string | number) {
  return Number(value).toFixed(2);
}
