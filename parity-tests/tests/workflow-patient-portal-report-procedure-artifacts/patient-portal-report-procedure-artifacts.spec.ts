import { inflateRawSync } from "node:zlib";
import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMedicalReportAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const procedureOrderDate = "2026-06-24";
const procedureOrderCode = "84443";
const procedureOrderDiagnosis = "ICD10:E11.9";

test.describe("patient portal generated report procedure-order artifact parity @slice237 @workflow-patient-portal-report-procedure-artifacts @patients @portal @reports", () => {
  test("normalizes selected procedure-order delivery metadata in generated reports", async ({
    targetDb,
    workflow
  }) => {
    test.setTimeout(180_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMedicalReportAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    const procedureName = `Slice 237 artifact procedure order ${workflowSuffix()}`;
    let procedureOrderId: number | null = null;

    try {
      procedureOrderId = await workflow.createProcedureOrder({
        patientId: patient!.pid,
        providerId: patient!.providerId || 101,
        encounterId: encounter!.encounter,
        dateOrdered: procedureOrderDate,
        priority: "routine",
        status: "pending",
        procedureCode: procedureOrderCode,
        procedureName,
        procedureType: "laboratory",
        diagnosis: procedureOrderDiagnosis,
        instructions: "Created for Slice 237 selected procedure-order delivery artifact parity."
      });

      const generated = await workflow.generatePatientPortalMedicalReport(portalLoginUsername, portalPassword, {
        sectionIds: ["demographics", "billing"],
        procedureOrderIds: [String(procedureOrderId)],
        issueIds: [],
        encounterFormIds: []
      });

      expect(generated).toMatchObject({
        authenticated: true,
        username: portalLoginUsername,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        title: "Customized Medical History Report",
        includedSectionIds: ["demographics", "billing"],
        includedProcedureOrderIds: [String(procedureOrderId)],
        includedIssueIds: [],
        includedEncounterFormIds: [],
        printableVersionAvailable: true,
        pdfDownloadAvailable: true,
        packageDownloadAvailable: true,
        reportSectionCount: 3,
        failureReason: null
      });
      expect(generated.packageMetadata).toMatchObject({
        contentType: "application/zip",
        manifestAvailable: true,
        pdfAvailable: true,
        summaryAvailable: true
      });
      expect(generated.packageMetadata.entryNames[0]).toBe("manifest.json");
      expect(generated.packageMetadata.entryNames[1]).toMatch(/^medical-report-MOD-PAT-0004-\d{8}\.pdf$/);
      expect(generated.packageMetadata.entryNames[2]).toBe("summary.txt");
      expect(generated.summaryLines.join("\n")).toContain(
        `Procedure Order: ${procedureName} ordered ${procedureOrderDate} with 0 result rows.`
      );
    } finally {
      if (procedureOrderId !== null) {
        await workflow.deleteProcedureOrderCascade(procedureOrderId);
      }
    }
  });

  test("downloads selected procedure-order report artifacts", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    test.setTimeout(180_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMedicalReportAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    const procedureName = `Slice 237 delivery procedure order ${workflowSuffix()}`;
    let procedureOrderId: number | null = null;

    try {
      procedureOrderId = await workflow.createProcedureOrder({
        patientId: patient!.pid,
        providerId: patient!.providerId || 101,
        encounterId: encounter!.encounter,
        dateOrdered: procedureOrderDate,
        priority: "routine",
        status: "pending",
        procedureCode: procedureOrderCode,
        procedureName,
        procedureType: "laboratory",
        diagnosis: procedureOrderDiagnosis,
        instructions: "Created for Slice 237 selected procedure-order PDF and package artifact parity."
      });

      if (target.type === "legacy-openemr") {
        await expectLegacySelectedProcedureOrderSourceArtifacts(page, target, procedureOrderId);
        return;
      }

      await expectModernizedSelectedProcedureOrderDeliveryArtifacts(page, target, procedureOrderId, procedureName);
    } finally {
      if (procedureOrderId !== null) {
        await workflow.deleteProcedureOrderCascade(procedureOrderId);
      }
    }
  });
});

async function expectLegacySelectedProcedureOrderSourceArtifacts(
  page: Page,
  target: RuntimeTarget,
  procedureOrderId: number
) {
  await page.context().clearCookies();
  await page.goto(`${target.publicUrl}/portal/index.php?site=default&woops=1`);
  await page.locator("#uname").fill(portalLoginUsername);
  await page.locator("#pass").fill(portalPassword);

  const emailConfirmation = page.locator("#passaddon");
  if ((await emailConfirmation.count()) > 0 && await emailConfirmation.isVisible()) {
    await emailConfirmation.fill(portalLoginUsername);
  }

  await page.getByRole("button", { name: "Log In" }).click();
  await expect.poll(() => page.url()).toContain("/portal/home.php");

  await page.goto(`${target.publicUrl}/portal/report/portal_patient_report.php`);
  await expectRenderedText(page, /Patient Report/i);
  await expect(page.locator(`input[name='procedures[]'][value='${procedureOrderId}']`)).toHaveCount(1);

  const printableParams = new URLSearchParams();
  printableParams.set("printable", "1");
  printableParams.set("include_demographics", "demographics");
  printableParams.set("include_billing", "billing");
  printableParams.append("procedures[]", String(procedureOrderId));
  const printableResponse = await page.request.get(
    `${target.publicUrl}/portal/report/portal_custom_report.php?${printableParams.toString()}`
  );
  expect(printableResponse.ok()).toBeTruthy();
  const printableHtml = await printableResponse.text();
  expect(printableHtml).toContain("Procedure Order");
  expect(printableHtml).toContain("PATIENT:Kim, Nora");

  const pdfResponse = await page.request.post(`${target.publicUrl}/portal/report/portal_custom_report.php`, {
    form: {
      include_demographics: "demographics",
      include_billing: "billing",
      "procedures[]": String(procedureOrderId),
      pdf: "1"
    }
  });
  expect(pdfResponse.ok()).toBeTruthy();
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");

  const pdf = await pdfResponse.body();
  expect(pdf.byteLength).toBeGreaterThan(1000);
  expect(pdf.toString("latin1").startsWith("%PDF")).toBeTruthy();
}

async function expectModernizedSelectedProcedureOrderDeliveryArtifacts(
  page: Page,
  target: RuntimeTarget,
  procedureOrderId: number,
  procedureName: string
) {
  const loginResponse = await page.request.post(`${target.apiBaseUrl}/api/patient-portal/login`, {
    data: {
      username: portalLoginUsername,
      password: portalPassword
    }
  });
  expect(loginResponse.ok()).toBeTruthy();
  const login = await loginResponse.json() as { authenticated: boolean; sessionId?: string | null };
  expect(login.authenticated).toBeTruthy();
  expect(login.sessionId).toBeTruthy();

  const selectedReportInput = {
    sectionIds: ["demographics", "billing"],
    procedureOrderIds: [String(procedureOrderId)],
    issueIds: [],
    encounterFormIds: []
  };

  const pdfResponse = await page.request.post(`${target.apiBaseUrl}/api/patient-portal/medical-report/pdf`, {
    headers: {
      "X-OpenEMR-Patient-Portal-Session": login.sessionId!
    },
    data: selectedReportInput
  });
  expect(pdfResponse.ok()).toBeTruthy();
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");
  expect(pdfResponse.headers()["content-disposition"]).toContain("medical-report-MOD-PAT-0004-");

  const pdfText = (await pdfResponse.body()).toString("ascii");
  expect(pdfText.startsWith("%PDF-1.4")).toBeTruthy();
  expect(pdfText).toContain(`Included procedure orders: ${procedureOrderId}`);
  expect(pdfText).toContain(`Order: ${procedureName}`);
  expect(pdfText).toContain(`Order date: ${procedureOrderDate}`);
  expect(pdfText).toContain(`Code: ${procedureOrderCode}`);
  expect(pdfText).toContain(`Diagnosis: ${procedureOrderDiagnosis}`);
  expect(pdfText).toContain("Status: pending");
  expect(pdfText).toContain("Reports: 0");

  const packageResponse = await page.request.post(`${target.apiBaseUrl}/api/patient-portal/medical-report/package`, {
    headers: {
      "X-OpenEMR-Patient-Portal-Session": login.sessionId!
    },
    data: selectedReportInput
  });
  expect(packageResponse.ok()).toBeTruthy();
  expect(packageResponse.headers()["content-type"]).toContain("application/zip");
  expect(packageResponse.headers()["content-disposition"]).toContain("medical-report-MOD-PAT-0004-");

  const packageBytes = await packageResponse.body();
  expect(packageBytes.toString("latin1", 0, 2)).toBe("PK");
  const packageEntries = readZipEntries(packageBytes);
  const entryNames = [...packageEntries.keys()];
  expect(entryNames[0]).toBe("manifest.json");
  expect(entryNames[1]).toMatch(/^medical-report-MOD-PAT-0004-\d{8}\.pdf$/);
  expect(entryNames[2]).toBe("summary.txt");

  const manifest = JSON.parse(packageEntries.get("manifest.json")!.toString("utf8")) as {
    report: { includedProcedureOrderIds: string[] };
  };
  expect(manifest.report.includedProcedureOrderIds).toEqual([String(procedureOrderId)]);

  const summaryText = packageEntries.get("summary.txt")!.toString("utf8");
  expect(summaryText).toContain(`Included procedure orders: ${procedureOrderId}`);
  expect(summaryText).toContain(
    `Procedure Order: ${procedureName} ordered ${procedureOrderDate} with 0 result rows.`
  );

  const packagePdfEntryName = entryNames.find((name) => name.endsWith(".pdf"));
  expect(packagePdfEntryName).toBeTruthy();
  const packagePdfText = packageEntries.get(packagePdfEntryName!)!.toString("ascii");
  expect(packagePdfText).toContain(`Included procedure orders: ${procedureOrderId}`);
  expect(packagePdfText).toContain(`Order: ${procedureName}`);
  expect(packagePdfText).toContain(`Code: ${procedureOrderCode}`);
  expect(packagePdfText).toContain(`Diagnosis: ${procedureOrderDiagnosis}`);

  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);

  const procedureRegion = page.getByRole("region", { name: "Patient portal medical report procedures" });
  const checkboxes = procedureRegion.getByRole("checkbox");
  const checkboxCount = await checkboxes.count();
  for (let index = 0; index < checkboxCount; index += 1) {
    const checkbox = checkboxes.nth(index);
    if (await checkbox.isChecked()) {
      await checkbox.uncheck();
    }
  }

  await procedureRegion
    .getByRole("checkbox", { name: `Include procedure order ${procedureName} in generated report` })
    .check();

  await page.getByRole("button", { name: "Generate report" }).click();
  const generatedReportRegion = page.getByRole("region", { name: "Patient portal generated medical report" });
  await expect(generatedReportRegion).toContainText("PDF Download available");
  await expect(generatedReportRegion).toContainText("Package Download available");
  await expect(generatedReportRegion).toContainText(`Order: ${procedureName}`);
  await expect(generatedReportRegion).toContainText(`Procedure Order: ${procedureName} ordered ${procedureOrderDate} with 0 result rows.`);
  await expect(generatedReportRegion).toContainText("manifest.json");
  await expect(generatedReportRegion).toContainText("summary.txt");
  await expect(page.getByRole("button", { name: "Download report PDF" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Download report package" })).toBeEnabled();
}

function readZipEntries(packageBytes: Buffer): Map<string, Buffer> {
  const minimumEndOfCentralDirectoryLength = 22;
  const searchStart = Math.max(0, packageBytes.length - 65_557);
  let endOfCentralDirectoryOffset = -1;

  for (let offset = packageBytes.length - minimumEndOfCentralDirectoryLength; offset >= searchStart; offset -= 1) {
    if (packageBytes.readUInt32LE(offset) === 0x06054b50) {
      endOfCentralDirectoryOffset = offset;
      break;
    }
  }

  if (endOfCentralDirectoryOffset < 0) {
    throw new Error("ZIP end-of-central-directory record was not found.");
  }

  const entryCount = packageBytes.readUInt16LE(endOfCentralDirectoryOffset + 10);
  let directoryOffset = packageBytes.readUInt32LE(endOfCentralDirectoryOffset + 16);
  const entries = new Map<string, Buffer>();

  for (let index = 0; index < entryCount; index += 1) {
    if (packageBytes.readUInt32LE(directoryOffset) !== 0x02014b50) {
      throw new Error(`ZIP central-directory entry ${index} was malformed.`);
    }

    const compressionMethod = packageBytes.readUInt16LE(directoryOffset + 10);
    const compressedSize = packageBytes.readUInt32LE(directoryOffset + 20);
    const fileNameLength = packageBytes.readUInt16LE(directoryOffset + 28);
    const extraFieldLength = packageBytes.readUInt16LE(directoryOffset + 30);
    const commentLength = packageBytes.readUInt16LE(directoryOffset + 32);
    const localHeaderOffset = packageBytes.readUInt32LE(directoryOffset + 42);
    const fileNameOffset = directoryOffset + 46;
    const entryName = packageBytes.toString("utf8", fileNameOffset, fileNameOffset + fileNameLength);

    if (packageBytes.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`ZIP local-file header for ${entryName} was malformed.`);
    }

    const localFileNameLength = packageBytes.readUInt16LE(localHeaderOffset + 26);
    const localExtraFieldLength = packageBytes.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraFieldLength;
    const compressedContent = packageBytes.subarray(dataOffset, dataOffset + compressedSize);
    const content = compressionMethod === 0
      ? Buffer.from(compressedContent)
      : compressionMethod === 8
        ? Buffer.from(inflateRawSync(compressedContent))
        : unsupportedZipCompression(entryName, compressionMethod);

    entries.set(entryName, content);
    directoryOffset = fileNameOffset + fileNameLength + extraFieldLength + commentLength;
  }

  return entries;
}

function unsupportedZipCompression(entryName: string, compressionMethod: number): never {
  throw new Error(`ZIP entry ${entryName} used unsupported compression method ${compressionMethod}.`);
}

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
