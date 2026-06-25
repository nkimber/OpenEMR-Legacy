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

const imageDocumentAnchorPatientId = "MOD-PAT-0001";

test.describe("patient image document preview parity @slice88 @workflow-document-image-preview @mutation @documents", () => {
  test("creates, renders, previews, downloads, archives, and removes an image patient document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(imageDocumentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${imageDocumentAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const suffix = workflowSuffix();
    const fileName = `Parity Image Document ${suffix}.svg`;
    const contentBase64 = buildSvgFixtureBase64();
    const imageDataUri = `data:image/svg+xml;base64,${contentBase64}`;
    const sizeBytes = Buffer.from(contentBase64, "base64").length;
    const imageDocumentInput = {
      patientId: patient.pid,
      categoryId: 3,
      categoryName: "Medical Record",
      name: fileName,
      docDate: "2026-06-18",
      encounter: 1000013,
      fileName,
      mimetype: "image/svg+xml",
      contentBase64,
      notes: "Created by the parity image document preview suite."
    };
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-88-document-image-preview-precondition",
        description: "Captures the Slice 88 image document anchor patient, baseline document count, proposed SVG binary payload, and expected inline preview metadata before create.",
        expected: {
          patient: {
            pubpid: imageDocumentAnchorPatientId,
            displayName: "Stone, Avery"
          },
          create: {
            categoryId: 3,
            categoryName: "Medical Record",
            docDate: "2026-06-18",
            encounter: 1000013,
            mimetype: "image/svg+xml",
            storageMethod: "database",
            previewKind: "image",
            previewStatus: "Inline image preview",
            thumbnailLabel: "IMG",
            canPreviewInline: true,
            canDownload: true,
            deleted: 0,
            reviewStatus: "pending"
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
            ...imageDocumentInput,
            contentBase64Length: contentBase64.length,
            sizeBytes
          }
        },
        context: {
          canonicalId: imageDocumentAnchorPatientId,
          suite: "workflow-document-image-preview",
          workflow: "patient-document-image-preview"
        }
      });

      documentId = await workflow.createPatientBinaryDocument(imageDocumentInput);

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: fileName,
        docDate: "2026-06-18",
        mimetype: "image/svg+xml",
        fileName,
        storageMethod: "database",
        deleted: 0,
        reviewStatus: "pending",
        contentBase64
      });
      expect(created!.sizeBytes).toBe(sizeBytes);

      const content = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(content).not.toBeNull();
      expect(content).toMatchObject({
        id: Number(documentId),
        name: fileName,
        mimetype: "image/svg+xml",
        fileName,
        storageMethod: "database",
        previewKind: "image",
        previewStatus: "Inline image preview",
        thumbnailLabel: "IMG",
        thumbnailText: fileName,
        canPreviewInline: true,
        canDownload: true,
        contentBase64,
        isBinary: true
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-88-document-image-preview-created",
        description: "Captures the temporary Slice 88 SVG image document row, normalized inline-preview content metadata, and active document-count increment immediately after create.",
        expected: {
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: fileName,
            docDate: "2026-06-18",
            encounter: 1000013,
            mimetype: "image/svg+xml",
            fileName,
            storageMethod: "database",
            deleted: 0,
            reviewStatus: "pending",
            sizeBytes
          },
          preview: {
            previewKind: "image",
            previewStatus: "Inline image preview",
            thumbnailLabel: "IMG",
            thumbnailText: fileName,
            canPreviewInline: true,
            canDownload: true,
            contentBase64,
            imageDataUri
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
          content
        },
        context: {
          canonicalId: imageDocumentAnchorPatientId,
          suite: "workflow-document-image-preview",
          workflow: "patient-document-image-preview-created"
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
          probe: "slice-88-document-image-preview-surface",
          description: "Captures the legacy Documents category rendering facts for the temporary Slice 88 SVG image document.",
          expected: {
            category: "Medical Record",
            documentName: fileName,
            mimetype: "image/svg+xml",
            previewKind: "image",
            previewStatus: "Inline image preview"
          },
          actual: {
            patient,
            documentId,
            created,
            content,
            surface: {
              application: "legacy-openemr",
              page: "patient-documents",
              category: "Medical Record",
              renderedDocumentName: fileName
            }
          },
          context: {
            canonicalId: imageDocumentAnchorPatientId,
            suite: "workflow-document-image-preview",
            workflow: "patient-document-image-preview-legacy-surface"
          }
        });
      } else {
        await openAuthenticatedModernizedDocuments(page, target, patient.pubpid);

        const documentCard = page.locator(".document-card").filter({ hasText: fileName }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText("Inline image preview");
        await expect(documentCard).toContainText("IMG");
        await expect(documentCard).toContainText("image/svg+xml");

        await documentCard.getByRole("button", { name: "View" }).click();
        await expect(page.getByRole("heading", { name: "Document Viewer" })).toBeVisible();
        const viewer = page.getByLabel("Document viewer");
        await expect(viewer).toContainText(fileName);
        await expect(viewer).toContainText("image/svg+xml");
        await expect(viewer).toContainText("Inline image preview");
        const previewImage = viewer.getByRole("img", { name: fileName });
        await expect(previewImage).toBeVisible();
        await expect(previewImage).toHaveAttribute("src", imageDataUri);

        const download = await page.request.get(`${target.apiBaseUrl}/api/documents/${documentId}/download`, {
          headers: await getModernizedAdminSessionHeaders(page, target)
        });
        expect(download.ok()).toBe(true);
        expect(download.headers()["content-type"]).toContain("image/svg+xml");
        const downloadContentBase64 = (await download.body()).toString("base64");
        expect(downloadContentBase64).toBe(contentBase64);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-88-document-image-preview-surface",
          description: "Captures the modernized Documents card/viewer inline image preview facts and byte-preserving download response for the temporary Slice 88 SVG image document.",
          expected: {
            card: {
              previewStatus: "Inline image preview",
              thumbnailLabel: "IMG",
              mimetype: "image/svg+xml"
            },
            viewer: {
              heading: "Document Viewer",
              imageAccessibleName: fileName,
              imageSrc: imageDataUri
            },
            download: {
              contentTypeIncludes: "image/svg+xml",
              contentBase64
            }
          },
          actual: {
            patient,
            documentId,
            created,
            content,
            surface: {
              application: "modernized-openemr",
              page: "documents",
              viewer: "Document viewer",
              renderedDocumentName: fileName,
              imageDataUri
            },
            download: {
              ok: download.ok(),
              contentType: download.headers()["content-type"],
              contentBase64: downloadContentBase64
            }
          },
          context: {
            canonicalId: imageDocumentAnchorPatientId,
            suite: "workflow-document-image-preview",
            workflow: "patient-document-image-preview-modernized-surface"
          }
        });
      }

      await workflow.softDeletePatientDocument(documentId);
      const archived = await workflow.getPatientDocument(documentId);
      expect(archived).toMatchObject({
        deleted: 1
      });
      const afterArchiveCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterArchiveCounts.documents).toBe(beforeCounts.documents);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-88-document-image-preview-archived",
        description: "Captures the temporary Slice 88 SVG image document after archive and active document-count return to baseline.",
        expected: {
          document: {
            patientId: patient.pid,
            mimetype: "image/svg+xml",
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
          canonicalId: imageDocumentAnchorPatientId,
          suite: "workflow-document-image-preview",
          workflow: "patient-document-image-preview-archived"
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
        probe: "slice-88-document-image-preview-cleanup",
        description: "Captures the final Slice 88 hard-delete cleanup state for the temporary SVG image document.",
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
          canonicalId: imageDocumentAnchorPatientId,
          suite: "workflow-document-image-preview",
          workflow: "patient-document-image-preview-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function buildSvgFixtureBase64() {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64" viewBox="0 0 96 64">',
    '<rect width="96" height="64" fill="#ffffff"/>',
    '<path d="M10 48l18-18 13 12 17-24 28 30H10z" fill="#32746d"/>',
    '<circle cx="72" cy="17" r="8" fill="#f2b84b"/>',
    "</svg>"
  ].join("");

  return Buffer.from(svg, "utf8").toString("base64");
}

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
