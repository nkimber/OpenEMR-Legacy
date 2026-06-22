import { test, expect } from "../../src/fixtures/parityTest.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterDocumentSignoffAnchorPatientId = "MOD-PAT-0001";
const encounterDocumentSignoffAnchorEncounter = 1000013;
const encounterDocumentSignoffFromDate = "2026-01-01";

test.describe("encounter document sign-off parity @slice80 @workflow-encounter-document-signoff @mutation", () => {
  test("creates, signs, renders, deletes, and removes an encounter-attached document", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentSignoffAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient!.pid,
      encounterDocumentSignoffAnchorEncounter
    );
    const name = `Parity Encounter Signed Document ${workflowSuffix()}`;
    const body = `Created by the parity encounter document sign-off suite for ${name}.`;
    let documentId: number | string | null = null;

    try {
      documentId = await workflow.createEncounterDocument({
        patientId: patient!.pid,
        encounter: encounterDocumentSignoffAnchorEncounter,
        categoryId: 3,
        categoryName: "Medical Record",
        name,
        docDate: "2026-06-18",
        content: body,
        notes: "Created by the parity encounter document sign-off suite."
      });

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name,
        docDate: "2026-06-18",
        encounter: encounterDocumentSignoffAnchorEncounter,
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

      const afterCreateEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient!.pid,
        encounterDocumentSignoffAnchorEncounter
      );
      expect(afterCreateEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);

      await workflow.signEncounterDocument(encounterDocumentSignoffAnchorEncounter, documentId, "admin");

      const signed = await workflow.getPatientDocument(documentId);
      expect(signed).toMatchObject({
        reviewStatus: "approved",
        reviewedBy: "admin",
        deleted: 0
      });
      expect(signed!.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, name);
        await expectRenderedText(page, "Medical Record");
      } else {
        const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterDocumentSignoffAnchorEncounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
        expect(detailResponse.ok()).toBe(true);
        const detailPayload = await detailResponse.json();
        const apiDocument = detailPayload.documents.find((document: { name: string }) => document.name === name);
        expect(apiDocument).toMatchObject({
          categoryName: "Medical Record",
          reviewStatus: "approved",
          reviewedBy: "admin",
          previewKind: "text",
          thumbnailLabel: "TXT"
        });
        expect(apiDocument.reviewedAt).toBeTruthy();

        await openAuthenticatedModernizedEncounters(page, target, patient!.pubpid, encounterDocumentSignoffFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const attachments = page.getByRole("region", { name: "Encounter attached documents" });
        const documentCard = attachments.locator(".encounter-document-card").filter({ hasText: name }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText("approved");
        await expect(documentCard).toContainText("Reviewed by admin");
        await expect(documentCard.getByRole("button", { name: "Sign" })).toBeDisabled();
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
      encounterDocumentSignoffAnchorEncounter
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
