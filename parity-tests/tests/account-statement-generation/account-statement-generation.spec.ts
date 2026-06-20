import { test, expect } from "../../src/fixtures/parityTest.js";
import type { AccountLedgerEntry, PatientStatementSummary } from "../../src/db/legacyMariaDbProbe.js";

const statementGenerationAnchorPatientId = "MOD-PAT-0005";

type StatementLineItem = {
  lineNumber: number;
  entryDate: string;
  encounter: number;
  entryType: string;
  description: string;
  code: string;
  reference: string;
  chargeAmount: number;
  paymentAmount: number;
  adjustmentAmount: number;
  balanceAmount: number;
};

type StatementDocument = {
  statementNumber: string;
  paymentInstructions: string;
  generatedText: string;
  lineItems: StatementLineItem[];
};

test.describe("patient statement generation parity @slice59 @account-statement-generation @billing", () => {
  test("stable billing anchor produces a printable statement document from the shared ledger", async ({
    page,
    target,
    targetDb
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(statementGenerationAnchorPatientId);
    expect(patient).not.toBeNull();

    const statement = await targetDb.getPatientStatementForPatient(patient!.pid);
    const ledgerEntries = await targetDb.getAccountLedgerForPatient(patient!.pid);
    expect(statement).not.toBeNull();

    const expectedDocument = buildStatementDocument(patient!.pubpid, statement!, ledgerEntries);
    expect(expectedDocument.statementNumber).toBe("STMT-MOD-PAT-0005-20260625");
    expect(expectedDocument.paymentInstructions).toBe("Please pay $364.75 by 2026-07-25.");
    expect(expectedDocument.generatedText).toContain("Patient Statement STMT-MOD-PAT-0005-20260625");
    expect(expectedDocument.generatedText).toContain("Elias Morgan");
    expect(expectedDocument.generatedText).toContain("Period 2025-06-22 to 2026-06-25");
    expect(expectedDocument.generatedText).toContain("Balance due $364.75");
    expect(expectedDocument.lineItems).toHaveLength(10);
    expect(sumLines(expectedDocument.lineItems, "chargeAmount")).toBeCloseTo(635, 2);
    expect(sumLines(expectedDocument.lineItems, "paymentAmount")).toBeCloseTo(206, 2);
    expect(sumLines(expectedDocument.lineItems, "adjustmentAmount")).toBeCloseTo(64.25, 2);

    expect(expectedDocument.lineItems[0]).toMatchObject({
      lineNumber: 1,
      entryDate: "2025-06-22",
      encounter: 1000051,
      entryType: "Charge",
      description: "Routine venipuncture",
      code: "36415",
      chargeAmount: 18,
      balanceAmount: 18
    });
    expect(expectedDocument.lineItems.at(-1)).toMatchObject({
      lineNumber: 10,
      entryDate: "2026-06-25",
      encounter: 1000053,
      entryType: "Adjustment",
      description: "Contractual adjustment",
      code: "99214",
      adjustmentAmount: 22.25,
      balanceAmount: 364.75
    });

    if (target.type === "legacy-openemr") {
      return;
    }

    const response = await page.request.get(`${target.apiBaseUrl}/api/billing/${patient!.pubpid}`);
    expect(response.ok()).toBeTruthy();
    const apiBilling = await response.json();
    const apiDocument = apiBilling.statementDocument;
    expect(apiDocument).toMatchObject({
      statementNumber: expectedDocument.statementNumber,
      title: "Patient Statement",
      statementStatus: statement!.statementStatus,
      statementDate: statement!.statementDate,
      dueDate: statement!.dueDate,
      statementPeriodStart: statement!.statementPeriodStart,
      statementPeriodEnd: statement!.statementPeriodEnd,
      recipientName: statement!.recipientName,
      mailingAddressLine1: statement!.mailingAddressLine1,
      mailingAddressLine2: statement!.mailingAddressLine2,
      paymentInstructions: expectedDocument.paymentInstructions
    });
    expect(apiDocument.generatedText).toContain("Patient Statement STMT-MOD-PAT-0005-20260625");
    expect(apiDocument.generatedText).toContain("Balance due $364.75");
    expect(apiDocument.lineItems).toHaveLength(expectedDocument.lineItems.length);
    expect(Number(apiDocument.balanceDueAmount)).toBeCloseTo(364.75, 2);
    expect(Number(apiDocument.lineItems.at(-1).balanceAmount)).toBeCloseTo(364.75, 2);

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Fees" }).click();
    await expect(page.getByRole("heading", { name: "Fees" })).toBeVisible();
    await page.getByLabel("Fees patient ID").fill(patient!.pubpid);

    const body = page.locator("body");
    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(body).toContainText("Patient Statement");
    await expect(body).toContainText("STMT-MOD-PAT-0005-20260625");
    await expect(body).toContainText("Please pay $364.75 by 2026-07-25.");
    await expect(body).toContainText(/Balance due\s*\$364\.75/);
    await expect(body).toContainText(/Lines\s*10/);
    await expect(body).toContainText("Patient Statement STMT-MOD-PAT-0005-20260625");
    await expect(body).toContainText("Northstar HMO insurance payment");
    await expect(body).toContainText("EOB-NSTAR-1000052");
  });
});

function buildStatementDocument(
  pubpid: string,
  statement: PatientStatementSummary,
  ledgerEntries: AccountLedgerEntry[]
): StatementDocument {
  const statementNumber = `STMT-${pubpid}-${statement.statementDate.replaceAll("-", "")}`;
  const paymentInstructions = Number(statement.balanceDueAmount) > 0
    ? `Please pay ${formatMoney(Number(statement.balanceDueAmount))} by ${statement.dueDate}.`
    : "No payment is due for this statement.";
  const lineItems = ledgerEntries.map((entry, index) => {
    const amount = Number(entry.amount);
    return {
      lineNumber: index + 1,
      entryDate: entry.entryDate,
      encounter: entry.encounter,
      entryType: entry.entryType,
      description: entry.description,
      code: entry.code,
      reference: entry.reference,
      chargeAmount: entry.entryType === "Charge" ? amount : 0,
      paymentAmount: entry.entryType === "Payment" ? Math.abs(amount) : 0,
      adjustmentAmount: entry.entryType === "Adjustment" ? Math.abs(amount) : 0,
      balanceAmount: Number(entry.runningBalanceAmount)
    };
  });

  const generatedText = [
    `Patient Statement ${statementNumber}`,
    statement.recipientName,
    statement.mailingAddressLine1,
    statement.mailingAddressLine2,
    `Email ${statement.email}`,
    `Phone ${statement.phone}`,
    `Period ${statement.statementPeriodStart} to ${statement.statementPeriodEnd}`,
    `Statement date ${statement.statementDate}`,
    `Due date ${statement.dueDate}`,
    `Total charges ${formatMoney(Number(statement.chargeAmount))}`,
    `Payments ${formatMoney(Number(statement.paymentAmount))}`,
    `Adjustments ${formatMoney(Number(statement.adjustmentAmount))}`,
    `Current due ${formatMoney(Number(statement.currentDueAmount))}`,
    `Past due ${formatMoney(Number(statement.pastDueAmount))}`,
    `Balance due ${formatMoney(Number(statement.balanceDueAmount))}`,
    paymentInstructions
  ].filter((line) => !line.endsWith(" "));

  return {
    statementNumber,
    paymentInstructions,
    generatedText: generatedText.join("\n"),
    lineItems
  };
}

function sumLines(lines: StatementLineItem[], field: "chargeAmount" | "paymentAmount" | "adjustmentAmount") {
  return lines.reduce((sum, line) => sum + line[field], 0);
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}
