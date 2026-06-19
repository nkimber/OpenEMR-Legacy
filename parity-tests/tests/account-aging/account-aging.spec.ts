import { test, expect } from "../../src/fixtures/parityTest.js";

const accountAgingAnchorPatientId = "MOD-PAT-0005";
const agingAsOfDate = "2026-06-18";

test.describe("account aging parity @slice50 @account-aging @billing", () => {
  test("stable billing anchor has deterministic current 31-60 and over-90 aging buckets", async ({
    page,
    target,
    targetDb
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(accountAgingAnchorPatientId);
    expect(patient).not.toBeNull();

    const agingRows = await targetDb.getAccountAgingForPatient(patient!.pid, agingAsOfDate);
    expect(agingRows.length).toBe(3);

    const currentEncounter = agingRows.find((row) => row.encounter === 1000053);
    expect(currentEncounter).toMatchObject({
      patientId: patient!.pid,
      encounter: 1000053,
      lastBillingDate: "2026-06-12",
      ageDays: 6,
      agingBucket: "Current"
    });
    expect(Number(currentEncounter!.balanceAmount)).toBeCloseTo(83.75, 2);

    const days31To60Encounter = agingRows.find((row) => row.encounter === 1000052);
    expect(days31To60Encounter).toMatchObject({
      patientId: patient!.pid,
      encounter: 1000052,
      lastBillingDate: "2026-04-23",
      ageDays: 56,
      lineCount: 2,
      paymentCount: 2,
      agingBucket: "31-60"
    });
    expect(Number(days31To60Encounter!.balanceAmount)).toBe(18);

    const over90Encounter = agingRows.find((row) => row.encounter === 1000051);
    expect(over90Encounter).toMatchObject({
      patientId: patient!.pid,
      encounter: 1000051,
      lastBillingDate: "2025-06-22",
      ageDays: 361,
      paymentCount: 0,
      agingBucket: "Over 90"
    });
    expect(Number(over90Encounter!.balanceAmount)).toBe(263);

    const bucketTotals = agingRows.reduce<Record<string, number>>((totals, row) => {
      totals[row.agingBucket] = (totals[row.agingBucket] ?? 0) + Number(row.balanceAmount);
      return totals;
    }, {});

    expect(bucketTotals.Current).toBeCloseTo(83.75, 2);
    expect(bucketTotals["31-60"]).toBe(18);
    expect(bucketTotals["61-90"] ?? 0).toBe(0);
    expect(bucketTotals["Over 90"]).toBe(263);

    const totalBalance = agingRows.reduce((total, row) => total + Number(row.balanceAmount), 0);
    expect(totalBalance).toBeCloseTo(364.75, 2);

    if (target.type === "legacy-openemr") {
      return;
    }

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Fees" }).click();
    await expect(page.getByRole("heading", { name: "Fees" })).toBeVisible();
    await page.getByLabel("Fees patient ID").fill(patient!.pubpid);

    const body = page.locator("body");
    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(body).toContainText("Aging Summary");
    await expect(body).toContainText(/As of\s*2026-06-18/);
    await expect(body).toContainText(/Current\s*\$83\.75/);
    await expect(body).toContainText(/31-60\s*\$18\.00/);
    await expect(body).toContainText(/61-90\s*\$0\.00/);
    await expect(body).toContainText(/Over 90\s*\$263\.00/);
    await expect(body).toContainText(/Total balance\s*\$364\.75/);
    await expect(body).toContainText("Encounter 1000053");
    await expect(body).toContainText("Age 6 days");
    await expect(body).toContainText("Encounter 1000052");
    await expect(body).toContainText("Age 56 days");
    await expect(body).toContainText("Encounter 1000051");
    await expect(body).toContainText("Age 361 days");
  });
});
