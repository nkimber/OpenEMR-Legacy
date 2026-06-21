import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const binaryContentReplaceAnchorPatientId = "MOD-PAT-0001";

test.describe("patient binary document content replacement parity @slice128 @workflow-document-binary-content-replace @mutation @documents", () => {
  test("replaces the bytes, preview facts, revision hash, and download payload for a patient binary document", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(binaryContentReplaceAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const documentName = `Parity Patient Binary Replace Document ${suffix}`;
    const originalFileName = `${documentName} Original.pdf`;
    const replacementFileName = `${documentName} Replacement.pdf`;
    const originalContentBase64 = buildPdfFixtureBase64(originalFileName, "Original patient binary replacement payload");
    const replacementContentBase64 = buildPdfFixtureBase64(replacementFileName, "Replacement patient binary replacement payload");
    const replacementBytes = Buffer.from(replacementContentBase64, "base64");
    let documentId: number | string | null = null;

    try {
      documentId = await workflow.createPatientBinaryDocument({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-18",
        encounter: 1000013,
        fileName: originalFileName,
        mimetype: "application/pdf",
        contentBase64: originalContentBase64,
        notes: "Created by the parity patient binary document content replacement suite."
      });

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-18",
        mimetype: "application/pdf",
        storageMethod: "database",
        deleted: 0,
        contentBase64: originalContentBase64
      });

      const createdContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(createdContent).not.toBeNull();
      expect(createdContent).toMatchObject({
        name: documentName,
        mimetype: "application/pdf",
        storageMethod: "database",
        previewKind: "pdf",
        previewStatus: "Inline PDF preview",
        thumbnailLabel: "PDF",
        canPreviewInline: true,
        canDownload: true,
        versionLabel: "Version 1",
        versionStatus: "Current version"
      });
      expect(createdContent!.contentBase64).toBe(originalContentBase64);
      expect(createdContent!.revisionHash).toBe(createdContent!.hash);
      const createdRevisionAt = timestampSeconds(createdContent!.revisionAt);
      const createdHash = createdContent!.hash;

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      if (target.type === "legacy-openemr") {
        await workflow.replacePatientDocumentBinaryContent(documentId, {
          fileName: replacementFileName,
          mimetype: "application/pdf",
          contentBase64: replacementContentBase64
        });
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Documents" }).click();
        await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
        await page.getByLabel("Documents patient ID").fill(patient!.pubpid);

        const documentCard = page.locator(".document-card").filter({ hasText: documentName }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText(originalFileName);
        await documentCard.getByRole("button", { name: "Binary File" }).click();
        await documentCard.getByLabel("Patient replacement binary document upload").setInputFiles({
          name: replacementFileName,
          mimeType: "application/pdf",
          buffer: replacementBytes
        });
        await expect(documentCard).toContainText(`${replacementFileName} selected`);
        await documentCard.getByLabel("Patient replacement binary document file name").fill(replacementFileName);
        await documentCard.getByLabel("Patient replacement binary document MIME type").fill("application/pdf");
        await documentCard.getByRole("button", { name: "Save Binary" }).click();
        await expect(documentCard).toContainText(replacementFileName);
        await expect(documentCard).toContainText("Inline PDF preview");
        await expect(documentCard).not.toContainText(originalFileName);
      }

      const replaced = await workflow.getPatientDocument(documentId);
      expect(replaced).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-18",
        mimetype: "application/pdf",
        storageMethod: "database",
        deleted: 0,
        contentBase64: replacementContentBase64
      });
      expect(replaced!.sizeBytes).toBe(replacementBytes.length);

      const replacedContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(replacedContent).not.toBeNull();
      expect(replacedContent).toMatchObject({
        name: documentName,
        mimetype: "application/pdf",
        storageMethod: "database",
        sizeBytes: replacementBytes.length,
        previewKind: "pdf",
        previewStatus: "Inline PDF preview",
        thumbnailLabel: "PDF",
        canPreviewInline: true,
        canDownload: true,
        versionLabel: "Version 1",
        versionStatus: "Current version",
        hasPriorVersions: false
      });
      expect(replacedContent!.contentBase64).toBe(replacementContentBase64);
      expect(replacedContent!.contentBase64).not.toBe(originalContentBase64);
      expect(replacedContent!.fileName).toBe(target.type === "legacy-openemr" ? documentName : replacementFileName);
      expect(replacedContent!.hash).not.toBe(createdHash);
      expect(replacedContent!.revisionHash).toBe(replacedContent!.hash);
      expect(timestampSeconds(replacedContent!.revisionAt)).toBeGreaterThanOrEqual(createdRevisionAt);

      const afterReplaceCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterReplaceCounts.documents).toBe(beforeCounts.documents + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, documentName);
      } else {
        const response = await page.request.get(`${target.apiBaseUrl}/api/documents/${documentId}/content`);
        expect(response.ok()).toBe(true);
        const apiDocument = await response.json() as Record<string, unknown>;
        expect(apiDocument).toMatchObject({
          name: documentName,
          fileName: replacementFileName,
          mimetype: "application/pdf",
          previewKind: "pdf",
          previewStatus: "Inline PDF preview",
          thumbnailLabel: "PDF",
          canPreviewInline: true,
          canDownload: true,
          revisionHash: replacedContent!.hash,
          hash: replacedContent!.hash
        });

        const download = await page.request.get(`${target.apiBaseUrl}/api/documents/${documentId}/download`);
        expect(download.ok()).toBe(true);
        expect(download.headers()["content-type"]).toContain("application/pdf");
        expect((await download.body()).toString("base64")).toBe(replacementContentBase64);

        const replacedCard = page.locator(".document-card").filter({ hasText: documentName }).first();
        await expect(replacedCard).toBeVisible();
        await expect(replacedCard).toContainText("Version 1 / Current version");
        await expect(replacedCard).toContainText("No prior versions");
        await expect(replacedCard).toContainText(replacementFileName);
        await expect(replacedCard).toContainText("PDF");
      }
    } finally {
      if (documentId !== null) {
        await workflow.deletePatientDocument(documentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.documents).toBe(beforeCounts.documents);
    if (documentId !== null) {
      await expect(workflow.getPatientDocument(documentId)).resolves.toBeNull();
    }
  });
});

function buildPdfFixtureBase64(fileName: string, marker: string) {
  const pdf = [
    "%PDF-1.4",
    "1 0 obj",
    "<< /Type /Catalog /Pages 2 0 R >>",
    "endobj",
    "2 0 obj",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "endobj",
    "3 0 obj",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >>",
    "endobj",
    "4 0 obj",
    `<< /Length ${fileName.length + marker.length + 96} >>`,
    "stream",
    `BT /F1 12 Tf 24 100 Td (${marker}) Tj ET`,
    `% ${fileName}`,
    "endstream",
    "endobj",
    "%%EOF",
    ""
  ].join("\n");

  return Buffer.from(pdf, "utf8").toString("base64");
}

function timestampSeconds(value: string | Date) {
  return Math.floor(new Date(value).getTime() / 1000);
}

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
