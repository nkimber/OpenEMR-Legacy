import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedDocuments } from "../../src/ui/modernizedOpenEmr.js";
const documentRevisionReplacementAnchorPatientId = "MOD-PAT-0001";

test.describe("patient document replacement revision parity @slice55 @workflow-document-revision-replace @mutation @documents", () => {
  test("content replacement updates the current document revision in place", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(documentRevisionReplacementAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const documentName = `Parity Revision Replace Document ${suffix}`;
    const replacementFileName = `${documentName}.txt`;
    const originalBody = `Original revision payload for ${documentName}.`;
    const replacementBody = `Replacement revision payload for ${documentName}.`;
    const documentInput = {
      patientId: patient!.pid,
      categoryId: 3,
      categoryName: "Medical Record",
      name: documentName,
      docDate: "2026-06-19",
      encounter: 1000013,
      content: originalBody,
      notes: "Created by the parity document revision replacement suite."
    };
    const replacementInput = {
      fileName: replacementFileName,
      content: replacementBody
    };
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-55-document-revision-replace-precondition",
        description: "Captures the Slice 55 document replacement revision anchor patient, baseline document count, proposed original document, and replacement payload before create.",
        expected: {
          patient: {
            pubpid: documentRevisionReplacementAnchorPatientId,
            displayName: "Stone, Avery"
          },
          create: {
            categoryId: 3,
            categoryName: "Medical Record",
            docDate: "2026-06-19",
            encounter: 1000013,
            mimetype: "text/plain",
            storageMethod: "database",
            currentVersion: 1,
            versionLabel: "Version 1",
            versionStatus: "Current version",
            versionHistoryCount: 1,
            hasPriorVersions: false
          },
          replace: {
            fileName: replacementFileName,
            contentIncludes: replacementBody,
            contentExcludes: originalBody
          },
          countChange: {
            documentsAfterCreate: beforeCounts.documents + 1,
            documentsAfterReplace: beforeCounts.documents + 1,
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
          canonicalId: documentRevisionReplacementAnchorPatientId,
          suite: "workflow-document-revision-replace",
          workflow: "patient-document-revision-replacement"
        }
      });

      documentId = await workflow.createPatientDocument(documentInput);

      const createdContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(createdContent).not.toBeNull();
      expect(createdContent).toMatchObject({
        currentVersion: 1,
        versionLabel: "Version 1",
        versionStatus: "Current version",
        versionHistoryCount: 1,
        hasPriorVersions: false
      });
      expect(createdContent!.content).toContain(originalBody);
      expect(createdContent!.revisionHash).toBe(createdContent!.hash);
      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-55-document-revision-replace-created",
        description: "Captures the temporary Slice 55 document after create, including original content, revision metadata, hash parity, and active document-count increment.",
        expected: {
          content: {
            currentVersion: 1,
            versionLabel: "Version 1",
            versionStatus: "Current version",
            versionHistoryCount: 1,
            hasPriorVersions: false,
            includes: originalBody
          },
          revision: {
            revisionHashEqualsHash: true
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
          createdContent
        },
        context: {
          canonicalId: documentRevisionReplacementAnchorPatientId,
          suite: "workflow-document-revision-replace",
          workflow: "patient-document-revision-replacement-created"
        }
      });

      await page.waitForTimeout(1100);

      await workflow.replacePatientDocumentContent(documentId, replacementInput);

      const replacedContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(replacedContent).not.toBeNull();
      expect(replacedContent).toMatchObject({
        id: Number(documentId),
        currentVersion: 1,
        versionLabel: "Version 1",
        versionStatus: "Current version",
        versionHistoryCount: 1,
        hasPriorVersions: false,
        mimetype: "text/plain",
        storageMethod: "database"
      });
      expect(replacedContent!.content).toContain(replacementBody);
      expect(replacedContent!.content).not.toContain(originalBody);
      expect(replacedContent!.hash).not.toBe(createdContent!.hash);
      expect(replacedContent!.revisionHash).toBe(replacedContent!.hash);
      expect(timestampSeconds(replacedContent!.revisionAt)).toBeGreaterThan(timestampSeconds(createdContent!.revisionAt));

      const afterReplaceCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterReplaceCounts.documents).toBe(beforeCounts.documents + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-55-document-revision-replace-replaced",
        description: "Captures the temporary Slice 55 document after content replacement, including current revision timestamp/hash movement and stable single-version projection.",
        expected: {
          content: {
            id: Number(documentId),
            currentVersion: 1,
            versionLabel: "Version 1",
            versionStatus: "Current version",
            versionHistoryCount: 1,
            hasPriorVersions: false,
            mimetype: "text/plain",
            storageMethod: "database",
            includes: replacementBody,
            excludes: originalBody
          },
          revision: {
            hashChanged: true,
            revisionHashEqualsHash: true,
            revisionMovedForward: true
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
          replacementInput,
          createdContent,
          replacedContent,
          revisionComparison: {
            createdRevisionAt: createdContent!.revisionAt,
            replacedRevisionAt: replacedContent!.revisionAt,
            createdHash: createdContent!.hash,
            replacedHash: replacedContent!.hash
          }
        },
        context: {
          canonicalId: documentRevisionReplacementAnchorPatientId,
          suite: "workflow-document-revision-replace",
          workflow: "patient-document-revision-replacement-replaced"
        }
      });

      if (target.type !== "legacy-openemr") {
        await openAuthenticatedModernizedDocuments(page, target, patient!.pubpid);

        const documentCard = page.locator(".document-card").filter({ hasText: documentName }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText(replacementBody);
        await expect(documentCard).toContainText("Version 1 / Current version");
        await expect(documentCard).toContainText("No prior versions");

        await documentCard.getByRole("button", { name: "View" }).click();
        await expect(page.getByRole("heading", { name: "Document Viewer" })).toBeVisible();
        const viewer = page.getByLabel("Document viewer");
        await expect(viewer).toContainText("Version 1");
        await expect(viewer).toContainText("1 current version");
        await expect(viewer).toContainText(replacementBody);
      }

      await workflow.softDeletePatientDocument(documentId);
      const archived = await workflow.getPatientDocument(documentId);
      expect(archived).toMatchObject({ deleted: 1 });
      const afterArchiveCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-55-document-revision-replace-archived",
        description: "Captures the temporary Slice 55 replaced document after soft-delete/archive and active document-count return to baseline.",
        expected: {
          document: {
            name: documentName,
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
          archived
        },
        context: {
          canonicalId: documentRevisionReplacementAnchorPatientId,
          suite: "workflow-document-revision-replace",
          workflow: "patient-document-revision-replacement-archived"
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
        probe: "slice-55-document-revision-replace-cleanup",
        description: "Captures the final Slice 55 hard-delete cleanup state for the temporary revision-replaced patient document.",
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
          canonicalId: documentRevisionReplacementAnchorPatientId,
          suite: "workflow-document-revision-replace",
          workflow: "patient-document-revision-replacement-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function timestampSeconds(value: string) {
  const [datePart, timePart = "00:00:00"] = value.trim().split(" ");
  const secondPart = timePart.split(".")[0];
  const parsed = Date.parse(`${datePart}T${secondPart}Z`);
  if (Number.isNaN(parsed)) {
    throw new Error(`Could not parse database timestamp: ${value}`);
  }

  return Math.floor(parsed / 1000);
}
