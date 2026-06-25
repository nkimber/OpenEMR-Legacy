import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";
import type { StatementBatchSummary } from "../../src/db/legacyMariaDbProbe.js";

type ApiStatementBatch = {
  asOfDate: string;
  candidateCount: number;
  totalBalanceAmount: number;
  totalPastDueAmount: number;
  totalCurrentDueAmount: number;
  candidates: Array<{
    legacyPid: number;
    pubpid: string;
    patientDisplayName: string;
    statementNumber: string;
    statementStatus: string;
    statementDate: string;
    dueDate: string;
    balanceDueAmount: number;
    pastDueAmount: number;
    currentDueAmount: number;
    openEncounterCount: number;
    ledgerEntryCount: number;
    oldestOpenAgeDays: number;
    oldestOpenDate: string;
    deliveryMethod: string;
  }>;
};

test.describe("statement batch candidate parity @slice61 @account-statement-batch @billing", () => {
  test("top statement batch candidates match the seeded account balances", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
    const expectedBatch = await targetDb.getStatementBatchCandidates(5);
    expect(expectedBatch.asOfDate).toBe("2026-06-18");
    expect(expectedBatch.candidateCount).toBeGreaterThan(5);
    expect(expectedBatch.candidates).toHaveLength(5);
    expect(Number(expectedBatch.totalBalanceAmount)).toBeGreaterThan(0);
    expect(Number(expectedBatch.totalPastDueAmount)).toBeGreaterThan(0);
    expect(Number(expectedBatch.totalCurrentDueAmount)).toBeGreaterThan(0);

    const firstCandidate = expectedBatch.candidates[0];
    expect(firstCandidate.statementNumber).toMatch(/^STMT-MOD-PAT-\d{4}-\d{8}$/);
    expect(["Past due review", "Ready for statement"]).toContain(firstCandidate.statementStatus);
    expect(["Email-ready", "Print"]).toContain(firstCandidate.deliveryMethod);
    expect(Number(firstCandidate.balanceDueAmount)).toBeGreaterThan(0);
    expect(firstCandidate.openEncounterCount).toBeGreaterThan(0);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-61-statement-batch-candidates",
      description: "Captures the Slice 61 ranked statement batch candidates derived from the shared full-population billing ledger.",
      expected: {
        asOfDate: "2026-06-18",
        minimumCandidateCount: 6,
        selectedCandidateLimit: 5,
        requiredStatuses: ["Past due review", "Ready for statement"],
        requiredDeliveryMethods: ["Email-ready", "Print"],
        totals: {
          totalBalanceAmount: "positive",
          totalPastDueAmount: "positive",
          totalCurrentDueAmount: "positive"
        }
      },
      actual: {
        batch: expectedBatch,
        firstCandidate
      },
      context: {
        suite: "account-statement-batch",
        workflow: "statement-batch-candidates"
      }
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-61-statement-batch-contract",
      description: "Captures the Slice 61 statement batch API/UI contract: deterministic ranking, statement identifiers, balance fields, open encounter counts, and delivery metadata.",
      expected: {
        statementNumberPattern: "STMT-MOD-PAT-0000-YYYYMMDD",
        statusValues: ["Past due review", "Ready for statement"],
        deliveryMethodValues: ["Email-ready", "Print"],
        requiredFields: [
          "pubpid",
          "patientDisplayName",
          "statementNumber",
          "statementStatus",
          "balanceDueAmount",
          "pastDueAmount",
          "currentDueAmount",
          "openEncounterCount",
          "ledgerEntryCount",
          "oldestOpenAgeDays",
          "oldestOpenDate",
          "deliveryMethod"
        ]
      },
      actual: {
        topCandidates: expectedBatch.candidates,
        uiAnchor: {
          patientDisplayName: firstCandidate.patientDisplayName,
          pubpid: firstCandidate.pubpid,
          statementNumber: firstCandidate.statementNumber,
          statementStatus: firstCandidate.statementStatus,
          deliveryMethod: firstCandidate.deliveryMethod,
          balanceDueAmount: firstCandidate.balanceDueAmount
        }
      },
      context: {
        suite: "account-statement-batch",
        workflow: "statement-batch-contract"
      }
    });

    if (target.type === "legacy-openemr") {
      return;
    }

    const response = await page.request.get(`${target.apiBaseUrl}/api/billing/statements/batch?limit=5`, {
      headers: await getModernizedAdminSessionHeaders(page, target)
    });
    expect(response.ok()).toBeTruthy();
    const apiBatch = await response.json() as ApiStatementBatch;
    expect(normalizeApiBatch(apiBatch)).toEqual(expectedBatch);

    await openAuthenticatedModernizedFees(page, target);
    await expect(page.getByRole("heading", { name: "Statement Batch" })).toBeVisible();

    const body = page.locator("body");
    await expect(body).toContainText(firstCandidate.patientDisplayName);
    await expect(body).toContainText(firstCandidate.pubpid);
    await expect(body).toContainText(firstCandidate.statementNumber);
    await expect(body).toContainText(firstCandidate.statementStatus);
    await expect(body).toContainText(firstCandidate.deliveryMethod);
    await expect(body).toContainText(formatMoney(Number(firstCandidate.balanceDueAmount)));

    await page.getByRole("button", { name: "Open" }).first().click();
    await expect(page.getByLabel("Fees patient ID")).toHaveValue(firstCandidate.pubpid);
    await expect(page.getByRole("heading", { name: firstCandidate.patientDisplayName })).toBeVisible();
  });
});

function normalizeApiBatch(apiBatch: ApiStatementBatch): StatementBatchSummary {
  return {
    asOfDate: apiBatch.asOfDate,
    candidateCount: apiBatch.candidateCount,
    totalBalanceAmount: formatAmount(apiBatch.totalBalanceAmount),
    totalPastDueAmount: formatAmount(apiBatch.totalPastDueAmount),
    totalCurrentDueAmount: formatAmount(apiBatch.totalCurrentDueAmount),
    candidates: apiBatch.candidates.map((candidate) => ({
      patientId: candidate.legacyPid,
      pubpid: candidate.pubpid,
      patientDisplayName: candidate.patientDisplayName,
      statementNumber: candidate.statementNumber,
      statementStatus: candidate.statementStatus,
      statementDate: candidate.statementDate,
      dueDate: candidate.dueDate,
      balanceDueAmount: formatAmount(candidate.balanceDueAmount),
      pastDueAmount: formatAmount(candidate.pastDueAmount),
      currentDueAmount: formatAmount(candidate.currentDueAmount),
      openEncounterCount: candidate.openEncounterCount,
      ledgerEntryCount: candidate.ledgerEntryCount,
      oldestOpenAgeDays: candidate.oldestOpenAgeDays,
      oldestOpenDate: candidate.oldestOpenDate,
      deliveryMethod: candidate.deliveryMethod
    }))
  };
}

function formatAmount(value: number) {
  return value.toFixed(2);
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}
