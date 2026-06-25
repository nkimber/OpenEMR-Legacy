import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const accountLedgerAnchorPatientId = "MOD-PAT-0005";

const expectedLedger = [
  {
    entryDate: "2025-06-22",
    encounter: 1000051,
    entryType: "Charge",
    description: "Routine venipuncture",
    code: "36415",
    amount: 18,
    runningBalanceAmount: 18
  },
  {
    entryDate: "2025-06-22",
    encounter: 1000051,
    entryType: "Charge",
    description: "New patient office visit",
    code: "99204",
    amount: 245,
    runningBalanceAmount: 263
  },
  {
    entryDate: "2026-04-23",
    encounter: 1000052,
    entryType: "Charge",
    description: "Routine venipuncture",
    code: "36415",
    amount: 18,
    runningBalanceAmount: 281
  },
  {
    entryDate: "2026-04-23",
    encounter: 1000052,
    entryType: "Charge",
    description: "Established patient office visit",
    code: "99214",
    amount: 168,
    runningBalanceAmount: 449
  },
  {
    entryDate: "2026-04-30",
    encounter: 1000052,
    entryType: "Payment",
    description: "Northstar HMO insurance payment",
    code: "99214",
    amount: -126,
    runningBalanceAmount: 323
  },
  {
    entryDate: "2026-04-30",
    encounter: 1000052,
    entryType: "Adjustment",
    description: "Contractual adjustment",
    code: "99214",
    amount: -42,
    runningBalanceAmount: 281
  },
  {
    entryDate: "2026-06-12",
    encounter: 1000053,
    entryType: "Charge",
    description: "Routine venipuncture",
    code: "36415",
    amount: 18,
    runningBalanceAmount: 299
  },
  {
    entryDate: "2026-06-12",
    encounter: 1000053,
    entryType: "Charge",
    description: "Established patient office visit",
    code: "99214",
    amount: 168,
    runningBalanceAmount: 467
  },
  {
    entryDate: "2026-06-25",
    encounter: 1000053,
    entryType: "Payment",
    description: "Northstar HMO insurance payment",
    code: "99214",
    amount: -80,
    runningBalanceAmount: 387
  },
  {
    entryDate: "2026-06-25",
    encounter: 1000053,
    entryType: "Adjustment",
    description: "Contractual adjustment",
    code: "99214",
    amount: -22.25,
    runningBalanceAmount: 364.75
  }
];

test.describe("account ledger parity @slice51 @account-ledger @billing", () => {
  test("stable billing anchor has chronological charge payment adjustment and running balance entries", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(accountLedgerAnchorPatientId);
    expect(patient).not.toBeNull();

    const ledgerEntries = await targetDb.getAccountLedgerForPatient(patient!.pid);
    expect(ledgerEntries).toHaveLength(expectedLedger.length);

    for (const [index, expected] of expectedLedger.entries()) {
      const actual = ledgerEntries[index];
      expect(actual).toMatchObject({
        patientId: patient!.pid,
        entryDate: expected.entryDate,
        encounter: expected.encounter,
        entryType: expected.entryType,
        description: expected.description,
        code: expected.code
      });
      expect(Number(actual.amount)).toBeCloseTo(expected.amount, 2);
      expect(Number(actual.runningBalanceAmount)).toBeCloseTo(expected.runningBalanceAmount, 2);
    }

    const chargeAmount = ledgerEntries
      .filter((entry) => entry.entryType === "Charge")
      .reduce((sum, entry) => sum + Number(entry.amount), 0);
    const paymentAmount = ledgerEntries
      .filter((entry) => entry.entryType === "Payment")
      .reduce((sum, entry) => sum + Math.abs(Number(entry.amount)), 0);
    const adjustmentAmount = ledgerEntries
      .filter((entry) => entry.entryType === "Adjustment")
      .reduce((sum, entry) => sum + Math.abs(Number(entry.amount)), 0);
    const finalRunningBalance = Number(ledgerEntries.at(-1)?.runningBalanceAmount ?? 0);
    const entryTypeCounts = ledgerEntries.reduce<Record<string, number>>((counts, entry) => {
      counts[entry.entryType] = (counts[entry.entryType] ?? 0) + 1;
      return counts;
    }, {});
    const firstEntry = ledgerEntries[0];
    const lastEntry = ledgerEntries.at(-1);

    expect(chargeAmount).toBe(635);
    expect(paymentAmount).toBe(206);
    expect(adjustmentAmount).toBeCloseTo(64.25, 2);
    expect(finalRunningBalance).toBeCloseTo(364.75, 2);

    const northstarPayment = ledgerEntries.find(
      (entry) => entry.entryType === "Payment" && entry.reference === "EOB-NSTAR-1000052"
    );
    const northstarAdjustment = ledgerEntries.find(
      (entry) => entry.entryType === "Adjustment" && entry.reference === "EOB-NSTAR-1000052"
    );
    expect(northstarPayment).toBeDefined();
    expect(northstarAdjustment).toBeDefined();

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-51-account-ledger-anchor",
      description: "Verifies the Slice 51 billing anchor patient and chronological account ledger database rows before application rendering.",
      expected: {
        patient: {
          pubpid: accountLedgerAnchorPatientId
        },
        entryCount: expectedLedger.length,
        entries: expectedLedger,
        totals: {
          chargeAmount: 635,
          paymentAmount: 206,
          adjustmentAmount: 64.25,
          finalRunningBalance: 364.75
        },
        entryTypeCounts: {
          Charge: 6,
          Payment: 2,
          Adjustment: 2
        },
        firstEntry: {
          entryDate: "2025-06-22",
          encounter: 1000051,
          entryType: "Charge",
          code: "36415",
          runningBalanceAmount: 18
        },
        lastEntry: {
          entryDate: "2026-06-25",
          encounter: 1000053,
          entryType: "Adjustment",
          reference: "EOB-NSTAR-1000053",
          runningBalanceAmount: 364.75
        },
        referenceExamples: {
          northstarPayment: "EOB-NSTAR-1000052",
          northstarAdjustment: "EOB-NSTAR-1000052"
        }
      },
      actual: {
        patient,
        ledgerEntries,
        totals: {
          chargeAmount,
          paymentAmount,
          adjustmentAmount,
          finalRunningBalance
        },
        entryTypeCounts,
        firstEntry,
        lastEntry,
        referenceExamples: {
          northstarPayment,
          northstarAdjustment
        }
      },
      context: {
        canonicalId: accountLedgerAnchorPatientId,
        suite: "account-ledger",
        workflow: "account-ledger-readiness"
      }
    });

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-51-account-ledger-render-precondition",
      description: "Captures the account ledger rows and totals used by the Slice 51 Fees ledger rendering assertions.",
      expected: {
        visibleText: [
          "Account Ledger",
          "Entries 10",
          "First entry 2025-06-22",
          "Last entry 2026-06-25",
          "Ending balance $364.75",
          "Northstar HMO insurance payment",
          "EOB-NSTAR-1000052",
          "Running $364.75"
        ]
      },
      actual: {
        patient,
        ledgerEntries,
        totals: {
          chargeAmount,
          paymentAmount,
          adjustmentAmount,
          finalRunningBalance
        },
        entryTypeCounts,
        firstEntry,
        lastEntry,
        referenceExamples: {
          northstarPayment,
          northstarAdjustment
        }
      },
      context: {
        canonicalId: accountLedgerAnchorPatientId,
        suite: "account-ledger",
        workflow: "account-ledger-rendering"
      }
    });

    if (target.type === "legacy-openemr") {
      return;
    }

    await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

    const body = page.locator("body");
    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(body).toContainText("Account Ledger");
    await expect(body).toContainText(/Entries\s*10/);
    await expect(body).toContainText(/First entry\s*2025-06-22/);
    await expect(body).toContainText(/Last entry\s*2026-06-25/);
    await expect(body).toContainText(/Ending balance\s*\$364\.75/);
    await expect(body).toContainText("Northstar HMO insurance payment");
    await expect(body).toContainText("EOB-NSTAR-1000052");
    await expect(body).toContainText("Running $364.75");
  });
});
