import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const claimAdjudicationAnchorPatientId = "MOD-PAT-0005";
const claimAdjudicationEncounter = 1000052;

test.describe("claim adjudication parity @slice530 @workflow-claim-adjudication @mutation @billing", () => {
  test("creates, adjudicates, renders, and removes a temporary claim adjudication", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(claimAdjudicationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeBalances = await targetDb.getAccountBalancesForPatient(patient!.pid);
    const beforeAnchorBalance = balanceForEncounter(beforeBalances, claimAdjudicationEncounter);
    expect(beforeAnchorBalance).not.toBeNull();
    const beforeLedger = await targetDb.getAccountLedgerForPatient(patient!.pid);
    const generatedProcessFile = `CLAIM-${claimAdjudicationEncounter}-ADJUDICATION-${Math.floor(Math.random() * 100000)}-837P.txt`;
    const adjudicatedProcessFile = `CLAIM-${claimAdjudicationEncounter}-EOB-835.txt`;
    const queuedPayload = `Parity adjudication queued claim ${Date.now()}`;
    const adjudicatedPayload = `Adjudicated parity claim ${Date.now()}`;
    const reference = `EOB-${claimAdjudicationEncounter}-ADJUDICATED`;
    const createInput = {
      patientId: patient!.pid,
      encounter: claimAdjudicationEncounter,
      payerId: 9005,
      payerName: "Northstar HMO",
      payerType: 1,
      status: 2,
      billProcess: 0,
      billTime: "2026-06-18 12:15:00",
      processTime: "2026-06-18 14:15:00",
      processFile: generatedProcessFile,
      target: "X12",
      x12PartnerId: 1,
      submittedClaim: queuedPayload
    };
    const adjudicatedInput = {
      status: 3,
      billProcess: 0,
      processTime: "2026-06-18 16:05:00",
      processFile: adjudicatedProcessFile,
      target: "X12",
      x12PartnerId: 1,
      submittedClaim: adjudicatedPayload
    };
    const paymentInput = {
      patientId: patient!.pid,
      encounter: claimAdjudicationEncounter,
      payerId: 9005,
      payerName: "Northstar HMO",
      payerType: 1,
      reference,
      postDate: "2026-06-18",
      paymentType: "insurance_payment",
      paymentMethod: "electronic_payment",
      codeType: "CPT4",
      code: "99214",
      memo: `Adjudicated claim ${claimAdjudicationEncounter}`,
      payAmount: "42.00",
      adjustmentAmount: "5.75",
      accountCode: "CO45",
      reasonCode: "CO-45",
      payerClaimNumber: ""
    };
    let claimId: number | string | null = null;
    let paymentIds: Array<number | string> = [];

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-530-claim-adjudication-precondition",
        description: "Captures the Slice 530 claim adjudication anchor, baseline claim/payment/balance state, and proposed generated claim plus EOB payment payload.",
        expected: {
          patient: {
            pubpid: claimAdjudicationAnchorPatientId
          },
          encounter: claimAdjudicationEncounter,
          generatedClaim: {
            status: 2,
            statusLabel: "Marked as cleared",
            target: "X12",
            processFile: generatedProcessFile
          },
          adjudication: {
            reference,
            payerName: "Northstar HMO",
            payAmount: "42.00",
            adjustmentAmount: "5.75",
            reasonCode: "CO-45",
            processFile: adjudicatedProcessFile
          },
          countChange: {
            claimsAfterCreate: beforeCounts.claims + 1,
            paymentSessionsAfterAdjudication: beforeCounts.paymentSessions + 1,
            paymentActivitiesAfterAdjudication: beforeCounts.paymentActivities + 1,
            claimsAfterCleanup: beforeCounts.claims,
            paymentSessionsAfterCleanup: beforeCounts.paymentSessions,
            paymentActivitiesAfterCleanup: beforeCounts.paymentActivities
          },
          balanceChange: {
            paymentAmountDelta: 42,
            adjustmentAmountDelta: 5.75,
            balanceAmountDelta: -47.75
          }
        },
        actual: {
          patient,
          beforeCounts,
          beforeAnchorBalance,
          beforeLedgerCount: beforeLedger.length,
          proposedClaim: createInput,
          proposedAdjudication: adjudicatedInput,
          proposedPayment: paymentInput
        },
        context: {
          canonicalId: claimAdjudicationAnchorPatientId,
          encounter: claimAdjudicationEncounter,
          suite: "workflow-claim-adjudication",
          workflow: "claim-adjudication-precondition"
        }
      });

      claimId = await workflow.createClaimStatus(createInput);
      const generated = await workflow.getClaimStatus(claimId);
      expect(generated).toMatchObject({
        patientId: patient!.pid,
        encounter: claimAdjudicationEncounter,
        payerName: "Northstar HMO",
        status: 2,
        statusLabel: "Marked as cleared",
        billProcess: 0,
        processFile: generatedProcessFile,
        target: "X12",
        submittedClaim: queuedPayload
      });

      const payerClaimNumber = `ADJ-${claimId}`.slice(0, 48);
      paymentInput.payerClaimNumber = payerClaimNumber;

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient!.pubpid);
        const claimCard = page.locator("article.billing-line-card").filter({ hasText: generatedProcessFile }).first();
        await expect(claimCard).toContainText("Claim Status");
        await claimCard.getByRole("button", { name: "Adjudicate" }).click();
        await expect(page.locator("body")).toContainText(reference);
        await expect(page.locator("body")).toContainText("Paid $42.00");
        await expect(page.locator("body")).toContainText("Adjusted $5.75");
        await expect(page.locator("body")).toContainText(`Claim ${payerClaimNumber}`);
        await expect(page.locator("body")).toContainText(adjudicatedProcessFile);
      } else {
        const paymentId = await workflow.createPaymentPosting(paymentInput);
        paymentIds.push(paymentId);
        await workflow.updateClaimStatus(claimId, adjudicatedInput);
      }

      const discoveredPaymentIds = await findPaymentIdsForReference(targetDb, target.type, reference);
      paymentIds = Array.from(new Set([...paymentIds, ...discoveredPaymentIds]));
      expect(paymentIds.length).toBeGreaterThan(0);

      const adjudicated = await workflow.getClaimStatus(claimId);
      expect(adjudicated).toMatchObject({
        patientId: patient!.pid,
        encounter: claimAdjudicationEncounter,
        payerName: "Northstar HMO",
        status: 3,
        statusLabel: "Marked as cleared",
        billProcess: 0,
        processTime: "2026-06-18 16:05:00",
        processFile: adjudicatedProcessFile,
        target: "X12",
        x12PartnerId: 1
      });

      const afterAdjudicationCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterAdjudicationCounts.claims).toBe(beforeCounts.claims + 1);
      expect(afterAdjudicationCounts.paymentSessions).toBe(beforeCounts.paymentSessions + 1);
      expect(afterAdjudicationCounts.paymentActivities).toBe(beforeCounts.paymentActivities + 1);

      const postings = await targetDb.getPaymentPostingsForPatient(patient!.pid);
      expect(postings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            encounter: claimAdjudicationEncounter,
            payerName: "Northstar HMO",
            reference,
            paymentType: "insurance_payment",
            paymentMethod: "electronic_payment",
            payAmount: expect.stringMatching(/^42(?:\.00)?$/),
            adjustmentAmount: expect.stringMatching(/^5\.75(?:0+)?$/),
            reasonCode: "CO-45",
            payerClaimNumber
          })
        ])
      );

      const afterAdjudicationBalances = await targetDb.getAccountBalancesForPatient(patient!.pid);
      const afterAdjudicationAnchorBalance = balanceForEncounter(afterAdjudicationBalances, claimAdjudicationEncounter);
      expect(afterAdjudicationAnchorBalance).not.toBeNull();
      expectMoney(afterAdjudicationAnchorBalance!.paymentAmount, money(beforeAnchorBalance!.paymentAmount) + 42);
      expectMoney(afterAdjudicationAnchorBalance!.adjustmentAmount, money(beforeAnchorBalance!.adjustmentAmount) + 5.75);
      expectMoney(afterAdjudicationAnchorBalance!.balanceAmount, money(beforeAnchorBalance!.balanceAmount) - 47.75);

      const afterAdjudicationLedger = await targetDb.getAccountLedgerForPatient(patient!.pid);
      expect(afterAdjudicationLedger).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            entryType: "Payment",
            description: `Adjudicated claim ${claimAdjudicationEncounter}`,
            reference,
            amount: expect.stringMatching(/^-42(?:\.00)?$/)
          }),
          expect.objectContaining({
            entryType: "Adjustment",
            description: `Adjudicated claim ${claimAdjudicationEncounter}`,
            reference,
            amount: expect.stringMatching(/^-5\.75(?:0+)?$/)
          })
        ])
      );

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-530-claim-adjudication-adjudicated",
        description: "Captures the temporary Slice 530 claim after adjudication, including cleared claim status, EOB process file, payment posting, balance movement, and ledger entries.",
        expected: {
          claim: {
            patientId: patient!.pid,
            encounter: claimAdjudicationEncounter,
            payerName: "Northstar HMO",
            status: 3,
            statusLabel: "Marked as cleared",
            processFile: adjudicatedProcessFile,
            target: "X12"
          },
          payment: {
            reference,
            payerClaimNumber,
            payAmount: "42.00",
            adjustmentAmount: "5.75",
            reasonCode: "CO-45"
          },
          counts: {
            claims: beforeCounts.claims + 1,
            paymentSessions: beforeCounts.paymentSessions + 1,
            paymentActivities: beforeCounts.paymentActivities + 1
          },
          balance: {
            paymentAmount: money(beforeAnchorBalance!.paymentAmount) + 42,
            adjustmentAmount: money(beforeAnchorBalance!.adjustmentAmount) + 5.75,
            balanceAmount: money(beforeAnchorBalance!.balanceAmount) - 47.75
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterAdjudicationCounts,
          beforeAnchorBalance,
          afterAdjudicationAnchorBalance,
          paymentIds,
          generated,
          adjudicated,
          postings: postings.filter((posting) => posting.reference === reference),
          ledgerEntries: afterAdjudicationLedger.filter((entry) => entry.reference === reference)
        },
        context: {
          canonicalId: claimAdjudicationAnchorPatientId,
          encounter: claimAdjudicationEncounter,
          suite: "workflow-claim-adjudication",
          workflow: "claim-adjudication-adjudicated"
        }
      });
    } finally {
      for (const paymentId of paymentIds) {
        await workflow.deletePaymentPosting(paymentId);
      }

      if (claimId !== null) {
        await workflow.deleteClaimStatus(claimId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.claims).toBe(beforeCounts.claims);
    expect(afterCleanupCounts.paymentSessions).toBe(beforeCounts.paymentSessions);
    expect(afterCleanupCounts.paymentActivities).toBe(beforeCounts.paymentActivities);
    const afterCleanupPaymentIds = await findPaymentIdsForReference(targetDb, target.type, reference);
    expect(afterCleanupPaymentIds).toHaveLength(0);
    if (claimId !== null) {
      const afterCleanup = await workflow.getClaimStatus(claimId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-530-claim-adjudication-cleanup",
        description: "Captures the final Slice 530 cleanup state for the temporary claim and adjudication payment.",
        expected: {
          counts: {
            claims: beforeCounts.claims,
            paymentSessions: beforeCounts.paymentSessions,
            paymentActivities: beforeCounts.paymentActivities
          },
          deletedClaim: null,
          deletedPayments: []
        },
        actual: {
          patient,
          beforeCounts,
          afterCleanupCounts,
          claimId,
          afterCleanup,
          afterCleanupPaymentIds
        },
        context: {
          canonicalId: claimAdjudicationAnchorPatientId,
          encounter: claimAdjudicationEncounter,
          suite: "workflow-claim-adjudication",
          workflow: "claim-adjudication-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

async function findPaymentIdsForReference(
  targetDb: {
    queryRows<T extends Record<string, string>>(sql: string): Promise<T[]>;
  },
  targetType: string,
  reference: string
): Promise<Array<number | string>> {
  if (targetType === "legacy-openemr") {
    const rows = await targetDb.queryRows<{ id: string }>(`
SELECT DISTINCT s.session_id AS id
FROM ar_session s
INNER JOIN ar_activity aa ON aa.session_id = s.session_id
WHERE s.reference = ${sqlString(reference)};
`);
    return rows.map((row) => Number(row.id));
  }

  const rows = await targetDb.queryRows<{ id: string }>(`
SELECT pa.id
FROM payment_activities pa
INNER JOIN payment_sessions ps ON ps.id = pa.session_id
WHERE ps.reference = ${sqlString(reference)};
`);
  return rows.map((row) => row.id);
}

function balanceForEncounter<T extends { encounter: number }>(balances: T[], encounter: number): T | null {
  return balances.find((balance) => balance.encounter === encounter) ?? null;
}

function money(value: string): number {
  return Number.parseFloat(value);
}

function expectMoney(actual: string, expected: number) {
  expect(money(actual)).toBeCloseTo(expected, 2);
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
