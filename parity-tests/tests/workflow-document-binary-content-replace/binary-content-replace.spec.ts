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

const binaryContentReplaceAnchorPatientId = "MOD-PAT-0001";

test.describe("patient binary document content replacement parity @slice128 @workflow-document-binary-content-replace @mutation @documents", () => {
  test("replaces the bytes, preview facts, revision hash, and download payload for a patient binary document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(binaryContentReplaceAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Missing seeded patient binary content replacement patient ${binaryContentReplaceAnchorPatientId}`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const suffix = workflowSuffix();
    const documentName = `Parity Patient Binary Replace Document ${suffix}`;
    const originalFileName = `${documentName} Original.pdf`;
    const replacementFileName = `${documentName} Replacement.pdf`;
    const originalContentBase64 = buildPdfFixtureBase64(originalFileName, "Original patient binary replacement payload");
    const replacementContentBase64 = buildPdfFixtureBase64(replacementFileName, "Replacement patient binary replacement payload");
    const originalBytes = Buffer.from(originalContentBase64, "base64");
    const replacementBytes = Buffer.from(replacementContentBase64, "base64");
    const originalDocumentInput = {
      patientId: patient.pid,
      categoryId: 3,
      categoryName: "Medical Record",
      name: documentName,
      docDate: "2026-06-18",
      encounter: 1000013,
      fileName: originalFileName,
      mimetype: "application/pdf",
      contentBase64: originalContentBase64,
      notes: "Created by the parity patient binary document content replacement suite."
    };
    const replacementInput = {
      fileName: replacementFileName,
      mimetype: "application/pdf",
      contentBase64: replacementContentBase64
    };
    let documentId: number | string | null = null;
    let created: Awaited<ReturnType<typeof workflow.getPatientDocument>> = null;
    let createdContent: Awaited<ReturnType<typeof targetDb.getPatientDocumentContent>> = null;
    let replaced: Awaited<ReturnType<typeof workflow.getPatientDocument>> = null;
    let replacedContent: Awaited<ReturnType<typeof targetDb.getPatientDocumentContent>> = null;
    let afterCreateCounts: Awaited<ReturnType<typeof targetDb.getPatientWorkflowCounts>> | null = null;
    let afterReplaceCounts: Awaited<ReturnType<typeof targetDb.getPatientWorkflowCounts>> | null = null;
    let surfaceFacts: Record<string, unknown> = {};

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-128-document-binary-content-replace-precondition",
        description:
          "Seeded patient, baseline document counts, proposed original patient PDF document, and replacement PDF payload before binary content replacement.",
        expected: {
          patientCanonicalId: binaryContentReplaceAnchorPatientId,
          categoryId: 3,
          categoryName: "Medical Record",
          encounter: 1000013,
          docDate: "2026-06-18",
          original: {
            fileName: originalFileName,
            mimetype: "application/pdf",
            sizeBytes: originalBytes.length,
            previewKind: "pdf",
            previewStatus: "Inline PDF preview"
          },
          replacement: {
            fileName: replacementFileName,
            mimetype: "application/pdf",
            sizeBytes: replacementBytes.length,
            previewKind: "pdf",
            previewStatus: "Inline PDF preview",
            contentChanges: true
          },
          countChange: {
            documentsAfterCreate: beforeCounts.documents + 1,
            documentsAfterReplace: beforeCounts.documents + 1,
            documentsAfterCleanup: beforeCounts.documents
          }
        },
        actual: {
          patient: {
            pid: patient.pid,
            pubpid: patient.pubpid,
            fname: patient.fname,
            lname: patient.lname
          },
          beforeCounts,
          proposedDocument: {
            ...originalDocumentInput,
            contentBase64Length: originalContentBase64.length,
            sizeBytes: originalBytes.length
          },
          proposedReplacement: {
            ...replacementInput,
            contentBase64Length: replacementContentBase64.length,
            sizeBytes: replacementBytes.length
          }
        }
      });

      documentId = await workflow.createPatientBinaryDocument(originalDocumentInput);

      created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-18",
        mimetype: "application/pdf",
        storageMethod: "database",
        deleted: 0,
        contentBase64: originalContentBase64
      });
      expect(created!.sizeBytes).toBe(originalBytes.length);

      createdContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(createdContent).not.toBeNull();
      expect(createdContent).toMatchObject({
        name: documentName,
        mimetype: "application/pdf",
        storageMethod: "database",
        previewKind: "pdf",
        previewStatus: "Inline PDF preview",
        thumbnailLabel: "PDF",
        canPreviewInline: true,
        canDownload: true,
        versionLabel: "Version 1",
        versionStatus: "Current version"
      });
      expect(createdContent!.contentBase64).toBe(originalContentBase64);
      expect(createdContent!.revisionHash).toBe(createdContent!.hash);
      expect(createdContent!.sizeBytes).toBe(originalBytes.length);
      const createdRevisionAt = timestampSeconds(createdContent!.revisionAt);
      const createdHash = createdContent!.hash;

      afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-128-document-binary-content-replace-created",
        description:
          "Temporary patient PDF document was created with original bytes, current-version revision facts, preview metadata, and active document count increment.",
        expected: {
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: documentName,
            docDate: "2026-06-18",
            encounter: 1000013,
            mimetype: "application/pdf",
            storageMethod: "database",
            deleted: 0,
            fileName: originalFileName,
            sizeBytes: originalBytes.length,
            contentBase64: originalContentBase64
          },
          content: {
            previewKind: "pdf",
            previewStatus: "Inline PDF preview",
            thumbnailLabel: "PDF",
            canPreviewInline: true,
            canDownload: true,
            versionLabel: "Version 1",
            versionStatus: "Current version",
            revisionHashEqualsHash: true
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
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.replacePatientDocumentBinaryContent(documentId, replacementInput);
      } else {
        await openAuthenticatedModernizedDocuments(page, target, patient.pubpid);

        const documentCard = page.locator(".document-card").filter({ hasText: documentName }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText(originalFileName);
        await documentCard.getByRole("button", { name: "Binary File" }).click();
        await documentCard.getByLabel("Patient replacement binary document upload").setInputFiles({
          name: replacementFileName,
          mimeType: "application/pdf",
          buffer: replacementBytes
        });
        await expect(documentCard).toContainText(`${replacementFileName} selected`);
        await documentCard.getByLabel("Patient replacement binary document file name").fill(replacementFileName);
        await documentCard.getByLabel("Patient replacement binary document MIME type").fill("application/pdf");
        await documentCard.getByRole("button", { name: "Save Binary" }).click();
        await expect(documentCard).toContainText(replacementFileName);
        await expect(documentCard).toContainText("Inline PDF preview");
        await expect(documentCard).not.toContainText(originalFileName);
        surfaceFacts = {
          modernizedReplacementForm: {
            searchPatientId: patient.pubpid,
            documentName,
            originalFileName,
            replacementFileName,
            renderedAfterSave: await documentCard.innerText()
          }
        };
      }

      replaced = await workflow.getPatientDocument(documentId);
      expect(replaced).toMatchObject({
        patientId: patient.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-18",
        mimetype: "application/pdf",
        storageMethod: "database",
        deleted: 0,
        contentBase64: replacementContentBase64
      });
      expect(replaced!.sizeBytes).toBe(replacementBytes.length);

      const replacedContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(replacedContent).not.toBeNull();
      expect(replacedContent).toMatchObject({
        name: documentName,
        mimetype: "application/pdf",
        storageMethod: "database",
        sizeBytes: replacementBytes.length,
        previewKind: "pdf",
        previewStatus: "Inline PDF preview",
        thumbnailLabel: "PDF",
        canPreviewInline: true,
        canDownload: true,
        versionLabel: "Version 1",
        versionStatus: "Current version",
        hasPriorVersions: false
      });
      expect(replacedContent!.contentBase64).toBe(replacementContentBase64);
      expect(replacedContent!.contentBase64).not.toBe(originalContentBase64);
      expect(replacedContent!.fileName).toBe(target.type === "legacy-openemr" ? documentName : replacementFileName);
      expect(replacedContent!.hash).not.toBe(createdHash);
      expect(replacedContent!.revisionHash).toBe(replacedContent!.hash);
      expect(timestampSeconds(replacedContent!.revisionAt)).toBeGreaterThanOrEqual(createdRevisionAt);

      afterReplaceCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterReplaceCounts.documents).toBe(beforeCounts.documents + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-128-document-binary-content-replace-replaced",
        description:
          "Temporary patient PDF document was replaced in place with new bytes, changed hash, preserved single-current-version facts, and stable active count.",
        expected: {
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: documentName,
            docDate: "2026-06-18",
            mimetype: "application/pdf",
            storageMethod: "database",
            deleted: 0,
            contentBase64: replacementContentBase64,
            sizeBytes: replacementBytes.length
          },
          content: {
            originalContentRemoved: true,
            hashChanged: true,
            revisionHashEqualsHash: true,
            revisionAtAfterOrEqualCreated: true,
            previewKind: "pdf",
            previewStatus: "Inline PDF preview",
            thumbnailLabel: "PDF",
            canPreviewInline: true,
            canDownload: true,
            versionLabel: "Version 1",
            versionStatus: "Current version",
            hasPriorVersions: false
          },
          counts: {
            documents: beforeCounts.documents + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterReplaceCounts,
          documentId,
          created,
          createdContent,
          createdHash,
          createdRevisionAt,
          replaced,
          replacedContent,
          replacementInput,
          surfaceFacts
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, documentName);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-128-document-binary-content-replace-surface",
          description:
            "Legacy Documents category rendering facts for the temporary patient binary replacement document after byte replacement.",
          expected: {
            category: "Medical Record",
            documentName,
            replacementFileName,
            mimetype: "application/pdf",
            sizeBytes: replacementBytes.length,
            renderedDocumentName: documentName
          },
          actual: {
            patient,
            documentId,
            replaced,
            replacedContent,
            surface: {
              application: "legacy-openemr",
              page: "patient-documents",
              patientPid: patient.pid,
              expandedCategory: "Medical Record",
              renderedDocumentName: documentName
            }
          }
        });
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const response = await page.request.get(`${target.apiBaseUrl}/api/documents/${documentId}/content`, {
          headers
        });
        expect(response.ok()).toBe(true);
        const apiDocument = await response.json() as Record<string, unknown>;
        expect(apiDocument).toMatchObject({
          name: documentName,
          fileName: replacementFileName,
          mimetype: "application/pdf",
          previewKind: "pdf",
          previewStatus: "Inline PDF preview",
          thumbnailLabel: "PDF",
          canPreviewInline: true,
          canDownload: true,
          revisionHash: replacedContent!.hash,
          hash: replacedContent!.hash
        });

        const download = await page.request.get(`${target.apiBaseUrl}/api/documents/${documentId}/download`, {
          headers
        });
        expect(download.ok()).toBe(true);
        expect(download.headers()["content-type"]).toContain("application/pdf");
        const downloadContentBase64 = (await download.body()).toString("base64");
        expect(downloadContentBase64).toBe(replacementContentBase64);

        const replacedCard = page.locator(".document-card").filter({ hasText: documentName }).first();
        await expect(replacedCard).toBeVisible();
        await expect(replacedCard).toContainText("Version 1 / Current version");
        await expect(replacedCard).toContainText("No prior versions");
        await expect(replacedCard).toContainText(replacementFileName);
        await expect(replacedCard).toContainText("PDF");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-128-document-binary-content-replace-surface",
          description:
            "Modernized patient document content API, byte-preserving download response, and Documents card anchors after binary content replacement.",
          expected: {
            apiDocument: {
              name: documentName,
              fileName: replacementFileName,
              mimetype: "application/pdf",
              previewKind: "pdf",
              previewStatus: "Inline PDF preview",
              thumbnailLabel: "PDF",
              canPreviewInline: true,
              canDownload: true,
              revisionHash: replacedContent!.hash,
              hash: replacedContent!.hash
            },
            download: {
              contentTypeIncludes: "application/pdf",
              contentBase64: replacementContentBase64
            },
            card: {
              versionText: "Version 1 / Current version",
              priorVersionText: "No prior versions",
              replacementFileName,
              thumbnailLabel: "PDF"
            }
          },
          actual: {
            patient,
            documentId,
            replaced,
            replacedContent,
            apiDocument,
            download: {
              contentType: download.headers()["content-type"],
              contentBase64: downloadContentBase64
            },
            surface: {
              application: "modernized-openemr",
              contentApi: `/api/documents/${documentId}/content`,
              downloadApi: `/api/documents/${documentId}/download`,
              page: "documents",
              searchPatientId: patient.pubpid,
              renderedCard: await replacedCard.innerText()
            }
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
    const afterCleanup = documentId !== null ? await workflow.getPatientDocument(documentId) : null;
    if (documentId !== null) {
      expect(afterCleanup).toBeNull();
    }
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-128-document-binary-content-replace-cleanup",
      description:
        "Temporary patient binary replacement document was hard-deleted and patient document counts returned to baseline.",
      expected: {
        documentDeleted: true,
        documentCountRestored: true
      },
      actual: {
        documentId,
        beforeCounts,
        afterCleanupCounts,
        afterCleanup
      }
    });
  });
});

function buildPdfFixtureBase64(fileName: string, marker: string) {
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
    `<< /Length ${fileName.length + marker.length + 96} >>`,
    "stream",
    `BT /F1 12 Tf 24 100 Td (${marker}) Tj ET`,
    `% ${fileName}`,
    "endstream",
    "endobj",
    "%%EOF",
    ""
  ].join("\n");

  return Buffer.from(pdf, "utf8").toString("base64");
}

function timestampSeconds(value: string | Date) {
  return Math.floor(new Date(value).getTime() / 1000);
}

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
