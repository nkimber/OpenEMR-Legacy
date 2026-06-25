import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedDocuments } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const documentArchiveAnchorPatientId = "MOD-PAT-0001";

test.describe("patient document archive restore parity @slice42 @workflow-document-archive @mutation", () => {
  test("archives, hides, restores, renders, and removes a patient document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(documentArchiveAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const documentName = `Parity Restorable Document ${suffix}`;
    const body = `Created by the parity document archive restore suite for ${documentName}.`;
    const documentInput = {
      patientId: patient!.pid,
      categoryId: 3,
      categoryName: "Medical Record",
      name: documentName,
      docDate: "2026-06-19",
      encounter: 1000013,
      content: body,
      notes: "Created by the parity document archive restore suite."
    };
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-42-document-archive-precondition",
        description: "Captures the Slice 42 document archive/restore anchor patient, baseline document count, and proposed restorable document payload before create.",
        expected: {
          patient: {
            pubpid: documentArchiveAnchorPatientId,
            displayName: "Stone, Avery"
          },
          create: {
            categoryId: 3,
            categoryName: "Medical Record",
            docDate: "2026-06-19",
            encounter: 1000013,
            mimetype: "text/plain",
            storageMethod: "database",
            deleted: 0,
            reviewStatus: "pending"
          },
          countChange: {
            documentsAfterCreate: beforeCounts.documents + 1,
            documentsAfterArchive: beforeCounts.documents,
            documentsAfterRestore: beforeCounts.documents + 1,
            documentsAfterCleanup: beforeCounts.documents
          }
        },
        actual: {
          patient,
          beforeCounts,
          proposedDocument: documentInput
        },
        context: {
          canonicalId: documentArchiveAnchorPatientId,
          suite: "workflow-document-archive",
          workflow: "patient-document-archive-restore"
        }
      });

      documentId = await workflow.createPatientDocument(documentInput);

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-19",
        deleted: 0,
        reviewStatus: "pending"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-42-document-archive-created",
        description: "Captures the temporary Slice 42 restorable document row and active document-count increment immediately after create.",
        expected: {
          document: {
            patientId: patient!.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: documentName,
            docDate: "2026-06-19",
            encounter: 1000013,
            mimetype: "text/plain",
            storageMethod: "database",
            deleted: 0,
            reviewStatus: "pending"
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
          canonicalId: documentArchiveAnchorPatientId,
          suite: "workflow-document-archive",
          workflow: "patient-document-archive-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.softDeletePatientDocument(documentId);
      } else {
        await openAuthenticatedModernizedDocuments(page, target, patient!.pubpid);
        await page.getByLabel("Show archived documents").check();

        const activeCard = page.locator(".document-card").filter({ hasText: documentName }).first();
        await expect(activeCard).toBeVisible();
        await activeCard.getByRole("button", { name: "Archive" }).click();
        await expect(activeCard).toContainText("Archived");
        await expect(activeCard.getByRole("button", { name: "Restore" })).toBeVisible();
      }

      const archived = await workflow.getPatientDocument(documentId);
      expect(archived).toMatchObject({
        deleted: 1,
        name: documentName,
        categoryName: "Medical Record"
      });
      const archivedContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(archivedContent).toBeNull();

      const afterArchiveCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterArchiveCounts.documents).toBe(beforeCounts.documents);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-42-document-archive-archived",
        description: "Captures the temporary Slice 42 document after archive, including active-count return and hidden archived content projection.",
        expected: {
          document: {
            name: documentName,
            categoryName: "Medical Record",
            deleted: 1,
            storageMethod: "database"
          },
          counts: {
            documents: beforeCounts.documents
          },
          activeContent: null
        },
        actual: {
          patient,
          beforeCounts,
          afterArchiveCounts,
          documentId,
          created,
          archived,
          archivedContent
        },
        context: {
          canonicalId: documentArchiveAnchorPatientId,
          suite: "workflow-document-archive",
          workflow: "patient-document-archive-archived"
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.restorePatientDocument(documentId);
      } else {
        const archivedCard = page.locator(".document-card").filter({ hasText: documentName }).first();
        await archivedCard.getByRole("button", { name: "Restore" }).click();
        await expect(archivedCard.getByRole("button", { name: "View" })).toBeEnabled();
      }

      const restored = await workflow.getPatientDocument(documentId);
      expect(restored).toMatchObject({
        deleted: 0,
        name: documentName,
        categoryName: "Medical Record"
      });
      expect(restored!.contentPreview).toContain(body);

      const afterRestoreCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterRestoreCounts.documents).toBe(beforeCounts.documents + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-42-document-archive-restored",
        description: "Captures the temporary Slice 42 document after restore and active document-count increment return.",
        expected: {
          document: {
            name: documentName,
            categoryName: "Medical Record",
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
          afterRestoreCounts,
          documentId,
          archived,
          restored
        },
        context: {
          canonicalId: documentArchiveAnchorPatientId,
          suite: "workflow-document-archive",
          workflow: "patient-document-archive-restored"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, documentName);
      } else {
        const restoredCard = page.locator(".document-card").filter({ hasText: documentName }).first();
        await expect(restoredCard).toBeVisible();
        await expect(restoredCard).not.toContainText("Archived");
        await restoredCard.getByRole("button", { name: "View" }).click();
        await expect(page.getByRole("heading", { name: "Document Viewer" })).toBeVisible();
        await expect(page.locator(".document-content-block")).toContainText(body);
      }
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
        probe: "slice-42-document-archive-cleanup",
        description: "Captures the final Slice 42 hard-delete cleanup state for the temporary restored patient document.",
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
          canonicalId: documentArchiveAnchorPatientId,
          suite: "workflow-document-archive",
          workflow: "patient-document-archive-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
