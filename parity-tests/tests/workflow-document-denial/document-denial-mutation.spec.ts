import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedDocuments } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const documentDenialAnchorPatientId = "MOD-PAT-0001";

test.describe("patient document denial parity @slice40 @workflow-document-denial @mutation", () => {
  test("creates, denies, renders, archives, and removes a reviewed patient document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(documentDenialAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const name = `Parity Denied Document ${workflowSuffix()}`;
    const body = `Created by the parity document denial suite for ${name}.`;
    const documentInput = {
      patientId: patient!.pid,
      categoryId: 3,
      categoryName: "Medical Record",
      name,
      docDate: "2026-06-18",
      encounter: 1000013,
      content: body,
      notes: "Created by the parity document denial suite."
    };
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-40-document-denial-precondition",
        description: "Captures the Slice 40 document denial anchor patient, baseline document count, and proposed temporary reviewed document payload before create.",
        expected: {
          patient: {
            pubpid: documentDenialAnchorPatientId,
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
          deny: {
            reviewStatus: "denied",
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
          canonicalId: documentDenialAnchorPatientId,
          suite: "workflow-document-denial",
          workflow: "patient-document-denial"
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
        probe: "slice-40-document-denial-created",
        description: "Captures the temporary Slice 40 pending document row and active document-count increment immediately after create.",
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
          canonicalId: documentDenialAnchorPatientId,
          suite: "workflow-document-denial",
          workflow: "patient-document-denial-created"
        }
      });

      await workflow.denyPatientDocument(documentId, "admin");

      const denied = await workflow.getPatientDocument(documentId);
      expect(denied).toMatchObject({
        reviewStatus: "denied",
        reviewedBy: "admin",
        deleted: 0
      });
      expect(denied!.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      const afterDenyCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-40-document-denial-denied",
        description: "Captures the temporary Slice 40 document row after denied review state is applied.",
        expected: {
          document: {
            reviewStatus: "denied",
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
          afterDenyCounts,
          documentId,
          created,
          denied
        },
        context: {
          canonicalId: documentDenialAnchorPatientId,
          suite: "workflow-document-denial",
          workflow: "patient-document-denial-denied"
        }
      });
      expect(afterDenyCounts.documents).toBe(beforeCounts.documents + 1);

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
        await expect(documentCard).toContainText("denied");
        await expect(documentCard).toContainText("Reviewed by admin");
        await expect(documentCard.getByRole("button", { name: "Sign" })).toBeDisabled();
        await expect(documentCard.getByRole("button", { name: "Deny" })).toBeDisabled();
        await documentCard.getByRole("button", { name: "View" }).click();
        await expect(page.getByRole("heading", { name: "Document Viewer" })).toBeVisible();
        await expect(page.getByLabel("Document viewer")).toContainText("denied");
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
        probe: "slice-40-document-denial-archived",
        description: "Captures the temporary Slice 40 denied document after soft-delete/archive and active document-count return to baseline.",
        expected: {
          document: {
            reviewStatus: "denied",
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
          denied,
          archived
        },
        context: {
          canonicalId: documentDenialAnchorPatientId,
          suite: "workflow-document-denial",
          workflow: "patient-document-denial-archived"
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
        probe: "slice-40-document-denial-cleanup",
        description: "Captures the final Slice 40 hard-delete cleanup state for the temporary denied patient document.",
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
          canonicalId: documentDenialAnchorPatientId,
          suite: "workflow-document-denial",
          workflow: "patient-document-denial-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
