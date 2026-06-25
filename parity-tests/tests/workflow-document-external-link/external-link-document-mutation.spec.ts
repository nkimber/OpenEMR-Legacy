import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedDocuments } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const externalLinkAnchorPatientId = "MOD-PAT-0001";

test.describe("patient external-link document parity @slice39 @workflow-document-external-link @mutation", () => {
  test("creates, renders, archives, and removes an external-link patient document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(externalLinkAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const name = `Parity External Link ${suffix}`;
    const url = `https://example.test/openemr/external-record/${suffix}`;
    const externalLinkInput = {
      patientId: patient!.pid,
      categoryId: 3,
      categoryName: "Medical Record",
      name,
      docDate: "2026-06-18",
      encounter: 1000013,
      url,
      notes: "Created by the parity external-link document suite."
    };
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-39-document-external-link-precondition",
        description: "Captures the Slice 39 external-link document anchor patient, baseline document count, and proposed URL-backed document payload before create.",
        expected: {
          patient: {
            pubpid: externalLinkAnchorPatientId,
            displayName: "Stone, Avery"
          },
          create: {
            categoryId: 3,
            categoryName: "Medical Record",
            docDate: "2026-06-18",
            encounter: 1000013,
            mimetype: "text/uri-list",
            storageMethod: "web_url",
            deleted: 0,
            reviewStatus: "pending",
            reviewedBy: "",
            reviewedAt: ""
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
          proposedDocument: externalLinkInput
        },
        context: {
          canonicalId: externalLinkAnchorPatientId,
          suite: "workflow-document-external-link",
          workflow: "patient-document-external-link"
        }
      });

      documentId = await workflow.createPatientExternalLinkDocument(externalLinkInput);

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name,
        docDate: "2026-06-18",
        mimetype: "text/uri-list",
        storageMethod: "web_url",
        url,
        deleted: 0,
        reviewStatus: "pending",
        reviewedBy: "",
        reviewedAt: ""
      });
      expect(created!.contentPreview).toContain(url);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-39-document-external-link-created",
        description: "Captures the temporary Slice 39 URL-backed document row and active document-count increment immediately after create.",
        expected: {
          document: {
            patientId: patient!.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name,
            docDate: "2026-06-18",
            encounter: 1000013,
            mimetype: "text/uri-list",
            storageMethod: "web_url",
            url,
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
          canonicalId: externalLinkAnchorPatientId,
          suite: "workflow-document-external-link",
          workflow: "patient-document-external-link-created"
        }
      });

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
        await expect(documentCard).toContainText("web_url");
        await expect(documentCard).toContainText(url);
        await expect(documentCard.getByRole("link", { name: "Open Link" })).toHaveAttribute("href", url);

        await documentCard.getByRole("button", { name: "View" }).click();
        await expect(page.getByRole("heading", { name: "Document Viewer" })).toBeVisible();
        await expect(page.getByLabel("Document viewer")).toContainText("web_url");
        await expect(page.getByLabel("Document viewer")).toContainText(url);
        await expect(page.getByLabel("Document viewer").getByRole("link", { name: "Open Link" })).toHaveAttribute("href", url);
      }

      await workflow.softDeletePatientDocument(documentId);
      const archived = await workflow.getPatientDocument(documentId);
      expect(archived).toMatchObject({
        deleted: 1
      });
      const afterArchiveCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-39-document-external-link-archived",
        description: "Captures the temporary Slice 39 URL-backed document after soft-delete/archive and active document-count return to baseline.",
        expected: {
          document: {
            patientId: patient!.pid,
            storageMethod: "web_url",
            url,
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
          created,
          archived
        },
        context: {
          canonicalId: externalLinkAnchorPatientId,
          suite: "workflow-document-external-link",
          workflow: "patient-document-external-link-archived"
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
        probe: "slice-39-document-external-link-cleanup",
        description: "Captures the final Slice 39 hard-delete cleanup state for the temporary URL-backed patient document.",
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
          canonicalId: externalLinkAnchorPatientId,
          suite: "workflow-document-external-link",
          workflow: "patient-document-external-link-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
