import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const refundAnchorPatientId = "MOD-PAT-0005";
const refundAnchorEncounter = 1000052;

test.describe("patient payment refund parity @slice526 @workflow-patient-payment-refunds @mutation @billing", () => {
  test("posts, renders, and removes a patient refund reversal", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(refundAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeBalances = await targetDb.getAccountBalancesForPatient(patient!.pid);
    const beforeAnchorBalance = balanceForEncounter(beforeBalances, refundAnchorEncounter);
    expect(beforeAnchorBalance).not.toBeNull();
    const beforeLedger = await targetDb.getAccountLedgerForPatient(patient!.pid);
    const reference = `RFND-PARITY-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const refundInput = {
      patientId: patient!.pid,
      encounter: refundAnchorEncounter,
      payerId: 0,
      payerName: "",
      payerType: 0,
      reference,
      postDate: "2026-06-19",
      paymentType: "patient_refund",
      paymentMethod: "credit_card",
      codeType: "CPT4",
      code: "99214",
      memo: "Parity patient refund",
      payAmount: "-18.00",
      adjustmentAmount: "0.00",
      accountCode: "",
      reasonCode: "",
      payerClaimNumber: ""
    };
    let refundPaymentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-526-patient-payment-refund-precondition",
        description: "Captures the Slice 526 refund anchor, baseline payment/balance/ledger state, and proposed negative patient-refund posting payload.",
        expected: {
          patient: {
            pubpid: refundAnchorPatientId
          },
          encounter: refundAnchorEncounter,
          refund: {
            payerType: 0,
            paymentType: "patient_refund",
            paymentMethod: "credit_card",
            postDate: "2026-06-19",
            payAmount: "-18.00",
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
          proposedRefund: refundInput
        },
        context: {
          canonicalId: refundAnchorPatientId,
          encounter: refundAnchorEncounter,
          suite: "workflow-patient-payment-refunds",
          workflow: "patient-payment-refund-precondition"
        }
      });

      refundPaymentId = await workflow.createPaymentPosting(refundInput);
      const created = await workflow.getPaymentPosting(refundPaymentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        encounter: refundAnchorEncounter,
        payerId: 0,
        payerName: "",
        payerType: 0,
        reference,
        paymentType: "patient_refund",
        paymentMethod: "credit_card",
        postDate: "2026-06-19",
        codeType: "CPT4",
        code: "99214",
        memo: "Parity patient refund",
        payAmount: "-18.00",
        adjustmentAmount: "0.00",
        accountCode: "",
        reasonCode: "",
        payerClaimNumber: "",
        deleted: ""
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.paymentSessions).toBe(beforeCounts.paymentSessions + 1);
      expect(afterCreateCounts.paymentActivities).toBe(beforeCounts.paymentActivities + 1);

      const postings = await targetDb.getPaymentPostingsForPatient(patient!.pid);
      expect(postings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            encounter: refundAnchorEncounter,
            payerType: 0,
            payerName: "",
            reference,
            paymentType: "patient_refund",
            paymentMethod: "credit_card",
            payAmount: expect.stringMatching(/^-18(?:\.00)?$/),
            adjustmentAmount: expect.stringMatching(/^0(?:\.0+)?$/),
            reasonCode: "",
            payerClaimNumber: ""
          })
        ])
      );

      const afterCreateBalances = await targetDb.getAccountBalancesForPatient(patient!.pid);
      const afterCreateAnchorBalance = balanceForEncounter(afterCreateBalances, refundAnchorEncounter);
      expect(afterCreateAnchorBalance).not.toBeNull();
      expectMoney(afterCreateAnchorBalance!.paymentAmount, money(beforeAnchorBalance!.paymentAmount) - 18);
      expectMoney(afterCreateAnchorBalance!.adjustmentAmount, money(beforeAnchorBalance!.adjustmentAmount));
      expectMoney(afterCreateAnchorBalance!.balanceAmount, money(beforeAnchorBalance!.balanceAmount) + 18);

      const afterCreateLedger = await targetDb.getAccountLedgerForPatient(patient!.pid);
      expect(afterCreateLedger.length).toBe(beforeLedger.length + 1);
      expect(afterCreateLedger).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            description: "Parity patient refund",
            reference,
            amount: expect.stringMatching(/^18(?:\.00)?$/)
          })
        ])
      );
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-526-patient-payment-refund-created",
        description: "Captures the temporary Slice 526 patient refund after create, including payment/session/activity increments, balance movement, and positive refund ledger amount.",
        expected: {
          refund: {
            patientId: patient!.pid,
            encounter: refundAnchorEncounter,
            payerType: 0,
            reference,
            paymentType: "patient_refund",
            paymentMethod: "credit_card",
            payAmount: "-18.00",
            adjustmentAmount: "0.00",
            deleted: ""
          },
          counts: {
            paymentSessions: beforeCounts.paymentSessions + 1,
            paymentActivities: beforeCounts.paymentActivities + 1,
            ledgerEntries: beforeLedger.length + 1
          },
          balance: {
            paymentAmountDelta: "-18.00",
            adjustmentAmountDelta: "0.00",
            balanceAmountDelta: "18.00"
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          beforeAnchorBalance,
          afterCreateAnchorBalance,
          beforeLedgerCount: beforeLedger.length,
          refundLedgerEntries: afterCreateLedger.filter((entry) => entry.reference === reference),
          postings: postings.filter((posting) => posting.reference === reference),
          refundPaymentId,
          created
        },
        context: {
          canonicalId: refundAnchorPatientId,
          encounter: refundAnchorEncounter,
          suite: "workflow-patient-payment-refunds",
          workflow: "patient-payment-refund-created"
        }
      });

      if (target.type !== "legacy-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText("Payment Posting");
        await expect(page.locator("body")).toContainText(reference);
        await expect(page.locator("body")).toContainText("Refunded $18.00");
        await expect(page.locator("body")).toContainText("Patient refund");
        await expect(page.locator("body")).toContainText("Refund $18.00");
      }
    } finally {
      if (refundPaymentId !== null) {
        await workflow.deletePaymentPosting(refundPaymentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.paymentSessions).toBe(beforeCounts.paymentSessions);
    expect(afterCleanupCounts.paymentActivities).toBe(beforeCounts.paymentActivities);
    if (refundPaymentId !== null) {
      const afterCleanup = await workflow.getPaymentPosting(refundPaymentId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-526-patient-payment-refund-cleanup",
        description: "Captures the final Slice 526 hard-delete cleanup state for the temporary patient refund posting.",
        expected: {
          counts: {
            paymentSessions: beforeCounts.paymentSessions,
            paymentActivities: beforeCounts.paymentActivities
          },
          deletedRefund: null
        },
        actual: {
          patient,
          beforeCounts,
          afterCleanupCounts,
          refundPaymentId,
          afterCleanup
        },
        context: {
          canonicalId: refundAnchorPatientId,
          encounter: refundAnchorEncounter,
          suite: "workflow-patient-payment-refunds",
          workflow: "patient-payment-refund-cleanup"
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
