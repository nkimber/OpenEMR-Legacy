import { test, expect } from "../../src/fixtures/parityTest.js";

const documentRevisionReplacementAnchorPatientId = "MOD-PAT-0001";

test.describe("patient document replacement revision parity @slice55 @workflow-document-revision-replace @mutation @documents", () => {
  test("content replacement updates the current document revision in place", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(documentRevisionReplacementAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const documentName = `Parity Revision Replace Document ${suffix}`;
    const replacementFileName = `${documentName}.txt`;
    const originalBody = `Original revision payload for ${documentName}.`;
    const replacementBody = `Replacement revision payload for ${documentName}.`;
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
        notes: "Created by the parity document revision replacement suite."
      });

      const createdContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(createdContent).not.toBeNull();
      expect(createdContent).toMatchObject({
        currentVersion: 1,
        versionLabel: "Version 1",
        versionStatus: "Current version",
        versionHistoryCount: 1,
        hasPriorVersions: false
      });
      expect(createdContent!.content).toContain(originalBody);
      expect(createdContent!.revisionHash).toBe(createdContent!.hash);

      await page.waitForTimeout(1100);

      await workflow.replacePatientDocumentContent(documentId, {
        fileName: replacementFileName,
        content: replacementBody
      });

      const replacedContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(replacedContent).not.toBeNull();
      expect(replacedContent).toMatchObject({
        id: Number(documentId),
        currentVersion: 1,
        versionLabel: "Version 1",
        versionStatus: "Current version",
        versionHistoryCount: 1,
        hasPriorVersions: false,
        mimetype: "text/plain",
        storageMethod: "database"
      });
      expect(replacedContent!.content).toContain(replacementBody);
      expect(replacedContent!.content).not.toContain(originalBody);
      expect(replacedContent!.hash).not.toBe(createdContent!.hash);
      expect(replacedContent!.revisionHash).toBe(replacedContent!.hash);
      expect(timestampSeconds(replacedContent!.revisionAt)).toBeGreaterThan(timestampSeconds(createdContent!.revisionAt));

      const afterReplaceCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterReplaceCounts.documents).toBe(beforeCounts.documents + 1);

      if (target.type !== "legacy-openemr") {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Documents" }).click();
        await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
        await page.getByLabel("Documents patient ID").fill(patient!.pubpid);

        const documentCard = page.locator(".document-card").filter({ hasText: documentName }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText(replacementBody);
        await expect(documentCard).toContainText("Version 1 / Current version");
        await expect(documentCard).toContainText("No prior versions");

        await documentCard.getByRole("button", { name: "View" }).click();
        await expect(page.getByRole("heading", { name: "Document Viewer" })).toBeVisible();
        const viewer = page.getByLabel("Document viewer");
        await expect(viewer).toContainText("Version 1");
        await expect(viewer).toContainText("1 current version");
        await expect(viewer).toContainText(replacementBody);
      }

      await workflow.softDeletePatientDocument(documentId);
      const archived = await workflow.getPatientDocument(documentId);
      expect(archived).toMatchObject({ deleted: 1 });
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

function timestampSeconds(value: string) {
  const [datePart, timePart = "00:00:00"] = value.trim().split(" ");
  const secondPart = timePart.split(".")[0];
  const parsed = Date.parse(`${datePart}T${secondPart}Z`);
  if (Number.isNaN(parsed)) {
    throw new Error(`Could not parse database timestamp: ${value}`);
  }

  return Math.floor(parsed / 1000);
}
