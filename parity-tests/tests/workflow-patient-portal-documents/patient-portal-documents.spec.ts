import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalDocumentAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const expectedDocumentNames = [
  "Advance directive acknowledgement 01",
  "Continuity of care document 02"
];

test.describe("patient portal document list and download parity @slice218 @workflow-patient-portal-documents @patients @portal @documents", () => {
  test("lists active patient documents and exposes the selected-document package", async ({
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(180_000);

    const patient = await targetDb.findPatientByCanonicalId(portalDocumentAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-218-patient-portal-documents-precondition",
      description: "Captures the Slice 218 portal document precondition: the signed-in anchor patient exists for document list and selected-package download checks.",
      expected: {
        anchorCanonicalId: portalDocumentAnchorPatientId,
        loginUsername: portalLoginUsername,
        pubpid: portalDocumentAnchorPatientId
      },
      actual: {
        patient
      },
      context: {
        canonicalId: portalDocumentAnchorPatientId,
        suite: "workflow-patient-portal-documents",
        workflow: "patient-portal-documents-precondition"
      }
    });

    const portalDocuments = await workflow.getPatientPortalDocuments(portalLoginUsername, portalPassword);
    expect(portalDocuments).toMatchObject({
      authenticated: true,
      username: portalLoginUsername,
      portalUsername: portalLoginUsername,
      pid: patient!.pid,
      pubpid: patient!.pubpid,
      displayName: "Kim, Nora",
      documentCount: 2,
      failureReason: null
    });
    expect(portalDocuments.documents.map((document) => document.name).sort()).toEqual(expectedDocumentNames);
    expect(portalDocuments.categories.map((category) => category.displayPath).sort()).toEqual(["Advance Directive", "CCDA"]);
    expect(portalDocuments.documents.every((document) => document.canDownload)).toBe(true);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-218-patient-portal-documents-list",
      description: "Captures the Slice 218 portal document list projection, including legacy category paths, active document names, and download eligibility.",
      expected: {
        documentNames: expectedDocumentNames,
        categories: ["Advance Directive", "CCDA"],
        documentCount: 2,
        allDocumentsDownloadable: true
      },
      actual: {
        patient,
        portalDocuments
      },
      context: {
        canonicalId: portalDocumentAnchorPatientId,
        suite: "workflow-patient-portal-documents",
        workflow: "patient-portal-documents-list"
      }
    });

    const requestedDocumentIds = portalDocuments.documents.map((document) => document.id);
    const downloadResult = await workflow.downloadPatientPortalDocuments(
      portalLoginUsername,
      portalPassword,
      requestedDocumentIds
    );
    expect(downloadResult).toMatchObject({
      authenticated: true,
      downloadable: true,
      fileName: "patient_documents.zip",
      documentCount: 2,
      failureReason: null
    });
    expect(downloadResult.contentType).toContain("application/zip");
    expect(downloadResult.contentLength).toBeGreaterThan(0);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-218-patient-portal-documents-download",
      description: "Captures the Slice 218 selected-document package result, including requested document IDs, ZIP filename, content type, and byte length.",
      expected: {
        requestedDocumentIds,
        downloadable: true,
        fileName: "patient_documents.zip",
        documentCount: 2,
        contentTypeIncludes: "application/zip",
        contentLengthGreaterThan: 0
      },
      actual: {
        portalDocuments,
        requestedDocumentIds,
        downloadResult
      },
      context: {
        canonicalId: portalDocumentAnchorPatientId,
        suite: "workflow-patient-portal-documents",
        workflow: "patient-portal-documents-download"
      }
    });

    if (target.type === "modernized-openemr") {
      expect(downloadResult.contentLength).toBeGreaterThan(300);
    }
  });

  test("renders portal documents and downloads the selected document zip from the portal surface", async ({
    page,
    target
  }, testInfo) => {
    test.setTimeout(180_000);

    if (target.type === "legacy-openemr") {
      await expectLegacyPatientPortalDocuments(page, target);
      const legacyDocumentsSurface = await page.locator("body").innerText();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-218-patient-portal-documents-legacy-surface",
        description: "Captures the Slice 218 legacy patient portal document download surface with both expected active documents and the download action.",
        expected: {
          visibleFields: [
            "Select Documents to Download",
            ...expectedDocumentNames,
            "Download Selected Documents"
          ]
        },
        actual: {
          url: page.url(),
          expectedDocumentNames,
          legacyDocumentsSurface
        },
        context: {
          canonicalId: portalDocumentAnchorPatientId,
          suite: "workflow-patient-portal-documents",
          workflow: "patient-portal-documents-legacy-surface"
        }
      });
      return;
    }

    await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
    const documentsRegion = page.getByRole("region", { name: "Patient portal documents" });
    await expect(documentsRegion).toContainText("Documents");
    await expect(documentsRegion).toContainText(expectedDocumentNames[0]);
    await expect(documentsRegion).toContainText(expectedDocumentNames[1]);

    await documentsRegion.getByLabel(`Select patient portal document ${expectedDocumentNames[0]}`).check();
    await documentsRegion.getByLabel(`Select patient portal document ${expectedDocumentNames[1]}`).check();
    const downloadPromise = page.waitForEvent("download");
    await documentsRegion.getByRole("button", { name: "Download selected documents" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("patient_documents.zip");
    const modernizedDocumentsSurface = await documentsRegion.innerText();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-218-patient-portal-documents-modernized-surface",
      description: "Captures the Slice 218 modernized Portal documents rendering and selected-document ZIP download filename.",
      expected: {
        visibleFields: [
          "Patient portal documents",
          ...expectedDocumentNames,
          "Download selected documents"
        ],
        suggestedFilename: "patient_documents.zip"
      },
      actual: {
        url: page.url(),
        expectedDocumentNames,
        suggestedFilename: download.suggestedFilename(),
        modernizedDocumentsSurface
      },
      context: {
        canonicalId: portalDocumentAnchorPatientId,
        suite: "workflow-patient-portal-documents",
        workflow: "patient-portal-documents-modernized-surface"
      }
    });
  });
});

async function expectLegacyPatientPortalDocuments(page: Page, target: RuntimeTarget) {
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
  await page.goto(`${target.publicUrl}/portal/get_patient_documents.php`);
  await expectRenderedText(page, /Select Documents to Download/i);
  await expect(page.locator("body")).toContainText(expectedDocumentNames[0]);
  await expect(page.locator("body")).toContainText(expectedDocumentNames[1]);
  await expect(page.locator("body")).toContainText("Download Selected Documents");
}
