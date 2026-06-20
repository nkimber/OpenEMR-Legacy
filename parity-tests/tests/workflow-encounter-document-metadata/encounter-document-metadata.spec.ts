import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterDocumentMetadataAnchorPatientId = "MOD-PAT-0001";
const encounterDocumentMetadataAnchorEncounter = 1000013;
const encounterDocumentMetadataFromDate = "2026-01-01";

test.describe("encounter document metadata parity @slice82 @workflow-encounter-document-metadata @mutation", () => {
  test("creates, refiles, renders, deletes, and removes an encounter-attached document", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentMetadataAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient!.pid,
      encounterDocumentMetadataAnchorEncounter
    );
    const suffix = workflowSuffix();
    const originalName = `Parity Encounter Metadata Document ${suffix}`;
    const updatedName = `Parity Encounter Refiled Directive ${suffix}`;
    const body = `Created by the parity encounter document metadata suite for ${originalName}.`;
    const updatedNotes = "Updated by the parity encounter document metadata suite.";
    let documentId: number | string | null = null;

    try {
      documentId = await workflow.createEncounterDocument({
        patientId: patient!.pid,
        encounter: encounterDocumentMetadataAnchorEncounter,
        categoryId: 3,
        categoryName: "Medical Record",
        name: originalName,
        docDate: "2026-06-18",
        content: body,
        notes: "Created by the parity encounter document metadata suite."
      });

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: originalName,
        docDate: "2026-06-18",
        encounter: encounterDocumentMetadataAnchorEncounter,
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0,
        reviewStatus: "pending"
      });
      expect(created!.contentPreview).toContain(body);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      const afterCreateEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient!.pid,
        encounterDocumentMetadataAnchorEncounter
      );
      expect(afterCreateEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);

      if (target.type === "legacy-openemr") {
        await workflow.updateEncounterDocumentMetadata(encounterDocumentMetadataAnchorEncounter, documentId, {
          categoryId: 6,
          categoryName: "Advance Directive",
          name: updatedName,
          docDate: "2026-06-19",
          encounter: encounterDocumentMetadataAnchorEncounter,
          notes: updatedNotes
        });
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Encounters" }).click();
        await expect(page.getByRole("heading", { name: "Encounters" })).toBeVisible();
        await page.getByLabel("Encounter patient ID").fill(patient!.pubpid);
        await page.getByLabel("Encounter from date").fill(encounterDocumentMetadataFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const attachments = page.getByRole("region", { name: "Encounter attached documents" });
        const originalCard = attachments.locator(".encounter-document-card").filter({ hasText: originalName }).first();
        await expect(originalCard).toBeVisible();
        await originalCard.getByRole("button", { name: "Edit" }).click();
        await originalCard.getByLabel("Encounter document metadata name").fill(updatedName);
        await originalCard.getByLabel("Encounter document metadata category").selectOption("6");
        await originalCard.getByLabel("Encounter document metadata date").fill("2026-06-19");
        await expect(originalCard.getByLabel("Encounter document metadata encounter")).toHaveValue(
          String(encounterDocumentMetadataAnchorEncounter)
        );
        await originalCard.getByLabel("Encounter document metadata notes").fill(updatedNotes);
        await originalCard.getByRole("button", { name: "Save Metadata" }).click();
        await expect(attachments.locator(".encounter-document-card").filter({ hasText: updatedName }).first()).toBeVisible();
      }

      const updated = await workflow.getPatientDocument(documentId);
      expect(updated).toMatchObject({
        patientId: patient!.pid,
        categoryId: 6,
        categoryName: "Advance Directive",
        name: updatedName,
        docDate: "2026-06-19",
        encounter: encounterDocumentMetadataAnchorEncounter,
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0,
        reviewStatus: "pending",
        notes: updatedNotes
      });
      expect(updated!.contentPreview).toContain(body);

      const afterUpdateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterUpdateCounts.documents).toBe(beforeCounts.documents + 1);
      const afterUpdateEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient!.pid,
        encounterDocumentMetadataAnchorEncounter
      );
      expect(afterUpdateEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Advance Directive"]);
        await expectRenderedText(page, updatedName);
        await expectRenderedText(page, "Advance Directive");
      } else {
        const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterDocumentMetadataAnchorEncounter}`);
        expect(detailResponse.ok()).toBe(true);
        const detailPayload = await detailResponse.json();
        const apiDocument = detailPayload.documents.find((document: { name: string }) => document.name === updatedName);
        expect(apiDocument).toMatchObject({
          categoryName: "Advance Directive",
          docDate: "2026-06-19",
          notes: updatedNotes,
          reviewStatus: "pending",
          previewKind: "text",
          thumbnailLabel: "TXT"
        });

        const updatedCard = page
          .getByRole("region", { name: "Encounter attached documents" })
          .locator(".encounter-document-card")
          .filter({ hasText: updatedName })
          .first();
        await expect(updatedCard).toBeVisible();
        await expect(updatedCard).toContainText("Advance Directive");
        await expect(updatedCard).toContainText("2026-06-19");
        await expect(updatedCard).toContainText(updatedNotes);
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
      encounterDocumentMetadataAnchorEncounter
    );
    expect(afterCleanupEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);
    if (documentId !== null) {
      await expect(workflow.getPatientDocument(documentId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
