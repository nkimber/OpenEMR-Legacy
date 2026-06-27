import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  getModernizedAdminSessionHeaders,
  openAuthenticatedModernizedDocuments
} from "../../src/ui/modernizedOpenEmr.js";

const ocrQueueAnchorPatientId = "MOD-PAT-0001";

test.describe("patient document OCR queue parity @slice590 @workflow-document-ocr-queue @mutation @documents", () => {
  test("projects scanned pending-OCR documents into the modernized OCR queue", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(ocrQueueAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${ocrQueueAnchorPatientId} was not found.`);
    }

    const suffix = workflowSuffix();
    const fileName = `Parity OCR Queue ${suffix}.pdf`;
    const notes = "Scan source: referrals scanner; OCR pending; Queue reason: imported referral packet.";
    const contentBase64 = buildScannedPdfFixtureBase64(fileName);
    const sizeBytes = Buffer.from(contentBase64, "base64").length;
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-590-document-ocr-queue-precondition",
        description: "Captures the OCR queue scanned-document fixture before creation.",
        expected: {
          patient: {
            pubpid: ocrQueueAnchorPatientId,
            displayName: "Stone, Avery"
          },
          create: {
            categoryId: 3,
            categoryName: "Medical Record",
            mimetype: "application/pdf",
            storageMethod: "database",
            isScannedAttachment: true,
            captureSource: "referrals scanner",
            scanPageCount: 1,
            ocrStatus: "OCR pending",
            queueStatus: "Ready for OCR"
          }
        },
        actual: {
          patient,
          proposedDocument: {
            patientId: patient.pid,
            fileName,
            notes,
            sizeBytes,
            contentBase64Length: contentBase64.length
          }
        },
        context: {
          canonicalId: ocrQueueAnchorPatientId,
          suite: "workflow-document-ocr-queue",
          workflow: "document-ocr-queue-precondition"
        }
      });

      documentId = await workflow.createPatientBinaryDocument({
        patientId: patient.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: fileName,
        docDate: "2026-06-21",
        encounter: 1000013,
        fileName,
        mimetype: "application/pdf",
        contentBase64,
        notes
      });

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: fileName,
        docDate: "2026-06-21",
        encounter: 1000013,
        mimetype: "application/pdf",
        fileName,
        storageMethod: "database",
        deleted: 0,
        isScannedAttachment: true,
        scanStatus: "Scanned attachment",
        captureSource: "referrals scanner",
        scanPageCount: 1,
        ocrStatus: "OCR pending"
      });
      expect(created!.sizeBytes).toBe(sizeBytes);

      const createdContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(createdContent).not.toBeNull();
      expect(createdContent).toMatchObject({
        id: Number(documentId),
        name: fileName,
        isScannedAttachment: true,
        captureSource: "referrals scanner",
        scanPageCount: 1,
        ocrStatus: "OCR pending"
      });

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-590-document-ocr-queue-source-facts",
        description: "Captures normalized source facts proving the temporary scanned document should be present in an OCR work queue.",
        expected: {
          document: {
            id: Number(documentId),
            patientId: patient.pid,
            name: fileName,
            mimetype: "application/pdf",
            deleted: 0,
            isScannedAttachment: true,
            captureSource: "referrals scanner",
            scanPageCount: 1,
            ocrStatus: "OCR pending"
          }
        },
        actual: {
          patient,
          documentId,
          created,
          createdContent
        },
        context: {
          canonicalId: ocrQueueAnchorPatientId,
          suite: "workflow-document-ocr-queue",
          workflow: "document-ocr-queue-source-facts"
        }
      });

      if (target.type === "legacy-openemr") {
        return;
      }

      const headers = await getModernizedAdminSessionHeaders(page, target);
      const queueResponse = await page.request.get(
        `${target.apiBaseUrl}/api/documents/ocr-queue?patientId=${encodeURIComponent(patient.pubpid)}`,
        { headers }
      );
      expect(queueResponse.ok()).toBeTruthy();
      const queue = await queueResponse.json() as {
        count: number;
        items: Array<{
          id: number;
          name: string;
          patientId: string;
          pubpid: string;
          captureSource: string;
          scanPageCount: number;
          ocrStatus: string;
          queueStatus: string;
          priority: string;
        }>;
      };
      const queued = queue.items.find((item) => item.id === Number(documentId));
      expect(queued).toMatchObject({
        id: Number(documentId),
        name: fileName,
        patientId: patient.pubpid,
        pubpid: patient.pubpid,
        captureSource: "referrals scanner",
        scanPageCount: 1,
        ocrStatus: "OCR pending",
        queueStatus: "Ready for OCR",
        priority: "Standard"
      });

      await openAuthenticatedModernizedDocuments(page, target, patient.pubpid);
      const ocrQueuePanel = page.getByLabel("Document OCR queue");
      await expect(ocrQueuePanel).toBeVisible();
      await expect(ocrQueuePanel).toContainText(fileName);
      await expect(ocrQueuePanel).toContainText("Ready for OCR");
      await expect(ocrQueuePanel).toContainText("OCR pending");
      await expect(ocrQueuePanel).toContainText("referrals scanner");

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-590-document-ocr-queue-modernized-api-ui",
        description: "Captures the modernized protected OCR queue API projection and Documents page OCR Queue rendering for the temporary scanned document.",
        expected: {
          queue: {
            id: Number(documentId),
            name: fileName,
            queueStatus: "Ready for OCR",
            ocrStatus: "OCR pending",
            priority: "Standard"
          },
          ui: {
            panel: "Document OCR queue",
            visibleText: [fileName, "Ready for OCR", "OCR pending", "referrals scanner"]
          }
        },
        actual: {
          patient,
          documentId,
          queue
        },
        context: {
          canonicalId: ocrQueueAnchorPatientId,
          suite: "workflow-document-ocr-queue",
          workflow: "document-ocr-queue-modernized-api-ui"
        }
      });
    } finally {
      if (documentId !== null) {
        await workflow.deletePatientDocument(documentId);
      }
    }

    if (documentId !== null) {
      const afterCleanup = await workflow.getPatientDocument(documentId);
      expect(afterCleanup).toBeNull();
    }
  });
});

function buildScannedPdfFixtureBase64(fileName: string) {
  const pdf = [
    "%PDF-1.4",
    "% OCR queue parity fixture",
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
    `<< /Length ${fileName.length + 84} >>`,
    "stream",
    "BT /F1 12 Tf 24 100 Td (OpenEMR parity OCR queue document) Tj ET",
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
