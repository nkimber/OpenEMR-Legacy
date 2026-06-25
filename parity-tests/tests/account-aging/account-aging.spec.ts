import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const accountAgingAnchorPatientId = "MOD-PAT-0005";
const agingAsOfDate = "2026-06-18";
const currentEncounterId = 1000053;
const days31To60EncounterId = 1000052;
const over90EncounterId = 1000051;

test.describe("account aging parity @slice50 @account-aging @billing", () => {
  test("stable billing anchor has deterministic current 31-60 and over-90 aging buckets", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(accountAgingAnchorPatientId);
    expect(patient).not.toBeNull();

    const agingRows = await targetDb.getAccountAgingForPatient(patient!.pid, agingAsOfDate);
    expect(agingRows.length).toBe(3);

    const currentEncounter = agingRows.find((row) => row.encounter === currentEncounterId);
    const days31To60Encounter = agingRows.find((row) => row.encounter === days31To60EncounterId);
    const over90Encounter = agingRows.find((row) => row.encounter === over90EncounterId);
    const bucketTotals = agingRows.reduce<Record<string, number>>((totals, row) => {
      totals[row.agingBucket] = (totals[row.agingBucket] ?? 0) + Number(row.balanceAmount);
      return totals;
    }, {});
    const totalBalance = agingRows.reduce((total, row) => total + Number(row.balanceAmount), 0);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-50-account-aging-anchor",
      description: "Verifies the Slice 50 billing anchor patient and deterministic account aging database rows before application rendering.",
      expected: {
        patient: {
          pubpid: accountAgingAnchorPatientId
        },
        asOfDate: agingAsOfDate,
        rowCount: 3,
        encounters: {
          current: {
            encounter: currentEncounterId,
            lastBillingDate: "2026-06-12",
            ageDays: 6,
            agingBucket: "Current",
            balanceAmount: 83.75
          },
          days31To60: {
            encounter: days31To60EncounterId,
            lastBillingDate: "2026-04-23",
            ageDays: 56,
            lineCount: 2,
            paymentCount: 2,
            agingBucket: "31-60",
            balanceAmount: 18
          },
          over90: {
            encounter: over90EncounterId,
            lastBillingDate: "2025-06-22",
            ageDays: 361,
            paymentCount: 0,
            agingBucket: "Over 90",
            balanceAmount: 263
          }
        },
        bucketTotals: {
          Current: 83.75,
          "31-60": 18,
          "61-90": 0,
          "Over 90": 263,
          totalBalance: 364.75
        }
      },
      actual: {
        patient,
        agingRows,
        selected: {
          currentEncounter,
          days31To60Encounter,
          over90Encounter
        },
        bucketTotals,
        totalBalance
      },
      context: {
        canonicalId: accountAgingAnchorPatientId,
        suite: "account-aging",
        workflow: "account-aging-readiness"
      }
    });

    expect(currentEncounter).toMatchObject({
      patientId: patient!.pid,
      encounter: currentEncounterId,
      lastBillingDate: "2026-06-12",
      ageDays: 6,
      agingBucket: "Current"
    });
    expect(Number(currentEncounter!.balanceAmount)).toBeCloseTo(83.75, 2);

    expect(days31To60Encounter).toMatchObject({
      patientId: patient!.pid,
      encounter: days31To60EncounterId,
      lastBillingDate: "2026-04-23",
      ageDays: 56,
      lineCount: 2,
      paymentCount: 2,
      agingBucket: "31-60"
    });
    expect(Number(days31To60Encounter!.balanceAmount)).toBe(18);

    expect(over90Encounter).toMatchObject({
      patientId: patient!.pid,
      encounter: over90EncounterId,
      lastBillingDate: "2025-06-22",
      ageDays: 361,
      paymentCount: 0,
      agingBucket: "Over 90"
    });
    expect(Number(over90Encounter!.balanceAmount)).toBe(263);

    expect(bucketTotals.Current).toBeCloseTo(83.75, 2);
    expect(bucketTotals["31-60"]).toBe(18);
    expect(bucketTotals["61-90"] ?? 0).toBe(0);
    expect(bucketTotals["Over 90"]).toBe(263);

    expect(totalBalance).toBeCloseTo(364.75, 2);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-50-account-aging-render-precondition",
      description: "Captures the account aging rows and bucket totals used by the Slice 50 Fees aging rendering assertions.",
      expected: {
        visibleText: [
          "Aging Summary",
          `As of ${agingAsOfDate}`,
          "Current $83.75",
          "31-60 $18.00",
          "61-90 $0.00",
          "Over 90 $263.00",
          "Total balance $364.75",
          `Encounter ${currentEncounterId}`,
          "Age 6 days",
          `Encounter ${days31To60EncounterId}`,
          "Age 56 days",
          `Encounter ${over90EncounterId}`,
          "Age 361 days"
        ]
      },
      actual: {
        patient,
        agingRows,
        bucketTotals,
        totalBalance,
        selected: {
          currentEncounter,
          days31To60Encounter,
          over90Encounter
        }
      },
      context: {
        canonicalId: accountAgingAnchorPatientId,
        suite: "account-aging",
        workflow: "account-aging-rendering"
      }
    });

    if (target.type === "legacy-openemr") {
      return;
    }

    await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

    const body = page.locator("body");
    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(body).toContainText("Aging Summary");
    await expect(body).toContainText(/As of\s*2026-06-18/);
    await expect(body).toContainText(/Current\s*\$83\.75/);
    await expect(body).toContainText(/31-60\s*\$18\.00/);
    await expect(body).toContainText(/61-90\s*\$0\.00/);
    await expect(body).toContainText(/Over 90\s*\$263\.00/);
    await expect(body).toContainText(/Total balance\s*\$364\.75/);
    await expect(body).toContainText(`Encounter ${currentEncounterId}`);
    await expect(body).toContainText("Age 6 days");
    await expect(body).toContainText(`Encounter ${days31To60EncounterId}`);
    await expect(body).toContainText("Age 56 days");
    await expect(body).toContainText(`Encounter ${over90EncounterId}`);
    await expect(body).toContainText("Age 361 days");
  });
});
