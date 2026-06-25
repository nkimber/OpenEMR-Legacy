import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const accountBalanceAnchorPatientId = "MOD-PAT-0005";
const accountBalanceAnchorEncounter = 1000052;

test.describe("account balance parity @slice49 @account-balance @billing", () => {
  test("stable billing anchor has computed charge payment adjustment and balance totals", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(accountBalanceAnchorPatientId);
    expect(patient).not.toBeNull();

    const balances = await targetDb.getAccountBalancesForPatient(patient!.pid);
    expect(balances.length).toBeGreaterThanOrEqual(1);

    const anchorBalance = balances.find((balance) => balance.encounter === accountBalanceAnchorEncounter);
    const patientTotals = {
      chargeAmount: balances.reduce((total, balance) => total + Number(balance.chargeAmount), 0),
      paymentAmount: balances.reduce((total, balance) => total + Number(balance.paymentAmount), 0),
      adjustmentAmount: balances.reduce((total, balance) => total + Number(balance.adjustmentAmount), 0),
      balanceAmount: balances.reduce((total, balance) => total + Number(balance.balanceAmount), 0)
    };

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-49-account-balance-anchor",
      description: "Verifies the Slice 49 billing anchor patient and normalized account balance database rollups before application rendering.",
      expected: {
        patient: {
          pubpid: accountBalanceAnchorPatientId
        },
        anchorEncounter: {
          encounter: accountBalanceAnchorEncounter,
          lineCount: 2,
          paymentCount: 2,
          chargeAmount: 186,
          paymentAmount: 126,
          adjustmentAmount: 42,
          balanceAmount: 18
        },
        patientTotals: {
          chargeAmount: 635,
          paymentAmount: 206,
          adjustmentAmount: 64.25,
          balanceAmount: 364.75
        }
      },
      actual: {
        patient,
        balances,
        anchorBalance,
        patientTotals
      },
      context: {
        canonicalId: accountBalanceAnchorPatientId,
        suite: "account-balance",
        workflow: "account-balance-readiness"
      }
    });

    expect(anchorBalance).toBeDefined();
    expect(anchorBalance).toMatchObject({
      patientId: patient!.pid,
      encounter: accountBalanceAnchorEncounter,
      lineCount: 2,
      paymentCount: 2
    });
    expect(Number(anchorBalance!.chargeAmount)).toBe(186);
    expect(Number(anchorBalance!.paymentAmount)).toBe(126);
    expect(Number(anchorBalance!.adjustmentAmount)).toBe(42);
    expect(Number(anchorBalance!.balanceAmount)).toBe(18);

    expect(patientTotals.chargeAmount).toBe(635);
    expect(patientTotals.paymentAmount).toBe(206);
    expect(patientTotals.adjustmentAmount).toBeCloseTo(64.25, 2);
    expect(patientTotals.balanceAmount).toBeCloseTo(364.75, 2);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-49-account-balance-render-precondition",
      description: "Captures the account balance totals and anchor encounter rollup used by the Slice 49 Fees balance rendering assertions.",
      expected: {
        visibleText: [
          "Account Balance",
          "Charges $635.00",
          "Paid $206.00",
          "Adjusted $64.25",
          "Balance $364.75",
          `Encounter ${accountBalanceAnchorEncounter}`,
          "Charges $186.00",
          "Paid $126.00",
          "Adjusted $42.00",
          "Balance $18.00"
        ]
      },
      actual: {
        patient,
        anchorBalance,
        patientTotals,
        balances
      },
      context: {
        canonicalId: accountBalanceAnchorPatientId,
        suite: "account-balance",
        workflow: "account-balance-rendering"
      }
    });

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
    await expect(page.locator("body")).toContainText(`Encounter ${accountBalanceAnchorEncounter}`);
    await expect(page.locator("body")).toContainText(/Charges\s*\$186\.00/);
    await expect(page.locator("body")).toContainText(/Paid\s*\$126\.00/);
    await expect(page.locator("body")).toContainText(/Adjusted\s*\$42\.00/);
    await expect(page.locator("body")).toContainText(/Balance\s*\$18\.00/);
  });
});
