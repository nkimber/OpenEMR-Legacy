import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const documentArchiveAnchorPatientId = "MOD-PAT-0001";

test.describe("patient document archive restore parity @slice42 @workflow-document-archive @mutation", () => {
  test("archives, hides, restores, renders, and removes a patient document", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(documentArchiveAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const documentName = `Parity Restorable Document ${suffix}`;
    const body = `Created by the parity document archive restore suite for ${documentName}.`;
    let documentId: number | string | null = null;

    try {
      documentId = await workflow.createPatientDocument({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-19",
        encounter: 1000013,
        content: body,
        notes: "Created by the parity document archive restore suite."
      });

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-19",
        deleted: 0,
        reviewStatus: "pending"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      if (target.type === "legacy-openemr") {
        await workflow.softDeletePatientDocument(documentId);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Documents" }).click();
        await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
        await page.getByLabel("Documents patient ID").fill(patient!.pubpid);
        await page.getByLabel("Show archived documents").check();

        const activeCard = page.locator(".document-card").filter({ hasText: documentName }).first();
        await expect(activeCard).toBeVisible();
        await activeCard.getByRole("button", { name: "Archive" }).click();
        await expect(activeCard).toContainText("Archived");
        await expect(activeCard.getByRole("button", { name: "Restore" })).toBeVisible();
      }

      const archived = await workflow.getPatientDocument(documentId);
      expect(archived).toMatchObject({
        deleted: 1,
        name: documentName,
        categoryName: "Medical Record"
      });
      await expect(targetDb.getPatientDocumentContent(Number(documentId))).resolves.toBeNull();

      const afterArchiveCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterArchiveCounts.documents).toBe(beforeCounts.documents);

      if (target.type === "legacy-openemr") {
        await workflow.restorePatientDocument(documentId);
      } else {
        const archivedCard = page.locator(".document-card").filter({ hasText: documentName }).first();
        await archivedCard.getByRole("button", { name: "Restore" }).click();
        await expect(archivedCard.getByRole("button", { name: "View" })).toBeEnabled();
      }

      const restored = await workflow.getPatientDocument(documentId);
      expect(restored).toMatchObject({
        deleted: 0,
        name: documentName,
        categoryName: "Medical Record"
      });
      expect(restored!.contentPreview).toContain(body);

      const afterRestoreCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterRestoreCounts.documents).toBe(beforeCounts.documents + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, documentName);
      } else {
        const restoredCard = page.locator(".document-card").filter({ hasText: documentName }).first();
        await expect(restoredCard).toBeVisible();
        await expect(restoredCard).not.toContainText("Archived");
        await restoredCard.getByRole("button", { name: "View" }).click();
        await expect(page.getByRole("heading", { name: "Document Viewer" })).toBeVisible();
        await expect(page.locator(".document-content-block")).toContainText(body);
      }
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
