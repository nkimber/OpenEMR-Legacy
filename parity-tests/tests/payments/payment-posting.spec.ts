import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const paymentPostingAnchorPatientId = "MOD-PAT-0005";

test.describe("payment posting parity @slice48 @payments @billing", () => {
  test("stable billing anchor has seeded payment and adjustment postings", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(paymentPostingAnchorPatientId);
    expect(patient).not.toBeNull();

    const postings = await targetDb.getPaymentPostingsForPatient(patient!.pid);
    expect(postings.length).toBeGreaterThanOrEqual(2);

    const anchorPayment = postings.find(
      (posting) => posting.reference === "EOB-NSTAR-1000052" && Number(posting.payAmount) === 126
    );
    const anchorAdjustment = postings.find(
      (posting) => posting.reference === "EOB-NSTAR-1000052" && Number(posting.adjustmentAmount) === 42
    );

    expect(anchorPayment).toMatchObject({
      patientId: patient!.pid,
      encounter: 1000052,
      payerName: "Northstar HMO",
      paymentType: "insurance_payment",
      paymentMethod: "check_payment",
      memo: "Northstar HMO insurance payment",
      payerClaimNumber: "NSTAR-CLM-1000052"
    });
    expect(anchorAdjustment).toMatchObject({
      patientId: patient!.pid,
      encounter: 1000052,
      payerName: "Northstar HMO",
      accountCode: "CO45",
      reasonCode: "CO-45",
      memo: "Contractual adjustment",
      payerClaimNumber: "NSTAR-CLM-1000052"
    });

    if (target.type === "legacy-openemr") {
      return;
    }

    await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText("Payments");
    await expect(page.locator("body")).toContainText("Payment Posting");
    await expect(page.locator("body")).toContainText("Northstar HMO");
    await expect(page.locator("body")).toContainText("EOB-NSTAR-1000052");
    await expect(page.locator("body")).toContainText("Paid $126.00");
    await expect(page.locator("body")).toContainText("Adjusted $42.00");
    await expect(page.locator("body")).toContainText("Reason CO-45");
    await expect(page.locator("body")).toContainText("Claim NSTAR-CLM-1000052");
  });
});
