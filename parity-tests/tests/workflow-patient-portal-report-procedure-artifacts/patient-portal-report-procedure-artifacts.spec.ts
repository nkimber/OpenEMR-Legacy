import { inflateRawSync } from "node:zlib";
import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(180_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMedicalReportAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    const procedureName = `Slice 237 artifact procedure order ${workflowSuffix()}`;
    let procedureOrderId: number | null = null;
    let cleanupAttached = false;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-237-patient-portal-report-procedure-artifacts-precondition",
      description: "Captures the Slice 237 procedure-order artifact precondition: the signed-in anchor patient and latest encounter exist before a temporary procedure order is created for PDF/package delivery checks.",
      expected: {
        canonicalId: portalMedicalReportAnchorPatientId,
        portalUsername: portalLoginUsername,
        procedureOrderDate,
        procedureOrderCode,
        procedureOrderDiagnosis,
        selectedSections: ["demographics", "billing"],
        expectedPackageEntries: ["manifest.json", "medical-report-MOD-PAT-0004-yyyymmdd.pdf", "summary.txt"]
      },
      actual: {
        patient: summarizePatient(patient),
        encounter: summarizeEncounter(encounter)
      },
      context: {
        suite: "workflow-patient-portal-report-procedure-artifacts",
        workflow: "patient-portal-report-procedure-artifacts-precondition"
      }
    });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-237-patient-portal-report-procedure-artifacts-result",
        description: "Captures the Slice 237 selected procedure-order delivery metadata projection, including generated-report inclusion, PDF availability, package availability, ZIP entry metadata, and summary text.",
        expected: {
          authenticated: true,
          includedSectionIds: ["demographics", "billing"],
          includedProcedureOrderIds: [String(procedureOrderId)],
          packageDownloadAvailable: true,
          packageContentType: "application/zip",
          packageEntries: ["manifest.json", "medical-report-MOD-PAT-0004-yyyymmdd.pdf", "summary.txt"],
          summaryLine: `Procedure Order: ${procedureName} ordered ${procedureOrderDate} with 0 result rows.`
        },
        actual: summarizeGeneratedReport(generated),
        context: {
          suite: "workflow-patient-portal-report-procedure-artifacts",
          workflow: "patient-portal-report-procedure-artifacts-result"
        }
      });
      await workflow.deleteProcedureOrderCascade(procedureOrderId);
      const cleanupBuilder = await workflow.getPatientPortalMedicalReport(portalLoginUsername, portalPassword);
      expect(cleanupBuilder.procedureOrders.some((order) => order.id === String(procedureOrderId))).toBe(false);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-237-patient-portal-report-procedure-artifacts-cleanup",
        description: "Captures the Slice 237 cleanup state after deleting the temporary procedure order tree.",
        expected: {
          procedureOrderIdAbsent: String(procedureOrderId)
        },
        actual: {
          deletedProcedureOrderId: procedureOrderId,
          cleanupBuilder: summarizeReportBuilder(cleanupBuilder, String(procedureOrderId))
        },
        context: {
          suite: "workflow-patient-portal-report-procedure-artifacts",
          workflow: "patient-portal-report-procedure-artifacts-cleanup"
        }
      });
      procedureOrderId = null;
      cleanupAttached = true;
    } finally {
      if (procedureOrderId !== null) {
        await workflow.deleteProcedureOrderCascade(procedureOrderId);
        if (!cleanupAttached) {
          const cleanupBuilder = await workflow.getPatientPortalMedicalReport(portalLoginUsername, portalPassword);
          await attachDatabaseProbeEvidence(testInfo, {
            target: target.id,
            probe: "slice-237-patient-portal-report-procedure-artifacts-cleanup",
            description: "Captures the Slice 237 best-effort cleanup state after deleting the temporary procedure order tree.",
            expected: {
              procedureOrderIdAbsent: String(procedureOrderId)
            },
            actual: {
              deletedProcedureOrderId: procedureOrderId,
              cleanupBuilder: summarizeReportBuilder(cleanupBuilder, String(procedureOrderId))
            },
            context: {
              suite: "workflow-patient-portal-report-procedure-artifacts",
              workflow: "patient-portal-report-procedure-artifacts-cleanup"
            }
          });
        }
      }
    }
  });

  test("downloads selected procedure-order report artifacts", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
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
        const legacyArtifacts = await expectLegacySelectedProcedureOrderSourceArtifacts(page, target, procedureOrderId);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-237-patient-portal-report-procedure-artifacts-legacy-ui",
          description: "Captures the legacy selected procedure-order source artifact path: report-builder checkbox, printable custom report, and PDF export metadata.",
          expected: {
            visibleFacts: ["Patient Report", "Procedure Order", "PATIENT:Kim, Nora"],
            procedureOrderId: String(procedureOrderId),
            printablePdfHeader: "%PDF"
          },
          actual: {
            patient: summarizePatient(patient),
            encounter: summarizeEncounter(encounter),
            procedureOrder: summarizeTemporaryProcedureOrder(procedureOrderId, procedureName),
            legacyArtifacts
          },
          context: {
            suite: "workflow-patient-portal-report-procedure-artifacts",
            workflow: "patient-portal-report-procedure-artifacts-legacy-ui"
          }
        });
        return;
      }

      const modernizedArtifacts = await expectModernizedSelectedProcedureOrderDeliveryArtifacts(page, target, procedureOrderId, procedureName);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-237-patient-portal-report-procedure-artifacts-modernized-ui",
        description: "Captures the modernized selected procedure-order delivery artifacts, including PDF response facts, ZIP package entries, manifest/summary contents, package PDF facts, and Portal rendering.",
        expected: {
          pdfContentType: "application/pdf",
          packageContentType: "application/zip",
          zipEntries: ["manifest.json", "medical-report-MOD-PAT-0004-yyyymmdd.pdf", "summary.txt"],
          visibleFacts: ["PDF Download available", "Package Download available", "manifest.json", "summary.txt", procedureName]
        },
        actual: {
          patient: summarizePatient(patient),
          encounter: summarizeEncounter(encounter),
          procedureOrder: summarizeTemporaryProcedureOrder(procedureOrderId, procedureName),
          modernizedArtifacts
        },
        context: {
          suite: "workflow-patient-portal-report-procedure-artifacts",
          workflow: "patient-portal-report-procedure-artifacts-modernized-ui"
        }
      });
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
  return {
    portalUrl: page.url(),
    printableUrl: `${target.publicUrl}/portal/report/portal_custom_report.php?${printableParams.toString()}`,
    procedureOrderId,
    procedureOrderInputCount: await page.locator(`input[name='procedures[]'][value='${procedureOrderId}']`).count(),
    printableContentLength: printableHtml.length,
    pdfContentType: pdfResponse.headers()["content-type"],
    pdfByteLength: pdf.byteLength,
    pdfHeader: pdf.toString("latin1", 0, 4),
    containsFacts: {
      patientReport: true,
      procedureOrder: printableHtml.includes("Procedure Order"),
      patientHeader: printableHtml.includes("PATIENT:Kim, Nora"),
      pdfHeader: pdf.toString("latin1").startsWith("%PDF")
    }
  };
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
  const generatedReportText = await generatedReportRegion.innerText();
  return {
    pdf: {
      contentType: pdfResponse.headers()["content-type"],
      contentDisposition: pdfResponse.headers()["content-disposition"],
      textLength: pdfText.length,
      containsFacts: {
        pdfHeader: pdfText.startsWith("%PDF-1.4"),
        includedProcedureOrder: pdfText.includes(`Included procedure orders: ${procedureOrderId}`),
        procedureName: pdfText.includes(`Order: ${procedureName}`),
        code: pdfText.includes(`Code: ${procedureOrderCode}`),
        diagnosis: pdfText.includes(`Diagnosis: ${procedureOrderDiagnosis}`)
      }
    },
    package: {
      contentType: packageResponse.headers()["content-type"],
      contentDisposition: packageResponse.headers()["content-disposition"],
      byteLength: packageBytes.byteLength,
      zipHeader: packageBytes.toString("latin1", 0, 2),
      entryNames,
      manifestReportProcedureOrderIds: manifest.report.includedProcedureOrderIds,
      summaryTextLength: summaryText.length,
      packagePdfEntryName,
      packagePdfTextLength: packagePdfText.length,
      containsFacts: {
        summaryIncludedProcedureOrder: summaryText.includes(`Included procedure orders: ${procedureOrderId}`),
        summaryProcedureLine: summaryText.includes(`Procedure Order: ${procedureName} ordered ${procedureOrderDate} with 0 result rows.`),
        packagePdfProcedureName: packagePdfText.includes(`Order: ${procedureName}`),
        packagePdfCode: packagePdfText.includes(`Code: ${procedureOrderCode}`),
        packagePdfDiagnosis: packagePdfText.includes(`Diagnosis: ${procedureOrderDiagnosis}`)
      }
    },
    portal: {
      portalUrl: page.url(),
      generatedReportTextLength: generatedReportText.length,
      containsFacts: {
        pdfDownloadAvailable: generatedReportText.includes("PDF Download available"),
        packageDownloadAvailable: generatedReportText.includes("Package Download available"),
        procedureName: generatedReportText.includes(`Order: ${procedureName}`),
        summaryLine: generatedReportText.includes(`Procedure Order: ${procedureName} ordered ${procedureOrderDate} with 0 result rows.`),
        manifestJson: generatedReportText.includes("manifest.json"),
        summaryTxt: generatedReportText.includes("summary.txt")
      }
    }
  };
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

function summarizePatient(patient: any) {
  return {
    pid: patient?.pid,
    pubpid: patient?.pubpid,
    providerId: patient?.providerId,
    displayName: "Kim, Nora",
    portalUsername: portalLoginUsername
  };
}

function summarizeEncounter(encounter: any) {
  return {
    encounter: encounter?.encounter,
    pid: encounter?.pid,
    date: encounter?.date,
    reason: encounter?.reason
  };
}

function summarizeTemporaryProcedureOrder(procedureOrderId: number, procedureName: string) {
  return {
    id: procedureOrderId,
    procedureName,
    procedureCode: procedureOrderCode,
    procedureOrderDate,
    diagnosis: procedureOrderDiagnosis,
    status: "pending"
  };
}

function summarizeGeneratedReport(generated: any) {
  return {
    authenticated: generated.authenticated,
    username: generated.username,
    portalUsername: generated.portalUsername,
    pid: generated.pid,
    pubpid: generated.pubpid,
    displayName: generated.displayName,
    title: generated.title,
    includedSectionIds: generated.includedSectionIds,
    includedProcedureOrderIds: generated.includedProcedureOrderIds,
    includedIssueIds: generated.includedIssueIds,
    includedEncounterFormIds: generated.includedEncounterFormIds,
    printableVersionAvailable: generated.printableVersionAvailable,
    pdfDownloadAvailable: generated.pdfDownloadAvailable,
    packageDownloadAvailable: generated.packageDownloadAvailable,
    reportSectionCount: generated.reportSectionCount,
    sectionTitles: Array.isArray(generated.reportSections)
      ? generated.reportSections.map((section: any) => section.title)
      : [],
    summaryLines: generated.summaryLines,
    packageMetadata: generated.packageMetadata,
    failureReason: generated.failureReason
  };
}

function summarizeReportBuilder(reportBuilder: any, selectedProcedureOrderId: string) {
  const procedureOrders = Array.isArray(reportBuilder.procedureOrders) ? reportBuilder.procedureOrders : [];
  return {
    authenticated: reportBuilder.authenticated,
    username: reportBuilder.username,
    portalUsername: reportBuilder.portalUsername,
    pid: reportBuilder.pid,
    pubpid: reportBuilder.pubpid,
    displayName: reportBuilder.displayName,
    failureReason: reportBuilder.failureReason,
    procedureOrderCount: procedureOrders.length,
    selectedOrderPresent: procedureOrders.some((order: any) => order.id === selectedProcedureOrderId)
  };
}
