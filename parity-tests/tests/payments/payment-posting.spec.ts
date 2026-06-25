import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const paymentPostingAnchorPatientId = "MOD-PAT-0005";
const paymentPostingAnchorEncounter = 1000052;
const paymentPostingAnchorReference = "EOB-NSTAR-1000052";

test.describe("payment posting parity @slice48 @payments @billing", () => {
  test("stable billing anchor has seeded payment and adjustment postings", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(paymentPostingAnchorPatientId);
    expect(patient).not.toBeNull();

    const postings = await targetDb.getPaymentPostingsForPatient(patient!.pid);
    const encounterPostings = postings.filter((posting) => posting.encounter === paymentPostingAnchorEncounter);
    expect(postings.length).toBeGreaterThanOrEqual(2);

    const anchorPayment = postings.find(
      (posting) => posting.reference === paymentPostingAnchorReference && Number(posting.payAmount) === 126
    );
    const anchorAdjustment = postings.find(
      (posting) => posting.reference === paymentPostingAnchorReference && Number(posting.adjustmentAmount) === 42
    );

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-48-payment-posting-anchor",
      description: "Verifies the Slice 48 billing anchor patient and seeded payment posting database facts before application rendering.",
      expected: {
        patient: {
          pubpid: paymentPostingAnchorPatientId
        },
        postings: {
          minimumCount: 2,
          anchorEncounter: paymentPostingAnchorEncounter,
          reference: paymentPostingAnchorReference,
          payment: {
            payerName: "Northstar HMO",
            paymentType: "insurance_payment",
            paymentMethod: "check_payment",
            payAmount: "126",
            memo: "Northstar HMO insurance payment",
            payerClaimNumber: "NSTAR-CLM-1000052"
          },
          adjustment: {
            payerName: "Northstar HMO",
            adjustmentAmount: "42",
            accountCode: "CO45",
            reasonCode: "CO-45",
            memo: "Contractual adjustment",
            payerClaimNumber: "NSTAR-CLM-1000052"
          }
        }
      },
      actual: {
        patient,
        postings,
        encounterPostings,
        selected: {
          anchorPayment,
          anchorAdjustment
        }
      },
      context: {
        canonicalId: paymentPostingAnchorPatientId,
        suite: "payments",
        workflow: "payment-posting-readiness"
      }
    });

    expect(anchorPayment).toMatchObject({
      patientId: patient!.pid,
      encounter: paymentPostingAnchorEncounter,
      payerName: "Northstar HMO",
      paymentType: "insurance_payment",
      paymentMethod: "check_payment",
      memo: "Northstar HMO insurance payment",
      payerClaimNumber: "NSTAR-CLM-1000052"
    });
    expect(anchorAdjustment).toMatchObject({
      patientId: patient!.pid,
      encounter: paymentPostingAnchorEncounter,
      payerName: "Northstar HMO",
      accountCode: "CO45",
      reasonCode: "CO-45",
      memo: "Contractual adjustment",
      payerClaimNumber: "NSTAR-CLM-1000052"
    });

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-48-payment-posting-render-precondition",
      description: "Captures the exact payment and adjustment posting rows used by the Slice 48 Fees payment rendering assertions.",
      expected: {
        visibleText: [
          "Payments",
          "Payment Posting",
          "Northstar HMO",
          paymentPostingAnchorReference,
          "Paid $126.00",
          "Adjusted $42.00",
          "Reason CO-45",
          "Claim NSTAR-CLM-1000052"
        ]
      },
      actual: {
        patient,
        selected: {
          anchorPayment,
          anchorAdjustment
        },
        encounterPostings
      },
      context: {
        canonicalId: paymentPostingAnchorPatientId,
        suite: "payments",
        workflow: "payment-posting-rendering"
      }
    });

    if (target.type === "legacy-openemr") {
      return;
    }

    await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText("Payments");
    await expect(page.locator("body")).toContainText("Payment Posting");
    await expect(page.locator("body")).toContainText("Northstar HMO");
    await expect(page.locator("body")).toContainText(paymentPostingAnchorReference);
    await expect(page.locator("body")).toContainText("Paid $126.00");
    await expect(page.locator("body")).toContainText("Adjusted $42.00");
    await expect(page.locator("body")).toContainText("Reason CO-45");
    await expect(page.locator("body")).toContainText("Claim NSTAR-CLM-1000052");
  });
});
