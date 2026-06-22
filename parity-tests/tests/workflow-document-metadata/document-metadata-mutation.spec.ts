import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedDocuments } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const documentMetadataAnchorPatientId = "MOD-PAT-0001";

test.describe("patient document metadata parity @slice41 @workflow-document-metadata @mutation", () => {
  test("creates, refiles, renders, archives, and removes a patient document", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(documentMetadataAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const originalName = `Parity Metadata Document ${suffix}`;
    const updatedName = `Parity Refiled Directive ${suffix}`;
    const body = `Created by the parity document metadata suite for ${originalName}.`;
    const updatedNotes = "Updated by the parity document metadata suite.";
    let documentId: number | string | null = null;

    try {
      documentId = await workflow.createPatientDocument({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: originalName,
        docDate: "2026-06-18",
        encounter: 1000013,
        content: body,
        notes: "Created by the parity document metadata suite."
      });

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: originalName,
        docDate: "2026-06-18",
        encounter: 1000013,
        notes: "Created by the parity document metadata suite.",
        deleted: 0,
        reviewStatus: "pending"
      });
      expect(created!.contentPreview).toContain(body);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      if (target.type === "legacy-openemr") {
        await workflow.updatePatientDocumentMetadata(documentId, {
          categoryId: 6,
          categoryName: "Advance Directive",
          name: updatedName,
          docDate: "2026-06-19",
          encounter: 1000014,
          notes: updatedNotes
        });
      } else {
        await openAuthenticatedModernizedDocuments(page, target, patient!.pubpid);

        const originalCard = page.locator(".document-card").filter({ hasText: originalName }).first();
        await expect(originalCard).toBeVisible();
        await originalCard.getByRole("button", { name: "Edit" }).click();
        await originalCard.getByLabel("Document metadata name").fill(updatedName);
        await originalCard.getByLabel("Document metadata category").selectOption("6");
        await originalCard.getByLabel("Document metadata date").fill("2026-06-19");
        await originalCard.getByLabel("Document metadata encounter").fill("1000014");
        await originalCard.getByLabel("Document metadata notes").fill(updatedNotes);
        await originalCard.getByRole("button", { name: "Save Metadata" }).click();
        await expect(page.locator(".document-card").filter({ hasText: updatedName }).first()).toBeVisible();
      }

      const updated = await workflow.getPatientDocument(documentId);
      expect(updated).toMatchObject({
        patientId: patient!.pid,
        categoryId: 6,
        categoryName: "Advance Directive",
        name: updatedName,
        docDate: "2026-06-19",
        encounter: 1000014,
        notes: updatedNotes,
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0,
        reviewStatus: "pending"
      });
      expect(updated!.contentPreview).toContain(body);

      const afterUpdateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterUpdateCounts.documents).toBe(beforeCounts.documents + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Advance Directive"]);
        await expectRenderedText(page, updatedName);
        await expectRenderedText(page, "Advance Directive");
      } else {
        const updatedCard = page.locator(".document-card").filter({ hasText: updatedName }).first();
        await expect(updatedCard).toBeVisible();
        await expect(updatedCard).toContainText("Advance Directive");
        await expect(updatedCard).toContainText("2026-06-19");
        await expect(updatedCard).toContainText("Encounter 1000014");
        await expect(updatedCard).toContainText(updatedNotes);
        await updatedCard.getByRole("button", { name: "View" }).click();
        await expect(page.getByRole("heading", { name: "Document Viewer" })).toBeVisible();
        await expect(page.getByLabel("Document viewer")).toContainText(updatedName);
        await expect(page.getByLabel("Document viewer")).toContainText("Advance Directive");
        await expect(page.getByLabel("Document viewer")).toContainText(updatedNotes);
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

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
