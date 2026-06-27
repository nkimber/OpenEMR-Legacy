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

const pdfThumbnailAnchorPatientId = "MOD-PAT-0001";

test.describe("patient PDF generated thumbnail parity @slice592 @workflow-document-pdf-thumbnail @mutation @documents", () => {
  test("creates, renders, thumbnails, archives, and removes a PDF patient document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(pdfThumbnailAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${pdfThumbnailAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const suffix = workflowSuffix();
    const fileName = `Parity PDF Thumbnail Document ${suffix}.pdf`;
    const contentBase64 = buildPdfFixtureBase64(fileName);
    const sizeBytes = Buffer.from(contentBase64, "base64").length;
    const pdfDocumentInput = {
      patientId: patient.pid,
      categoryId: 3,
      categoryName: "Medical Record",
      name: fileName,
      docDate: "2026-06-24",
      encounter: 1000013,
      fileName,
      mimetype: "application/pdf",
      contentBase64,
      notes: "Created by the parity PDF generated thumbnail suite."
    };
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-592-document-pdf-thumbnail-precondition",
        description: "Captures the Slice 592 PDF thumbnail anchor patient, baseline document count, and expected generated-thumbnail metadata before create.",
        expected: {
          patient: {
            pubpid: pdfThumbnailAnchorPatientId,
            displayName: "Stone, Avery"
          },
          create: {
            categoryId: 3,
            categoryName: "Medical Record",
            docDate: "2026-06-24",
            encounter: 1000013,
            mimetype: "application/pdf",
            storageMethod: "database",
            previewKind: "pdf",
            previewStatus: "Inline PDF preview",
            thumbnailLabel: "PDF",
            thumbnailDataUriPrefix: "data:image/svg+xml;base64,",
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
            sizeBytes
          }
        },
        context: {
          canonicalId: pdfThumbnailAnchorPatientId,
          suite: "workflow-document-pdf-thumbnail",
          workflow: "patient-document-pdf-thumbnail"
        }
      });

      documentId = await workflow.createPatientBinaryDocument(pdfDocumentInput);

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: fileName,
        docDate: "2026-06-24",
        encounter: 1000013,
        mimetype: "application/pdf",
        fileName,
        storageMethod: "database",
        deleted: 0,
        contentBase64,
        thumbnailDataUri: null
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
        probe: "slice-592-document-pdf-thumbnail-created",
        description: "Captures the temporary Slice 592 PDF row and normalized source facts immediately after create.",
        expected: {
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: fileName,
            docDate: "2026-06-24",
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
          canonicalId: pdfThumbnailAnchorPatientId,
          suite: "workflow-document-pdf-thumbnail",
          workflow: "patient-document-pdf-thumbnail-created"
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
          probe: "slice-592-document-pdf-thumbnail-surface",
          description: "Captures the legacy Documents category rendering facts for the temporary Slice 592 PDF document.",
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
            canonicalId: pdfThumbnailAnchorPatientId,
            suite: "workflow-document-pdf-thumbnail",
            workflow: "patient-document-pdf-thumbnail-legacy-surface"
          }
        });
      } else {
        await openAuthenticatedModernizedDocuments(page, target, patient.pubpid);

        const documentsResponse = await page.request.get(`${target.apiBaseUrl}/api/documents/${patient.pubpid}`, {
          headers: await getModernizedAdminSessionHeaders(page, target)
        });
        expect(documentsResponse.ok()).toBe(true);
        const documentsPayload = await documentsResponse.json() as {
          documents: Array<{
            id: number;
            name: string;
            previewKind: string;
            previewStatus: string;
            thumbnailLabel: string;
            thumbnailDataUri: string | null;
          }>;
        };
        const apiDocument = documentsPayload.documents.find((item) => item.id === Number(documentId));
        expect(apiDocument).toBeTruthy();
        expect(apiDocument).toMatchObject({
          name: fileName,
          previewKind: "pdf",
          previewStatus: "Inline PDF preview",
          thumbnailLabel: "PDF"
        });
        expect(apiDocument!.thumbnailDataUri).toMatch(/^data:image\/svg\+xml;base64,/);
        const decodedThumbnail = Buffer.from(apiDocument!.thumbnailDataUri!.split(",")[1], "base64").toString("utf8");
        expect(decodedThumbnail).toContain("Generated PDF thumbnail");
        expect(decodedThumbnail).toContain("PDF");
        expect(decodedThumbnail).toContain(fileName);

        const documentCard = page.locator(".document-card").filter({ hasText: fileName }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText("Inline PDF preview");
        await expect(documentCard).toContainText("PDF");

        const thumbnail = documentCard.getByRole("img", { name: `${fileName} thumbnail` });
        await expect(thumbnail).toBeVisible();
        await expect(thumbnail).toHaveAttribute("src", apiDocument!.thumbnailDataUri!);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-592-document-pdf-thumbnail-surface",
          description: "Captures the modernized Documents card generated SVG thumbnail facts for the temporary Slice 592 PDF document.",
          expected: {
            card: {
              previewStatus: "Inline PDF preview",
              thumbnailLabel: "PDF",
              mimetype: "application/pdf"
            },
            thumbnail: {
              accessibleName: `${fileName} thumbnail`,
              srcPrefix: "data:image/svg+xml;base64,",
              decodedContains: ["Generated PDF thumbnail", "PDF", fileName]
            }
          },
          actual: {
            patient,
            documentId,
            created,
            createdContent,
            apiDocument,
            thumbnail: {
              decodedThumbnail
            },
            surface: {
              application: "modernized-openemr",
              page: "documents",
              renderedDocumentName: fileName
            }
          },
          context: {
            canonicalId: pdfThumbnailAnchorPatientId,
            suite: "workflow-document-pdf-thumbnail",
            workflow: "patient-document-pdf-thumbnail-modernized-surface"
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
        probe: "slice-592-document-pdf-thumbnail-archived",
        description: "Captures the temporary Slice 592 PDF document after archive and active document-count return to baseline.",
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
          canonicalId: pdfThumbnailAnchorPatientId,
          suite: "workflow-document-pdf-thumbnail",
          workflow: "patient-document-pdf-thumbnail-archived"
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
        probe: "slice-592-document-pdf-thumbnail-cleanup",
        description: "Captures the final Slice 592 hard-delete cleanup state for the temporary PDF thumbnail document.",
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
          canonicalId: pdfThumbnailAnchorPatientId,
          suite: "workflow-document-pdf-thumbnail",
          workflow: "patient-document-pdf-thumbnail-cleanup"
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
    `<< /Length ${fileName.length + 82} >>`,
    "stream",
    "BT /F1 12 Tf 24 100 Td (OpenEMR parity PDF thumbnail document) Tj ET",
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
