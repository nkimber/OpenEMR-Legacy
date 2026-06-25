import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterScannedAttachmentAnchorPatientId = "MOD-PAT-0001";
const encounterScannedAttachmentAnchorEncounter = 1000013;
const encounterScannedAttachmentFromDate = "2026-01-01";

test.describe("encounter scanned attachment parity @slice126 @workflow-encounter-document-scanned-attachment @mutation @documents", () => {
  test("creates, renders, verifies scan readiness, and removes an encounter-scoped scanned attachment", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterScannedAttachmentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Missing seeded encounter scanned attachment patient ${encounterScannedAttachmentAnchorPatientId}`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient.pid,
      encounterScannedAttachmentAnchorEncounter
    );
    const suffix = workflowSuffix();
    const fileName = `Parity Encounter Scanned Attachment ${suffix}.pdf`;
    const notes = "Scan source: front-desk scanner; OCR pending; Created by the parity encounter scanned attachment suite.";
    const contentBase64 = buildScannedPdfFixtureBase64(fileName);
    const sizeBytes = Buffer.from(contentBase64, "base64").length;
    const scannedDocumentInput = {
      patientId: patient.pid,
      encounter: encounterScannedAttachmentAnchorEncounter,
      categoryId: 3,
      categoryName: "Medical Record",
      name: fileName,
      docDate: "2026-06-20",
      fileName,
      mimetype: "application/pdf",
      contentBase64,
      notes
    };
    let documentId: number | string | null = null;
    let created: Awaited<ReturnType<typeof workflow.getPatientDocument>> = null;
    let createdContent: Awaited<ReturnType<typeof targetDb.getPatientDocumentContent>> = null;
    let afterCreateCounts: Awaited<ReturnType<typeof targetDb.getPatientWorkflowCounts>> | null = null;
    let afterCreateEncounterDocuments: Awaited<ReturnType<typeof targetDb.getPatientDocumentsForEncounter>> | null = null;
    let attachedDocument: Record<string, unknown> | undefined;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-126-encounter-document-scanned-attachment-precondition",
        description:
          "Seeded encounter scanned-attachment patient, encounter baseline, proposed scanned PDF payload, and expected scan-readiness metadata before create.",
        expected: {
          patientCanonicalId: encounterScannedAttachmentAnchorPatientId,
          encounterId: encounterScannedAttachmentAnchorEncounter,
          categoryId: 3,
          categoryName: "Medical Record",
          docDate: "2026-06-20",
          expectedDocumentDelta: 1,
          expectedEncounterDocumentDelta: 1,
          scanReadiness: {
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
            ...scannedDocumentInput,
            contentBase64Length: contentBase64.length,
            sizeBytes
          }
        }
      });

      documentId = await workflow.createEncounterBinaryDocument(scannedDocumentInput);

      created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: fileName,
        docDate: "2026-06-20",
        encounter: encounterScannedAttachmentAnchorEncounter,
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

      createdContent = await targetDb.getPatientDocumentContent(Number(documentId));
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
      expect(createdContent!.sizeBytes).toBe(sizeBytes);

      afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      afterCreateEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterScannedAttachmentAnchorEncounter
      );
      expect(afterCreateEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      attachedDocument = afterCreateEncounterDocuments.documents.find((document) => document.name === fileName);
      expect(attachedDocument).toMatchObject({
        categoryName: "Medical Record",
        encounter: encounterScannedAttachmentAnchorEncounter,
        mimetype: "application/pdf",
        fileName,
        previewKind: "pdf",
        previewStatus: "Inline PDF preview",
        thumbnailLabel: "PDF",
        canPreviewInline: true,
        canDownload: true,
        isScannedAttachment: true,
        scanStatus: "Scanned attachment",
        captureSource: "front-desk scanner",
        scanPageCount: 1,
        ocrStatus: "OCR pending"
      });

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-126-encounter-document-scanned-attachment-created",
        description:
          "Temporary encounter-scoped scanned PDF document was created with normalized content metadata, scan-readiness facts, and encounter document count increment.",
        expected: {
          document: {
            patientId: patient.pid,
            encounter: encounterScannedAttachmentAnchorEncounter,
            categoryId: 3,
            categoryName: "Medical Record",
            name: fileName,
            docDate: "2026-06-20",
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
            canPreviewInline: true,
            canDownload: true,
            isScannedAttachment: true,
            scanStatus: "Scanned attachment",
            captureSource: "front-desk scanner",
            scanPageCount: 1,
            ocrStatus: "OCR pending",
            contentBase64
          },
          counts: {
            documents: beforeCounts.documents + 1,
            encounterDocuments: beforeEncounterDocuments.documents.length + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          beforeEncounterDocuments,
          afterCreateEncounterDocuments,
          documentId,
          created,
          createdContent,
          attachedDocument
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
          probe: "slice-126-encounter-document-scanned-attachment-surface",
          description:
            "Legacy Documents category rendering facts for the temporary encounter-scoped scanned PDF attachment.",
          expected: {
            category: "Medical Record",
            documentName: fileName,
            encounterId: encounterScannedAttachmentAnchorEncounter,
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
            attachedDocument,
            surface: {
              application: "legacy-openemr",
              page: "patient-documents",
              patientPid: patient.pid,
              expandedCategory: "Medical Record",
              renderedDocumentName: fileName
            }
          }
        });
      } else {
        const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterScannedAttachmentAnchorEncounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
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
          canDownload: true,
          isScannedAttachment: true,
          scanStatus: "Scanned attachment",
          captureSource: "front-desk scanner",
          scanPageCount: 1,
          ocrStatus: "OCR pending"
        });

        await openAuthenticatedModernizedEncounters(page, target, patient!.pubpid, encounterScannedAttachmentFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const attachments = page.getByRole("region", { name: "Encounter attached documents" });
        const documentCard = attachments.locator(".encounter-document-card").filter({ hasText: fileName }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText("Scanned attachment");
        await expect(documentCard).toContainText("front-desk scanner");
        await expect(documentCard).toContainText("1 scanned page");
        await expect(documentCard).toContainText("OCR pending");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-126-encounter-document-scanned-attachment-surface",
          description:
            "Modernized encounter detail API and attached-document card rendering anchors for the temporary scanned PDF attachment.",
          expected: {
            apiDocument: {
              categoryName: "Medical Record",
              mimetype: "application/pdf",
              previewKind: "pdf",
              previewStatus: "Inline PDF preview",
              thumbnailLabel: "PDF",
              canPreviewInline: true,
              canDownload: true,
              isScannedAttachment: true,
              scanStatus: "Scanned attachment",
              captureSource: "front-desk scanner",
              scanPageCount: 1,
              ocrStatus: "OCR pending"
            },
            card: {
              documentName: fileName,
              scanStatus: "Scanned attachment",
              captureSource: "front-desk scanner",
              scanPageCountText: "1 scanned page",
              ocrStatus: "OCR pending"
            }
          },
          actual: {
            patient,
            documentId,
            created,
            createdContent,
            attachedDocument,
            apiDocument,
            surface: {
              application: "modernized-openemr",
              page: "encounters",
              searchPatientId: patient.pubpid,
              fromDate: encounterScannedAttachmentFromDate,
              encounterId: encounterScannedAttachmentAnchorEncounter,
              renderedCard: await documentCard.innerText()
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
      encounterScannedAttachmentAnchorEncounter
    );
    expect(afterCleanupEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);
    const afterCleanup = documentId !== null ? await workflow.getPatientDocument(documentId) : null;
    if (documentId !== null) {
      expect(afterCleanup).toBeNull();
    }

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-126-encounter-document-scanned-attachment-cleanup",
      description:
        "Temporary encounter scanned attachment was hard-deleted and patient/encounter document counts returned to baseline.",
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

function buildScannedPdfFixtureBase64(fileName: string) {
  const pdf = [
    "%PDF-1.4",
    "% Encounter scanned attachment parity fixture",
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
    `<< /Length ${fileName.length + 98} >>`,
    "stream",
    "BT /F1 12 Tf 24 100 Td (OpenEMR parity encounter scanned attachment document) Tj ET",
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
