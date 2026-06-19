import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const documentContentReplacementAnchorPatientId = "MOD-PAT-0001";

test.describe("patient document content replacement parity @slice43 @workflow-document-content-replace @mutation", () => {
  test("creates, replaces, renders, archives, and removes a patient document payload", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(documentContentReplacementAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const documentName = `Parity Replace Content Document ${suffix}`;
    const replacementFileName = `${documentName}.txt`;
    const originalBody = `Original payload created by the parity document content replacement suite for ${documentName}.`;
    const replacementBody = `Replacement payload created by the parity document content replacement suite for ${documentName}.`;
    let documentId: number | string | null = null;

    try {
      documentId = await workflow.createPatientDocument({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-19",
        encounter: 1000013,
        content: originalBody,
        notes: "Created by the parity document content replacement suite."
      });

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-19",
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0
      });
      expect(created!.contentPreview).toContain(originalBody);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      if (target.type === "legacy-openemr") {
        await workflow.replacePatientDocumentContent(documentId, {
          fileName: replacementFileName,
          content: replacementBody
        });
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Documents" }).click();
        await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
        await page.getByLabel("Documents patient ID").fill(patient!.pubpid);

        const documentCard = page.locator(".document-card").filter({ hasText: documentName }).first();
        await expect(documentCard).toBeVisible();
        await documentCard.getByRole("button", { name: "Replace" }).click();
        await documentCard.getByLabel("Replacement document file name").fill(replacementFileName);
        await documentCard.getByLabel("Replacement document body").fill(replacementBody);
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
        docDate: "2026-06-19",
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0
      });
      expect(replaced!.contentPreview).toContain(replacementBody);
      expect(replaced!.contentPreview).not.toContain(originalBody);

      const replacedContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(replacedContent).not.toBeNull();
      expect(replacedContent!.isBinary).toBe(false);
      expect(replacedContent!.mimetype).toBe("text/plain");
      expect(replacedContent!.content).toContain(replacementBody);
      expect(replacedContent!.content).not.toContain(originalBody);

      const afterReplaceCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterReplaceCounts.documents).toBe(beforeCounts.documents + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, documentName);
      } else {
        const replacedCard = page.locator(".document-card").filter({ hasText: documentName }).first();
        await expect(replacedCard).toBeVisible();
        await replacedCard.getByRole("button", { name: "View" }).click();
        await expect(page.getByRole("heading", { name: "Document Viewer" })).toBeVisible();
        await expect(page.locator(".document-content-block")).toContainText(replacementBody);
        await expect(page.locator(".document-content-block")).not.toContainText(originalBody);
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
