import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedDocuments } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const imageThumbnailAnchorPatientId = "MOD-PAT-0001";

test.describe("patient image document thumbnail parity @slice89 @workflow-document-image-thumbnail @mutation @documents", () => {
  test("creates, renders, thumbnails, archives, and removes an image patient document", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(imageThumbnailAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const fileName = `Parity Thumbnail Document ${suffix}.svg`;
    const contentBase64 = buildSvgFixtureBase64();
    const thumbnailDataUri = `data:image/svg+xml;base64,${contentBase64}`;
    let documentId: number | string | null = null;

    try {
      documentId = await workflow.createPatientBinaryDocument({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: fileName,
        docDate: "2026-06-18",
        encounter: 1000013,
        fileName,
        mimetype: "image/svg+xml",
        contentBase64,
        notes: "Created by the parity image document thumbnail suite."
      });

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: fileName,
        docDate: "2026-06-18",
        mimetype: "image/svg+xml",
        fileName,
        storageMethod: "database",
        deleted: 0,
        reviewStatus: "pending",
        contentBase64,
        thumbnailDataUri
      });

      const content = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(content).not.toBeNull();
      expect(content).toMatchObject({
        id: Number(documentId),
        name: fileName,
        mimetype: "image/svg+xml",
        fileName,
        storageMethod: "database",
        previewKind: "image",
        previewStatus: "Inline image preview",
        thumbnailLabel: "IMG",
        thumbnailText: fileName,
        thumbnailDataUri,
        canPreviewInline: true,
        canDownload: true,
        contentBase64,
        isBinary: true
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, fileName);
      } else {
        await openAuthenticatedModernizedDocuments(page, target, patient!.pubpid);

        const documentCard = page.locator(".document-card").filter({ hasText: fileName }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText("Inline image preview");
        await expect(documentCard).toContainText("image/svg+xml");

        const thumbnail = documentCard.getByRole("img", { name: `${fileName} thumbnail` });
        await expect(thumbnail).toBeVisible();
        await expect(thumbnail).toHaveAttribute("src", thumbnailDataUri);
      }

      await workflow.softDeletePatientDocument(documentId);
      const archived = await workflow.getPatientDocument(documentId);
      expect(archived).toMatchObject({
        deleted: 1
      });
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

function buildSvgFixtureBase64() {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64">',
    '<rect width="96" height="64" fill="#ffffff"/>',
    '<path d="M10 48l18-18 13 12 17-24 28 30H10z" fill="#32746d"/>',
    '<circle cx="72" cy="17" r="8" fill="#f2b84b"/>',
    '<text x="48" y="58" text-anchor="middle" font-family="Arial" font-size="8" fill="#1d2a35">THUMB</text>',
    "</svg>"
  ].join("");

  return Buffer.from(svg, "utf8").toString("base64");
}

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
