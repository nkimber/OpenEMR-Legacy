import { test, expect } from "../../src/fixtures/parityTest.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterDocumentRevisionReplaceAnchorPatientId = "MOD-PAT-0001";
const encounterDocumentRevisionReplaceEncounter = 1000013;
const encounterDocumentRevisionReplaceFromDate = "2026-01-01";

test.describe("encounter document replacement revision parity @slice123 @workflow-encounter-document-revision-replace @mutation @documents", () => {
  test("replacement updates the current revision facts for an encounter-attached document", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentRevisionReplaceAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient!.pid,
      encounterDocumentRevisionReplaceEncounter
    );
    const suffix = workflowSuffix();
    const documentName = `Parity Encounter Revision Replace Document ${suffix}`;
    const replacementFileName = `${documentName}.txt`;
    const originalBody = `Original encounter revision payload for ${documentName}.`;
    const replacementBody = `Replacement encounter revision payload for ${documentName}.`;
    let documentId: number | string | null = null;

    try {
      documentId = await workflow.createEncounterDocument({
        patientId: patient!.pid,
        encounter: encounterDocumentRevisionReplaceEncounter,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-18",
        content: originalBody,
        notes: "Created by the encounter document replacement revision suite."
      });

      const createdContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(createdContent).not.toBeNull();
      expect(createdContent).toMatchObject({
        name: documentName,
        encounter: encounterDocumentRevisionReplaceEncounter,
        versionLabel: "Version 1",
        versionStatus: "Current version",
        versionHistoryCount: 1,
        hasPriorVersions: false
      });
      expect(createdContent!.content).toContain(originalBody);
      expect(createdContent!.revisionHash).toBe(createdContent!.hash);
      const createdRevisionAt = timestampSeconds(createdContent!.revisionAt);
      const createdHash = createdContent!.hash;

      if (target.type === "legacy-openemr") {
        await workflow.replaceEncounterDocumentContent(encounterDocumentRevisionReplaceEncounter, documentId, {
          fileName: replacementFileName,
          content: replacementBody
        });
      } else {
        await openAuthenticatedModernizedEncounters(page, target, patient!.pubpid, encounterDocumentRevisionReplaceFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const documentCard = page
          .getByRole("region", { name: "Encounter attached documents" })
          .locator(".encounter-document-card")
          .filter({ hasText: documentName })
          .first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText("Version 1 / Current version");
        await documentCard.getByRole("button", { name: "Replace" }).click();
        await documentCard.getByLabel("Encounter replacement document file name").fill(replacementFileName);
        await documentCard.getByLabel("Encounter replacement document body").fill(replacementBody);
        await documentCard.getByRole("button", { name: "Save Content" }).click();
        await expect(documentCard).toContainText(replacementBody);
        await expect(documentCard).not.toContainText(originalBody);
      }

      const replacedContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(replacedContent).not.toBeNull();
      expect(replacedContent).toMatchObject({
        name: documentName,
        encounter: encounterDocumentRevisionReplaceEncounter,
        versionLabel: "Version 1",
        versionStatus: "Current version",
        versionHistoryCount: 1,
        hasPriorVersions: false
      });
      expect(replacedContent!.content).toContain(replacementBody);
      expect(replacedContent!.content).not.toContain(originalBody);
      expect(replacedContent!.fileName).toBe(target.type === "legacy-openemr" ? documentName : replacementFileName);
      expect(replacedContent!.hash).not.toBe(createdHash);
      expect(replacedContent!.revisionHash).toBe(replacedContent!.hash);
      expect(timestampSeconds(replacedContent!.revisionAt)).toBeGreaterThanOrEqual(createdRevisionAt);

      const afterReplaceCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterReplaceCounts.documents).toBe(beforeCounts.documents + 1);
      const afterReplaceEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient!.pid,
        encounterDocumentRevisionReplaceEncounter
      );
      expect(afterReplaceEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      const replacedEncounterDocument = afterReplaceEncounterDocuments.documents.find(
        (document) => document.id === Number(documentId)
      );
      expect(replacedEncounterDocument).toMatchObject({
        name: documentName,
        categoryName: "Medical Record",
        versionLabel: "Version 1",
        versionStatus: "Current version",
        versionHistoryCount: 1,
        hasPriorVersions: false,
        revisionHash: replacedContent!.hash,
        hash: replacedContent!.hash
      });
      expect(replacedEncounterDocument!.contentPreview).toContain(replacementBody);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, documentName);
      } else {
        const response = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterDocumentRevisionReplaceEncounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
        expect(response.ok()).toBe(true);
        const payload = await response.json() as { documents: Array<Record<string, unknown>> };
        const apiDocument = payload.documents.find((document) => document.id === Number(documentId));
        expect(apiDocument).toMatchObject({
          name: documentName,
          fileName: replacementFileName,
          versionLabel: "Version 1",
          versionStatus: "Current version",
          versionHistoryCount: 1,
          hasPriorVersions: false,
          revisionHash: replacedContent!.hash,
          hash: replacedContent!.hash
        });
        expect(String(apiDocument!.contentPreview)).toContain(replacementBody);

        const replacedCard = page
          .getByRole("region", { name: "Encounter attached documents" })
          .locator(".encounter-document-card")
          .filter({ hasText: documentName })
          .first();
        await expect(replacedCard).toBeVisible();
        await expect(replacedCard).toContainText("Version 1 / Current version");
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
      encounterDocumentRevisionReplaceEncounter
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
  return Math.floor(new Date(value.replace(" ", "T")).getTime() / 1000);
}
