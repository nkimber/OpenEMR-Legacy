import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";
import type { PatientStatementSummary, StatementBatchSummary } from "../../src/db/legacyMariaDbProbe.js";

type DeliveryManifest = {
  asOfDate: string;
  deliveryId: string;
  preparedAt: string;
  candidateCount: number;
  includedStatementCount: number;
  emailReadyCount: number;
  printReadyCount: number;
  totalBalanceAmount: string;
  totalPastDueAmount: string;
  totalCurrentDueAmount: string;
  entries: Array<{
    pubpid: string;
    legacyPid: number;
    patientDisplayName: string;
    statementNumber: string;
    statementStatus: string;
    statementDate: string;
    dueDate: string;
    balanceDueAmount: string;
    pastDueAmount: string;
    currentDueAmount: string;
    deliveryMethod: string;
    destination: string;
    fileName: string;
    deliveryStatus: string;
  }>;
};

test.describe("statement delivery manifest parity @slice570 @account-statement-delivery @billing", () => {
  test("top statement candidates prepare deterministic delivery handoff metadata", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
    const batch = await targetDb.getStatementBatchCandidates(5);
    const expectedManifest = await buildExpectedDeliveryManifest(targetDb, batch);
    expect(expectedManifest.asOfDate).toBe("2026-06-18");
    expect(expectedManifest.deliveryId).toBe("STMT-DELIVERY-20260618-TOP5");
    expect(expectedManifest.includedStatementCount).toBe(5);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-570-statement-delivery-source",
      description:
        "Captures the Slice 570 statement delivery source rows: ranked statement candidates, delivery channels, destinations, file names, and queued handoff statuses.",
      expected: {
        asOfDate: "2026-06-18",
        deliveryId: "STMT-DELIVERY-20260618-TOP5",
        selectedCandidateLimit: 5,
        deliveryStatuses: ["Queued"],
        deliveryMethods: ["Email-ready", "Print"]
      },
      actual: expectedManifest,
      context: {
        suite: "account-statement-delivery",
        workflow: "statement-delivery-source"
      }
    });

    if (target.type === "legacy-openemr") {
      return;
    }

    const response = await page.request.post(`${target.apiBaseUrl}/api/billing/statements/batch/delivery-manifest?limit=5`, {
      headers: await getModernizedAdminSessionHeaders(page, target)
    });
    expect(response.ok()).toBeTruthy();
    const manifest = normalizeDeliveryManifest(await response.json());
    expect(manifest).toEqual(expectedManifest);

    await openAuthenticatedModernizedFees(page, target);
    await page.getByRole("button", { name: "Delivery Manifest" }).click();
    await expect(page.getByLabel("Statement delivery manifest")).toContainText(expectedManifest.deliveryId);
    await expect(page.getByLabel("Statement delivery entries")).toContainText(expectedManifest.entries[0].statementNumber);
    await expect(page.getByLabel("Statement delivery entries")).toContainText(expectedManifest.entries[0].deliveryStatus);
  });
});

async function buildExpectedDeliveryManifest(
  targetDb: { getPatientStatementForPatient(pid: number): Promise<PatientStatementSummary | null> },
  batch: StatementBatchSummary
): Promise<DeliveryManifest> {
  const entries = [];
  for (const candidate of batch.candidates) {
    const statement = await targetDb.getPatientStatementForPatient(candidate.patientId);
    if (!statement) {
      continue;
    }

    entries.push({
      pubpid: candidate.pubpid,
      legacyPid: candidate.patientId,
      patientDisplayName: candidate.patientDisplayName,
      statementNumber: candidate.statementNumber,
      statementStatus: candidate.statementStatus,
      statementDate: candidate.statementDate,
      dueDate: candidate.dueDate,
      balanceDueAmount: formatAmount(candidate.balanceDueAmount),
      pastDueAmount: formatAmount(candidate.pastDueAmount),
      currentDueAmount: formatAmount(candidate.currentDueAmount),
      deliveryMethod: candidate.deliveryMethod,
      destination: candidate.deliveryMethod === "Email-ready" && statement.email.trim()
        ? statement.email.trim()
        : statement.mailingAddressLine2.trim()
          ? `${statement.mailingAddressLine1}, ${statement.mailingAddressLine2}`
          : statement.mailingAddressLine1,
      fileName: `statements/${candidate.statementNumber}.pdf`,
      deliveryStatus: "Queued"
    });
  }

  return {
    asOfDate: batch.asOfDate,
    deliveryId: `STMT-DELIVERY-${batch.asOfDate.replaceAll("-", "")}-TOP${entries.length}`,
    preparedAt: `${batch.asOfDate}T12:00:00Z`,
    candidateCount: batch.candidateCount,
    includedStatementCount: entries.length,
    emailReadyCount: entries.filter((entry) => entry.deliveryMethod === "Email-ready").length,
    printReadyCount: entries.filter((entry) => entry.deliveryMethod === "Print").length,
    totalBalanceAmount: formatAmount(batch.totalBalanceAmount),
    totalPastDueAmount: formatAmount(batch.totalPastDueAmount),
    totalCurrentDueAmount: formatAmount(batch.totalCurrentDueAmount),
    entries
  };
}

function normalizeDeliveryManifest(raw: any): DeliveryManifest {
  return {
    asOfDate: raw.asOfDate,
    deliveryId: raw.deliveryId,
    preparedAt: raw.preparedAt,
    candidateCount: raw.candidateCount,
    includedStatementCount: raw.includedStatementCount,
    emailReadyCount: raw.emailReadyCount,
    printReadyCount: raw.printReadyCount,
    totalBalanceAmount: formatAmount(raw.totalBalanceAmount),
    totalPastDueAmount: formatAmount(raw.totalPastDueAmount),
    totalCurrentDueAmount: formatAmount(raw.totalCurrentDueAmount),
    entries: raw.entries.map((entry: any) => ({
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
      destination: entry.destination,
      fileName: entry.fileName,
      deliveryStatus: entry.deliveryStatus
    }))
  };
}

function formatAmount(value: string | number) {
  return Number(value).toFixed(2);
}
