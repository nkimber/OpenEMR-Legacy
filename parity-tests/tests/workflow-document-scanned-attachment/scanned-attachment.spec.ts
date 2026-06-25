import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedDocuments } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const scannedAttachmentAnchorPatientId = "MOD-PAT-0001";

test.describe("patient scanned attachment parity @slice92 @workflow-document-scanned-attachment @mutation @documents", () => {
  test("creates, renders, verifies scan readiness, archives, and removes a scanned patient attachment", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(scannedAttachmentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${scannedAttachmentAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const suffix = workflowSuffix();
    const fileName = `Parity Scanned Attachment ${suffix}.pdf`;
    const notes = "Scan source: front-desk scanner; OCR pending; Created by the parity scanned attachment suite.";
    const contentBase64 = buildScannedPdfFixtureBase64(fileName);
    const sizeBytes = Buffer.from(contentBase64, "base64").length;
    const scannedDocumentInput = {
      patientId: patient.pid,
      categoryId: 3,
      categoryName: "Medical Record",
      name: fileName,
      docDate: "2026-06-20",
      encounter: 1000013,
      fileName,
      mimetype: "application/pdf",
      contentBase64,
      notes
    };
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-92-document-scanned-attachment-precondition",
        description: "Captures the Slice 92 scanned patient attachment anchor patient, baseline document count, proposed scanned PDF payload, and expected scan-readiness metadata before create.",
        expected: {
          patient: {
            pubpid: scannedAttachmentAnchorPatientId,
            displayName: "Stone, Avery"
          },
          create: {
            categoryId: 3,
            categoryName: "Medical Record",
            docDate: "2026-06-20",
            encounter: 1000013,
            mimetype: "application/pdf",
            storageMethod: "database",
            previewKind: "pdf",
            previewStatus: "Inline PDF preview",
            thumbnailLabel: "PDF",
            isScannedAttachment: true,
            scanStatus: "Scanned attachment",
            captureSource: "front-desk scanner",
            scanPageCount: 1,
            ocrStatus: "OCR pending",
            deleted: 0
          },
          countChange: {
            documentsAfterCreate: beforeCounts.documents + 1,
            documentsAfterArchive: beforeCounts.documents,
            documentsAfterCleanup: beforeCounts.documents
          }
        },
        actual: {
          patient,
          beforeCounts,
          proposedDocument: {
            ...scannedDocumentInput,
            contentBase64Length: contentBase64.length,
            sizeBytes
          }
        },
        context: {
          canonicalId: scannedAttachmentAnchorPatientId,
          suite: "workflow-document-scanned-attachment",
          workflow: "patient-scanned-attachment"
        }
      });

      documentId = await workflow.createPatientBinaryDocument(scannedDocumentInput);

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: fileName,
        docDate: "2026-06-20",
        encounter: 1000013,
        mimetype: "application/pdf",
        fileName,
        storageMethod: "database",
        deleted: 0,
        isScannedAttachment: true,
        scanStatus: "Scanned attachment",
        captureSource: "front-desk scanner",
        scanPageCount: 1,
        ocrStatus: "OCR pending"
      });
      expect(created!.sizeBytes).toBe(sizeBytes);

      const createdContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(createdContent).not.toBeNull();
      expect(createdContent).toMatchObject({
        id: Number(documentId),
        name: fileName,
        fileName,
        mimetype: "application/pdf",
        previewKind: "pdf",
        previewStatus: "Inline PDF preview",
        thumbnailLabel: "PDF",
        isScannedAttachment: true,
        scanStatus: "Scanned attachment",
        captureSource: "front-desk scanner",
        scanPageCount: 1,
        ocrStatus: "OCR pending"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-92-document-scanned-attachment-created",
        description: "Captures the temporary Slice 92 scanned PDF document row, normalized scan-readiness content metadata, and active document-count increment immediately after create.",
        expected: {
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: fileName,
            docDate: "2026-06-20",
            encounter: 1000013,
            mimetype: "application/pdf",
            fileName,
            storageMethod: "database",
            deleted: 0,
            sizeBytes
          },
          scanReadiness: {
            previewKind: "pdf",
            previewStatus: "Inline PDF preview",
            thumbnailLabel: "PDF",
            isScannedAttachment: true,
            scanStatus: "Scanned attachment",
            captureSource: "front-desk scanner",
            scanPageCount: 1,
            ocrStatus: "OCR pending",
            contentBase64
          },
          counts: {
            documents: beforeCounts.documents + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          documentId,
          created,
          createdContent
        },
        context: {
          canonicalId: scannedAttachmentAnchorPatientId,
          suite: "workflow-document-scanned-attachment",
          workflow: "patient-scanned-attachment-created"
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
          probe: "slice-92-document-scanned-attachment-surface",
          description: "Captures the legacy Documents category rendering facts for the temporary Slice 92 scanned patient attachment.",
          expected: {
            category: "Medical Record",
            documentName: fileName,
            scanStatus: "Scanned attachment",
            captureSource: "front-desk scanner",
            scanPageCount: 1,
            ocrStatus: "OCR pending"
          },
          actual: {
            patient,
            documentId,
            created,
            createdContent,
            surface: {
              application: "legacy-openemr",
              page: "patient-documents",
              category: "Medical Record",
              renderedDocumentName: fileName
            }
          },
          context: {
            canonicalId: scannedAttachmentAnchorPatientId,
            suite: "workflow-document-scanned-attachment",
            workflow: "patient-scanned-attachment-legacy-surface"
          }
        });
      } else {
        await openAuthenticatedModernizedDocuments(page, target, patient.pubpid);

        const documentCard = page.locator(".document-card").filter({ hasText: fileName }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText("Scanned attachment");
        await expect(documentCard).toContainText("front-desk scanner");
        await expect(documentCard).toContainText("1 scanned page");
        await expect(documentCard).toContainText("OCR pending");

        await documentCard.getByRole("button", { name: "View" }).click();
        await expect(page.getByRole("heading", { name: "Document Viewer" })).toBeVisible();

        const viewer = page.getByLabel("Document viewer");
        await expect(viewer).toContainText(fileName);
        await expect(viewer).toContainText("Scanned attachment");
        await expect(viewer).toContainText("front-desk scanner");
        await expect(viewer).toContainText("1");
        await expect(viewer).toContainText("OCR pending");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-92-document-scanned-attachment-surface",
          description: "Captures the modernized Documents card/viewer scan-readiness UI anchors for the temporary Slice 92 scanned patient attachment.",
          expected: {
            card: {
              scanStatus: "Scanned attachment",
              captureSource: "front-desk scanner",
              scanPageCountText: "1 scanned page",
              ocrStatus: "OCR pending"
            },
            viewer: {
              heading: "Document Viewer",
              scanStatus: "Scanned attachment",
              captureSource: "front-desk scanner",
              ocrStatus: "OCR pending"
            }
          },
          actual: {
            patient,
            documentId,
            created,
            createdContent,
            surface: {
              application: "modernized-openemr",
              page: "documents",
              viewer: "Document viewer",
              renderedDocumentName: fileName
            }
          },
          context: {
            canonicalId: scannedAttachmentAnchorPatientId,
            suite: "workflow-document-scanned-attachment",
            workflow: "patient-scanned-attachment-modernized-surface"
          }
        });
      }

      await workflow.softDeletePatientDocument(documentId);
      const archived = await workflow.getPatientDocument(documentId);
      expect(archived).toMatchObject({ deleted: 1 });
      const afterArchiveCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterArchiveCounts.documents).toBe(beforeCounts.documents);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-92-document-scanned-attachment-archived",
        description: "Captures the temporary Slice 92 scanned PDF document after archive and active document-count return to baseline.",
        expected: {
          document: {
            patientId: patient.pid,
            mimetype: "application/pdf",
            storageMethod: "database",
            deleted: 1,
            isScannedAttachment: true,
            scanStatus: "Scanned attachment",
            captureSource: "front-desk scanner",
            scanPageCount: 1,
            ocrStatus: "OCR pending"
          },
          counts: {
            documents: beforeCounts.documents
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterArchiveCounts,
          documentId,
          created,
          archived
        },
        context: {
          canonicalId: scannedAttachmentAnchorPatientId,
          suite: "workflow-document-scanned-attachment",
          workflow: "patient-scanned-attachment-archived"
        }
      });
    } finally {
      if (documentId !== null) {
        await workflow.deletePatientDocument(documentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.documents).toBe(beforeCounts.documents);
    if (documentId !== null) {
      const afterCleanup = await workflow.getPatientDocument(documentId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-92-document-scanned-attachment-cleanup",
        description: "Captures the final Slice 92 hard-delete cleanup state for the temporary scanned patient attachment.",
        expected: {
          counts: {
            documents: beforeCounts.documents
          },
          deletedDocument: null
        },
        actual: {
          patient,
          beforeCounts,
          afterCleanupCounts,
          documentId,
          afterCleanup
        },
        context: {
          canonicalId: scannedAttachmentAnchorPatientId,
          suite: "workflow-document-scanned-attachment",
          workflow: "patient-scanned-attachment-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function buildScannedPdfFixtureBase64(fileName: string) {
  const pdf = [
    "%PDF-1.4",
    "% Scanned attachment parity fixture",
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
    `<< /Length ${fileName.length + 88} >>`,
    "stream",
    "BT /F1 12 Tf 24 100 Td (OpenEMR parity scanned attachment document) Tj ET",
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
