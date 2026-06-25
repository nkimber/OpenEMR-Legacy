import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const accountStatementAnchorPatientId = "MOD-PAT-0005";

test.describe("patient statement readiness parity @slice52 @account-statement @billing", () => {
  test("stable billing anchor has statement-ready recipient balance and past-due details", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(accountStatementAnchorPatientId);
    expect(patient).not.toBeNull();

    const statement = await targetDb.getPatientStatementForPatient(patient!.pid);
    expect(statement).not.toBeNull();
    expect(statement).toMatchObject({
      patientId: patient!.pid,
      recipientName: "Elias Morgan",
      mailingAddressLine1: "105 Test Patient Avenue",
      mailingAddressLine2: "Carlsbad, CA 92008",
      email: "mod-pat-0005@example.test",
      phone: "(619) 555-1005",
      statementStatus: "Past due review",
      statementPeriodStart: "2025-06-22",
      statementPeriodEnd: "2026-06-25",
      statementDate: "2026-06-25",
      dueDate: "2026-07-25",
      openEncounterCount: 3,
      ledgerEntryCount: 10,
      oldestOpenAgeDays: 361,
      oldestOpenDate: "2025-06-22"
    });

    expect(Number(statement!.chargeAmount)).toBe(635);
    expect(Number(statement!.paymentAmount)).toBe(206);
    expect(Number(statement!.adjustmentAmount)).toBeCloseTo(64.25, 2);
    expect(Number(statement!.currentDueAmount)).toBeCloseTo(83.75, 2);
    expect(Number(statement!.pastDueAmount)).toBe(281);
    expect(Number(statement!.balanceDueAmount)).toBeCloseTo(364.75, 2);

    const balances = await targetDb.getAccountBalancesForPatient(patient!.pid);
    const aging = await targetDb.getAccountAgingForPatient(patient!.pid);
    const ledger = await targetDb.getAccountLedgerForPatient(patient!.pid);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-52-account-statement-anchor",
      description: "Verifies the Slice 52 billing anchor patient and statement readiness projection before application rendering.",
      expected: {
        patient: {
          pubpid: accountStatementAnchorPatientId
        },
        statement: {
          patientId: patient!.pid,
          recipientName: "Elias Morgan",
          mailingAddressLine1: "105 Test Patient Avenue",
          mailingAddressLine2: "Carlsbad, CA 92008",
          email: "mod-pat-0005@example.test",
          phone: "(619) 555-1005",
          statementStatus: "Past due review",
          statementPeriodStart: "2025-06-22",
          statementPeriodEnd: "2026-06-25",
          statementDate: "2026-06-25",
          dueDate: "2026-07-25",
          openEncounterCount: 3,
          ledgerEntryCount: 10,
          oldestOpenAgeDays: 361,
          oldestOpenDate: "2025-06-22",
          chargeAmount: 635,
          paymentAmount: 206,
          adjustmentAmount: 64.25,
          currentDueAmount: 83.75,
          pastDueAmount: 281,
          balanceDueAmount: 364.75
        },
        sourceContext: {
          balanceRows: 3,
          agingRows: 3,
          ledgerRows: 10
        }
      },
      actual: {
        patient,
        statement,
        sourceContext: {
          balances,
          aging,
          ledger
        }
      },
      context: {
        canonicalId: accountStatementAnchorPatientId,
        suite: "account-statement",
        workflow: "account-statement-readiness"
      }
    });

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-52-account-statement-render-precondition",
      description: "Captures the statement readiness facts used by the Slice 52 Fees rendering assertions.",
      expected: {
        visibleText: [
          "Statement Readiness",
          "Past due review",
          "$364.75",
          "Period 2025-06-22 to 2026-06-25",
          "Due date 2026-07-25",
          "Recipient Elias Morgan",
          "Address 105 Test Patient Avenue",
          "City/state Carlsbad, CA 92008",
          "Past due $281.00",
          "Current due $83.75",
          "Oldest age 361 days"
        ]
      },
      actual: {
        patient,
        statement,
        sourceCounts: {
          balanceRows: balances.length,
          agingRows: aging.length,
          ledgerRows: ledger.length
        }
      },
      context: {
        canonicalId: accountStatementAnchorPatientId,
        suite: "account-statement",
        workflow: "account-statement-rendering"
      }
    });

    if (target.type === "legacy-openemr") {
      return;
    }

    await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

    const body = page.locator("body");
    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(body).toContainText("Statement Readiness");
    await expect(body).toContainText("Past due review");
    await expect(body).toContainText("$364.75");
    await expect(body).toContainText(/Period\s*2025-06-22 to 2026-06-25/);
    await expect(body).toContainText(/Due date\s*2026-07-25/);
    await expect(body).toContainText(/Recipient\s*Elias Morgan/);
    await expect(body).toContainText(/Address\s*105 Test Patient Avenue/);
    await expect(body).toContainText(/City\/state\s*Carlsbad, CA 92008/);
    await expect(body).toContainText(/Past due\s*\$281\.00/);
    await expect(body).toContainText(/Current due\s*\$83\.75/);
    await expect(body).toContainText(/Oldest age\s*361 days/);
  });
});
