import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterDocumentArchiveAnchorPatientId = "MOD-PAT-0001";
const encounterDocumentArchiveEncounter = 1000013;
const encounterDocumentArchiveFromDate = "2026-01-01";

test.describe("encounter document archive restore parity @slice85 @workflow-encounter-document-archive @mutation", () => {
  test("archives, hides, restores, renders, and removes an encounter-attached document", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentArchiveAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient!.pid,
      encounterDocumentArchiveEncounter
    );
    const suffix = workflowSuffix();
    const documentName = `Parity Encounter Archive Document ${suffix}`;
    const body = `Created by the parity encounter document archive restore suite for ${documentName}.`;
    const notes = "Created by the parity encounter document archive restore suite.";
    let documentId: number | string | null = null;

    try {
      documentId = await workflow.createEncounterDocument({
        patientId: patient!.pid,
        encounter: encounterDocumentArchiveEncounter,
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
        encounter: encounterDocumentArchiveEncounter,
        deleted: 0,
        reviewStatus: "pending",
        notes
      });
      expect(created!.contentPreview).toContain(body);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);
      const afterCreateEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient!.pid,
        encounterDocumentArchiveEncounter
      );
      expect(afterCreateEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);

      if (target.type === "legacy-openemr") {
        await workflow.softDeleteEncounterDocument(encounterDocumentArchiveEncounter, documentId);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Encounters" }).click();
        await expect(page.getByRole("heading", { name: "Encounters" })).toBeVisible();
        await page.getByLabel("Encounter patient ID").fill(patient!.pubpid);
        await page.getByLabel("Encounter from date").fill(encounterDocumentArchiveFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const attachments = page.getByRole("region", { name: "Encounter attached documents" });
        const documentCard = attachments.locator(".encounter-document-card").filter({ hasText: documentName }).first();
        await expect(documentCard).toBeVisible();
        await documentCard.getByRole("button", { name: "Archive" }).click();
        await expect(documentCard).toContainText("Archived");
        await expect(documentCard.getByRole("button", { name: "Restore" })).toBeVisible();
        await expect(attachments.getByLabel("Show archived attached documents")).toBeChecked();
      }

      const archived = await workflow.getPatientDocument(documentId);
      expect(archived).toMatchObject({
        deleted: 1,
        name: documentName,
        categoryName: "Medical Record",
        encounter: encounterDocumentArchiveEncounter
      });
      await expect(targetDb.getPatientDocumentContent(Number(documentId))).resolves.toBeNull();

      const afterArchiveCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterArchiveCounts.documents).toBe(beforeCounts.documents);
      const afterArchiveEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient!.pid,
        encounterDocumentArchiveEncounter
      );
      expect(afterArchiveEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);

      if (target.type === "legacy-openemr") {
        await workflow.restoreEncounterDocument(encounterDocumentArchiveEncounter, documentId);
      } else {
        const apiHiddenResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterDocumentArchiveEncounter}`);
        expect(apiHiddenResponse.ok()).toBe(true);
        const activePayload = await apiHiddenResponse.json();
        expect(activePayload.documents.find((document: { id: number }) => document.id === Number(documentId))).toBeUndefined();

        const apiArchivedResponse = await page.request.get(
          `${target.apiBaseUrl}/api/encounters/${encounterDocumentArchiveEncounter}?includeArchivedDocuments=true`
        );
        expect(apiArchivedResponse.ok()).toBe(true);
        const archivedPayload = await apiArchivedResponse.json();
        const apiArchivedDocument = archivedPayload.documents.find(
          (document: { id: number }) => document.id === Number(documentId)
        );
        expect(apiArchivedDocument).toMatchObject({
          name: documentName,
          deleted: 1,
          previewKind: "text",
          thumbnailLabel: "TXT"
        });

        const archivedCard = page
          .getByRole("region", { name: "Encounter attached documents" })
          .locator(".encounter-document-card")
          .filter({ hasText: documentName })
          .first();
        await archivedCard.getByRole("button", { name: "Restore" }).click();
        await expect(archivedCard).not.toContainText("Archived");
      }

      const restored = await workflow.getPatientDocument(documentId);
      expect(restored).toMatchObject({
        deleted: 0,
        name: documentName,
        categoryName: "Medical Record",
        encounter: encounterDocumentArchiveEncounter
      });
      expect(restored!.contentPreview).toContain(body);

      const afterRestoreCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterRestoreCounts.documents).toBe(beforeCounts.documents + 1);
      const afterRestoreEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient!.pid,
        encounterDocumentArchiveEncounter
      );
      expect(afterRestoreEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, documentName);
      } else {
        const restoredResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterDocumentArchiveEncounter}`);
        expect(restoredResponse.ok()).toBe(true);
        const restoredPayload = await restoredResponse.json();
        const apiRestoredDocument = restoredPayload.documents.find(
          (document: { id: number }) => document.id === Number(documentId)
        );
        expect(apiRestoredDocument).toMatchObject({
          name: documentName,
          deleted: 0,
          previewKind: "text",
          thumbnailLabel: "TXT"
        });

        const restoredCard = page
          .getByRole("region", { name: "Encounter attached documents" })
          .locator(".encounter-document-card")
          .filter({ hasText: documentName })
          .first();
        await expect(restoredCard).toBeVisible();
        await expect(restoredCard).not.toContainText("Archived");
        await expect(restoredCard).toContainText(body);
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
      encounterDocumentArchiveEncounter
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
