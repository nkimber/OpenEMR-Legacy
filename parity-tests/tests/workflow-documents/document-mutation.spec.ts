import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedDocuments } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const documentMutationAnchorPatientId = "MOD-PAT-0001";

test.describe("patient document mutation parity @slice26 @workflow-documents @mutation", () => {
  test("creates, renders, soft-deletes, and removes a patient document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(documentMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const name = `Parity Document ${workflowSuffix()}`;
    const body = `Created by the parity document mutation suite for ${name}.`;
    const documentInput = {
      patientId: patient!.pid,
      categoryId: 3,
      categoryName: "Medical Record",
      name,
      docDate: "2026-06-18",
      encounter: 1000013,
      content: body,
      notes: "Created by the parity document mutation suite."
    };
    let documentId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-26-document-mutation-precondition",
      description: "Captures the Slice 26 document mutation anchor patient, workflow counts before mutation, and proposed database-backed text document payload.",
      expected: {
        patient: {
          pubpid: documentMutationAnchorPatientId
        },
        create: {
          categoryId: 3,
          categoryName: "Medical Record",
          docDate: "2026-06-18",
          encounter: 1000013,
          mimetype: "text/plain",
          storageMethod: "database",
          deleted: 0
        }
      },
      actual: {
        patient,
        beforeCounts,
        proposed: documentInput
      },
      context: {
        canonicalId: documentMutationAnchorPatientId,
        suite: "workflow-documents",
        workflow: "document-mutation"
      }
    });

    try {
      documentId = await workflow.createPatientDocument(documentInput);

      const created = await workflow.getPatientDocument(documentId);
      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-26-document-mutation-created",
        description: "Captures the temporary patient document row immediately after Slice 26 creates it, including the document-count increment.",
        expected: {
          document: {
            patientId: patient!.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name,
            docDate: "2026-06-18",
            mimetype: "text/plain",
            storageMethod: "database",
            deleted: 0,
            contentPreviewIncludes: body
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
          canonicalId: documentMutationAnchorPatientId,
          suite: "workflow-documents",
          workflow: "document-mutation-created"
        }
      });

      expect(created).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name,
        docDate: "2026-06-18",
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0
      });
      expect(created!.contentPreview).toContain(body);

      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);

        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, name);
        await expectRenderedText(page, "Medical Record");
      } else {
        await openAuthenticatedModernizedDocuments(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText(name);
        await expect(page.locator("body")).toContainText(body);
        await expect(page.locator("body")).toContainText("Medical Record");
      }

      await workflow.softDeletePatientDocument(documentId);
      const archived = await workflow.getPatientDocument(documentId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-26-document-mutation-archived",
        description: "Captures the temporary patient document row after Slice 26 soft-deletes it and before hard-delete cleanup.",
        expected: {
          document: {
            name,
            deleted: 1,
            storageMethod: "database"
          }
        },
        actual: {
          patient,
          documentId,
          created,
          archived
        },
        context: {
          canonicalId: documentMutationAnchorPatientId,
          suite: "workflow-documents",
          workflow: "document-mutation-archived"
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
    const deleted = documentId !== null ? await workflow.getPatientDocument(documentId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-26-document-mutation-cleanup",
      description: "Captures the Slice 26 document mutation cleanup state after deleting the temporary patient document.",
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
        deleted
      },
      context: {
        canonicalId: documentMutationAnchorPatientId,
        suite: "workflow-documents",
        workflow: "document-mutation-cleanup"
      }
    });

    expect(afterCleanupCounts.documents).toBe(beforeCounts.documents);
    if (documentId !== null) {
      expect(deleted).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
