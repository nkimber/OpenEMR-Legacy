import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const adjustmentReversalAnchorPatientId = "MOD-PAT-0005";
const adjustmentReversalAnchorEncounter = 1000052;

test.describe("adjustment reversal parity @slice528 @workflow-adjustment-reversals @mutation @billing", () => {
  test("posts, renders, and removes an adjustment reversal", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(adjustmentReversalAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeBalances = await targetDb.getAccountBalancesForPatient(patient!.pid);
    const beforeAnchorBalance = balanceForEncounter(beforeBalances, adjustmentReversalAnchorEncounter);
    expect(beforeAnchorBalance).not.toBeNull();
    const beforeLedger = await targetDb.getAccountLedgerForPatient(patient!.pid);
    const reference = `ADJREV-PARITY-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const payerClaimNumber = `NSTAR-ADJREV-PARITY-${Math.floor(Math.random() * 100000)}`;
    const reversalInput = {
      patientId: patient!.pid,
      encounter: adjustmentReversalAnchorEncounter,
      payerId: 9005,
      payerName: "Northstar HMO",
      payerType: 1,
      reference,
      postDate: "2026-06-19",
      paymentType: "adjustment_reversal",
      paymentMethod: "check_payment",
      codeType: "CPT4",
      code: "99214",
      memo: "Parity adjustment reversal",
      payAmount: "0.00",
      adjustmentAmount: "-12.00",
      accountCode: "",
      reasonCode: "",
      payerClaimNumber
    };
    let reversalPaymentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-528-adjustment-reversal-precondition",
        description: "Captures the Slice 528 adjustment-reversal anchor, baseline payment/balance/ledger state, and proposed negative insurer-backed adjustment payload.",
        expected: {
          patient: {
            pubpid: adjustmentReversalAnchorPatientId
          },
          encounter: adjustmentReversalAnchorEncounter,
          reversal: {
            payerId: 9005,
            payerName: "Northstar HMO",
            payerType: 1,
            paymentType: "adjustment_reversal",
            paymentMethod: "check_payment",
            postDate: "2026-06-19",
            payAmount: "0.00",
            adjustmentAmount: "-12.00"
          },
          countChange: {
            paymentSessionsAfterCreate: beforeCounts.paymentSessions + 1,
            paymentActivitiesAfterCreate: beforeCounts.paymentActivities + 1,
            paymentSessionsAfterCleanup: beforeCounts.paymentSessions,
            paymentActivitiesAfterCleanup: beforeCounts.paymentActivities
          }
        },
        actual: {
          patient,
          beforeCounts,
          beforeAnchorBalance,
          beforeLedgerCount: beforeLedger.length,
          proposedReversal: reversalInput
        },
        context: {
          canonicalId: adjustmentReversalAnchorPatientId,
          encounter: adjustmentReversalAnchorEncounter,
          suite: "workflow-adjustment-reversals",
          workflow: "adjustment-reversal-precondition"
        }
      });

      reversalPaymentId = await workflow.createPaymentPosting(reversalInput);
      const created = await workflow.getPaymentPosting(reversalPaymentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        encounter: adjustmentReversalAnchorEncounter,
        payerId: 9005,
        payerName: "Northstar HMO",
        payerType: 1,
        reference,
        paymentType: "adjustment_reversal",
        paymentMethod: "check_payment",
        postDate: "2026-06-19",
        codeType: "CPT4",
        code: "99214",
        memo: "Parity adjustment reversal",
        payAmount: "0.00",
        adjustmentAmount: "-12.00",
        accountCode: "",
        reasonCode: "",
        payerClaimNumber,
        deleted: ""
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.paymentSessions).toBe(beforeCounts.paymentSessions + 1);
      expect(afterCreateCounts.paymentActivities).toBe(beforeCounts.paymentActivities + 1);

      const postings = await targetDb.getPaymentPostingsForPatient(patient!.pid);
      expect(postings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            encounter: adjustmentReversalAnchorEncounter,
            payerType: 1,
            payerName: "Northstar HMO",
            reference,
            paymentType: "adjustment_reversal",
            paymentMethod: "check_payment",
            payAmount: expect.stringMatching(/^0(?:\.0+)?$/),
            adjustmentAmount: expect.stringMatching(/^-12(?:\.00)?$/),
            reasonCode: "",
            payerClaimNumber
          })
        ])
      );

      const afterCreateBalances = await targetDb.getAccountBalancesForPatient(patient!.pid);
      const afterCreateAnchorBalance = balanceForEncounter(afterCreateBalances, adjustmentReversalAnchorEncounter);
      expect(afterCreateAnchorBalance).not.toBeNull();
      expectMoney(afterCreateAnchorBalance!.paymentAmount, money(beforeAnchorBalance!.paymentAmount));
      expectMoney(afterCreateAnchorBalance!.adjustmentAmount, money(beforeAnchorBalance!.adjustmentAmount) - 12);
      expectMoney(afterCreateAnchorBalance!.balanceAmount, money(beforeAnchorBalance!.balanceAmount) + 12);

      const afterCreateLedger = await targetDb.getAccountLedgerForPatient(patient!.pid);
      expect(afterCreateLedger.length).toBe(beforeLedger.length + 1);
      expect(afterCreateLedger).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            description: "Parity adjustment reversal",
            reference,
            amount: expect.stringMatching(/^12(?:\.00)?$/)
          })
        ])
      );

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-528-adjustment-reversal-created",
        description: "Captures the temporary Slice 528 adjustment reversal after create, including insurer identity, count increments, balance movement, and positive reversal ledger amount.",
        expected: {
          reversal: {
            patientId: patient!.pid,
            encounter: adjustmentReversalAnchorEncounter,
            payerId: 9005,
            payerName: "Northstar HMO",
            payerType: 1,
            reference,
            paymentType: "adjustment_reversal",
            paymentMethod: "check_payment",
            payAmount: "0.00",
            adjustmentAmount: "-12.00",
            deleted: ""
          },
          counts: {
            paymentSessions: beforeCounts.paymentSessions + 1,
            paymentActivities: beforeCounts.paymentActivities + 1,
            ledgerEntries: beforeLedger.length + 1
          },
          balance: {
            paymentAmountDelta: "0.00",
            adjustmentAmountDelta: "-12.00",
            balanceAmountDelta: "12.00"
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          beforeAnchorBalance,
          afterCreateAnchorBalance,
          beforeLedgerCount: beforeLedger.length,
          reversalLedgerEntries: afterCreateLedger.filter((entry) => entry.reference === reference),
          postings: postings.filter((posting) => posting.reference === reference),
          reversalPaymentId,
          created
        },
        context: {
          canonicalId: adjustmentReversalAnchorPatientId,
          encounter: adjustmentReversalAnchorEncounter,
          suite: "workflow-adjustment-reversals",
          workflow: "adjustment-reversal-created"
        }
      });

      if (target.type !== "legacy-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText("Payment Posting");
        await expect(page.locator("body")).toContainText(reference);
        await expect(page.locator("body")).toContainText("Primary Northstar HMO");
        await expect(page.locator("body")).toContainText("Adjustment reversal");
        await expect(page.locator("body")).toContainText("Adjustment reversed $12.00");
        await expect(page.locator("body")).toContainText(`Claim ${payerClaimNumber}`);
      }
    } finally {
      if (reversalPaymentId !== null) {
        await workflow.deletePaymentPosting(reversalPaymentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.paymentSessions).toBe(beforeCounts.paymentSessions);
    expect(afterCleanupCounts.paymentActivities).toBe(beforeCounts.paymentActivities);
    if (reversalPaymentId !== null) {
      const afterCleanup = await workflow.getPaymentPosting(reversalPaymentId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-528-adjustment-reversal-cleanup",
        description: "Captures the final Slice 528 hard-delete cleanup state for the temporary adjustment reversal posting.",
        expected: {
          counts: {
            paymentSessions: beforeCounts.paymentSessions,
            paymentActivities: beforeCounts.paymentActivities
          },
          deletedReversal: null
        },
        actual: {
          patient,
          beforeCounts,
          afterCleanupCounts,
          reversalPaymentId,
          afterCleanup
        },
        context: {
          canonicalId: adjustmentReversalAnchorPatientId,
          encounter: adjustmentReversalAnchorEncounter,
          suite: "workflow-adjustment-reversals",
          workflow: "adjustment-reversal-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

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
