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

const binaryDocumentAnchorPatientId = "MOD-PAT-0001";

test.describe("binary patient document mutation parity @slice33 @workflow-document-binary @mutation", () => {
  test("creates, renders, downloads, archives, and removes a binary patient document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(binaryDocumentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const fileName = `Parity Binary Document ${suffix}.pdf`;
    const contentBase64 = buildPdfFixtureBase64(fileName);
    const contentSizeBytes = Buffer.from(contentBase64, "base64").length;
    const proposedDocument = {
      patientId: patient!.pid,
      categoryId: 3,
      categoryName: "Medical Record",
      name: fileName,
      docDate: "2026-06-18",
      encounter: 1000013,
      fileName,
      mimetype: "application/pdf",
      contentBase64,
      notes: "Created by the parity binary document mutation suite."
    };
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-33-binary-document-mutation-precondition",
        description: "Captures the Slice 33 binary patient-document mutation anchor patient, baseline counts, and proposed temporary PDF document payload before create.",
        expected: {
          patient: {
            pubpid: binaryDocumentAnchorPatientId,
            displayName: "Stone, Avery"
          },
          create: {
            categoryId: 3,
            categoryName: "Medical Record",
            docDate: "2026-06-18",
            encounter: 1000013,
            mimetype: "application/pdf",
            storageMethod: "database",
            deleted: 0,
            sizeBytes: contentSizeBytes
          }
        },
        actual: {
          patient,
          beforeCounts,
          proposedDocument,
          contentSizeBytes
        },
        context: {
          canonicalId: binaryDocumentAnchorPatientId,
          suite: "workflow-document-binary",
          workflow: "binary-patient-document-mutation"
        }
      });

      documentId = await workflow.createPatientBinaryDocument(proposedDocument);

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: fileName,
        docDate: "2026-06-18",
        mimetype: "application/pdf",
        fileName,
        storageMethod: "database",
        deleted: 0,
        contentBase64
      });
      expect(created!.sizeBytes).toBe(contentSizeBytes);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-33-binary-document-mutation-created",
        description: "Captures the temporary Slice 33 binary patient document row and document-count increment immediately after create.",
        expected: {
          document: {
            patientId: patient!.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: fileName,
            docDate: "2026-06-18",
            encounter: 1000013,
            mimetype: "application/pdf",
            fileName,
            storageMethod: "database",
            deleted: 0,
            sizeBytes: contentSizeBytes,
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
          created
        },
        context: {
          canonicalId: binaryDocumentAnchorPatientId,
          suite: "workflow-document-binary",
          workflow: "binary-patient-document-mutation-created"
        }
      });
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, fileName);
        await expectRenderedText(page, "Medical Record");
      } else {
        await openAuthenticatedModernizedDocuments(page, target, patient!.pubpid);

        const documentCard = page.locator(".document-card").filter({ hasText: fileName }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText("application/pdf");
        await documentCard.getByRole("button", { name: "View" }).click();
        await expect(page.getByRole("heading", { name: "Document Viewer" })).toBeVisible();
        await expect(page.getByLabel("Document viewer")).toContainText(fileName);
        await expect(page.getByLabel("Document viewer")).toContainText("application/pdf");
        await expect(page.getByLabel("Document viewer")).toContainText("Binary document");

        const download = await page.request.get(`${target.apiBaseUrl}/api/documents/${documentId}/download`, {
          headers: await getModernizedAdminSessionHeaders(page, target)
        });
        expect(download.ok()).toBe(true);
        expect(download.headers()["content-type"]).toContain("application/pdf");
        expect((await download.body()).toString("base64")).toBe(contentBase64);
      }

      await workflow.softDeletePatientDocument(documentId);
      const archived = await workflow.getPatientDocument(documentId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-33-binary-document-mutation-archived",
        description: "Captures the temporary Slice 33 binary patient document row after archive and before hard-delete cleanup.",
        expected: {
          document: {
            name: fileName,
            deleted: 1,
            mimetype: "application/pdf",
            storageMethod: "database",
            sizeBytes: contentSizeBytes
          }
        },
        actual: {
          patient,
          documentId,
          created,
          archived
        },
        context: {
          canonicalId: binaryDocumentAnchorPatientId,
          suite: "workflow-document-binary",
          workflow: "binary-patient-document-mutation-archived"
        }
      });
      expect(archived).toMatchObject({
        deleted: 1
      });
    } finally {
      if (documentId !== null) {
        await workflow.deletePatientDocument(documentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.documents).toBe(beforeCounts.documents);
    if (documentId !== null) {
      const afterCleanup = await workflow.getPatientDocument(documentId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-33-binary-document-mutation-cleanup",
        description: "Captures the final Slice 33 hard-delete cleanup state for the temporary binary patient document.",
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
          canonicalId: binaryDocumentAnchorPatientId,
          suite: "workflow-document-binary",
          workflow: "binary-patient-document-mutation-cleanup"
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
    `<< /Length ${fileName.length + 80} >>`,
    "stream",
    "BT /F1 12 Tf 24 100 Td (OpenEMR parity binary document) Tj ET",
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
