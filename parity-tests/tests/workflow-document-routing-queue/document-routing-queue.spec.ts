import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  getModernizedAdminSessionHeaders,
  openAuthenticatedModernizedDocuments
} from "../../src/ui/modernizedOpenEmr.js";

const routingQueueAnchorPatientId = "MOD-PAT-0001";

test.describe("patient document routing queue parity @slice593 @workflow-document-routing-queue @mutation @documents", () => {
  test("projects pending-review documents into the modernized routing queue", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(routingQueueAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${routingQueueAnchorPatientId} was not found.`);
    }

    const suffix = workflowSuffix();
    const fileName = `Parity Routing Queue ${suffix}.pdf`;
    const notes = "Route to: Clinical review; Routing priority: High; Routing reason: advance directive review packet.";
    const contentBase64 = buildRoutingPdfFixtureBase64(fileName);
    const sizeBytes = Buffer.from(contentBase64, "base64").length;
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-593-document-routing-queue-precondition",
        description: "Captures the routing queue document fixture before creation.",
        expected: {
          patient: {
            pubpid: routingQueueAnchorPatientId,
            displayName: "Stone, Avery"
          },
          create: {
            categoryId: 6,
            categoryName: "Advance Directive",
            mimetype: "application/pdf",
            storageMethod: "database",
            reviewStatus: "pending",
            queueStatus: "Awaiting review",
            routeDestination: "Clinical review",
            priority: "High"
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
          canonicalId: routingQueueAnchorPatientId,
          suite: "workflow-document-routing-queue",
          workflow: "document-routing-queue-precondition"
        }
      });

      documentId = await workflow.createPatientBinaryDocument({
        patientId: patient.pid,
        categoryId: 6,
        categoryName: "Advance Directive",
        name: fileName,
        docDate: "2026-06-25",
        encounter: 1000013,
        fileName,
        mimetype: "application/pdf",
        contentBase64,
        notes
      });

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        categoryId: 6,
        categoryName: "Advance Directive",
        name: fileName,
        docDate: "2026-06-25",
        encounter: 1000013,
        mimetype: "application/pdf",
        fileName,
        storageMethod: "database",
        deleted: 0,
        reviewStatus: "pending"
      });
      expect(created!.sizeBytes).toBe(sizeBytes);

      const createdContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(createdContent).not.toBeNull();
      expect(createdContent).toMatchObject({
        id: Number(documentId),
        name: fileName,
        categoryName: "Advance Directive",
        mimetype: "application/pdf",
        notes
      });

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-593-document-routing-queue-source-facts",
        description: "Captures normalized source facts proving the temporary document should be present in a pending routing queue.",
        expected: {
          document: {
            id: Number(documentId),
            patientId: patient.pid,
            name: fileName,
            categoryName: "Advance Directive",
            mimetype: "application/pdf",
            deleted: 0,
            reviewStatus: "pending",
            routeDestination: "Clinical review",
            priority: "High"
          }
        },
        actual: {
          patient,
          documentId,
          created,
          createdContent
        },
        context: {
          canonicalId: routingQueueAnchorPatientId,
          suite: "workflow-document-routing-queue",
          workflow: "document-routing-queue-source-facts"
        }
      });

      if (target.type === "legacy-openemr") {
        return;
      }

      const headers = await getModernizedAdminSessionHeaders(page, target);
      const queueResponse = await page.request.get(
        `${target.apiBaseUrl}/api/documents/routing-queue?patientId=${encodeURIComponent(patient.pubpid)}`,
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
          categoryName: string;
          reviewStatus: string;
          queueStatus: string;
          routeDestination: string;
          priority: string;
          routingReason: string;
        }>;
      };
      const queued = queue.items.find((item) => item.id === Number(documentId));
      expect(queued).toMatchObject({
        id: Number(documentId),
        name: fileName,
        patientId: patient.pubpid,
        pubpid: patient.pubpid,
        categoryName: "Advance Directive",
        reviewStatus: "pending",
        queueStatus: "Awaiting review",
        routeDestination: "Clinical review",
        priority: "High",
        routingReason: "Pending Advance Directive review"
      });

      await openAuthenticatedModernizedDocuments(page, target, patient.pubpid);
      const routingQueuePanel = page.getByLabel("Document routing queue");
      await expect(routingQueuePanel).toBeVisible();
      await expect(routingQueuePanel).toContainText(fileName);
      await expect(routingQueuePanel).toContainText("Awaiting review");
      await expect(routingQueuePanel).toContainText("Clinical review");
      await expect(routingQueuePanel).toContainText("High");

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-593-document-routing-queue-modernized-api-ui",
        description: "Captures the modernized protected routing queue API projection and Documents page Routing Queue rendering for the temporary pending-review document.",
        expected: {
          queue: {
            id: Number(documentId),
            name: fileName,
            queueStatus: "Awaiting review",
            reviewStatus: "pending",
            routeDestination: "Clinical review",
            priority: "High"
          },
          ui: {
            panel: "Document routing queue",
            visibleText: [fileName, "Awaiting review", "Clinical review", "High"]
          }
        },
        actual: {
          patient,
          documentId,
          queue
        },
        context: {
          canonicalId: routingQueueAnchorPatientId,
          suite: "workflow-document-routing-queue",
          workflow: "document-routing-queue-modernized-api-ui"
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

function buildRoutingPdfFixtureBase64(fileName: string) {
  const pdf = [
    "%PDF-1.4",
    "% Routing queue parity fixture",
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
    `<< /Length ${fileName.length + 91} >>`,
    "stream",
    "BT /F1 12 Tf 24 100 Td (OpenEMR parity document routing queue) Tj ET",
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
