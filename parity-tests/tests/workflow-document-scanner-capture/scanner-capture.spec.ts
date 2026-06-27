import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedDocuments } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const scannerCaptureAnchorPatientId = "MOD-PAT-0001";

test.describe("patient scanner-capture document parity @slice596 @workflow-document-scanner-capture @mutation @documents", () => {
  test("captures, renders, queues for OCR, and removes a scanner-created patient document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(scannerCaptureAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${scannerCaptureAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const suffix = workflowSuffix();
    const documentName = `Parity Scanner Capture ${suffix}`;
    const fileName = `${documentName}.pdf`;
    const pageCount = 3;
    const input = {
      patientId: patient.pid,
      categoryId: 3,
      categoryName: "Medical Record",
      name: documentName,
      docDate: "2026-06-21",
      encounter: 1000013,
      captureSource: "front-desk scanner",
      pageCount,
      capturedBy: "admin",
      notes: "Created by the scanner-capture parity suite."
    };
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-596-document-scanner-capture-precondition",
        description: "Captures the scanner-capture anchor patient, baseline document count, and intended multi-page OCR-pending scan metadata before create.",
        expected: {
          patient: {
            pubpid: scannerCaptureAnchorPatientId,
            displayName: "Stone, Avery"
          },
          create: {
            categoryId: 3,
            categoryName: "Medical Record",
            docDate: "2026-06-21",
            encounter: 1000013,
            mimetype: "application/pdf",
            storageMethod: "database",
            isScannedAttachment: true,
            scanStatus: "Scanned attachment",
            captureSource: "front-desk scanner",
            scanPageCount: pageCount,
            ocrStatus: "OCR pending",
            deleted: 0
          },
          countChange: {
            documentsAfterCreate: beforeCounts.documents + 1,
            documentsAfterCleanup: beforeCounts.documents
          }
        },
        actual: {
          patient,
          beforeCounts,
          proposedCapture: input
        },
        context: {
          canonicalId: scannerCaptureAnchorPatientId,
          suite: "workflow-document-scanner-capture",
          workflow: "patient-scanner-capture"
        }
      });

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedDocuments(page, target, patient.pubpid);
        await page.getByLabel("Scanner capture document name").fill(documentName);
        await page.getByLabel("Scanner capture category").selectOption("3");
        await page.getByLabel("Scanner capture document date").fill(input.docDate);
        await page.getByLabel("Scanner capture encounter").fill(String(input.encounter));
        await page.getByLabel("Scanner capture pages").fill(String(pageCount));
        await page.getByLabel("Scanner capture source").fill(input.captureSource);
        await page.getByLabel("Scanner capture captured by").fill(input.capturedBy);
        await page.getByLabel("Scanner capture notes").fill(input.notes);
        await page.getByRole("button", { name: "Capture Scan" }).click();
        await expect(page.locator("body")).toContainText("Scanner capture saved");

        const documentsAfterUiCreate = await targetDb.getPatientDocumentsForPatient(patient.pid);
        const createdSummary = documentsAfterUiCreate.documents.find((document) => document.name === documentName);
        expect(createdSummary).toBeTruthy();
        documentId = createdSummary!.id;
      } else {
        documentId = await workflow.createPatientScannerCapture(input);
      }

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-21",
        encounter: 1000013,
        mimetype: "application/pdf",
        fileName,
        storageMethod: "database",
        deleted: 0,
        isScannedAttachment: true,
        scanStatus: "Scanned attachment",
        captureSource: "front-desk scanner",
        scanPageCount: pageCount,
        ocrStatus: "OCR pending"
      });
      expect(created!.sizeBytes).toBeGreaterThan(0);

      const createdContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(createdContent).not.toBeNull();
      expect(createdContent).toMatchObject({
        id: Number(documentId),
        name: documentName,
        fileName,
        mimetype: "application/pdf",
        previewKind: "pdf",
        previewStatus: "Inline PDF preview",
        thumbnailLabel: "PDF",
        isScannedAttachment: true,
        scanStatus: "Scanned attachment",
        captureSource: "front-desk scanner",
        scanPageCount: pageCount,
        ocrStatus: "OCR pending"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-596-document-scanner-capture-created",
        description: "Captures the temporary scanner-captured document row, normalized scan-readiness metadata, and active document-count increment immediately after create.",
        expected: {
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: documentName,
            docDate: "2026-06-21",
            encounter: 1000013,
            mimetype: "application/pdf",
            fileName,
            storageMethod: "database",
            deleted: 0
          },
          scanReadiness: {
            previewKind: "pdf",
            previewStatus: "Inline PDF preview",
            thumbnailLabel: "PDF",
            isScannedAttachment: true,
            scanStatus: "Scanned attachment",
            captureSource: "front-desk scanner",
            scanPageCount: pageCount,
            ocrStatus: "OCR pending"
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
          canonicalId: scannerCaptureAnchorPatientId,
          suite: "workflow-document-scanner-capture",
          workflow: "patient-scanner-capture-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, documentName);
        await expectRenderedText(page, "Medical Record");
      } else {
        await openAuthenticatedModernizedDocuments(page, target, patient.pubpid);

        const documentCard = page.locator(".document-card").filter({ hasText: documentName }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText("Scanned attachment");
        await expect(documentCard).toContainText("front-desk scanner");
        await expect(documentCard).toContainText("3 scanned pages");
        await expect(documentCard).toContainText("OCR pending");

        const ocrQueue = page.getByLabel("Document OCR queue");
        await expect(ocrQueue).toContainText(documentName);
        await expect(ocrQueue).toContainText("front-desk scanner / 3 pages");

        await documentCard.getByRole("button", { name: "View" }).click();
        const viewer = page.getByLabel("Document viewer");
        await expect(viewer).toContainText(documentName);
        await expect(viewer).toContainText("Scanned attachment");
        await expect(viewer).toContainText("front-desk scanner");
        await expect(viewer).toContainText("3");
        await expect(viewer).toContainText("OCR pending");
      }

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-596-document-scanner-capture-surface",
        description: "Captures the rendered scanner-capture evidence on the target-specific document surface.",
        expected: {
          documentName,
          category: "Medical Record",
          scanStatus: "Scanned attachment",
          captureSource: "front-desk scanner",
          scanPageCount: pageCount,
          ocrStatus: "OCR pending"
        },
        actual: {
          patient,
          documentId,
          created,
          createdContent,
          surface: {
            application: target.type,
            page: target.type === "legacy-openemr" ? "patient-documents" : "documents"
          }
        },
        context: {
          canonicalId: scannerCaptureAnchorPatientId,
          suite: "workflow-document-scanner-capture",
          workflow: "patient-scanner-capture-surface"
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
        probe: "slice-596-document-scanner-capture-cleanup",
        description: "Captures the final scanner-capture hard-delete cleanup state and active document-count return to baseline.",
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
          canonicalId: scannerCaptureAnchorPatientId,
          suite: "workflow-document-scanner-capture",
          workflow: "patient-scanner-capture-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
