import { test, expect } from "../../src/fixtures/parityTest.js";
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
  }) => {
    test.setTimeout(180_000);

    const patient = await targetDb.findPatientByCanonicalId(portalDocumentAnchorPatientId);
    expect(patient).not.toBeNull();

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

    const downloadResult = await workflow.downloadPatientPortalDocuments(
      portalLoginUsername,
      portalPassword,
      portalDocuments.documents.map((document) => document.id)
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

    if (target.type === "modernized-openemr") {
      expect(downloadResult.contentLength).toBeGreaterThan(300);
    }
  });

  test("renders portal documents and downloads the selected document zip from the portal surface", async ({
    page,
    target
  }) => {
    test.setTimeout(180_000);

    if (target.type === "legacy-openemr") {
      await expectLegacyPatientPortalDocuments(page, target);
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
