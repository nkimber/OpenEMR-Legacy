import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  getModernizedAdminSessionHeaders,
  openAuthenticatedModernizedDocuments
} from "../../src/ui/modernizedOpenEmr.js";

const retentionPolicyAnchorPatientId = "MOD-PAT-0001";

test.describe("patient document retention policy parity @slice594 @workflow-document-retention-policy @mutation @documents", () => {
  test("projects active documents into the modernized retention policy view", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(retentionPolicyAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${retentionPolicyAnchorPatientId} was not found.`);
    }

    const suffix = workflowSuffix();
    const fileName = `Parity Retention Policy ${suffix}.pdf`;
    const notes = "Retention class: Administrative; Retention years: 3; Retention basis: patient information retention test.";
    const contentBase64 = buildRetentionPdfFixtureBase64(fileName);
    const sizeBytes = Buffer.from(contentBase64, "base64").length;
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-594-document-retention-policy-precondition",
        description: "Captures the retention policy document fixture before creation.",
        expected: {
          patient: {
            pubpid: retentionPolicyAnchorPatientId,
            displayName: "Stone, Avery"
          },
          create: {
            categoryId: 4,
            categoryName: "Patient Information",
            docDate: "2020-01-15",
            mimetype: "application/pdf",
            storageMethod: "database",
            retentionClass: "Administrative",
            retentionYears: 3,
            retainUntil: "2023-01-15",
            dispositionStatus: "Eligible for disposition"
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
          canonicalId: retentionPolicyAnchorPatientId,
          suite: "workflow-document-retention-policy",
          workflow: "document-retention-policy-precondition"
        }
      });

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
      expect(created!.sizeBytes).toBe(sizeBytes);

      const createdContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(createdContent).not.toBeNull();
      expect(createdContent).toMatchObject({
        id: Number(documentId),
        name: fileName,
        categoryName: "Patient Information",
        mimetype: "application/pdf",
        notes
      });

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-594-document-retention-policy-source-facts",
        description: "Captures normalized source facts proving the temporary document should have deterministic retention policy evidence.",
        expected: {
          document: {
            id: Number(documentId),
            patientId: patient.pid,
            name: fileName,
            categoryName: "Patient Information",
            docDate: "2020-01-15",
            mimetype: "application/pdf",
            deleted: 0,
            retentionClass: "Administrative",
            retentionYears: 3,
            retainUntil: "2023-01-15",
            dispositionStatus: "Eligible for disposition"
          }
        },
        actual: {
          patient,
          documentId,
          created,
          createdContent
        },
        context: {
          canonicalId: retentionPolicyAnchorPatientId,
          suite: "workflow-document-retention-policy",
          workflow: "document-retention-policy-source-facts"
        }
      });

      if (target.type === "legacy-openemr") {
        return;
      }

      const headers = await getModernizedAdminSessionHeaders(page, target);
      const policyResponse = await page.request.get(
        `${target.apiBaseUrl}/api/documents/retention-policy?patientId=${encodeURIComponent(patient.pubpid)}`,
        { headers }
      );
      expect(policyResponse.ok()).toBeTruthy();
      const policy = await policyResponse.json() as {
        asOfDate: string;
        eligibleCount: number;
        items: Array<{
          id: number;
          name: string;
          patientId: string;
          pubpid: string;
          categoryName: string;
          retentionClass: string;
          retentionYears: number;
          retainUntil: string;
          dispositionStatus: string;
          policyBasis: string;
        }>;
      };
      const retained = policy.items.find((item) => item.id === Number(documentId));
      expect(policy.asOfDate).toBe("2026-06-18");
      expect(retained).toMatchObject({
        id: Number(documentId),
        name: fileName,
        patientId: patient.pubpid,
        pubpid: patient.pubpid,
        categoryName: "Patient Information",
        retentionClass: "Administrative",
        retentionYears: 3,
        retainUntil: "2023-01-15",
        dispositionStatus: "Eligible for disposition",
        policyBasis: "patient information retention test."
      });

      await openAuthenticatedModernizedDocuments(page, target, patient.pubpid);
      const retentionPanel = page.getByLabel("Document retention policy");
      await expect(retentionPanel).toBeVisible();
      await expect(retentionPanel).toContainText(fileName);
      await expect(retentionPanel).toContainText("Administrative");
      await expect(retentionPanel).toContainText("Retain until 2023-01-15");
      await expect(retentionPanel).toContainText("Eligible for disposition");

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-594-document-retention-policy-modernized-api-ui",
        description: "Captures the modernized protected retention policy API projection and Documents page Retention Policy rendering for the temporary active document.",
        expected: {
          policy: {
            id: Number(documentId),
            name: fileName,
            asOfDate: "2026-06-18",
            retentionClass: "Administrative",
            retentionYears: 3,
            retainUntil: "2023-01-15",
            dispositionStatus: "Eligible for disposition"
          },
          ui: {
            panel: "Document retention policy",
            visibleText: [fileName, "Administrative", "Retain until 2023-01-15", "Eligible for disposition"]
          }
        },
        actual: {
          patient,
          documentId,
          policy
        },
        context: {
          canonicalId: retentionPolicyAnchorPatientId,
          suite: "workflow-document-retention-policy",
          workflow: "document-retention-policy-modernized-api-ui"
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
    "% Retention policy parity fixture",
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
    `<< /Length ${fileName.length + 88} >>`,
    "stream",
    "BT /F1 12 Tf 24 100 Td (OpenEMR parity document retention policy) Tj ET",
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
