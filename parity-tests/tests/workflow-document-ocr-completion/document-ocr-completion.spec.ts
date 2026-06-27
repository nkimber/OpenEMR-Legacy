import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  getModernizedAdminSessionHeaders,
  openAuthenticatedModernizedDocuments
} from "../../src/ui/modernizedOpenEmr.js";

const ocrCompletionAnchorPatientId = "MOD-PAT-0001";

test.describe("patient document OCR completion parity @slice591 @workflow-document-ocr-completion @mutation @documents", () => {
  test("completes a queued scanned document OCR item on the modernized target", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(ocrCompletionAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${ocrCompletionAnchorPatientId} was not found.`);
    }

    const suffix = workflowSuffix();
    const fileName = `Parity OCR Completion ${suffix}.pdf`;
    const notes = "Scan source: coding scanner; OCR pending; Queue reason: scanned outside note.";
    const contentBase64 = buildScannedPdfFixtureBase64(fileName);
    let documentId: number | string | null = null;

    try {
      documentId = await workflow.createPatientBinaryDocument({
        patientId: patient.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: fileName,
        docDate: "2026-06-22",
        encounter: 1000013,
        fileName,
        mimetype: "application/pdf",
        contentBase64,
        notes
      });

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        name: fileName,
        mimetype: "application/pdf",
        deleted: 0,
        isScannedAttachment: true,
        captureSource: "coding scanner",
        scanPageCount: 1,
        ocrStatus: "OCR pending"
      });

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-591-document-ocr-completion-source-facts",
        description: "Captures the temporary scanned pending-OCR document before OCR completion.",
        expected: {
          document: {
            id: Number(documentId),
            patientId: patient.pid,
            name: fileName,
            isScannedAttachment: true,
            captureSource: "coding scanner",
            scanPageCount: 1,
            ocrStatus: "OCR pending"
          }
        },
        actual: {
          patient,
          documentId,
          created
        },
        context: {
          canonicalId: ocrCompletionAnchorPatientId,
          suite: "workflow-document-ocr-completion",
          workflow: "document-ocr-completion-source-facts"
        }
      });

      if (target.type === "legacy-openemr") {
        return;
      }

      const headers = await getModernizedAdminSessionHeaders(page, target);
      const queueBeforeResponse = await page.request.get(
        `${target.apiBaseUrl}/api/documents/ocr-queue?patientId=${encodeURIComponent(patient.pubpid)}`,
        { headers }
      );
      expect(queueBeforeResponse.ok()).toBeTruthy();
      const queueBefore = await queueBeforeResponse.json() as {
        items: Array<{ id: number; name: string; ocrStatus: string; queueStatus: string }>;
      };
      expect(queueBefore.items.find((item) => item.id === Number(documentId))).toMatchObject({
        id: Number(documentId),
        name: fileName,
        ocrStatus: "OCR pending",
        queueStatus: "Ready for OCR"
      });

      await openAuthenticatedModernizedDocuments(page, target, patient.pubpid);
      const ocrQueuePanel = page.getByLabel("Document OCR queue");
      await expect(ocrQueuePanel).toContainText(fileName);
      await ocrQueuePanel.getByRole("button", { name: "Complete OCR" }).click();

      const viewer = page.getByLabel("Document viewer");
      await expect(viewer).toContainText(fileName);
      await expect(viewer).toContainText("OCR complete");
      await expect(ocrQueuePanel).not.toContainText(fileName);

      const completed = await workflow.getPatientDocument(documentId);
      expect(completed).toMatchObject({
        id: Number(documentId),
        name: fileName,
        ocrStatus: "OCR complete"
      });

      const queueAfterResponse = await page.request.get(
        `${target.apiBaseUrl}/api/documents/ocr-queue?patientId=${encodeURIComponent(patient.pubpid)}`,
        { headers }
      );
      expect(queueAfterResponse.ok()).toBeTruthy();
      const queueAfter = await queueAfterResponse.json() as {
        items: Array<{ id: number; name: string }>;
      };
      expect(queueAfter.items.some((item) => item.id === Number(documentId))).toBe(false);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-591-document-ocr-completion-modernized-api-ui",
        description: "Captures the modernized OCR completion state, queue removal, and Documents viewer OCR complete rendering.",
        expected: {
          completion: {
            id: Number(documentId),
            ocrStatus: "OCR complete",
            queueContainsDocument: false
          },
          ui: {
            viewerText: ["OCR complete", fileName],
            queueNoLongerContains: fileName
          }
        },
        actual: {
          patient,
          documentId,
          completed,
          queueBefore,
          queueAfter
        },
        context: {
          canonicalId: ocrCompletionAnchorPatientId,
          suite: "workflow-document-ocr-completion",
          workflow: "document-ocr-completion-modernized-api-ui"
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
    "% OCR completion parity fixture",
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
    `<< /Length ${fileName.length + 92} >>`,
    "stream",
    "BT /F1 12 Tf 24 100 Td (OpenEMR parity OCR completion document) Tj ET",
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
