import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentUploadAnchorPatientId);
    expect(patient).not.toBeNull();
    if (patient === null) {
      throw new Error(`Encounter document upload anchor patient ${encounterDocumentUploadAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient.pid,
      encounterDocumentUploadAnchorEncounter
    );
    const suffix = workflowSuffix();
    const documentName = `Parity Encounter Attachment ${suffix}`;
    const documentContent = `Encounter-attached document content ${suffix}.`;
    const documentNotes = `Encounter attachment note ${suffix}.`;
    const documentInput = {
      patientId: patient.pid,
      encounter: encounterDocumentUploadAnchorEncounter,
      categoryId: 3,
      categoryName: "Medical Record",
      name: documentName,
      docDate: "2026-06-18",
      content: documentContent,
      notes: documentNotes
    };
    let documentId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-78-encounter-document-upload-precondition",
      description: "Captures the Slice 78 encounter document upload precondition: anchor patient, encounter-scoped document baseline, workflow counts, and proposed text document payload.",
      expected: {
        anchorCanonicalId: encounterDocumentUploadAnchorPatientId,
        encounter: encounterDocumentUploadAnchorEncounter,
        upload: {
          categoryId: 3,
          categoryName: "Medical Record",
          docDate: "2026-06-18",
          mimetype: "text/plain",
          storageMethod: "database",
          previewKind: "text",
          thumbnailLabel: "TXT"
        },
        countChange: {
          documentsAfterCreate: beforeCounts.documents + 1,
          documentsAfterCleanup: beforeCounts.documents,
          encounterDocumentsAfterCreate: beforeEncounterDocuments.documents.length + 1,
          encounterDocumentsAfterCleanup: beforeEncounterDocuments.documents.length
        }
      },
      actual: {
        patient,
        beforeCounts,
        beforeEncounterDocuments,
        proposed: {
          document: documentInput
        }
      },
      context: {
        canonicalId: encounterDocumentUploadAnchorPatientId,
        suite: "workflow-encounter-documents",
        workflow: "encounter-document-upload-precondition"
      }
    });

    try {
      documentId = await workflow.createEncounterDocument(documentInput);

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
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
      if (created === null) {
        throw new Error(`Encounter document ${documentId} was not found after upload.`);
      }
      expect(created.contentPreview).toContain(documentContent);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      const afterCreateEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
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
      if (attachedDocument === undefined) {
        throw new Error(`Encounter-attached document ${documentName} was not found after upload.`);
      }
      expect(attachedDocument.contentPreview).toContain(documentContent);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-78-encounter-document-upload-created",
        description: "Captures the created Slice 78 encounter-attached text document, normalized document projection, encounter document list, and count increment.",
        expected: {
          counts: {
            documents: beforeCounts.documents + 1,
            encounterDocuments: beforeEncounterDocuments.documents.length + 1
          },
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: documentName,
            docDate: "2026-06-18",
            encounter: encounterDocumentUploadAnchorEncounter,
            mimetype: "text/plain",
            storageMethod: "database",
            deleted: 0,
            notes: documentNotes,
            contentContains: documentContent
          },
          encounterDocument: {
            categoryName: "Medical Record",
            encounter: encounterDocumentUploadAnchorEncounter,
            previewKind: "text",
            thumbnailLabel: "TXT",
            contentContains: documentContent
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          beforeEncounterDocuments,
          afterCreateEncounterDocuments,
          documentId,
          documentInput,
          created,
          attachedDocument
        },
        context: {
          canonicalId: encounterDocumentUploadAnchorPatientId,
          suite: "workflow-encounter-documents",
          workflow: "encounter-document-upload-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, documentName);
        await expectRenderedText(page, "Medical Record");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-78-encounter-document-upload-surface",
          description: "Captures the Slice 78 legacy application-surface evidence for patient Documents category expansion after encounter document upload.",
          expected: {
            renderedDocumentName: documentName,
            renderedCategoryName: "Medical Record",
            page: "patient documents"
          },
          actual: {
            patient,
            documentId,
            created,
            attachedDocument,
            legacySurface: {
              page: "patient documents",
              expandedCategories: ["Medical Record"],
              renderedDocumentName: documentName,
              renderedCategoryName: "Medical Record"
            }
          },
          context: {
            canonicalId: encounterDocumentUploadAnchorPatientId,
            suite: "workflow-encounter-documents",
            workflow: "encounter-document-upload-surface"
          }
        });
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

        await openAuthenticatedModernizedEncounters(page, target, patient.pubpid, encounterDocumentUploadFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const attachments = page.getByRole("region", { name: "Encounter attached documents" });
        await expect(attachments).toContainText(documentName);
        await expect(attachments).toContainText(documentContent);
        await expect(attachments).toContainText("Inline text preview");
        await expect(attachments.locator('form[aria-label="Encounter document upload"]')).toBeVisible();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-78-encounter-document-upload-surface",
          description: "Captures the Slice 78 modernized API and Encounters workspace surface evidence for the uploaded encounter-attached text document.",
          expected: {
            apiDocument: {
              categoryName: "Medical Record",
              previewKind: "text",
              thumbnailLabel: "TXT"
            },
            ui: {
              attachedDocumentsRegion: "Encounter attached documents",
              renderedDocumentName: documentName,
              renderedContent: documentContent,
              renderedPreviewLabel: "Inline text preview",
              uploadFormAriaLabel: "Encounter document upload"
            }
          },
          actual: {
            patient,
            documentId,
            created,
            attachedDocument,
            apiDocument,
            modernizedSurface: {
              fromDate: encounterDocumentUploadFromDate,
              selectedEncounterLabel: "Hyperlipidemia",
              attachedDocumentsRegion: "Encounter attached documents",
              renderedDocumentName: documentName,
              renderedContent: documentContent,
              renderedPreviewLabel: "Inline text preview",
              uploadFormAriaLabel: "Encounter document upload"
            }
          },
          context: {
            canonicalId: encounterDocumentUploadAnchorPatientId,
            suite: "workflow-encounter-documents",
            workflow: "encounter-document-upload-surface"
          }
        });
      }
    } finally {
      if (documentId !== null) {
        await workflow.deletePatientDocument(documentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.documents).toBe(beforeCounts.documents);
    const afterCleanupEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient.pid,
      encounterDocumentUploadAnchorEncounter
    );
    expect(afterCleanupEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);
    const deletedDocument = documentId !== null ? await workflow.getPatientDocument(documentId) : null;
    if (documentId !== null) {
      expect(deletedDocument).toBeNull();
    }
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-78-encounter-document-upload-cleanup",
      description: "Captures the final Slice 78 cleanup state after deleting the temporary encounter-attached document.",
      expected: {
        counts: {
          documents: beforeCounts.documents,
          encounterDocuments: beforeEncounterDocuments.documents.length
        },
        deletedDocument: documentId === null ? null : { id: documentId, row: null }
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        beforeEncounterDocuments,
        afterCleanupEncounterDocuments,
        documentId,
        deletedDocument
      },
      context: {
        canonicalId: encounterDocumentUploadAnchorPatientId,
        suite: "workflow-encounter-documents",
        workflow: "encounter-document-upload-cleanup"
      }
    });
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
