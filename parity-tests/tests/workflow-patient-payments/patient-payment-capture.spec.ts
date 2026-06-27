import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const patientPaymentAnchorPatientId = "MOD-PAT-0005";
const patientPaymentEncounter = 1000052;

test.describe("patient payment capture parity @slice58 @slice568 @workflow-patient-payments @mutation @billing", () => {
  test("captures, renders, voids, and removes a patient payment", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(patientPaymentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeBalances = await targetDb.getAccountBalancesForPatient(patient!.pid);
    const beforeAnchorBalance = balanceForEncounter(beforeBalances, patientPaymentEncounter);
    expect(beforeAnchorBalance).not.toBeNull();
    const beforeLedger = await targetDb.getAccountLedgerForPatient(patient!.pid);
    const reference = `RCPT-PARITY-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const paymentInput = {
      patientId: patient!.pid,
      encounter: patientPaymentEncounter,
      payerId: 0,
      payerName: "",
      payerType: 0,
      reference,
      postDate: "2026-06-18",
      paymentType: "patient_payment",
      paymentMethod: "credit_card",
      codeType: "CPT4",
      code: "99214",
      memo: "Parity patient payment",
      payAmount: "35.00",
      adjustmentAmount: "0.00",
      accountCode: "",
      reasonCode: "",
      payerClaimNumber: ""
    };
    let patientPaymentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-58-patient-payment-capture-precondition",
        description: "Captures the Slice 58 patient payment anchor, baseline payment/balance/ledger state, and proposed patient-payment posting payload.",
        expected: {
          patient: {
            pubpid: patientPaymentAnchorPatientId
          },
          encounter: patientPaymentEncounter,
          payment: {
            payerType: 0,
            paymentType: "patient_payment",
            paymentMethod: "credit_card",
            postDate: "2026-06-18",
            codeType: "CPT4",
            code: "99214",
            payAmount: "35.00",
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
          proposedPayment: paymentInput
        },
        context: {
          canonicalId: patientPaymentAnchorPatientId,
          encounter: patientPaymentEncounter,
          suite: "workflow-patient-payments",
          workflow: "patient-payment-capture"
        }
      });

      if (target.type === "legacy-openemr") {
        patientPaymentId = await workflow.createPaymentPosting(paymentInput);
      } else {
        await openAuthenticatedModernizedFees(page, target, patient!.pubpid);
        await expect(page.locator("body")).toContainText("Payment Posting");
        await expect(page.getByLabel("New payment encounter")).not.toHaveValue("");
        await page.getByLabel("New payment source").selectOption("patient");
        await page.getByLabel("New payment post date").fill(paymentInput.postDate);
        await page.getByLabel("New payment reference").fill(reference);
        await page.getByLabel("New payment method").selectOption(paymentInput.paymentMethod);
        await page.getByLabel("New payment amount").fill(paymentInput.payAmount);
        await page.getByLabel("New payment CPT code").fill(paymentInput.code);
        await page.getByLabel("New payment memo").fill(paymentInput.memo);
        await page.getByLabel("New payment encounter").fill(String(patientPaymentEncounter));
        await expect(page.getByLabel("New payment encounter")).toHaveValue(String(patientPaymentEncounter));
        await page.getByRole("button", { name: "Post Payment" }).click();
        await expect(page.locator("body")).toContainText("Payment posting saved");
        await expect(page.locator("body")).toContainText(reference);

        const createdPostings = await targetDb.getPaymentPostingsForPatient(patient!.pid);
        patientPaymentId = createdPostings.find((posting) => posting.reference === reference)?.activityId ?? null;
        expect(patientPaymentId).not.toBeNull();
      }

      const created = await workflow.getPaymentPosting(patientPaymentId!);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        encounter: patientPaymentEncounter,
        payerId: 0,
        payerName: "",
        payerType: 0,
        reference,
        paymentType: "patient_payment",
        paymentMethod: "credit_card",
        postDate: "2026-06-18",
        codeType: "CPT4",
        code: "99214",
        memo: "Parity patient payment",
        payAmount: "35.00",
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
            encounter: patientPaymentEncounter,
            payerType: 0,
            payerName: "",
            reference,
            paymentType: "patient_payment",
            paymentMethod: "credit_card",
            payAmount: expect.stringMatching(/^35(?:\.00)?$/),
            adjustmentAmount: expect.stringMatching(/^0(?:\.0+)?$/),
            reasonCode: "",
            payerClaimNumber: ""
          })
        ])
      );

      const afterCreateBalances = await targetDb.getAccountBalancesForPatient(patient!.pid);
      const afterCreateAnchorBalance = balanceForEncounter(afterCreateBalances, patientPaymentEncounter);
      expect(afterCreateAnchorBalance).not.toBeNull();
      expectMoney(afterCreateAnchorBalance!.paymentAmount, money(beforeAnchorBalance!.paymentAmount) + 35);
      expectMoney(afterCreateAnchorBalance!.adjustmentAmount, money(beforeAnchorBalance!.adjustmentAmount));
      expectMoney(afterCreateAnchorBalance!.balanceAmount, money(beforeAnchorBalance!.balanceAmount) - 35);

      const afterCreateLedger = await targetDb.getAccountLedgerForPatient(patient!.pid);
      expect(afterCreateLedger.length).toBe(beforeLedger.length + 1);
      expect(afterCreateLedger).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            entryType: "Payment",
            description: "Parity patient payment",
            reference,
            amount: expect.stringMatching(/^-35(?:\.00)?$/)
          })
        ])
      );
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-58-patient-payment-capture-created",
        description: "Captures the temporary Slice 58 patient payment after create, including payment/session/activity increments, balance movement, and ledger entry.",
        expected: {
          payment: {
            patientId: patient!.pid,
            encounter: patientPaymentEncounter,
            payerType: 0,
            reference,
            paymentType: "patient_payment",
            paymentMethod: "credit_card",
            payAmount: "35.00",
            adjustmentAmount: "0.00",
            deleted: ""
          },
          counts: {
            paymentSessions: beforeCounts.paymentSessions + 1,
            paymentActivities: beforeCounts.paymentActivities + 1,
            ledgerEntries: beforeLedger.length + 1
          },
          balance: {
            paymentAmountDelta: "35.00",
            adjustmentAmountDelta: "0.00",
            balanceAmountDelta: "-35.00"
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          beforeAnchorBalance,
          afterCreateAnchorBalance,
          beforeLedgerCount: beforeLedger.length,
          createdLedgerEntries: afterCreateLedger.filter((entry) => entry.reference === reference),
          postings: postings.filter((posting) => posting.reference === reference),
          patientPaymentId,
          created
        },
        context: {
          canonicalId: patientPaymentAnchorPatientId,
          encounter: patientPaymentEncounter,
          suite: "workflow-patient-payments",
          workflow: "patient-payment-created"
        }
      });

      if (target.type !== "legacy-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText("Payment Posting");
        await expect(page.locator("body")).toContainText("Patient /");
        await expect(page.locator("body")).toContainText(reference);
        await expect(page.locator("body")).toContainText("credit_card");
        await expect(page.locator("body")).toContainText("Paid $35.00");
        await expect(page.locator("body")).toContainText("No adjustment");
        await expect(page.locator("body")).toContainText("No payer claim number");
      }

      expect(patientPaymentId).not.toBeNull();
      const activePatientPaymentId = patientPaymentId!;
      await workflow.voidPaymentPosting(activePatientPaymentId);
      const voided = await workflow.getPaymentPosting(activePatientPaymentId);
      expect(voided).not.toBeNull();
      expect(voided!.deleted).not.toBe("");

      const afterVoidCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterVoidCounts.paymentSessions).toBe(beforeCounts.paymentSessions + 1);
      expect(afterVoidCounts.paymentActivities).toBe(beforeCounts.paymentActivities);
      const afterVoidBalances = await targetDb.getAccountBalancesForPatient(patient!.pid);
      const afterVoidAnchorBalance = balanceForEncounter(afterVoidBalances, patientPaymentEncounter);
      expect(afterVoidAnchorBalance).not.toBeNull();
      expectMoney(afterVoidAnchorBalance!.paymentAmount, money(beforeAnchorBalance!.paymentAmount));
      expectMoney(afterVoidAnchorBalance!.adjustmentAmount, money(beforeAnchorBalance!.adjustmentAmount));
      expectMoney(afterVoidAnchorBalance!.balanceAmount, money(beforeAnchorBalance!.balanceAmount));
      const afterVoidLedger = await targetDb.getAccountLedgerForPatient(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-58-patient-payment-capture-voided",
        description: "Captures the temporary Slice 58 patient payment after voiding, including inactive payment state and rolled-back active balance/ledger projection.",
        expected: {
          payment: {
            reference,
            deleted: "not blank"
          },
          counts: {
            paymentSessions: beforeCounts.paymentSessions + 1,
            paymentActivities: beforeCounts.paymentActivities,
            ledgerEntries: beforeLedger.length
          },
          balance: {
            paymentAmount: beforeAnchorBalance!.paymentAmount,
            adjustmentAmount: beforeAnchorBalance!.adjustmentAmount,
            balanceAmount: beforeAnchorBalance!.balanceAmount
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterVoidCounts,
          beforeAnchorBalance,
          afterVoidAnchorBalance,
          beforeLedgerCount: beforeLedger.length,
          afterVoidLedgerCount: afterVoidLedger.length,
          voided
        },
        context: {
          canonicalId: patientPaymentAnchorPatientId,
          encounter: patientPaymentEncounter,
          suite: "workflow-patient-payments",
          workflow: "patient-payment-voided"
        }
      });
    } finally {
      if (patientPaymentId !== null) {
        await workflow.deletePaymentPosting(patientPaymentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.paymentSessions).toBe(beforeCounts.paymentSessions);
    expect(afterCleanupCounts.paymentActivities).toBe(beforeCounts.paymentActivities);
    if (patientPaymentId !== null) {
      const afterCleanup = await workflow.getPaymentPosting(patientPaymentId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-58-patient-payment-capture-cleanup",
        description: "Captures the final Slice 58 hard-delete cleanup state for the temporary patient payment posting.",
        expected: {
          counts: {
            paymentSessions: beforeCounts.paymentSessions,
            paymentActivities: beforeCounts.paymentActivities
          },
          deletedPayment: null
        },
        actual: {
          patient,
          beforeCounts,
          afterCleanupCounts,
          patientPaymentId,
          afterCleanup
        },
        context: {
          canonicalId: patientPaymentAnchorPatientId,
          encounter: patientPaymentEncounter,
          suite: "workflow-patient-payments",
          workflow: "patient-payment-cleanup"
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
