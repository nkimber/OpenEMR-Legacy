import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterBinaryDocumentAnchorPatientId = "MOD-PAT-0001";
const encounterBinaryDocumentAnchorEncounter = 1000013;
const encounterBinaryDocumentFromDate = "2026-01-01";

test.describe("encounter binary document upload parity @slice79 @workflow-encounter-binary-documents @mutation", () => {
  test("creates, renders, downloads, deletes, and removes an encounter-attached binary document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterBinaryDocumentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (patient === null) {
      throw new Error(`Encounter binary document anchor patient ${encounterBinaryDocumentAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient.pid,
      encounterBinaryDocumentAnchorEncounter
    );
    const suffix = workflowSuffix();
    const fileName = `Parity Encounter Binary Attachment ${suffix}.pdf`;
    const contentBase64 = buildPdfFixtureBase64(fileName);
    const sizeBytes = Buffer.from(contentBase64, "base64").length;
    const documentInput = {
      patientId: patient.pid,
      encounter: encounterBinaryDocumentAnchorEncounter,
      categoryId: 3,
      categoryName: "Medical Record",
      name: fileName,
      docDate: "2026-06-18",
      fileName,
      mimetype: "application/pdf",
      contentBase64,
      notes: "Created by the parity encounter binary document upload suite."
    };
    let documentId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-79-encounter-binary-document-upload-precondition",
      description: "Captures the Slice 79 encounter binary document upload precondition: anchor patient, encounter-scoped document baseline, workflow counts, and proposed PDF payload metadata.",
      expected: {
        anchorCanonicalId: encounterBinaryDocumentAnchorPatientId,
        encounter: encounterBinaryDocumentAnchorEncounter,
        upload: {
          categoryId: 3,
          categoryName: "Medical Record",
          docDate: "2026-06-18",
          mimetype: "application/pdf",
          storageMethod: "database",
          previewKind: "pdf",
          previewStatus: "Inline PDF preview",
          thumbnailLabel: "PDF",
          canPreviewInline: true,
          canDownload: true,
          sizeBytes
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
          document: documentInput,
          sizeBytes
        }
      },
      context: {
        canonicalId: encounterBinaryDocumentAnchorPatientId,
        suite: "workflow-encounter-binary-documents",
        workflow: "encounter-binary-document-upload-precondition"
      }
    });

    try {
      documentId = await workflow.createEncounterBinaryDocument(documentInput);

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: fileName,
        docDate: "2026-06-18",
        encounter: encounterBinaryDocumentAnchorEncounter,
        mimetype: "application/pdf",
        fileName,
        storageMethod: "database",
        deleted: 0,
        contentBase64
      });
      if (created === null) {
        throw new Error(`Encounter binary document ${documentId} was not found after upload.`);
      }
      expect(created.sizeBytes).toBe(sizeBytes);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      const afterCreateEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterBinaryDocumentAnchorEncounter
      );
      expect(afterCreateEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      const attachedDocument = afterCreateEncounterDocuments.documents.find((document) => document.name === fileName);
      expect(attachedDocument).toMatchObject({
        categoryName: "Medical Record",
        encounter: encounterBinaryDocumentAnchorEncounter,
        mimetype: "application/pdf",
        fileName,
        previewKind: "pdf",
        previewStatus: "Inline PDF preview",
        thumbnailLabel: "PDF",
        canPreviewInline: true,
        canDownload: true
      });
      if (attachedDocument === undefined) {
        throw new Error(`Encounter-attached binary document ${fileName} was not found after upload.`);
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-79-encounter-binary-document-upload-created",
        description: "Captures the created Slice 79 encounter-attached PDF document, normalized document projection, binary metadata, encounter document list, and count increment.",
        expected: {
          counts: {
            documents: beforeCounts.documents + 1,
            encounterDocuments: beforeEncounterDocuments.documents.length + 1
          },
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: fileName,
            docDate: "2026-06-18",
            encounter: encounterBinaryDocumentAnchorEncounter,
            mimetype: "application/pdf",
            fileName,
            storageMethod: "database",
            deleted: 0,
            contentBase64,
            sizeBytes
          },
          encounterDocument: {
            categoryName: "Medical Record",
            encounter: encounterBinaryDocumentAnchorEncounter,
            mimetype: "application/pdf",
            fileName,
            previewKind: "pdf",
            previewStatus: "Inline PDF preview",
            thumbnailLabel: "PDF",
            canPreviewInline: true,
            canDownload: true
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
          sizeBytes,
          created,
          attachedDocument
        },
        context: {
          canonicalId: encounterBinaryDocumentAnchorPatientId,
          suite: "workflow-encounter-binary-documents",
          workflow: "encounter-binary-document-upload-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, fileName);
        await expectRenderedText(page, "Medical Record");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-79-encounter-binary-document-upload-surface",
          description: "Captures the Slice 79 legacy application-surface evidence for patient Documents category expansion after encounter PDF upload.",
          expected: {
            renderedDocumentName: fileName,
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
              renderedDocumentName: fileName,
              renderedCategoryName: "Medical Record"
            }
          },
          context: {
            canonicalId: encounterBinaryDocumentAnchorPatientId,
            suite: "workflow-encounter-binary-documents",
            workflow: "encounter-binary-document-upload-surface"
          }
        });
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterBinaryDocumentAnchorEncounter}`, { headers });
        expect(detailResponse.ok()).toBe(true);
        const detailPayload = await detailResponse.json();
        const apiDocument = detailPayload.documents.find((document: { name: string }) => document.name === fileName);
        expect(apiDocument).toMatchObject({
          categoryName: "Medical Record",
          mimetype: "application/pdf",
          previewKind: "pdf",
          previewStatus: "Inline PDF preview",
          thumbnailLabel: "PDF",
          canPreviewInline: true,
          canDownload: true
        });

        const download = await page.request.get(`${target.apiBaseUrl}/api/documents/${documentId}/download`, {
          headers
        });
        expect(download.ok()).toBe(true);
        const downloadContentType = download.headers()["content-type"];
        const downloadBodyBase64 = (await download.body()).toString("base64");
        expect(downloadContentType).toContain("application/pdf");
        expect(downloadBodyBase64).toBe(contentBase64);

        await openAuthenticatedModernizedEncounters(page, target, patient.pubpid, encounterBinaryDocumentFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const attachments = page.getByRole("region", { name: "Encounter attached documents" });
        await expect(attachments).toContainText(fileName);
        await expect(attachments).toContainText("application/pdf");
        await expect(attachments).toContainText("Inline PDF preview");
        await expect(attachments).toContainText("PDF");
        await expect(attachments.locator('form[aria-label="Encounter binary document upload"]')).toBeVisible();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-79-encounter-binary-document-upload-surface",
          description: "Captures the Slice 79 modernized API, download response, and Encounters workspace surface evidence for the uploaded encounter-attached PDF document.",
          expected: {
            apiDocument: {
              categoryName: "Medical Record",
              mimetype: "application/pdf",
              previewKind: "pdf",
              previewStatus: "Inline PDF preview",
              thumbnailLabel: "PDF",
              canPreviewInline: true,
              canDownload: true
            },
            download: {
              contentTypeIncludes: "application/pdf",
              bodyBase64: contentBase64
            },
            ui: {
              attachedDocumentsRegion: "Encounter attached documents",
              renderedDocumentName: fileName,
              renderedMimetype: "application/pdf",
              renderedPreviewLabel: "Inline PDF preview",
              renderedThumbnailLabel: "PDF",
              uploadFormAriaLabel: "Encounter binary document upload"
            }
          },
          actual: {
            patient,
            documentId,
            created,
            attachedDocument,
            apiDocument,
            download: {
              ok: download.ok(),
              contentType: downloadContentType,
              bodyBase64: downloadBodyBase64
            },
            modernizedSurface: {
              fromDate: encounterBinaryDocumentFromDate,
              selectedEncounterLabel: "Hyperlipidemia",
              attachedDocumentsRegion: "Encounter attached documents",
              renderedDocumentName: fileName,
              renderedMimetype: "application/pdf",
              renderedPreviewLabel: "Inline PDF preview",
              renderedThumbnailLabel: "PDF",
              uploadFormAriaLabel: "Encounter binary document upload"
            }
          },
          context: {
            canonicalId: encounterBinaryDocumentAnchorPatientId,
            suite: "workflow-encounter-binary-documents",
            workflow: "encounter-binary-document-upload-surface"
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
      encounterBinaryDocumentAnchorEncounter
    );
    expect(afterCleanupEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);
    const deletedDocument = documentId !== null ? await workflow.getPatientDocument(documentId) : null;
    if (documentId !== null) {
      expect(deletedDocument).toBeNull();
    }
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-79-encounter-binary-document-upload-cleanup",
      description: "Captures the final Slice 79 cleanup state after deleting the temporary encounter-attached PDF document.",
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
        canonicalId: encounterBinaryDocumentAnchorPatientId,
        suite: "workflow-encounter-binary-documents",
        workflow: "encounter-binary-document-upload-cleanup"
      }
    });
  });
});

function buildPdfFixtureBase64(fileName: string) {
  const pdf = [
    "%PDF-1.4",
    "1 0 obj",
    "<< /Type /Catalog /Pages 2 0 R >>",
    "endobj",
    "2 0 obj",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "endobj",
    "3 0 obj",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >>",
    "endobj",
    "4 0 obj",
    `<< /Length ${fileName.length + 80} >>`,
    "stream",
    "BT /F1 12 Tf 24 100 Td (OpenEMR parity binary encounter document) Tj ET",
    `% ${fileName}`,
    "endstream",
    "endobj",
    "%%EOF",
    ""
  ].join("\n");

  return Buffer.from(pdf, "utf8").toString("base64");
}

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
