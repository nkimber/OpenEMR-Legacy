import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  getModernizedAdminSessionHeaders,
  openAuthenticatedModernizedDocuments
} from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const pdfPreviewAnchorPatientId = "MOD-PAT-0001";

test.describe("patient PDF document inline preview parity @slice90 @workflow-document-pdf-preview @mutation @documents", () => {
  test("creates, previews, downloads, archives, and removes a PDF patient document", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(pdfPreviewAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const fileName = `Parity PDF Preview Document ${suffix}.pdf`;
    const contentBase64 = buildPdfFixtureBase64(fileName);
    let documentId: number | string | null = null;

    try {
      documentId = await workflow.createPatientBinaryDocument({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: fileName,
        docDate: "2026-06-20",
        encounter: 1000013,
        fileName,
        mimetype: "application/pdf",
        contentBase64,
        notes: "Created by the parity PDF inline preview suite."
      });

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: fileName,
        docDate: "2026-06-20",
        encounter: 1000013,
        mimetype: "application/pdf",
        fileName,
        storageMethod: "database",
        deleted: 0,
        contentBase64
      });
      expect(created!.sizeBytes).toBe(Buffer.from(contentBase64, "base64").length);

      const createdContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(createdContent).not.toBeNull();
      expect(createdContent).toMatchObject({
        id: Number(documentId),
        name: fileName,
        fileName,
        mimetype: "application/pdf",
        previewKind: "pdf",
        previewStatus: "Inline PDF preview",
        thumbnailLabel: "PDF",
        canPreviewInline: true,
        canDownload: true,
        contentBase64
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, fileName);
        await expectRenderedText(page, "Medical Record");
      } else {
        await openAuthenticatedModernizedDocuments(page, target, patient!.pubpid);

        const documentCard = page.locator(".document-card").filter({ hasText: fileName }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText("Inline PDF preview");
        await expect(documentCard).toContainText("PDF");

        await documentCard.getByRole("button", { name: "View" }).click();
        await expect(page.getByRole("heading", { name: "Document Viewer" })).toBeVisible();

        const viewer = page.getByLabel("Document viewer");
        await expect(viewer).toContainText(fileName);
        await expect(viewer).toContainText("Inline PDF preview");
        await expect(viewer).toContainText("application/pdf");
        await expect(viewer).toContainText("Binary document");

        const pdfFrame = viewer.locator("iframe.document-inline-pdf-preview");
        await expect(pdfFrame).toBeVisible();
        await expect(pdfFrame).toHaveAttribute("title", `${fileName} PDF preview`);
        await expect(pdfFrame).toHaveAttribute("src", `data:application/pdf;base64,${contentBase64}`);

        const download = await page.request.get(`${target.apiBaseUrl}/api/documents/${documentId}/download`, {
          headers: await getModernizedAdminSessionHeaders(page, target)
        });
        expect(download.ok()).toBe(true);
        expect(download.headers()["content-type"]).toContain("application/pdf");
        expect((await download.body()).toString("base64")).toBe(contentBase64);
      }

      await workflow.softDeletePatientDocument(documentId);
      const archived = await workflow.getPatientDocument(documentId);
      expect(archived).toMatchObject({ deleted: 1 });
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

function buildPdfFixtureBase64(fileName: string) {
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
    `<< /Length ${fileName.length + 78} >>`,
    "stream",
    "BT /F1 12 Tf 24 100 Td (OpenEMR parity PDF preview document) Tj ET",
    `% ${fileName}`,
    "endstream",
    "endobj",
    "%%EOF",
    ""
  ].join("\n");

  return Buffer.from(pdf, "utf8").toString("base64");
}

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
