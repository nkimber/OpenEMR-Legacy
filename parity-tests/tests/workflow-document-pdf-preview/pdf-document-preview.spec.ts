import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  getModernizedAdminSessionHeaders,
  openAuthenticatedModernizedDocuments
} from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const pdfPreviewAnchorPatientId = "MOD-PAT-0001";

test.describe("patient PDF document inline preview parity @slice90 @workflow-document-pdf-preview @mutation @documents", () => {
  test("creates, previews, downloads, archives, and removes a PDF patient document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(pdfPreviewAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${pdfPreviewAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const suffix = workflowSuffix();
    const fileName = `Parity PDF Preview Document ${suffix}.pdf`;
    const contentBase64 = buildPdfFixtureBase64(fileName);
    const pdfDataUri = `data:application/pdf;base64,${contentBase64}`;
    const sizeBytes = Buffer.from(contentBase64, "base64").length;
    const pdfDocumentInput = {
      patientId: patient.pid,
      categoryId: 3,
      categoryName: "Medical Record",
      name: fileName,
      docDate: "2026-06-20",
      encounter: 1000013,
      fileName,
      mimetype: "application/pdf",
      contentBase64,
      notes: "Created by the parity PDF inline preview suite."
    };
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-90-document-pdf-preview-precondition",
        description: "Captures the Slice 90 PDF document anchor patient, baseline document count, proposed PDF binary payload, and expected inline PDF preview metadata before create.",
        expected: {
          patient: {
            pubpid: pdfPreviewAnchorPatientId,
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
            canPreviewInline: true,
            canDownload: true,
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
            ...pdfDocumentInput,
            contentBase64Length: contentBase64.length,
            sizeBytes,
            pdfDataUri
          }
        },
        context: {
          canonicalId: pdfPreviewAnchorPatientId,
          suite: "workflow-document-pdf-preview",
          workflow: "patient-document-pdf-preview"
        }
      });

      documentId = await workflow.createPatientBinaryDocument(pdfDocumentInput);

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
        contentBase64
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
        canPreviewInline: true,
        canDownload: true,
        contentBase64
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-90-document-pdf-preview-created",
        description: "Captures the temporary Slice 90 PDF document row, normalized inline PDF preview content metadata, and active document-count increment immediately after create.",
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
          preview: {
            previewKind: "pdf",
            previewStatus: "Inline PDF preview",
            thumbnailLabel: "PDF",
            canPreviewInline: true,
            canDownload: true,
            contentBase64,
            pdfDataUri
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
          canonicalId: pdfPreviewAnchorPatientId,
          suite: "workflow-document-pdf-preview",
          workflow: "patient-document-pdf-preview-created"
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
          probe: "slice-90-document-pdf-preview-surface",
          description: "Captures the legacy Documents category rendering facts for the temporary Slice 90 PDF document.",
          expected: {
            category: "Medical Record",
            documentName: fileName,
            mimetype: "application/pdf",
            previewKind: "pdf",
            previewStatus: "Inline PDF preview",
            thumbnailLabel: "PDF"
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
            canonicalId: pdfPreviewAnchorPatientId,
            suite: "workflow-document-pdf-preview",
            workflow: "patient-document-pdf-preview-legacy-surface"
          }
        });
      } else {
        await openAuthenticatedModernizedDocuments(page, target, patient.pubpid);

        const documentCard = page.locator(".document-card").filter({ hasText: fileName }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText("Inline PDF preview");
        await expect(documentCard).toContainText("PDF");

        await documentCard.getByRole("button", { name: "View" }).click();
        await expect(page.getByRole("heading", { name: "Document Viewer" })).toBeVisible();

        const viewer = page.getByLabel("Document viewer");
        await expect(viewer).toContainText(fileName);
        await expect(viewer).toContainText("Inline PDF preview");
        await expect(viewer).toContainText("application/pdf");
        await expect(viewer).toContainText("Binary document");

        const pdfFrame = viewer.locator("iframe.document-inline-pdf-preview");
        await expect(pdfFrame).toBeVisible();
        await expect(pdfFrame).toHaveAttribute("title", `${fileName} PDF preview`);
        await expect(pdfFrame).toHaveAttribute("src", pdfDataUri);

        const download = await page.request.get(`${target.apiBaseUrl}/api/documents/${documentId}/download`, {
          headers: await getModernizedAdminSessionHeaders(page, target)
        });
        expect(download.ok()).toBe(true);
        expect(download.headers()["content-type"]).toContain("application/pdf");
        const downloadContentBase64 = (await download.body()).toString("base64");
        expect(downloadContentBase64).toBe(contentBase64);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-90-document-pdf-preview-surface",
          description: "Captures the modernized Documents card/viewer inline PDF preview facts and byte-preserving download response for the temporary Slice 90 PDF document.",
          expected: {
            card: {
              previewStatus: "Inline PDF preview",
              thumbnailLabel: "PDF",
              mimetype: "application/pdf"
            },
            viewer: {
              heading: "Document Viewer",
              frameTitle: `${fileName} PDF preview`,
              frameSrc: pdfDataUri
            },
            download: {
              contentTypeIncludes: "application/pdf",
              contentBase64
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
              renderedDocumentName: fileName,
              pdfDataUri
            },
            download: {
              ok: download.ok(),
              contentType: download.headers()["content-type"],
              contentBase64: downloadContentBase64
            }
          },
          context: {
            canonicalId: pdfPreviewAnchorPatientId,
            suite: "workflow-document-pdf-preview",
            workflow: "patient-document-pdf-preview-modernized-surface"
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
        probe: "slice-90-document-pdf-preview-archived",
        description: "Captures the temporary Slice 90 PDF document after archive and active document-count return to baseline.",
        expected: {
          document: {
            patientId: patient.pid,
            mimetype: "application/pdf",
            storageMethod: "database",
            deleted: 1,
            contentBase64
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
          canonicalId: pdfPreviewAnchorPatientId,
          suite: "workflow-document-pdf-preview",
          workflow: "patient-document-pdf-preview-archived"
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
        probe: "slice-90-document-pdf-preview-cleanup",
        description: "Captures the final Slice 90 hard-delete cleanup state for the temporary PDF document.",
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
          canonicalId: pdfPreviewAnchorPatientId,
          suite: "workflow-document-pdf-preview",
          workflow: "patient-document-pdf-preview-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
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
    `<< /Length ${fileName.length + 78} >>`,
    "stream",
    "BT /F1 12 Tf 24 100 Td (OpenEMR parity PDF preview document) Tj ET",
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
