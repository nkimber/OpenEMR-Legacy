import { inflateRawSync } from "node:zlib";
import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";
import type { StatementBatchSummary } from "../../src/db/legacyMariaDbProbe.js";

type PackageManifest = {
  datasetId: string;
  datasetVersion: string;
  asOfDate: string;
  packageId: string;
  candidateCount: number;
  includedStatementCount: number;
  totalBalanceAmount: number;
  totalPastDueAmount: number;
  totalCurrentDueAmount: number;
  entries: Array<{
    pubpid: string;
    legacyPid: number;
    patientDisplayName: string;
    statementNumber: string;
    statementStatus: string;
    statementDate: string;
    dueDate: string;
    balanceDueAmount: number;
    pastDueAmount: number;
    currentDueAmount: number;
    deliveryMethod: string;
    fileName: string;
  }>;
};

test.describe("statement batch package parity @slice62 @account-statement-batch-package @billing", () => {
  test("top statement candidates export as a deterministic package", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
    const expectedBatch = await targetDb.getStatementBatchCandidates(5);
    const expectedPackage = buildExpectedPackage(expectedBatch);
    expect(expectedPackage.asOfDate).toBe("2026-06-18");
    expect(expectedPackage.packageId).toBe("STMT-BATCH-20260618-TOP5");
    expect(expectedPackage.includedStatementCount).toBe(5);
    expect(expectedPackage.entries).toHaveLength(5);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-62-statement-batch-package-source",
      description: "Captures the Slice 62 statement batch package source rows: ranked candidates, all-candidate totals, and selected top-five statement package inputs.",
      expected: {
        asOfDate: "2026-06-18",
        packageId: "STMT-BATCH-20260618-TOP5",
        selectedCandidateLimit: 5,
        includedStatementCount: 5,
        requiredPackageEntries: ["manifest.json", "summary.csv", "statements/*.pdf"]
      },
      actual: {
        batch: expectedBatch,
        package: expectedPackage
      },
      context: {
        suite: "account-statement-batch-package",
        workflow: "statement-batch-package-source"
      }
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-62-statement-batch-package-contract",
      description: "Captures the deterministic Slice 62 package export contract: ZIP name, manifest fields, summary CSV anchors, PDF filenames, and first PDF text anchors.",
      expected: {
        zipFileName: "statement-batch-20260618-top5.zip",
        contentType: "application/zip",
        manifestFile: "manifest.json",
        summaryFile: "summary.csv",
        summaryHeader: "StatementNumber,Pubpid,PatientDisplayName",
        firstPdfHeader: "%PDF-1.4",
        firstPdfTextAnchors: [
          `Patient Statement ${expectedPackage.entries[0].statementNumber}`,
          `Balance due ${formatMoney(Number(expectedPackage.entries[0].balanceDueAmount))}`
        ]
      },
      actual: {
        package: expectedPackage,
        files: expectedPackage.entries.map((entry) => entry.fileName),
        firstEntry: expectedPackage.entries[0]
      },
      context: {
        suite: "account-statement-batch-package",
        workflow: "statement-batch-package-contract"
      }
    });

    if (target.type === "legacy-openemr") {
      return;
    }

    const response = await page.request.get(`${target.apiBaseUrl}/api/billing/statements/batch/package.zip?limit=5`, {
      headers: await getModernizedAdminSessionHeaders(page, target)
    });
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("application/zip");
    expect(response.headers()["content-disposition"]).toContain("statement-batch-20260618-top5.zip");

    const zipEntries = readZipEntries(await response.body());
    expect(zipEntries.has("manifest.json")).toBeTruthy();
    expect(zipEntries.has("summary.csv")).toBeTruthy();

    const manifest = JSON.parse(zipEntries.get("manifest.json")!.toString("utf8")) as PackageManifest;
    expect(normalizeManifest(manifest)).toEqual(expectedPackage);

    const summaryCsv = zipEntries.get("summary.csv")!.toString("utf8");
    expect(summaryCsv).toContain("StatementNumber,Pubpid,PatientDisplayName");
    expect(summaryCsv).toContain(expectedPackage.entries[0].statementNumber);
    expect(summaryCsv).toContain(expectedPackage.entries[0].fileName);

    for (const entry of expectedPackage.entries) {
      expect(zipEntries.has(entry.fileName)).toBeTruthy();
    }

    const firstEntry = expectedPackage.entries[0];
    const firstPdf = zipEntries.get(firstEntry.fileName)!.toString("ascii");
    expect(firstPdf.startsWith("%PDF-1.4")).toBeTruthy();
    expect(firstPdf).toContain(`Patient Statement ${firstEntry.statementNumber}`);
    expect(firstPdf).toContain(`Balance due ${formatMoney(Number(firstEntry.balanceDueAmount))}`);

    await openAuthenticatedModernizedFees(page, target);
    await expect(page.getByRole("heading", { name: "Statement Batch" })).toBeVisible();
    await expect(page.locator("body")).toContainText(firstEntry.statementNumber);
    const batchExportButton = page.getByRole("button", { name: "Batch Export" });
    await expect(batchExportButton).toBeVisible();
    await expect(batchExportButton).toBeEnabled();
  });
});

function buildExpectedPackage(batch: StatementBatchSummary) {
  return {
    asOfDate: batch.asOfDate,
    packageId: "STMT-BATCH-20260618-TOP5",
    candidateCount: batch.candidateCount,
    includedStatementCount: batch.candidates.length,
    totalBalanceAmount: batch.totalBalanceAmount,
    totalPastDueAmount: batch.totalPastDueAmount,
    totalCurrentDueAmount: batch.totalCurrentDueAmount,
    entries: batch.candidates.map((candidate) => ({
      pubpid: candidate.pubpid,
      legacyPid: candidate.patientId,
      patientDisplayName: candidate.patientDisplayName,
      statementNumber: candidate.statementNumber,
      statementStatus: candidate.statementStatus,
      statementDate: candidate.statementDate,
      dueDate: candidate.dueDate,
      balanceDueAmount: candidate.balanceDueAmount,
      pastDueAmount: candidate.pastDueAmount,
      currentDueAmount: candidate.currentDueAmount,
      deliveryMethod: candidate.deliveryMethod,
      fileName: `statements/${candidate.statementNumber}.pdf`
    }))
  };
}

function normalizeManifest(manifest: PackageManifest) {
  return {
    asOfDate: manifest.asOfDate,
    packageId: manifest.packageId,
    candidateCount: manifest.candidateCount,
    includedStatementCount: manifest.includedStatementCount,
    totalBalanceAmount: formatAmount(manifest.totalBalanceAmount),
    totalPastDueAmount: formatAmount(manifest.totalPastDueAmount),
    totalCurrentDueAmount: formatAmount(manifest.totalCurrentDueAmount),
    entries: manifest.entries.map((entry) => ({
      pubpid: entry.pubpid,
      legacyPid: entry.legacyPid,
      patientDisplayName: entry.patientDisplayName,
      statementNumber: entry.statementNumber,
      statementStatus: entry.statementStatus,
      statementDate: entry.statementDate,
      dueDate: entry.dueDate,
      balanceDueAmount: formatAmount(entry.balanceDueAmount),
      pastDueAmount: formatAmount(entry.pastDueAmount),
      currentDueAmount: formatAmount(entry.currentDueAmount),
      deliveryMethod: entry.deliveryMethod,
      fileName: entry.fileName
    }))
  };
}

function readZipEntries(buffer: Buffer) {
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const fileNameStart = offset + 30;
    const fileNameEnd = fileNameStart + fileNameLength;
    const contentStart = fileNameEnd + extraLength;
    const contentEnd = contentStart + compressedSize;
    const fileName = buffer.toString("utf8", fileNameStart, fileNameEnd);
    const compressed = buffer.subarray(contentStart, contentEnd);

    if ((flags & 0x08) !== 0) {
      throw new Error(`ZIP entry ${fileName} uses an unsupported data descriptor`);
    }

    if (method === 0) {
      entries.set(fileName, Buffer.from(compressed));
    } else if (method === 8) {
      entries.set(fileName, inflateRawSync(compressed));
    } else {
      throw new Error(`ZIP entry ${fileName} uses unsupported compression method ${method}`);
    }

    offset = contentEnd;
  }

  return entries;
}

function formatAmount(value: number) {
  return value.toFixed(2);
}

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}
