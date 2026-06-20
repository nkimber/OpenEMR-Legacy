import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterBinaryDocumentAnchorPatientId = "MOD-PAT-0001";
const encounterBinaryDocumentAnchorEncounter = 1000013;
const encounterBinaryDocumentFromDate = "2026-01-01";

test.describe("encounter binary document upload parity @slice79 @workflow-encounter-binary-documents @mutation", () => {
  test("creates, renders, downloads, deletes, and removes an encounter-attached binary document", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterBinaryDocumentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient!.pid,
      encounterBinaryDocumentAnchorEncounter
    );
    const suffix = workflowSuffix();
    const fileName = `Parity Encounter Binary Attachment ${suffix}.pdf`;
    const contentBase64 = buildPdfFixtureBase64(fileName);
    let documentId: number | string | null = null;

    try {
      documentId = await workflow.createEncounterBinaryDocument({
        patientId: patient!.pid,
        encounter: encounterBinaryDocumentAnchorEncounter,
        categoryId: 3,
        categoryName: "Medical Record",
        name: fileName,
        docDate: "2026-06-18",
        fileName,
        mimetype: "application/pdf",
        contentBase64,
        notes: "Created by the parity encounter binary document upload suite."
      });

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: fileName,
        docDate: "2026-06-18",
        encounter: encounterBinaryDocumentAnchorEncounter,
        mimetype: "application/pdf",
        fileName,
        storageMethod: "database",
        deleted: 0,
        contentBase64
      });
      expect(created!.sizeBytes).toBe(Buffer.from(contentBase64, "base64").length);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      const afterCreateEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient!.pid,
        encounterBinaryDocumentAnchorEncounter
      );
      expect(afterCreateEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      const attachedDocument = afterCreateEncounterDocuments.documents.find((document) => document.name === fileName);
      expect(attachedDocument).toMatchObject({
        categoryName: "Medical Record",
        encounter: encounterBinaryDocumentAnchorEncounter,
        mimetype: "application/pdf",
        fileName,
        previewKind: "pdf",
        previewStatus: "Inline PDF preview",
        thumbnailLabel: "PDF",
        canPreviewInline: true,
        canDownload: true
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, fileName);
        await expectRenderedText(page, "Medical Record");
      } else {
        const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterBinaryDocumentAnchorEncounter}`);
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
          canDownload: true
        });

        const download = await page.request.get(`${target.apiBaseUrl}/api/documents/${documentId}/download`);
        expect(download.ok()).toBe(true);
        expect(download.headers()["content-type"]).toContain("application/pdf");
        expect((await download.body()).toString("base64")).toBe(contentBase64);

        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Encounters" }).click();
        await expect(page.getByRole("heading", { name: "Encounters" })).toBeVisible();
        await page.getByLabel("Encounter patient ID").fill(patient!.pubpid);
        await page.getByLabel("Encounter from date").fill(encounterBinaryDocumentFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const attachments = page.getByRole("region", { name: "Encounter attached documents" });
        await expect(attachments).toContainText(fileName);
        await expect(attachments).toContainText("application/pdf");
        await expect(attachments).toContainText("Inline PDF preview");
        await expect(attachments).toContainText("PDF");
        await expect(attachments.locator('form[aria-label="Encounter binary document upload"]')).toBeVisible();
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
      encounterBinaryDocumentAnchorEncounter
    );
    expect(afterCleanupEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);
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
    `<< /Length ${fileName.length + 80} >>`,
    "stream",
    "BT /F1 12 Tf 24 100 Td (OpenEMR parity binary encounter document) Tj ET",
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
