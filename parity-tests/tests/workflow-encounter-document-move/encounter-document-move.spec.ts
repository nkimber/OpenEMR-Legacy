import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterDocumentMoveAnchorPatientId = "MOD-PAT-0001";
const encounterDocumentMoveSourceEncounter = 1000013;
const encounterDocumentMoveTargetEncounter = 1000011;
const encounterDocumentMoveFromDate = "2026-01-01";

test.describe("encounter document move parity @slice83 @workflow-encounter-document-move @mutation", () => {
  test("creates, moves, renders, deletes, and removes an encounter-attached document", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentMoveAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeSourceDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient!.pid,
      encounterDocumentMoveSourceEncounter
    );
    const beforeTargetDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient!.pid,
      encounterDocumentMoveTargetEncounter
    );
    const suffix = workflowSuffix();
    const documentName = `Parity Encounter Moved Document ${suffix}`;
    const body = `Created by the parity encounter document move suite for ${documentName}.`;
    const notes = "Created by the parity encounter document move suite.";
    let documentId: number | string | null = null;

    try {
      documentId = await workflow.createEncounterDocument({
        patientId: patient!.pid,
        encounter: encounterDocumentMoveSourceEncounter,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-18",
        content: body,
        notes
      });

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-18",
        encounter: encounterDocumentMoveSourceEncounter,
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0,
        reviewStatus: "pending",
        notes
      });
      expect(created!.contentPreview).toContain(body);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      const afterCreateSourceDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient!.pid,
        encounterDocumentMoveSourceEncounter
      );
      const afterCreateTargetDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient!.pid,
        encounterDocumentMoveTargetEncounter
      );
      expect(afterCreateSourceDocuments.documents).toHaveLength(beforeSourceDocuments.documents.length + 1);
      expect(afterCreateSourceDocuments.documents.some((document) => document.id === Number(documentId))).toBe(true);
      expect(afterCreateTargetDocuments.documents).toHaveLength(beforeTargetDocuments.documents.length);
      expect(afterCreateTargetDocuments.documents.some((document) => document.id === Number(documentId))).toBe(false);

      if (target.type === "legacy-openemr") {
        await workflow.moveEncounterDocument(
          encounterDocumentMoveSourceEncounter,
          documentId,
          encounterDocumentMoveTargetEncounter
        );
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Encounters" }).click();
        await expect(page.getByRole("heading", { name: "Encounters" })).toBeVisible();
        await page.getByLabel("Encounter patient ID").fill(patient!.pubpid);
        await page.getByLabel("Encounter from date").fill(encounterDocumentMoveFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const attachments = page.getByRole("region", { name: "Encounter attached documents" });
        const originalCard = attachments.locator(".encounter-document-card").filter({ hasText: documentName }).first();
        await expect(originalCard).toBeVisible();
        await originalCard.getByRole("button", { name: "Move" }).click();
        const moveForm = originalCard.locator("form.document-edit-form").last();
        await moveForm.getByLabel("Encounter document move target encounter").fill(String(encounterDocumentMoveTargetEncounter));
        await moveForm.getByRole("button", { name: "Move" }).click();
        await expect(attachments.locator(".encounter-document-card").filter({ hasText: documentName }).first()).toBeVisible();
      }

      const moved = await workflow.getPatientDocument(documentId);
      expect(moved).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-18",
        encounter: encounterDocumentMoveTargetEncounter,
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0,
        reviewStatus: "pending",
        notes
      });
      expect(moved!.contentPreview).toContain(body);

      const afterMoveCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterMoveCounts.documents).toBe(beforeCounts.documents + 1);

      const afterMoveSourceDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient!.pid,
        encounterDocumentMoveSourceEncounter
      );
      const afterMoveTargetDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient!.pid,
        encounterDocumentMoveTargetEncounter
      );
      expect(afterMoveSourceDocuments.documents).toHaveLength(beforeSourceDocuments.documents.length);
      expect(afterMoveSourceDocuments.documents.some((document) => document.id === Number(documentId))).toBe(false);
      expect(afterMoveTargetDocuments.documents).toHaveLength(beforeTargetDocuments.documents.length + 1);
      expect(afterMoveTargetDocuments.documents.some((document) => document.id === Number(documentId))).toBe(true);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, documentName);
        await expectRenderedText(page, "Medical Record");
      } else {
        const sourceResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterDocumentMoveSourceEncounter}`);
        expect(sourceResponse.ok()).toBe(true);
        const sourcePayload = await sourceResponse.json();
        expect(sourcePayload.documents.some((document: { id: number }) => document.id === Number(documentId))).toBe(false);

        const targetResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterDocumentMoveTargetEncounter}`);
        expect(targetResponse.ok()).toBe(true);
        const targetPayload = await targetResponse.json();
        const apiDocument = targetPayload.documents.find((document: { id: number }) => document.id === Number(documentId));
        expect(apiDocument).toMatchObject({
          name: documentName,
          categoryName: "Medical Record",
          docDate: "2026-06-18",
          notes,
          reviewStatus: "pending",
          previewKind: "text",
          thumbnailLabel: "TXT"
        });

        const movedCard = page
          .getByRole("region", { name: "Encounter attached documents" })
          .locator(".encounter-document-card")
          .filter({ hasText: documentName })
          .first();
        await expect(movedCard).toBeVisible();
        await expect(movedCard).toContainText("Medical Record");
        await expect(movedCard).toContainText("2026-06-18");
        await expect(movedCard).toContainText(notes);
      }
    } finally {
      if (documentId !== null) {
        await workflow.deletePatientDocument(documentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.documents).toBe(beforeCounts.documents);
    const afterCleanupSourceDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient!.pid,
      encounterDocumentMoveSourceEncounter
    );
    const afterCleanupTargetDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient!.pid,
      encounterDocumentMoveTargetEncounter
    );
    expect(afterCleanupSourceDocuments.documents).toHaveLength(beforeSourceDocuments.documents.length);
    expect(afterCleanupTargetDocuments.documents).toHaveLength(beforeTargetDocuments.documents.length);
    if (documentId !== null) {
      await expect(workflow.getPatientDocument(documentId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
