import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";
import type { AccountLedgerEntry, PatientStatementSummary } from "../../src/db/legacyMariaDbProbe.js";

const statementPdfAnchorPatientId = "MOD-PAT-0005";

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
  lineItems: StatementLineItem[];
};

test.describe("patient statement PDF export parity @slice60 @account-statement-pdf @billing", () => {
  test("stable billing anchor exports the generated patient statement as a deterministic PDF", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(statementPdfAnchorPatientId);
    expect(patient).not.toBeNull();

    const statement = await targetDb.getPatientStatementForPatient(patient!.pid);
    const ledgerEntries = await targetDb.getAccountLedgerForPatient(patient!.pid);
    expect(statement).not.toBeNull();

    const expectedDocument = buildStatementDocument(patient!.pubpid, statement!, ledgerEntries);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-60-statement-pdf-source",
      description: "Captures the Slice 60 statement PDF source rows: billing anchor patient, statement summary, and ledger entries used for deterministic PDF export.",
      expected: {
        patient: {
          pubpid: statementPdfAnchorPatientId
        },
        statement: {
          statementStatus: "Past due review",
          statementDate: "2026-06-25",
          dueDate: "2026-07-25",
          statementPeriodStart: "2025-06-22",
          statementPeriodEnd: "2026-06-25",
          balanceDueAmount: "364.75",
          ledgerEntryCount: 10
        },
        ledger: {
          lineCount: 10,
          paymentReference: "EOB-NSTAR-1000052",
          endingBalance: "364.75"
        }
      },
      actual: {
        patient,
        statement,
        ledgerEntries
      },
      context: {
        canonicalId: statementPdfAnchorPatientId,
        suite: "account-statement-pdf",
        workflow: "statement-pdf-source"
      }
    });
    expect(expectedDocument.statementNumber).toBe("STMT-MOD-PAT-0005-20260625");
    expect(expectedDocument.paymentInstructions).toBe("Please pay $364.75 by 2026-07-25.");
    expect(expectedDocument.lineItems).toHaveLength(10);
    expect(sumLines(expectedDocument.lineItems, "chargeAmount")).toBeCloseTo(635, 2);
    expect(sumLines(expectedDocument.lineItems, "paymentAmount")).toBeCloseTo(206, 2);
    expect(sumLines(expectedDocument.lineItems, "adjustmentAmount")).toBeCloseTo(64.25, 2);
    expect(expectedDocument.lineItems.some((line) =>
      line.description === "Northstar HMO insurance payment"
      && line.reference === "EOB-NSTAR-1000052"
      && line.paymentAmount === 126
    )).toBeTruthy();
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-60-statement-pdf-contract",
      description: "Captures the deterministic Slice 60 patient statement PDF contract derived from the shared statement document.",
      expected: {
        statementNumber: "STMT-MOD-PAT-0005-20260625",
        fileName: "STMT-MOD-PAT-0005-20260625.pdf",
        contentType: "application/pdf",
        pdfHeader: "%PDF-1.4",
        textAnchors: [
          "Patient Statement STMT-MOD-PAT-0005-20260625",
          "Elias Morgan",
          "Period 2025-06-22 to 2026-06-25",
          "Balance due $364.75",
          "Please pay $364.75 by 2026-07-25.",
          "Northstar HMO insurance payment",
          "EOB-NSTAR-1000052"
        ],
        lineItems: {
          count: 10,
          chargeTotal: 635,
          paymentTotal: 206,
          adjustmentTotal: 64.25,
          endingBalance: 364.75
        }
      },
      actual: {
        patient,
        statement,
        expectedDocument
      },
      context: {
        canonicalId: statementPdfAnchorPatientId,
        suite: "account-statement-pdf",
        workflow: "statement-pdf-contract"
      }
    });

    if (target.type === "legacy-openemr") {
      return;
    }

    const pdfResponse = await page.request.get(`${target.apiBaseUrl}/api/billing/${patient!.pubpid}/statement.pdf`, {
      headers: await getModernizedAdminSessionHeaders(page, target)
    });
    expect(pdfResponse.ok()).toBeTruthy();
    expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
    expect(pdfResponse.headers()["content-disposition"]).toContain(`${expectedDocument.statementNumber}.pdf`);

    const pdfText = (await pdfResponse.body()).toString("ascii");
    expect(pdfText.startsWith("%PDF-1.4")).toBeTruthy();
    expect(pdfText).toContain(`Patient Statement ${expectedDocument.statementNumber}`);
    expect(pdfText).toContain(statement!.recipientName);
    expect(pdfText).toContain(`Period ${statement!.statementPeriodStart} to ${statement!.statementPeriodEnd}`);
    expect(pdfText).toContain(`Balance due ${formatMoney(Number(statement!.balanceDueAmount))}`);
    expect(pdfText).toContain(expectedDocument.paymentInstructions);
    expect(pdfText).toContain("Northstar HMO insurance payment");
    expect(pdfText).toContain("EOB-NSTAR-1000052");

    await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

    const pdfExportButton = page.getByRole("button", { name: "PDF Export" });
    const body = page.locator("body");
    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Patient Statement" })).toBeVisible();
    await expect(body).toContainText(expectedDocument.statementNumber);
    await expect(pdfExportButton).toBeVisible();
    await expect(pdfExportButton).toBeEnabled();
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

  return {
    statementNumber,
    paymentInstructions,
    lineItems
  };
}

function sumLines(lines: StatementLineItem[], field: "chargeAmount" | "paymentAmount" | "adjustmentAmount") {
  return lines.reduce((sum, line) => sum + line[field], 0);
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}
