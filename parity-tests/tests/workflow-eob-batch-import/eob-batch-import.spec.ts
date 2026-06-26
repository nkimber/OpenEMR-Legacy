import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const eobBatchImportAnchorPatientId = "MOD-PAT-0005";
const eobBatchImportEncounter = 1000052;
const eobBatchReferences = ["EOB-BATCH-1000052-PRIMARY", "EOB-BATCH-1000052-SECONDARY"];

test.describe("eob batch import parity @slice531 @workflow-eob-batch-import @mutation @billing", () => {
  test("imports, renders, verifies, and removes a temporary two-line EOB batch", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(eobBatchImportAnchorPatientId);
    expect(patient).not.toBeNull();

    await deletePaymentsForReferences(workflow, targetDb, target.type, eobBatchReferences);

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeBalances = await targetDb.getAccountBalancesForPatient(patient!.pid);
    const beforeAnchorBalance = balanceForEncounter(beforeBalances, eobBatchImportEncounter);
    expect(beforeAnchorBalance).not.toBeNull();
    const beforeLedger = await targetDb.getAccountLedgerForPatient(patient!.pid);
    const eobBatch = [
      {
        patientId: patient!.pid,
        encounter: eobBatchImportEncounter,
        payerId: 9005,
        payerName: "Northstar HMO",
        payerType: 1,
        reference: eobBatchReferences[0],
        postDate: "2026-06-18",
        paymentType: "insurance_payment",
        paymentMethod: "electronic_payment",
        codeType: "CPT4",
        code: "99214",
        memo: "Imported EOB batch primary",
        payAmount: "28.00",
        adjustmentAmount: "4.25",
        accountCode: "CO45",
        reasonCode: "CO-45",
        payerClaimNumber: "EOB-BATCH-1000052-P1"
      },
      {
        patientId: patient!.pid,
        encounter: eobBatchImportEncounter,
        payerId: 9005,
        payerName: "Northstar HMO",
        payerType: 1,
        reference: eobBatchReferences[1],
        postDate: "2026-06-18",
        paymentType: "insurance_payment",
        paymentMethod: "electronic_payment",
        codeType: "CPT4",
        code: "99213",
        memo: "Imported EOB batch secondary",
        payAmount: "11.00",
        adjustmentAmount: "1.50",
        accountCode: "PR2",
        reasonCode: "PR-2",
        payerClaimNumber: "EOB-BATCH-1000052-S1"
      }
    ];
    let paymentIds: Array<number | string> = [];

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-531-eob-batch-import-precondition",
        description: "Captures the Slice 531 EOB batch import anchor, baseline payment/balance state, and proposed two-line insurer remittance payload.",
        expected: {
          patient: {
            pubpid: eobBatchImportAnchorPatientId
          },
          encounter: eobBatchImportEncounter,
          import: {
            rows: 2,
            payerName: "Northstar HMO",
            paymentMethod: "electronic_payment",
            references: eobBatchReferences,
            payAmountTotal: "39.00",
            adjustmentAmountTotal: "5.75",
            reasonCodes: ["CO-45", "PR-2"]
          },
          countChange: {
            paymentSessionsAfterImport: beforeCounts.paymentSessions + 2,
            paymentActivitiesAfterImport: beforeCounts.paymentActivities + 2,
            paymentSessionsAfterCleanup: beforeCounts.paymentSessions,
            paymentActivitiesAfterCleanup: beforeCounts.paymentActivities
          },
          balanceChange: {
            paymentAmountDelta: 39,
            adjustmentAmountDelta: 5.75,
            balanceAmountDelta: -44.75
          }
        },
        actual: {
          patient,
          beforeCounts,
          beforeAnchorBalance,
          beforeLedgerCount: beforeLedger.length,
          proposedBatch: eobBatch
        },
        context: {
          canonicalId: eobBatchImportAnchorPatientId,
          encounter: eobBatchImportEncounter,
          suite: "workflow-eob-batch-import",
          workflow: "eob-batch-import-precondition"
        }
      });

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient!.pubpid);
        await expect(page.locator("body")).toContainText(`${eobBatchImportAnchorPatientId} / PID ${patient!.pid}`);
        await page.getByLabel("New payment encounter").fill(String(eobBatchImportEncounter));
        await page.getByRole("button", { name: "Import EOB" }).click();
        await expect(page.locator("body")).toContainText(eobBatchReferences[0]);
        await expect(page.locator("body")).toContainText(eobBatchReferences[1]);
        await expect(page.locator("body")).toContainText("Paid $28.00");
        await expect(page.locator("body")).toContainText("Adjusted $4.25");
        await expect(page.locator("body")).toContainText("Paid $11.00");
        await expect(page.locator("body")).toContainText("Adjusted $1.50");
        await expect(page.locator("body")).toContainText("Reason CO-45");
        await expect(page.locator("body")).toContainText("Reason PR-2");
        await expect(page.locator("body")).toContainText("Claim EOB-BATCH-1000052-P1");
        await expect(page.locator("body")).toContainText("Claim EOB-BATCH-1000052-S1");
      } else {
        for (const payment of eobBatch) {
          paymentIds.push(await workflow.createPaymentPosting(payment));
        }
      }

      paymentIds = await findPaymentIdsForReferences(targetDb, target.type, eobBatchReferences);
      expect(paymentIds).toHaveLength(2);

      const afterImportCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterImportCounts.paymentSessions).toBe(beforeCounts.paymentSessions + 2);
      expect(afterImportCounts.paymentActivities).toBe(beforeCounts.paymentActivities + 2);

      const postings = await targetDb.getPaymentPostingsForPatient(patient!.pid);
      expect(postings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            encounter: eobBatchImportEncounter,
            payerName: "Northstar HMO",
            reference: eobBatchReferences[0],
            paymentType: "insurance_payment",
            paymentMethod: "electronic_payment",
            payAmount: expect.stringMatching(/^28(?:\.00)?$/),
            adjustmentAmount: expect.stringMatching(/^4\.25(?:0+)?$/),
            reasonCode: "CO-45",
            payerClaimNumber: "EOB-BATCH-1000052-P1"
          }),
          expect.objectContaining({
            encounter: eobBatchImportEncounter,
            payerName: "Northstar HMO",
            reference: eobBatchReferences[1],
            paymentType: "insurance_payment",
            paymentMethod: "electronic_payment",
            payAmount: expect.stringMatching(/^11(?:\.00)?$/),
            adjustmentAmount: expect.stringMatching(/^1\.50(?:0+)?$/),
            reasonCode: "PR-2",
            payerClaimNumber: "EOB-BATCH-1000052-S1"
          })
        ])
      );

      const afterImportBalances = await targetDb.getAccountBalancesForPatient(patient!.pid);
      const afterImportAnchorBalance = balanceForEncounter(afterImportBalances, eobBatchImportEncounter);
      expect(afterImportAnchorBalance).not.toBeNull();
      expectMoney(afterImportAnchorBalance!.paymentAmount, money(beforeAnchorBalance!.paymentAmount) + 39);
      expectMoney(afterImportAnchorBalance!.adjustmentAmount, money(beforeAnchorBalance!.adjustmentAmount) + 5.75);
      expectMoney(afterImportAnchorBalance!.balanceAmount, money(beforeAnchorBalance!.balanceAmount) - 44.75);

      const afterImportLedger = await targetDb.getAccountLedgerForPatient(patient!.pid);
      expect(afterImportLedger).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            entryType: "Payment",
            description: "Imported EOB batch primary",
            reference: eobBatchReferences[0],
            amount: expect.stringMatching(/^-28(?:\.00)?$/)
          }),
          expect.objectContaining({
            entryType: "Adjustment",
            description: "Imported EOB batch primary",
            reference: eobBatchReferences[0],
            amount: expect.stringMatching(/^-4\.25(?:0+)?$/)
          }),
          expect.objectContaining({
            entryType: "Payment",
            description: "Imported EOB batch secondary",
            reference: eobBatchReferences[1],
            amount: expect.stringMatching(/^-11(?:\.00)?$/)
          }),
          expect.objectContaining({
            entryType: "Adjustment",
            description: "Imported EOB batch secondary",
            reference: eobBatchReferences[1],
            amount: expect.stringMatching(/^-1\.50(?:0+)?$/)
          })
        ])
      );

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-531-eob-batch-import-created",
        description: "Captures the temporary Slice 531 EOB batch after import, including payment metadata, balance movement, UI-backed modernized import, and ledger entries.",
        expected: {
          postings: eobBatch.map((payment) => ({
            encounter: payment.encounter,
            payerName: payment.payerName,
            reference: payment.reference,
            payAmount: payment.payAmount,
            adjustmentAmount: payment.adjustmentAmount,
            reasonCode: payment.reasonCode,
            payerClaimNumber: payment.payerClaimNumber
          })),
          counts: {
            paymentSessions: beforeCounts.paymentSessions + 2,
            paymentActivities: beforeCounts.paymentActivities + 2
          },
          balance: {
            paymentAmount: money(beforeAnchorBalance!.paymentAmount) + 39,
            adjustmentAmount: money(beforeAnchorBalance!.adjustmentAmount) + 5.75,
            balanceAmount: money(beforeAnchorBalance!.balanceAmount) - 44.75
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterImportCounts,
          paymentIds,
          postings: postings.filter((posting) => eobBatchReferences.includes(posting.reference)),
          beforeAnchorBalance,
          afterImportAnchorBalance,
          ledgerEntries: afterImportLedger.filter((entry) => eobBatchReferences.includes(entry.reference))
        },
        context: {
          canonicalId: eobBatchImportAnchorPatientId,
          encounter: eobBatchImportEncounter,
          suite: "workflow-eob-batch-import",
          workflow: "eob-batch-import-created"
        }
      });
    } finally {
      await deletePaymentsForReferences(workflow, targetDb, target.type, eobBatchReferences);
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.paymentSessions).toBe(beforeCounts.paymentSessions);
    expect(afterCleanupCounts.paymentActivities).toBe(beforeCounts.paymentActivities);
    const afterCleanupBalances = await targetDb.getAccountBalancesForPatient(patient!.pid);
    const afterCleanupAnchorBalance = balanceForEncounter(afterCleanupBalances, eobBatchImportEncounter);
    expect(afterCleanupAnchorBalance).not.toBeNull();
    expectMoney(afterCleanupAnchorBalance!.paymentAmount, money(beforeAnchorBalance!.paymentAmount));
    expectMoney(afterCleanupAnchorBalance!.adjustmentAmount, money(beforeAnchorBalance!.adjustmentAmount));
    expectMoney(afterCleanupAnchorBalance!.balanceAmount, money(beforeAnchorBalance!.balanceAmount));
    const afterCleanupPaymentIds = await findPaymentIdsForReferences(targetDb, target.type, eobBatchReferences);
    expect(afterCleanupPaymentIds).toHaveLength(0);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-531-eob-batch-import-cleanup",
      description: "Captures the final Slice 531 cleanup state for the temporary two-line EOB import.",
      expected: {
        counts: {
          paymentSessions: beforeCounts.paymentSessions,
          paymentActivities: beforeCounts.paymentActivities
        },
        balance: {
          paymentAmount: money(beforeAnchorBalance!.paymentAmount),
          adjustmentAmount: money(beforeAnchorBalance!.adjustmentAmount),
          balanceAmount: money(beforeAnchorBalance!.balanceAmount)
        },
        deletedPayments: []
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        beforeAnchorBalance,
        afterCleanupAnchorBalance,
        afterCleanupPaymentIds
      },
      context: {
        canonicalId: eobBatchImportAnchorPatientId,
        encounter: eobBatchImportEncounter,
        suite: "workflow-eob-batch-import",
        workflow: "eob-batch-import-cleanup"
      }
    });
  });
});

async function deletePaymentsForReferences(
  workflow: {
    deletePaymentPosting(id: number | string): Promise<void>;
  },
  targetDb: {
    queryRows<T extends Record<string, string>>(sql: string): Promise<T[]>;
  },
  targetType: string,
  references: string[]
) {
  const paymentIds = await findPaymentIdsForReferences(targetDb, targetType, references);
  for (const paymentId of paymentIds) {
    await workflow.deletePaymentPosting(paymentId);
  }
}

async function findPaymentIdsForReferences(
  targetDb: {
    queryRows<T extends Record<string, string>>(sql: string): Promise<T[]>;
  },
  targetType: string,
  references: string[]
): Promise<Array<number | string>> {
  if (references.length === 0) {
    return [];
  }

  const referenceList = references.map(sqlString).join(", ");
  if (targetType === "legacy-openemr") {
    const rows = await targetDb.queryRows<{ id: string }>(`
SELECT DISTINCT s.session_id AS id
FROM ar_session s
INNER JOIN ar_activity aa ON aa.session_id = s.session_id
WHERE s.reference IN (${referenceList});
`);
    return rows.map((row) => Number(row.id));
  }

  const rows = await targetDb.queryRows<{ id: string }>(`
SELECT pa.id
FROM payment_activities pa
INNER JOIN payment_sessions ps ON ps.id = pa.session_id
WHERE ps.reference IN (${referenceList});
`);
  return rows.map((row) => row.id);
}

type BalanceLike = {
  encounter: number;
  paymentAmount: string;
  adjustmentAmount: string;
  balanceAmount: string;
};

function balanceForEncounter(balances: BalanceLike[], encounter: number) {
  return balances.find((balance) => balance.encounter === encounter) ?? null;
}

function money(value: string) {
  return Number(Number(value).toFixed(2));
}

function expectMoney(actual: string, expected: number) {
  expect(money(actual)).toBeCloseTo(Number(expected.toFixed(2)), 2);
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
