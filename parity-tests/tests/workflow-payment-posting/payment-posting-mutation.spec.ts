import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const paymentPostingMutationAnchorPatientId = "MOD-PAT-0005";
const paymentPostingEncounter = 1000052;

test.describe("payment posting mutation parity @slice56 @workflow-payment-posting @mutation @billing", () => {
  test("creates, renders, voids, and removes a payment posting", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(paymentPostingMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeBalances = await targetDb.getAccountBalancesForPatient(patient!.pid);
    const beforeAnchorBalance = balanceForEncounter(beforeBalances, paymentPostingEncounter);
    expect(beforeAnchorBalance).not.toBeNull();
    const beforeLedger = await targetDb.getAccountLedgerForPatient(patient!.pid);
    const reference = `EOB-PARITY-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const payerClaimNumber = `NSTAR-CLM-PARITY-${Math.floor(Math.random() * 100000)}`;
    let paymentPostingId: number | string | null = null;

    try {
      paymentPostingId = await workflow.createPaymentPosting({
        patientId: patient!.pid,
        encounter: paymentPostingEncounter,
        payerId: 9005,
        payerName: "Northstar HMO",
        payerType: 1,
        reference,
        postDate: "2026-06-18",
        paymentType: "insurance_payment",
        paymentMethod: "check_payment",
        codeType: "CPT4",
        code: "99214",
        memo: "Parity payment posting",
        payAmount: "21.00",
        adjustmentAmount: "3.50",
        accountCode: "CO45",
        reasonCode: "CO-45",
        payerClaimNumber
      });

      const created = await workflow.getPaymentPosting(paymentPostingId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        encounter: paymentPostingEncounter,
        payerId: 9005,
        payerName: "Northstar HMO",
        payerType: 1,
        reference,
        paymentType: "insurance_payment",
        paymentMethod: "check_payment",
        postDate: "2026-06-18",
        codeType: "CPT4",
        code: "99214",
        memo: "Parity payment posting",
        payAmount: "21.00",
        adjustmentAmount: "3.50",
        accountCode: "CO45",
        reasonCode: "CO-45",
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
            encounter: paymentPostingEncounter,
            payerName: "Northstar HMO",
            reference,
            payAmount: expect.stringMatching(/^21(?:\.00)?$/),
            adjustmentAmount: expect.stringMatching(/^3\.50(?:0+)?$/),
            reasonCode: "CO-45",
            payerClaimNumber
          })
        ])
      );

      const afterCreateBalances = await targetDb.getAccountBalancesForPatient(patient!.pid);
      const afterCreateAnchorBalance = balanceForEncounter(afterCreateBalances, paymentPostingEncounter);
      expect(afterCreateAnchorBalance).not.toBeNull();
      expectMoney(afterCreateAnchorBalance!.paymentAmount, money(beforeAnchorBalance!.paymentAmount) + 21);
      expectMoney(afterCreateAnchorBalance!.adjustmentAmount, money(beforeAnchorBalance!.adjustmentAmount) + 3.5);
      expectMoney(afterCreateAnchorBalance!.balanceAmount, money(beforeAnchorBalance!.balanceAmount) - 24.5);

      const afterCreateLedger = await targetDb.getAccountLedgerForPatient(patient!.pid);
      expect(afterCreateLedger.length).toBe(beforeLedger.length + 2);
      expect(afterCreateLedger).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            entryType: "Payment",
            description: "Parity payment posting",
            reference,
            amount: expect.stringMatching(/^-21(?:\.00)?$/)
          }),
          expect.objectContaining({
            entryType: "Adjustment",
            description: "Parity payment posting",
            reference,
            amount: expect.stringMatching(/^-3\.50(?:0+)?$/)
          })
        ])
      );

      if (target.type !== "legacy-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText("Payment Posting");
        await expect(page.locator("body")).toContainText("Northstar HMO");
        await expect(page.locator("body")).toContainText(reference);
        await expect(page.locator("body")).toContainText("Paid $21.00");
        await expect(page.locator("body")).toContainText("Adjusted $3.50");
        await expect(page.locator("body")).toContainText("Reason CO-45");
        await expect(page.locator("body")).toContainText(`Claim ${payerClaimNumber}`);
      }

      await workflow.voidPaymentPosting(paymentPostingId);
      const voided = await workflow.getPaymentPosting(paymentPostingId);
      expect(voided).not.toBeNull();
      expect(voided!.deleted).not.toBe("");

      const afterVoidCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterVoidCounts.paymentSessions).toBe(beforeCounts.paymentSessions + 1);
      expect(afterVoidCounts.paymentActivities).toBe(beforeCounts.paymentActivities);
      const afterVoidBalances = await targetDb.getAccountBalancesForPatient(patient!.pid);
      const afterVoidAnchorBalance = balanceForEncounter(afterVoidBalances, paymentPostingEncounter);
      expect(afterVoidAnchorBalance).not.toBeNull();
      expectMoney(afterVoidAnchorBalance!.paymentAmount, money(beforeAnchorBalance!.paymentAmount));
      expectMoney(afterVoidAnchorBalance!.adjustmentAmount, money(beforeAnchorBalance!.adjustmentAmount));
      expectMoney(afterVoidAnchorBalance!.balanceAmount, money(beforeAnchorBalance!.balanceAmount));
    } finally {
      if (paymentPostingId !== null) {
        await workflow.deletePaymentPosting(paymentPostingId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.paymentSessions).toBe(beforeCounts.paymentSessions);
    expect(afterCleanupCounts.paymentActivities).toBe(beforeCounts.paymentActivities);
    if (paymentPostingId !== null) {
      await expect(workflow.getPaymentPosting(paymentPostingId)).resolves.toBeNull();
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
