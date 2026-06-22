import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const accountBalanceAnchorPatientId = "MOD-PAT-0005";

test.describe("account balance parity @slice49 @account-balance @billing", () => {
  test("stable billing anchor has computed charge payment adjustment and balance totals", async ({
    page,
    target,
    targetDb
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(accountBalanceAnchorPatientId);
    expect(patient).not.toBeNull();

    const balances = await targetDb.getAccountBalancesForPatient(patient!.pid);
    expect(balances.length).toBeGreaterThanOrEqual(1);

    const anchorBalance = balances.find((balance) => balance.encounter === 1000052);
    expect(anchorBalance).toBeDefined();
    expect(anchorBalance).toMatchObject({
      patientId: patient!.pid,
      encounter: 1000052,
      lineCount: 2,
      paymentCount: 2
    });
    expect(Number(anchorBalance!.chargeAmount)).toBe(186);
    expect(Number(anchorBalance!.paymentAmount)).toBe(126);
    expect(Number(anchorBalance!.adjustmentAmount)).toBe(42);
    expect(Number(anchorBalance!.balanceAmount)).toBe(18);

    const patientChargeAmount = balances.reduce((total, balance) => total + Number(balance.chargeAmount), 0);
    const patientPaymentAmount = balances.reduce((total, balance) => total + Number(balance.paymentAmount), 0);
    const patientAdjustmentAmount = balances.reduce((total, balance) => total + Number(balance.adjustmentAmount), 0);
    const patientBalanceAmount = balances.reduce((total, balance) => total + Number(balance.balanceAmount), 0);
    expect(patientChargeAmount).toBe(635);
    expect(patientPaymentAmount).toBe(206);
    expect(patientAdjustmentAmount).toBeCloseTo(64.25, 2);
    expect(patientBalanceAmount).toBeCloseTo(364.75, 2);

    if (target.type === "legacy-openemr") {
      return;
    }

    await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText("Account Balance");
    await expect(page.locator("body")).toContainText(/Charges\s*\$635\.00/);
    await expect(page.locator("body")).toContainText(/Paid\s*\$206\.00/);
    await expect(page.locator("body")).toContainText(/Adjusted\s*\$64\.25/);
    await expect(page.locator("body")).toContainText(/Balance\s*\$364\.75/);
    await expect(page.locator("body")).toContainText("Encounter 1000052");
    await expect(page.locator("body")).toContainText(/Charges\s*\$186\.00/);
    await expect(page.locator("body")).toContainText(/Paid\s*\$126\.00/);
    await expect(page.locator("body")).toContainText(/Adjusted\s*\$42\.00/);
    await expect(page.locator("body")).toContainText(/Balance\s*\$18\.00/);
  });
});
