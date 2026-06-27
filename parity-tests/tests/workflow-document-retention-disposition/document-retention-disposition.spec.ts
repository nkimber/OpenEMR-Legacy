import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  getModernizedAdminSessionHeaders,
  openAuthenticatedModernizedDocuments
} from "../../src/ui/modernizedOpenEmr.js";

const retentionDispositionAnchorPatientId = "MOD-PAT-0001";

test.describe("patient document retention disposition parity @slice595 @workflow-document-retention-disposition @mutation @documents", () => {
  test("archives an eligible retention-policy document through the controlled disposition workflow", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(retentionDispositionAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${retentionDispositionAnchorPatientId} was not found.`);
    }

    const suffix = workflowSuffix();
    const fileName = `Parity Retention Disposition ${suffix}.pdf`;
    const notes = "Retention class: Administrative; Retention years: 3; Retention basis: controlled disposition test.";
    const contentBase64 = buildRetentionPdfFixtureBase64(fileName);
    let documentId: number | string | null = null;

    try {
      documentId = await workflow.createPatientBinaryDocument({
        patientId: patient.pid,
        categoryId: 4,
        categoryName: "Patient Information",
        name: fileName,
        docDate: "2020-01-15",
        encounter: 1000013,
        fileName,
        mimetype: "application/pdf",
        contentBase64,
        notes
      });

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        categoryId: 4,
        categoryName: "Patient Information",
        name: fileName,
        docDate: "2020-01-15",
        encounter: 1000013,
        mimetype: "application/pdf",
        fileName,
        storageMethod: "database",
        deleted: 0
      });

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-595-document-retention-disposition-precondition",
        description: "Captures the active source document proving the temporary row is eligible for controlled retention disposition.",
        expected: {
          document: {
            id: Number(documentId),
            categoryName: "Patient Information",
            docDate: "2020-01-15",
            retainUntil: "2023-01-15",
            dispositionStatus: "Eligible for disposition",
            deleted: 0
          }
        },
        actual: {
          patient,
          documentId,
          created
        },
        context: {
          canonicalId: retentionDispositionAnchorPatientId,
          suite: "workflow-document-retention-disposition",
          workflow: "document-retention-disposition-precondition"
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.softDeletePatientDocument(documentId);
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const policyResponse = await page.request.get(
          `${target.apiBaseUrl}/api/documents/retention-policy?patientId=${encodeURIComponent(patient.pubpid)}`,
          { headers }
        );
        expect(policyResponse.ok()).toBeTruthy();
        const policy = await policyResponse.json() as {
          items: Array<{
            id: number;
            dispositionStatus: string;
            retainUntil: string;
          }>;
        };
        const eligible = policy.items.find((item) => item.id === Number(documentId));
        expect(eligible).toMatchObject({
          id: Number(documentId),
          dispositionStatus: "Eligible for disposition",
          retainUntil: "2023-01-15"
        });

        await openAuthenticatedModernizedDocuments(page, target, patient.pubpid);
        const retentionPanel = page.getByLabel("Document retention policy");
        const row = retentionPanel.locator(".message-item").filter({ hasText: fileName }).first();
        await expect(row).toBeVisible();
        await row.getByRole("button", { name: "Dispose" }).click();
        await expect(row).toBeHidden();
        await expect(retentionPanel).not.toContainText(fileName);
      }

      const archived = await workflow.getPatientDocument(documentId);
      expect(archived).toMatchObject({
        id: Number(documentId),
        name: fileName,
        categoryName: "Patient Information",
        deleted: 1
      });

      if (target.type !== "legacy-openemr") {
        expect(archived!.notes).toContain("Retention disposition by admin");
        expect(archived!.notes).toContain("retain until 2023-01-15");
      }

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-595-document-retention-disposition-archived",
        description: "Captures the final archived state after the retention disposition workflow executes.",
        expected: {
          document: {
            id: Number(documentId),
            name: fileName,
            categoryName: "Patient Information",
            deleted: 1,
            retainedUntil: "2023-01-15"
          }
        },
        actual: {
          patient,
          documentId,
          archived
        },
        context: {
          canonicalId: retentionDispositionAnchorPatientId,
          suite: "workflow-document-retention-disposition",
          workflow: "document-retention-disposition-archived"
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

function buildRetentionPdfFixtureBase64(fileName: string) {
  const pdf = [
    "%PDF-1.4",
    "% Retention disposition parity fixture",
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
    "BT /F1 12 Tf 24 100 Td (OpenEMR parity document retention disposition) Tj ET",
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
