import { test, expect } from "../../src/fixtures/parityTest.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterDocumentUploadAnchorPatientId = "MOD-PAT-0001";
const encounterDocumentUploadAnchorEncounter = 1000013;
const encounterDocumentUploadFromDate = "2026-01-01";

test.describe("encounter document upload parity @slice78 @workflow-encounter-documents @mutation", () => {
  test("creates, renders, deletes, and removes an encounter-attached document", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentUploadAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient!.pid,
      encounterDocumentUploadAnchorEncounter
    );
    const suffix = workflowSuffix();
    const documentName = `Parity Encounter Attachment ${suffix}`;
    const documentContent = `Encounter-attached document content ${suffix}.`;
    const documentNotes = `Encounter attachment note ${suffix}.`;
    let documentId: number | string | null = null;

    try {
      documentId = await workflow.createEncounterDocument({
        patientId: patient!.pid,
        encounter: encounterDocumentUploadAnchorEncounter,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-18",
        content: documentContent,
        notes: documentNotes
      });

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-18",
        encounter: encounterDocumentUploadAnchorEncounter,
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0,
        notes: documentNotes
      });
      expect(created!.contentPreview).toContain(documentContent);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      const afterCreateEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient!.pid,
        encounterDocumentUploadAnchorEncounter
      );
      expect(afterCreateEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      const attachedDocument = afterCreateEncounterDocuments.documents.find((document) => document.name === documentName);
      expect(attachedDocument).toMatchObject({
        categoryName: "Medical Record",
        encounter: encounterDocumentUploadAnchorEncounter,
        previewKind: "text",
        thumbnailLabel: "TXT"
      });
      expect(attachedDocument!.contentPreview).toContain(documentContent);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, documentName);
        await expectRenderedText(page, "Medical Record");
      } else {
        const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterDocumentUploadAnchorEncounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
        expect(detailResponse.ok()).toBe(true);
        const detailPayload = await detailResponse.json();
        const apiDocument = detailPayload.documents.find((document: { name: string }) => document.name === documentName);
        expect(apiDocument).toMatchObject({
          categoryName: "Medical Record",
          previewKind: "text",
          thumbnailLabel: "TXT"
        });

        await openAuthenticatedModernizedEncounters(page, target, patient!.pubpid, encounterDocumentUploadFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const attachments = page.getByRole("region", { name: "Encounter attached documents" });
        await expect(attachments).toContainText(documentName);
        await expect(attachments).toContainText(documentContent);
        await expect(attachments).toContainText("Inline text preview");
        await expect(attachments.locator('form[aria-label="Encounter document upload"]')).toBeVisible();
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
      encounterDocumentUploadAnchorEncounter
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
