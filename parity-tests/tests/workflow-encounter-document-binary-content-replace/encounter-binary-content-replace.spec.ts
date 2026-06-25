import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterBinaryContentReplaceAnchorPatientId = "MOD-PAT-0001";
const encounterBinaryContentReplaceEncounter = 1000013;
const encounterBinaryContentReplaceFromDate = "2026-01-01";

test.describe("encounter binary document content replacement parity @slice127 @workflow-encounter-document-binary-content-replace @mutation @documents", () => {
  test("replaces the bytes, preview facts, revision hash, and download payload for an encounter binary document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterBinaryContentReplaceAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Missing seeded encounter binary content replacement patient ${encounterBinaryContentReplaceAnchorPatientId}`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient.pid,
      encounterBinaryContentReplaceEncounter
    );
    const suffix = workflowSuffix();
    const documentName = `Parity Encounter Binary Replace Document ${suffix}`;
    const originalFileName = `${documentName} Original.pdf`;
    const replacementFileName = `${documentName} Replacement.pdf`;
    const originalContentBase64 = buildPdfFixtureBase64(originalFileName, "Original binary replacement payload");
    const replacementContentBase64 = buildPdfFixtureBase64(replacementFileName, "Replacement binary replacement payload");
    const originalBytes = Buffer.from(originalContentBase64, "base64");
    const replacementBytes = Buffer.from(replacementContentBase64, "base64");
    const originalDocumentInput = {
      patientId: patient.pid,
      encounter: encounterBinaryContentReplaceEncounter,
      categoryId: 3,
      categoryName: "Medical Record",
      name: documentName,
      docDate: "2026-06-18",
      fileName: originalFileName,
      mimetype: "application/pdf",
      contentBase64: originalContentBase64,
      notes: "Created by the parity encounter binary document content replacement suite."
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
    let afterReplaceEncounterDocuments: Awaited<ReturnType<typeof targetDb.getPatientDocumentsForEncounter>> | null = null;
    let replacedEncounterDocument: Record<string, unknown> | undefined;
    let surfaceFacts: Record<string, unknown> = {};

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-127-encounter-document-binary-content-replace-precondition",
        description:
          "Seeded patient, encounter document baseline, proposed original PDF attachment, and replacement PDF payload before binary content replacement.",
        expected: {
          patientCanonicalId: encounterBinaryContentReplaceAnchorPatientId,
          encounterId: encounterBinaryContentReplaceEncounter,
          categoryId: 3,
          categoryName: "Medical Record",
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
            encounterDocumentsAfterCreate: beforeEncounterDocuments.documents.length + 1,
            documentsAfterReplace: beforeCounts.documents + 1,
            encounterDocumentsAfterReplace: beforeEncounterDocuments.documents.length + 1,
            documentsAfterCleanup: beforeCounts.documents,
            encounterDocumentsAfterCleanup: beforeEncounterDocuments.documents.length
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
          beforeEncounterDocuments,
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

      documentId = await workflow.createEncounterBinaryDocument(originalDocumentInput);

      created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-18",
        encounter: encounterBinaryContentReplaceEncounter,
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
        encounter: encounterBinaryContentReplaceEncounter,
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
      const afterCreateEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterBinaryContentReplaceEncounter
      );
      expect(afterCreateEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-127-encounter-document-binary-content-replace-created",
        description:
          "Temporary encounter-scoped PDF attachment was created with original bytes, current-version revision facts, preview metadata, and active count increment.",
        expected: {
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: documentName,
            docDate: "2026-06-18",
            encounter: encounterBinaryContentReplaceEncounter,
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
            documents: beforeCounts.documents + 1,
            encounterDocuments: beforeEncounterDocuments.documents.length + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          beforeEncounterDocuments,
          afterCreateCounts,
          afterCreateEncounterDocuments,
          documentId,
          created,
          createdContent
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.replaceEncounterDocumentBinaryContent(encounterBinaryContentReplaceEncounter, documentId, {
          fileName: replacementFileName,
          mimetype: "application/pdf",
          contentBase64: replacementContentBase64
        });
      } else {
        await openAuthenticatedModernizedEncounters(page, target, patient!.pubpid, encounterBinaryContentReplaceFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const attachments = page.getByRole("region", { name: "Encounter attached documents" });
        const documentCard = attachments.locator(".encounter-document-card").filter({ hasText: documentName }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText(originalFileName);
        await documentCard.getByRole("button", { name: "Binary File" }).click();
        await documentCard.getByLabel("Encounter replacement binary document upload").setInputFiles({
          name: replacementFileName,
          mimeType: "application/pdf",
          buffer: replacementBytes
        });
        await expect(documentCard).toContainText(`${replacementFileName} selected`);
        await documentCard.getByLabel("Encounter replacement binary document file name").fill(replacementFileName);
        await documentCard.getByLabel("Encounter replacement binary document MIME type").fill("application/pdf");
        await documentCard.getByRole("button", { name: "Save Binary" }).click();
        await expect(documentCard).toContainText(replacementFileName);
        await expect(documentCard).toContainText("Inline PDF preview");
        await expect(documentCard).not.toContainText(originalFileName);
        surfaceFacts = {
          modernizedReplacementForm: {
            searchPatientId: patient.pubpid,
            fromDate: encounterBinaryContentReplaceFromDate,
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
        encounter: encounterBinaryContentReplaceEncounter,
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
        encounter: encounterBinaryContentReplaceEncounter,
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
      afterReplaceEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterBinaryContentReplaceEncounter
      );
      expect(afterReplaceEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      replacedEncounterDocument = afterReplaceEncounterDocuments.documents.find(
        (document) => document.id === Number(documentId)
      );
      expect(replacedEncounterDocument).toMatchObject({
        name: documentName,
        categoryName: "Medical Record",
        mimetype: "application/pdf",
        previewKind: "pdf",
        thumbnailLabel: "PDF",
        versionLabel: "Version 1",
        versionStatus: "Current version",
        revisionHash: replacedContent!.hash,
        hash: replacedContent!.hash,
        contentBase64: replacementContentBase64
      });
      expect(replacedEncounterDocument!.sizeBytes).toBe(replacementBytes.length);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-127-encounter-document-binary-content-replace-replaced",
        description:
          "Temporary encounter PDF attachment was replaced in place with new bytes, changed hash, preserved single-current-version facts, and stable encounter linkage.",
        expected: {
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: documentName,
            docDate: "2026-06-18",
            encounter: encounterBinaryContentReplaceEncounter,
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
            documents: beforeCounts.documents + 1,
            encounterDocuments: beforeEncounterDocuments.documents.length + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          beforeEncounterDocuments,
          afterReplaceCounts,
          afterReplaceEncounterDocuments,
          documentId,
          created,
          createdContent,
          createdHash,
          createdRevisionAt,
          replaced,
          replacedContent,
          replacedEncounterDocument,
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
          probe: "slice-127-encounter-document-binary-content-replace-surface",
          description:
            "Legacy Documents category rendering facts for the temporary encounter binary replacement document after byte replacement.",
          expected: {
            category: "Medical Record",
            documentName,
            encounterId: encounterBinaryContentReplaceEncounter,
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
            replacedEncounterDocument,
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
        const response = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterBinaryContentReplaceEncounter}`, { headers });
        expect(response.ok()).toBe(true);
        const payload = await response.json() as { documents: Array<Record<string, unknown>> };
        const apiDocument = payload.documents.find((document) => document.id === Number(documentId));
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

        const replacedCard = page
          .getByRole("region", { name: "Encounter attached documents" })
          .locator(".encounter-document-card")
          .filter({ hasText: documentName })
          .first();
        await expect(replacedCard).toBeVisible();
        await expect(replacedCard).toContainText("Version 1 / Current version");
        await expect(replacedCard).toContainText("No prior versions");
        await expect(replacedCard).toContainText(replacementFileName);
        await expect(replacedCard).toContainText("PDF");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-127-encounter-document-binary-content-replace-surface",
          description:
            "Modernized encounter-detail API, byte-preserving download response, and attached-document card anchors after binary content replacement.",
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
            replacedEncounterDocument,
            apiDocument,
            download: {
              contentType: download.headers()["content-type"],
              contentBase64: downloadContentBase64
            },
            surface: {
              application: "modernized-openemr",
              api: `/api/encounters/${encounterBinaryContentReplaceEncounter}`,
              downloadApi: `/api/documents/${documentId}/download`,
              page: "encounters",
              searchPatientId: patient.pubpid,
              fromDate: encounterBinaryContentReplaceFromDate,
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
    const afterCleanupEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient.pid,
      encounterBinaryContentReplaceEncounter
    );
    expect(afterCleanupEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);
    const afterCleanup = documentId !== null ? await workflow.getPatientDocument(documentId) : null;
    if (documentId !== null) {
      expect(afterCleanup).toBeNull();
    }
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-127-encounter-document-binary-content-replace-cleanup",
      description:
        "Temporary encounter binary replacement document was hard-deleted and patient/encounter document counts returned to baseline.",
      expected: {
        documentDeleted: true,
        documentCountRestored: true,
        encounterDocumentCountRestored: true
      },
      actual: {
        documentId,
        beforeCounts,
        afterCleanupCounts,
        beforeEncounterDocuments,
        afterCleanupEncounterDocuments,
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
