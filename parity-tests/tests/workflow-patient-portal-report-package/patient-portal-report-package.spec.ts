import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMedicalReportAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal generated report package parity @slice230 @workflow-patient-portal-report-package @patients @portal @reports", () => {
  test("normalizes generated medical report package metadata", async ({
    targetDb,
    target,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMedicalReportAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-230-patient-portal-report-package-precondition",
      description: "Captures the Slice 230 generated medical-report package precondition: the signed-in anchor patient exists before generating package metadata.",
      expected: {
        canonicalId: portalMedicalReportAnchorPatientId,
        portalUsername: portalLoginUsername,
        expectedEntries: ["manifest.json", "medical-report-MOD-PAT-0004-yyyymmdd.pdf", "summary.txt"]
      },
      actual: {
        canonicalId: portalMedicalReportAnchorPatientId,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        portalUsername: portalLoginUsername
      },
      context: {
        suite: "workflow-patient-portal-report-package",
        workflow: "patient-portal-generated-medical-report-package-precondition"
      }
    });

    const generated = await workflow.generatePatientPortalMedicalReport(portalLoginUsername, portalPassword, {
      sectionIds: ["demographics", "billing"]
    });

    expect(generated).toMatchObject({
      authenticated: true,
      username: portalLoginUsername,
      portalUsername: portalLoginUsername,
      pid: patient!.pid,
      pubpid: patient!.pubpid,
      displayName: "Kim, Nora",
      title: "Customized Medical History Report",
      printableVersionAvailable: true,
      pdfDownloadAvailable: true,
      packageDownloadAvailable: true,
      failureReason: null
    });
    expect(generated.packageMetadata).toMatchObject({
      contentType: "application/zip",
      manifestAvailable: true,
      pdfAvailable: true,
      summaryAvailable: true
    });
    expect(generated.packageMetadata.fileName).toMatch(/^medical-report-MOD-PAT-0004-\d{8}\.zip$/);
    expect(generated.packageMetadata.entryNames).toHaveLength(3);
    expect(generated.packageMetadata.entryNames[0]).toBe("manifest.json");
    expect(generated.packageMetadata.entryNames[1]).toMatch(/^medical-report-MOD-PAT-0004-\d{8}\.pdf$/);
    expect(generated.packageMetadata.entryNames[2]).toBe("summary.txt");
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-230-patient-portal-report-package-result",
      description: "Captures the Slice 230 generated medical-report package metadata projection, including ZIP filename, entry names, and package availability flags.",
      expected: {
        displayName: "Kim, Nora",
        packageDownloadAvailable: true,
        contentType: "application/zip",
        fileNamePattern: "^medical-report-MOD-PAT-0004-\\d{8}\\.zip$",
        entryNames: ["manifest.json", "medical-report-MOD-PAT-0004-yyyymmdd.pdf", "summary.txt"]
      },
      actual: {
        authenticated: generated.authenticated,
        username: generated.username,
        portalUsername: generated.portalUsername,
        pid: generated.pid,
        pubpid: generated.pubpid,
        displayName: generated.displayName,
        title: generated.title,
        printableVersionAvailable: generated.printableVersionAvailable,
        pdfDownloadAvailable: generated.pdfDownloadAvailable,
        packageDownloadAvailable: generated.packageDownloadAvailable,
        packageMetadata: generated.packageMetadata
      },
      context: {
        suite: "workflow-patient-portal-report-package",
        workflow: "patient-portal-generated-medical-report-package-result"
      }
    });
  });

  test("downloads generated report delivery artifacts", async ({
    page,
    target
  }, testInfo) => {
    test.setTimeout(120_000);

    if (target.type === "legacy-openemr") {
      const legacyArtifacts = await expectLegacyGeneratedMedicalReportSourceArtifacts(page, target);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-230-patient-portal-report-package-legacy-ui",
        description: "Captures the legacy OpenEMR generated-report source artifacts used as the package-delivery reference: printable HTML plus PDF export metadata.",
        expected: {
          printablePage: "portal/report/portal_custom_report.php?printable=1",
          pdfPage: "portal/report/portal_custom_report.php",
          visibleFacts: ["Modernization Family Medicine", "PATIENT:Kim, Nora"],
          pdfHeader: "%PDF"
        },
        actual: legacyArtifacts,
        context: {
          suite: "workflow-patient-portal-report-package",
          workflow: "patient-portal-generated-medical-report-package-legacy-ui"
        }
      });
      return;
    }

    const modernizedArtifacts = await expectModernizedGeneratedMedicalReportPackage(page, target);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-230-patient-portal-report-package-modernized-ui",
      description: "Captures the modernized generated medical-report package API and Portal surface, including ZIP response metadata, entry names, and download-control rendering.",
      expected: {
        endpoint: "/api/patient-portal/medical-report/package",
        contentType: "application/zip",
        entryNames: ["manifest.json", "medical-report-MOD-PAT-0004-yyyymmdd.pdf", "summary.txt"],
        visibleFacts: ["Package Download available", "manifest.json", "summary.txt", "Download report package"]
      },
      actual: modernizedArtifacts,
      context: {
        suite: "workflow-patient-portal-report-package",
        workflow: "patient-portal-generated-medical-report-package-modernized-ui"
      }
    });
  });
});

async function expectLegacyGeneratedMedicalReportSourceArtifacts(page: Page, target: RuntimeTarget) {
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
  const procedureOrderId = await page.locator("input[name='procedures[]']").first().getAttribute("value");
  expect(procedureOrderId).toBeTruthy();

  const printableParams = new URLSearchParams();
  printableParams.set("printable", "1");
  printableParams.set("include_demographics", "demographics");
  printableParams.set("include_billing", "billing");
  printableParams.append("procedures[]", procedureOrderId!);
  const printableResponse = await page.request.get(
    `${target.publicUrl}/portal/report/portal_custom_report.php?${printableParams.toString()}`
  );
  expect(printableResponse.ok()).toBeTruthy();
  const printableHtml = await printableResponse.text();
  expect(printableHtml).toContain("Modernization Family Medicine");
  expect(printableHtml).toContain("PATIENT:Kim, Nora");

  const pdfResponse = await page.request.post(`${target.publicUrl}/portal/report/portal_custom_report.php`, {
    form: {
      include_demographics: "demographics",
      include_billing: "billing",
      "procedures[]": procedureOrderId!,
      pdf: "1"
    }
  });
  expect(pdfResponse.ok()).toBeTruthy();
  expect(pdfResponse.headers()["content-type"]).toContain("application/pdf");

  const pdf = await pdfResponse.body();
  expect(pdf.byteLength).toBeGreaterThan(1000);
  expect(pdf.toString("latin1").startsWith("%PDF")).toBeTruthy();

  return {
    printableUrl: `${target.publicUrl}/portal/report/portal_custom_report.php?${printableParams.toString()}`,
    pdfUrl: `${target.publicUrl}/portal/report/portal_custom_report.php`,
    procedureOrderId,
    printableResponseLength: printableHtml.length,
    pdfContentType: pdfResponse.headers()["content-type"],
    pdfByteLength: pdf.byteLength,
    pdfHeader: pdf.toString("latin1", 0, 4),
    containsFacts: {
      printableFacility: printableHtml.includes("Modernization Family Medicine"),
      printablePatientHeader: printableHtml.includes("PATIENT:Kim, Nora"),
      pdfHeader: pdf.toString("latin1").startsWith("%PDF")
    }
  };
}

async function expectModernizedGeneratedMedicalReportPackage(page: Page, target: RuntimeTarget) {
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

  const packageResponse = await page.request.post(`${target.apiBaseUrl}/api/patient-portal/medical-report/package`, {
    headers: {
      "X-OpenEMR-Patient-Portal-Session": login.sessionId!
    },
    data: {
      sectionIds: ["demographics", "billing"]
    }
  });
  expect(packageResponse.ok()).toBeTruthy();
  expect(packageResponse.headers()["content-type"]).toContain("application/zip");
  expect(packageResponse.headers()["content-disposition"]).toContain("medical-report-MOD-PAT-0004-");
  expect(packageResponse.headers()["content-disposition"]).toContain(".zip");

  const packageBytes = await packageResponse.body();
  expect(packageBytes.toString("latin1", 0, 2)).toBe("PK");
  const entryNames = readZipCentralDirectoryEntryNames(packageBytes);
  expect(entryNames[0]).toBe("manifest.json");
  expect(entryNames[1]).toMatch(/^medical-report-MOD-PAT-0004-\d{8}\.pdf$/);
  expect(entryNames[2]).toBe("summary.txt");

  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  await page.getByRole("button", { name: "Generate report" }).click();
  const generatedReportRegion = page.getByRole("region", { name: "Patient portal generated medical report" });
  await expect(generatedReportRegion).toContainText("Package Download available");
  await expect(generatedReportRegion).toContainText("manifest.json");
  await expect(generatedReportRegion).toContainText("summary.txt");
  await expect(page.getByRole("button", { name: "Download report package" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Download report package" })).toBeEnabled();

  return {
    packageEndpoint: `${target.apiBaseUrl}/api/patient-portal/medical-report/package`,
    packageContentType: packageResponse.headers()["content-type"],
    contentDisposition: packageResponse.headers()["content-disposition"],
    packageByteLength: packageBytes.byteLength,
    zipHeader: packageBytes.toString("latin1", 0, 2),
    entryNames,
    portalUrl: page.url(),
    regionText: await generatedReportRegion.innerText(),
    downloadButtonVisible: await page.getByRole("button", { name: "Download report package" }).isVisible(),
    downloadButtonEnabled: await page.getByRole("button", { name: "Download report package" }).isEnabled()
  };
}

function readZipCentralDirectoryEntryNames(packageBytes: Buffer): string[] {
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
  const entryNames: string[] = [];

  for (let index = 0; index < entryCount; index += 1) {
    if (packageBytes.readUInt32LE(directoryOffset) !== 0x02014b50) {
      throw new Error(`ZIP central-directory entry ${index} was malformed.`);
    }

    const fileNameLength = packageBytes.readUInt16LE(directoryOffset + 28);
    const extraFieldLength = packageBytes.readUInt16LE(directoryOffset + 30);
    const commentLength = packageBytes.readUInt16LE(directoryOffset + 32);
    const fileNameOffset = directoryOffset + 46;
    entryNames.push(packageBytes.toString("utf8", fileNameOffset, fileNameOffset + fileNameLength));
    directoryOffset = fileNameOffset + fileNameLength + extraFieldLength + commentLength;
  }

  return entryNames;
}
