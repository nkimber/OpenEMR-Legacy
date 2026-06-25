import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedDocuments } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const documentSignoffAnchorPatientId = "MOD-PAT-0001";

test.describe("patient document sign-off parity @slice38 @workflow-document-signoff @mutation", () => {
  test("creates, signs, renders, archives, and removes a reviewed patient document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(documentSignoffAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const name = `Parity Signed Document ${workflowSuffix()}`;
    const body = `Created by the parity document sign-off suite for ${name}.`;
    const documentInput = {
      patientId: patient!.pid,
      categoryId: 3,
      categoryName: "Medical Record",
      name,
      docDate: "2026-06-18",
      encounter: 1000013,
      content: body,
      notes: "Created by the parity document sign-off suite."
    };
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-38-document-signoff-precondition",
        description: "Captures the Slice 38 document sign-off anchor patient, baseline document count, and proposed temporary reviewed document payload before create.",
        expected: {
          patient: {
            pubpid: documentSignoffAnchorPatientId,
            displayName: "Stone, Avery"
          },
          create: {
            categoryId: 3,
            categoryName: "Medical Record",
            docDate: "2026-06-18",
            encounter: 1000013,
            mimetype: "text/plain",
            storageMethod: "database",
            reviewStatus: "pending",
            reviewedBy: "",
            reviewedAt: ""
          },
          sign: {
            reviewStatus: "approved",
            reviewedBy: "admin"
          },
          countChange: {
            documentsAfterCreate: beforeCounts.documents + 1,
            documentsAfterArchive: beforeCounts.documents,
            documentsAfterCleanup: beforeCounts.documents
          }
        },
        actual: {
          patient,
          beforeCounts,
          proposedDocument: documentInput
        },
        context: {
          canonicalId: documentSignoffAnchorPatientId,
          suite: "workflow-document-signoff",
          workflow: "patient-document-signoff"
        }
      });

      documentId = await workflow.createPatientDocument(documentInput);

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name,
        docDate: "2026-06-18",
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0,
        reviewStatus: "pending",
        reviewedBy: "",
        reviewedAt: ""
      });
      expect(created!.contentPreview).toContain(body);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-38-document-signoff-created",
        description: "Captures the temporary Slice 38 pending document row and document-count increment immediately after create.",
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
            reviewStatus: "pending",
            reviewedBy: "",
            reviewedAt: ""
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
          canonicalId: documentSignoffAnchorPatientId,
          suite: "workflow-document-signoff",
          workflow: "patient-document-signoff-created"
        }
      });

      await workflow.signPatientDocument(documentId, "admin");

      const signed = await workflow.getPatientDocument(documentId);
      expect(signed).toMatchObject({
        reviewStatus: "approved",
        reviewedBy: "admin",
        deleted: 0
      });
      expect(signed!.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      const afterSignCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-38-document-signoff-signed",
        description: "Captures the temporary Slice 38 document row after approved sign-off review state is applied.",
        expected: {
          document: {
            reviewStatus: "approved",
            reviewedBy: "admin",
            deleted: 0
          },
          counts: {
            documents: beforeCounts.documents + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterSignCounts,
          documentId,
          created,
          signed
        },
        context: {
          canonicalId: documentSignoffAnchorPatientId,
          suite: "workflow-document-signoff",
          workflow: "patient-document-signoff-signed"
        }
      });
      expect(afterSignCounts.documents).toBe(beforeCounts.documents + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, name);
        await expectRenderedText(page, "Medical Record");
      } else {
        await openAuthenticatedModernizedDocuments(page, target, patient!.pubpid);

        const documentCard = page.locator(".document-card").filter({ hasText: name }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText("approved");
        await expect(documentCard).toContainText("Reviewed by admin");
        await documentCard.getByRole("button", { name: "View" }).click();
        await expect(page.getByRole("heading", { name: "Document Viewer" })).toBeVisible();
        await expect(page.getByLabel("Document viewer")).toContainText("approved");
        await expect(page.getByLabel("Document viewer")).toContainText("admin");
      }

      await workflow.softDeletePatientDocument(documentId);
      const archived = await workflow.getPatientDocument(documentId);
      expect(archived).toMatchObject({
        deleted: 1
      });
      const afterArchiveCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-38-document-signoff-archived",
        description: "Captures the temporary Slice 38 signed document after soft-delete/archive while preserving the count increment until hard cleanup.",
        expected: {
          document: {
            reviewStatus: "approved",
            reviewedBy: "admin",
            deleted: 1
          },
          counts: {
            documents: beforeCounts.documents
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterArchiveCounts,
          documentId,
          signed,
          archived
        },
        context: {
          canonicalId: documentSignoffAnchorPatientId,
          suite: "workflow-document-signoff",
          workflow: "patient-document-signoff-archived"
        }
      });
      expect(afterArchiveCounts.documents).toBe(beforeCounts.documents);
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
        probe: "slice-38-document-signoff-cleanup",
        description: "Captures the final Slice 38 hard-delete cleanup state for the temporary signed patient document.",
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
          canonicalId: documentSignoffAnchorPatientId,
          suite: "workflow-document-signoff",
          workflow: "patient-document-signoff-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
