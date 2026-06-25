import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedDocuments } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const documentContentReplacementAnchorPatientId = "MOD-PAT-0001";

test.describe("patient document content replacement parity @slice43 @workflow-document-content-replace @mutation", () => {
  test("creates, replaces, renders, archives, and removes a patient document payload", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(documentContentReplacementAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const documentName = `Parity Replace Content Document ${suffix}`;
    const replacementFileName = `${documentName}.txt`;
    const originalBody = `Original payload created by the parity document content replacement suite for ${documentName}.`;
    const replacementBody = `Replacement payload created by the parity document content replacement suite for ${documentName}.`;
    const documentInput = {
      patientId: patient!.pid,
      categoryId: 3,
      categoryName: "Medical Record",
      name: documentName,
      docDate: "2026-06-19",
      encounter: 1000013,
      content: originalBody,
      notes: "Created by the parity document content replacement suite."
    };
    const replacementInput = {
      fileName: replacementFileName,
      content: replacementBody
    };
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-43-document-content-replace-precondition",
        description: "Captures the Slice 43 document content replacement anchor patient, baseline document count, proposed original text document, and replacement payload before create.",
        expected: {
          patient: {
            pubpid: documentContentReplacementAnchorPatientId,
            displayName: "Stone, Avery"
          },
          create: {
            categoryId: 3,
            categoryName: "Medical Record",
            docDate: "2026-06-19",
            encounter: 1000013,
            mimetype: "text/plain",
            storageMethod: "database",
            deleted: 0
          },
          replace: {
            fileName: replacementFileName,
            mimetype: "text/plain",
            contentIncludes: replacementBody,
            contentExcludes: originalBody
          },
          countChange: {
            documentsAfterCreate: beforeCounts.documents + 1,
            documentsAfterReplace: beforeCounts.documents + 1,
            documentsAfterArchive: beforeCounts.documents,
            documentsAfterCleanup: beforeCounts.documents
          }
        },
        actual: {
          patient,
          beforeCounts,
          proposedDocument: documentInput,
          proposedReplacement: replacementInput
        },
        context: {
          canonicalId: documentContentReplacementAnchorPatientId,
          suite: "workflow-document-content-replace",
          workflow: "patient-document-content-replacement"
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
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0
      });
      expect(created!.contentPreview).toContain(originalBody);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);
      const originalContent = await targetDb.getPatientDocumentContent(Number(documentId));
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-43-document-content-replace-created",
        description: "Captures the temporary Slice 43 original document row, stored text payload, and active document-count increment immediately after create.",
        expected: {
          document: {
            patientId: patient!.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: documentName,
            docDate: "2026-06-19",
            mimetype: "text/plain",
            storageMethod: "database",
            deleted: 0,
            contentPreviewIncludes: originalBody
          },
          content: {
            isBinary: false,
            mimetype: "text/plain",
            includes: originalBody
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
          created,
          originalContent
        },
        context: {
          canonicalId: documentContentReplacementAnchorPatientId,
          suite: "workflow-document-content-replace",
          workflow: "patient-document-content-replacement-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.replacePatientDocumentContent(documentId, replacementInput);
      } else {
        await openAuthenticatedModernizedDocuments(page, target, patient!.pubpid);

        const documentCard = page.locator(".document-card").filter({ hasText: documentName }).first();
        await expect(documentCard).toBeVisible();
        await documentCard.getByRole("button", { name: "Replace" }).click();
        await documentCard.getByLabel("Replacement document file name").fill(replacementFileName);
        await documentCard.getByLabel("Replacement document body").fill(replacementBody);
        await documentCard.getByRole("button", { name: "Save Content" }).click();
        await expect(documentCard).toContainText(replacementBody);
        await expect(documentCard).not.toContainText(originalBody);
      }

      const replaced = await workflow.getPatientDocument(documentId);
      expect(replaced).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-19",
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0
      });
      expect(replaced!.contentPreview).toContain(replacementBody);
      expect(replaced!.contentPreview).not.toContain(originalBody);

      const replacedContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(replacedContent).not.toBeNull();
      expect(replacedContent!.isBinary).toBe(false);
      expect(replacedContent!.mimetype).toBe("text/plain");
      expect(replacedContent!.content).toContain(replacementBody);
      expect(replacedContent!.content).not.toContain(originalBody);

      const afterReplaceCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterReplaceCounts.documents).toBe(beforeCounts.documents + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-43-document-content-replace-replaced",
        description: "Captures the temporary Slice 43 document after database-backed content replacement, including preview/content assertions and stable active document count.",
        expected: {
          document: {
            patientId: patient!.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: documentName,
            docDate: "2026-06-19",
            mimetype: "text/plain",
            storageMethod: "database",
            deleted: 0,
            contentPreviewIncludes: replacementBody,
            contentPreviewExcludes: originalBody
          },
          content: {
            isBinary: false,
            mimetype: "text/plain",
            includes: replacementBody,
            excludes: originalBody
          },
          counts: {
            documents: beforeCounts.documents + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterReplaceCounts,
          documentId,
          created,
          replaced,
          replacedContent,
          replacementInput
        },
        context: {
          canonicalId: documentContentReplacementAnchorPatientId,
          suite: "workflow-document-content-replace",
          workflow: "patient-document-content-replacement-replaced"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, documentName);
      } else {
        const replacedCard = page.locator(".document-card").filter({ hasText: documentName }).first();
        await expect(replacedCard).toBeVisible();
        await replacedCard.getByRole("button", { name: "View" }).click();
        await expect(page.getByRole("heading", { name: "Document Viewer" })).toBeVisible();
        await expect(page.locator(".document-content-block")).toContainText(replacementBody);
        await expect(page.locator(".document-content-block")).not.toContainText(originalBody);
      }

      await workflow.softDeletePatientDocument(documentId);
      const archived = await workflow.getPatientDocument(documentId);
      expect(archived).toMatchObject({
        deleted: 1
      });
      const afterArchiveCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-43-document-content-replace-archived",
        description: "Captures the temporary Slice 43 replaced document after soft-delete/archive and active document-count return to baseline.",
        expected: {
          document: {
            name: documentName,
            categoryName: "Medical Record",
            deleted: 1,
            contentPreviewIncludes: replacementBody
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
          replaced,
          archived
        },
        context: {
          canonicalId: documentContentReplacementAnchorPatientId,
          suite: "workflow-document-content-replace",
          workflow: "patient-document-content-replacement-archived"
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
        probe: "slice-43-document-content-replace-cleanup",
        description: "Captures the final Slice 43 hard-delete cleanup state for the temporary content-replaced patient document.",
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
          canonicalId: documentContentReplacementAnchorPatientId,
          suite: "workflow-document-content-replace",
          workflow: "patient-document-content-replacement-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
