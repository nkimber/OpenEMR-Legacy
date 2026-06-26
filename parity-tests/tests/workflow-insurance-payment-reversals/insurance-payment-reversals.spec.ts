import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const reversalAnchorPatientId = "MOD-PAT-0005";
const reversalAnchorEncounter = 1000052;

test.describe("insurance payment reversal parity @slice527 @workflow-insurance-payment-reversals @mutation @billing", () => {
  test("posts, renders, and removes an insurance payment reversal", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(reversalAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeBalances = await targetDb.getAccountBalancesForPatient(patient!.pid);
    const beforeAnchorBalance = balanceForEncounter(beforeBalances, reversalAnchorEncounter);
    expect(beforeAnchorBalance).not.toBeNull();
    const beforeLedger = await targetDb.getAccountLedgerForPatient(patient!.pid);
    const reference = `REV-PARITY-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const payerClaimNumber = `NSTAR-REV-PARITY-${Math.floor(Math.random() * 100000)}`;
    const reversalInput = {
      patientId: patient!.pid,
      encounter: reversalAnchorEncounter,
      payerId: 9005,
      payerName: "Northstar HMO",
      payerType: 1,
      reference,
      postDate: "2026-06-19",
      paymentType: "insurance_reversal",
      paymentMethod: "check_payment",
      codeType: "CPT4",
      code: "99214",
      memo: "Parity insurance reversal",
      payAmount: "-16.00",
      adjustmentAmount: "0.00",
      accountCode: "",
      reasonCode: "",
      payerClaimNumber
    };
    let reversalPaymentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-527-insurance-payment-reversal-precondition",
        description: "Captures the Slice 527 reversal anchor, baseline payment/balance/ledger state, and proposed negative insurer-backed payment reversal payload.",
        expected: {
          patient: {
            pubpid: reversalAnchorPatientId
          },
          encounter: reversalAnchorEncounter,
          reversal: {
            payerId: 9005,
            payerName: "Northstar HMO",
            payerType: 1,
            paymentType: "insurance_reversal",
            paymentMethod: "check_payment",
            postDate: "2026-06-19",
            payAmount: "-16.00",
            adjustmentAmount: "0.00"
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
          canonicalId: reversalAnchorPatientId,
          encounter: reversalAnchorEncounter,
          suite: "workflow-insurance-payment-reversals",
          workflow: "insurance-payment-reversal-precondition"
        }
      });

      reversalPaymentId = await workflow.createPaymentPosting(reversalInput);
      const created = await workflow.getPaymentPosting(reversalPaymentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        encounter: reversalAnchorEncounter,
        payerId: 9005,
        payerName: "Northstar HMO",
        payerType: 1,
        reference,
        paymentType: "insurance_reversal",
        paymentMethod: "check_payment",
        postDate: "2026-06-19",
        codeType: "CPT4",
        code: "99214",
        memo: "Parity insurance reversal",
        payAmount: "-16.00",
        adjustmentAmount: "0.00",
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
            encounter: reversalAnchorEncounter,
            payerType: 1,
            payerName: "Northstar HMO",
            reference,
            paymentType: "insurance_reversal",
            paymentMethod: "check_payment",
            payAmount: expect.stringMatching(/^-16(?:\.00)?$/),
            adjustmentAmount: expect.stringMatching(/^0(?:\.0+)?$/),
            reasonCode: "",
            payerClaimNumber
          })
        ])
      );

      const afterCreateBalances = await targetDb.getAccountBalancesForPatient(patient!.pid);
      const afterCreateAnchorBalance = balanceForEncounter(afterCreateBalances, reversalAnchorEncounter);
      expect(afterCreateAnchorBalance).not.toBeNull();
      expectMoney(afterCreateAnchorBalance!.paymentAmount, money(beforeAnchorBalance!.paymentAmount) - 16);
      expectMoney(afterCreateAnchorBalance!.adjustmentAmount, money(beforeAnchorBalance!.adjustmentAmount));
      expectMoney(afterCreateAnchorBalance!.balanceAmount, money(beforeAnchorBalance!.balanceAmount) + 16);

      const afterCreateLedger = await targetDb.getAccountLedgerForPatient(patient!.pid);
      expect(afterCreateLedger.length).toBe(beforeLedger.length + 1);
      expect(afterCreateLedger).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            description: "Parity insurance reversal",
            reference,
            amount: expect.stringMatching(/^16(?:\.00)?$/)
          })
        ])
      );

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-527-insurance-payment-reversal-created",
        description: "Captures the temporary Slice 527 insurance payment reversal after create, including insurer identity, count increments, balance movement, and positive reversal ledger amount.",
        expected: {
          reversal: {
            patientId: patient!.pid,
            encounter: reversalAnchorEncounter,
            payerId: 9005,
            payerName: "Northstar HMO",
            payerType: 1,
            reference,
            paymentType: "insurance_reversal",
            paymentMethod: "check_payment",
            payAmount: "-16.00",
            adjustmentAmount: "0.00",
            deleted: ""
          },
          counts: {
            paymentSessions: beforeCounts.paymentSessions + 1,
            paymentActivities: beforeCounts.paymentActivities + 1,
            ledgerEntries: beforeLedger.length + 1
          },
          balance: {
            paymentAmountDelta: "-16.00",
            adjustmentAmountDelta: "0.00",
            balanceAmountDelta: "16.00"
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
          canonicalId: reversalAnchorPatientId,
          encounter: reversalAnchorEncounter,
          suite: "workflow-insurance-payment-reversals",
          workflow: "insurance-payment-reversal-created"
        }
      });

      if (target.type !== "legacy-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText("Payment Posting");
        await expect(page.locator("body")).toContainText(reference);
        await expect(page.locator("body")).toContainText("Primary Northstar HMO");
        await expect(page.locator("body")).toContainText("Insurance reversal");
        await expect(page.locator("body")).toContainText("Reversed $16.00");
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
        probe: "slice-527-insurance-payment-reversal-cleanup",
        description: "Captures the final Slice 527 hard-delete cleanup state for the temporary insurance payment reversal posting.",
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
          canonicalId: reversalAnchorPatientId,
          encounter: reversalAnchorEncounter,
          suite: "workflow-insurance-payment-reversals",
          workflow: "insurance-payment-reversal-cleanup"
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
