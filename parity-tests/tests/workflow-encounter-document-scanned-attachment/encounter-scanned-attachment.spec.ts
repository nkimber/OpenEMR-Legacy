import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterScannedAttachmentAnchorPatientId = "MOD-PAT-0001";
const encounterScannedAttachmentAnchorEncounter = 1000013;
const encounterScannedAttachmentFromDate = "2026-01-01";

test.describe("encounter scanned attachment parity @slice126 @workflow-encounter-document-scanned-attachment @mutation @documents", () => {
  test("creates, renders, verifies scan readiness, and removes an encounter-scoped scanned attachment", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterScannedAttachmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient!.pid,
      encounterScannedAttachmentAnchorEncounter
    );
    const suffix = workflowSuffix();
    const fileName = `Parity Encounter Scanned Attachment ${suffix}.pdf`;
    const notes = "Scan source: front-desk scanner; OCR pending; Created by the parity encounter scanned attachment suite.";
    const contentBase64 = buildScannedPdfFixtureBase64(fileName);
    let documentId: number | string | null = null;

    try {
      documentId = await workflow.createEncounterBinaryDocument({
        patientId: patient!.pid,
        encounter: encounterScannedAttachmentAnchorEncounter,
        categoryId: 3,
        categoryName: "Medical Record",
        name: fileName,
        docDate: "2026-06-20",
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
        encounter: encounterScannedAttachmentAnchorEncounter,
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

      const afterCreateEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient!.pid,
        encounterScannedAttachmentAnchorEncounter
      );
      expect(afterCreateEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      const attachedDocument = afterCreateEncounterDocuments.documents.find((document) => document.name === fileName);
      expect(attachedDocument).toMatchObject({
        categoryName: "Medical Record",
        encounter: encounterScannedAttachmentAnchorEncounter,
        mimetype: "application/pdf",
        fileName,
        previewKind: "pdf",
        previewStatus: "Inline PDF preview",
        thumbnailLabel: "PDF",
        canPreviewInline: true,
        canDownload: true,
        isScannedAttachment: true,
        scanStatus: "Scanned attachment",
        captureSource: "front-desk scanner",
        scanPageCount: 1,
        ocrStatus: "OCR pending"
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, fileName);
        await expectRenderedText(page, "Medical Record");
      } else {
        const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterScannedAttachmentAnchorEncounter}`);
        expect(detailResponse.ok()).toBe(true);
        const detailPayload = await detailResponse.json();
        const apiDocument = detailPayload.documents.find((document: { name: string }) => document.name === fileName);
        expect(apiDocument).toMatchObject({
          categoryName: "Medical Record",
          mimetype: "application/pdf",
          previewKind: "pdf",
          previewStatus: "Inline PDF preview",
          thumbnailLabel: "PDF",
          canPreviewInline: true,
          canDownload: true,
          isScannedAttachment: true,
          scanStatus: "Scanned attachment",
          captureSource: "front-desk scanner",
          scanPageCount: 1,
          ocrStatus: "OCR pending"
        });

        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Encounters" }).click();
        await expect(page.getByRole("heading", { name: "Encounters" })).toBeVisible();
        await page.getByLabel("Encounter patient ID").fill(patient!.pubpid);
        await page.getByLabel("Encounter from date").fill(encounterScannedAttachmentFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const attachments = page.getByRole("region", { name: "Encounter attached documents" });
        const documentCard = attachments.locator(".encounter-document-card").filter({ hasText: fileName }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText("Scanned attachment");
        await expect(documentCard).toContainText("front-desk scanner");
        await expect(documentCard).toContainText("1 scanned page");
        await expect(documentCard).toContainText("OCR pending");
      }
    } finally {
      if (documentId !== null) {
        await workflow.deletePatientDocument(documentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.documents).toBe(beforeCounts.documents);
    const afterCleanupEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient!.pid,
      encounterScannedAttachmentAnchorEncounter
    );
    expect(afterCleanupEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);
    if (documentId !== null) {
      await expect(workflow.getPatientDocument(documentId)).resolves.toBeNull();
    }
  });
});

function buildScannedPdfFixtureBase64(fileName: string) {
  const pdf = [
    "%PDF-1.4",
    "% Encounter scanned attachment parity fixture",
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
    `<< /Length ${fileName.length + 98} >>`,
    "stream",
    "BT /F1 12 Tf 24 100 Td (OpenEMR parity encounter scanned attachment document) Tj ET",
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
