import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const documentDenialAnchorPatientId = "MOD-PAT-0001";

test.describe("patient document denial parity @slice40 @workflow-document-denial @mutation", () => {
  test("creates, denies, renders, archives, and removes a reviewed patient document", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(documentDenialAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const name = `Parity Denied Document ${workflowSuffix()}`;
    const body = `Created by the parity document denial suite for ${name}.`;
    let documentId: number | string | null = null;

    try {
      documentId = await workflow.createPatientDocument({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name,
        docDate: "2026-06-18",
        encounter: 1000013,
        content: body,
        notes: "Created by the parity document denial suite."
      });

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name,
        docDate: "2026-06-18",
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0,
        reviewStatus: "pending",
        reviewedBy: "",
        reviewedAt: ""
      });
      expect(created!.contentPreview).toContain(body);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      await workflow.denyPatientDocument(documentId, "admin");

      const denied = await workflow.getPatientDocument(documentId);
      expect(denied).toMatchObject({
        reviewStatus: "denied",
        reviewedBy: "admin",
        deleted: 0
      });
      expect(denied!.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, name);
        await expectRenderedText(page, "Medical Record");
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Documents" }).click();
        await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
        await page.getByLabel("Documents patient ID").fill(patient!.pubpid);

        const documentCard = page.locator(".document-card").filter({ hasText: name }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText("denied");
        await expect(documentCard).toContainText("Reviewed by admin");
        await expect(documentCard.getByRole("button", { name: "Sign" })).toBeDisabled();
        await expect(documentCard.getByRole("button", { name: "Deny" })).toBeDisabled();
        await documentCard.getByRole("button", { name: "View" }).click();
        await expect(page.getByRole("heading", { name: "Document Viewer" })).toBeVisible();
        await expect(page.getByLabel("Document viewer")).toContainText("denied");
        await expect(page.getByLabel("Document viewer")).toContainText("admin");
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
