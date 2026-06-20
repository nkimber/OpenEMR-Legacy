import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterDocumentContentAnchorPatientId = "MOD-PAT-0001";
const encounterDocumentContentEncounter = 1000013;
const encounterDocumentContentFromDate = "2026-01-01";

test.describe("encounter document content replacement parity @slice84 @workflow-encounter-document-content-replace @mutation", () => {
  test("creates, replaces, renders, verifies revision facts, and removes an encounter-attached document", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentContentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient!.pid,
      encounterDocumentContentEncounter
    );
    const suffix = workflowSuffix();
    const documentName = `Parity Encounter Replace Content Document ${suffix}`;
    const replacementFileName = `${documentName}.txt`;
    const originalBody = `Original encounter attachment payload for ${documentName}.`;
    const replacementBody = `Replacement encounter attachment payload for ${documentName}.`;
    const notes = "Created by the parity encounter document content replacement suite.";
    let documentId: number | string | null = null;

    try {
      documentId = await workflow.createEncounterDocument({
        patientId: patient!.pid,
        encounter: encounterDocumentContentEncounter,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-18",
        content: originalBody,
        notes
      });

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-18",
        encounter: encounterDocumentContentEncounter,
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0,
        reviewStatus: "pending",
        notes
      });
      expect(created!.contentPreview).toContain(originalBody);

      const createdContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(createdContent).not.toBeNull();
      expect(createdContent!.revisionHash).toBe(createdContent!.hash);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);
      const afterCreateEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient!.pid,
        encounterDocumentContentEncounter
      );
      expect(afterCreateEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);

      if (target.type === "legacy-openemr") {
        await workflow.replaceEncounterDocumentContent(encounterDocumentContentEncounter, documentId, {
          fileName: replacementFileName,
          content: replacementBody
        });
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Encounters" }).click();
        await expect(page.getByRole("heading", { name: "Encounters" })).toBeVisible();
        await page.getByLabel("Encounter patient ID").fill(patient!.pubpid);
        await page.getByLabel("Encounter from date").fill(encounterDocumentContentFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const attachments = page.getByRole("region", { name: "Encounter attached documents" });
        const documentCard = attachments.locator(".encounter-document-card").filter({ hasText: documentName }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText("Version 1");
        await documentCard.getByRole("button", { name: "Replace" }).click();
        await documentCard.getByLabel("Encounter replacement document file name").fill(replacementFileName);
        await documentCard.getByLabel("Encounter replacement document body").fill(replacementBody);
        await documentCard.getByRole("button", { name: "Save Content" }).click();
        await expect(documentCard).toContainText(replacementBody);
        await expect(documentCard).not.toContainText(originalBody);
      }

      const replaced = await workflow.getPatientDocument(documentId);
      expect(replaced).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-18",
        encounter: encounterDocumentContentEncounter,
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0,
        reviewStatus: "pending",
        notes
      });
      expect(replaced!.contentPreview).toContain(replacementBody);
      expect(replaced!.contentPreview).not.toContain(originalBody);

      const replacedContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(replacedContent).not.toBeNull();
      expect(replacedContent!.content).toContain(replacementBody);
      expect(replacedContent!.content).not.toContain(originalBody);
      expect(replacedContent!.fileName).toBe(target.type === "legacy-openemr" ? documentName : replacementFileName);
      expect(replacedContent!.revisionHash).toBe(replacedContent!.hash);
      expect(timestampSeconds(replacedContent!.revisionAt)).toBeGreaterThanOrEqual(
        timestampSeconds(createdContent!.revisionAt)
      );

      const afterReplaceCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterReplaceCounts.documents).toBe(beforeCounts.documents + 1);
      const afterReplaceEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient!.pid,
        encounterDocumentContentEncounter
      );
      expect(afterReplaceEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      const replacedEncounterDocument = afterReplaceEncounterDocuments.documents.find(
        (document) => document.id === Number(documentId)
      );
      expect(replacedEncounterDocument).toMatchObject({
        name: documentName,
        categoryName: "Medical Record",
        previewKind: "text",
        thumbnailLabel: "TXT",
        versionLabel: "Version 1",
        versionStatus: "Current version",
        revisionHash: replacedContent!.hash
      });
      expect(replacedEncounterDocument!.contentPreview).toContain(replacementBody);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, documentName);
      } else {
        const response = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterDocumentContentEncounter}`);
        expect(response.ok()).toBe(true);
        const payload = await response.json();
        const apiDocument = payload.documents.find((document: { id: number }) => document.id === Number(documentId));
        expect(apiDocument).toMatchObject({
          name: documentName,
          fileName: replacementFileName,
          previewKind: "text",
          thumbnailLabel: "TXT",
          versionLabel: "Version 1",
          versionStatus: "Current version",
          revisionHash: replacedContent!.hash
        });
        expect(apiDocument.contentPreview).toContain(replacementBody);

        const replacedCard = page
          .getByRole("region", { name: "Encounter attached documents" })
          .locator(".encounter-document-card")
          .filter({ hasText: documentName })
          .first();
        await expect(replacedCard).toBeVisible();
        await expect(replacedCard).toContainText("Version 1");
        await expect(replacedCard).toContainText("No prior versions");
        await expect(replacedCard).toContainText(replacementBody);
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
      encounterDocumentContentEncounter
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

function timestampSeconds(value: string) {
  return Math.floor(new Date(value).getTime() / 1000);
}
