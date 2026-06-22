import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedDocuments } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const scannedAttachmentAnchorPatientId = "MOD-PAT-0001";

test.describe("patient scanned attachment parity @slice92 @workflow-document-scanned-attachment @mutation @documents", () => {
  test("creates, renders, verifies scan readiness, archives, and removes a scanned patient attachment", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(scannedAttachmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const fileName = `Parity Scanned Attachment ${suffix}.pdf`;
    const notes = "Scan source: front-desk scanner; OCR pending; Created by the parity scanned attachment suite.";
    const contentBase64 = buildScannedPdfFixtureBase64(fileName);
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
        notes
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
        isScannedAttachment: true,
        scanStatus: "Scanned attachment",
        captureSource: "front-desk scanner",
        scanPageCount: 1,
        ocrStatus: "OCR pending"
      });

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
        isScannedAttachment: true,
        scanStatus: "Scanned attachment",
        captureSource: "front-desk scanner",
        scanPageCount: 1,
        ocrStatus: "OCR pending"
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
        await expect(documentCard).toContainText("Scanned attachment");
        await expect(documentCard).toContainText("front-desk scanner");
        await expect(documentCard).toContainText("1 scanned page");
        await expect(documentCard).toContainText("OCR pending");

        await documentCard.getByRole("button", { name: "View" }).click();
        await expect(page.getByRole("heading", { name: "Document Viewer" })).toBeVisible();

        const viewer = page.getByLabel("Document viewer");
        await expect(viewer).toContainText(fileName);
        await expect(viewer).toContainText("Scanned attachment");
        await expect(viewer).toContainText("front-desk scanner");
        await expect(viewer).toContainText("1");
        await expect(viewer).toContainText("OCR pending");
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

function buildScannedPdfFixtureBase64(fileName: string) {
  const pdf = [
    "%PDF-1.4",
    "% Scanned attachment parity fixture",
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
    `<< /Length ${fileName.length + 88} >>`,
    "stream",
    "BT /F1 12 Tf 24 100 Td (OpenEMR parity scanned attachment document) Tj ET",
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
