import type { Page } from "@playwright/test";
import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  getModernizedAdminSessionHeaders,
  openAuthenticatedModernizedDocuments
} from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { PatientDocumentRecord } from "../../src/workflows/legacyWorkflowActions.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const documentLifecycleAnchorPatientId = "MOD-PAT-0001";

type PatientDocumentLifecycleEvent = {
  code: string;
  label: string;
  occurredAt?: string | null;
  actor?: string | null;
  detail: string;
};

type PatientDocumentApiItem = {
  id: number;
  name: string;
  deleted: number;
  reviewStatus: string;
  reviewedBy?: string | null;
  lifecycleEvents?: PatientDocumentLifecycleEvent[];
};

test.describe("patient document lifecycle timeline parity @slice91 @workflow-document-lifecycle @mutation @documents", () => {
  test("tracks, renders, archives, restores, and removes patient document lifecycle states", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(documentLifecycleAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${documentLifecycleAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const documentName = `Parity Patient Lifecycle Document ${workflowSuffix()}`;
    const body = `Created by the parity patient document lifecycle suite for ${documentName}.`;
    const notes = "Created by the parity patient document lifecycle suite.";
    const documentInput = {
      patientId: patient.pid,
      categoryId: 3,
      categoryName: "Medical Record",
      name: documentName,
      docDate: "2026-06-20",
      encounter: 1000013,
      content: body,
      notes
    };
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-91-document-lifecycle-precondition",
        description: "Captures the Slice 91 patient document lifecycle anchor patient, baseline document count, proposed temporary text document, and expected lifecycle transitions before create.",
        expected: {
          patient: {
            pubpid: documentLifecycleAnchorPatientId,
            displayName: "Stone, Avery"
          },
          lifecycle: {
            created: ["filed", "current-version", "review-pending", "active"],
            signed: ["filed", "current-version", "review-approved", "active"],
            archived: ["filed", "current-version", "review-approved", "archived"],
            restored: ["filed", "current-version", "review-approved", "active"]
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
          canonicalId: documentLifecycleAnchorPatientId,
          suite: "workflow-document-lifecycle",
          workflow: "patient-document-lifecycle"
        }
      });

      documentId = await workflow.createPatientDocument(documentInput);

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-20",
        encounter: 1000013,
        deleted: 0,
        reviewStatus: "pending",
        notes
      });
      expect(created!.contentPreview).toContain(body);
      expectLifecycleCodes(created!, ["filed", "current-version", "review-pending", "active"]);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      let apiCreated: PatientDocumentApiItem | null = null;
      if (target.type === "modernized-openemr") {
        apiCreated = await expectModernizedLifecycle(page, target, patient.pubpid, Number(documentId), [
          "filed",
          "current-version",
          "review-pending",
          "active"
        ]);

        const createdCard = await openModernizedPatientDocumentCard(page, target, patient.pubpid, documentName);
        await expect(createdCard).toContainText("Filed");
        await expect(createdCard).toContainText("Current version");
        await expect(createdCard).toContainText("Review pending");
        await expect(createdCard).toContainText("Active");
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-91-document-lifecycle-created",
        description: "Captures the temporary Slice 91 patient document after create with filed/current-version/review-pending/active lifecycle facts.",
        expected: {
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: documentName,
            docDate: "2026-06-20",
            encounter: 1000013,
            deleted: 0,
            reviewStatus: "pending",
            notes,
            contentPreviewIncludes: body
          },
          lifecycleCodes: ["filed", "current-version", "review-pending", "active"],
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
          derivedLifecycleCodes: deriveLifecycleCodes(created!),
          apiCreated
        },
        context: {
          canonicalId: documentLifecycleAnchorPatientId,
          suite: "workflow-document-lifecycle",
          workflow: "patient-document-lifecycle-created"
        }
      });

      await workflow.signPatientDocument(documentId, "admin");

      const signed = await workflow.getPatientDocument(documentId);
      expect(signed).toMatchObject({
        deleted: 0,
        reviewStatus: "approved",
        reviewedBy: "admin"
      });
      expect(signed!.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expectLifecycleCodes(signed!, ["filed", "current-version", "review-approved", "active"]);

      let apiSigned: PatientDocumentApiItem | null = null;
      if (target.type === "modernized-openemr") {
        apiSigned = await expectModernizedLifecycle(page, target, patient.pubpid, Number(documentId), [
          "filed",
          "current-version",
          "review-approved",
          "active"
        ]);
        expect(apiSigned.reviewedBy).toBe("admin");

        const signedCard = await openModernizedPatientDocumentCard(page, target, patient.pubpid, documentName);
        await expect(signedCard).toContainText("Review approved");
        await expect(signedCard).toContainText("By admin");
        await expect(signedCard).toContainText("Active");

        await signedCard.getByRole("button", { name: "View" }).click();
        const viewer = page.getByLabel("Document viewer");
        await expect(viewer).toContainText("Review approved");
        await expect(viewer).toContainText("By admin");
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-91-document-lifecycle-signed",
        description: "Captures the temporary Slice 91 patient document after sign-off with review-approved lifecycle facts.",
        expected: {
          document: {
            name: documentName,
            deleted: 0,
            reviewStatus: "approved",
            reviewedBy: "admin"
          },
          lifecycleCodes: ["filed", "current-version", "review-approved", "active"]
        },
        actual: {
          patient,
          documentId,
          created,
          signed,
          derivedLifecycleCodes: deriveLifecycleCodes(signed!),
          apiSigned
        },
        context: {
          canonicalId: documentLifecycleAnchorPatientId,
          suite: "workflow-document-lifecycle",
          workflow: "patient-document-lifecycle-signed"
        }
      });

      await workflow.softDeletePatientDocument(documentId);

      const archived = await workflow.getPatientDocument(documentId);
      expect(archived).toMatchObject({
        deleted: 1,
        reviewStatus: "approved",
        reviewedBy: "admin"
      });
      expectLifecycleCodes(archived!, ["filed", "current-version", "review-approved", "archived"]);

      const afterArchiveCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterArchiveCounts.documents).toBe(beforeCounts.documents);

      let apiArchived: PatientDocumentApiItem | null = null;
      if (target.type === "modernized-openemr") {
        apiArchived = await expectModernizedLifecycle(page, target, patient.pubpid, Number(documentId), [
          "filed",
          "current-version",
          "review-approved",
          "archived"
        ]);

        const archivedCard = await openModernizedPatientDocumentCard(page, target, patient.pubpid, documentName, true);
        await expect(archivedCard).toContainText("Review approved");
        await expect(archivedCard).toContainText("Archived");
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-91-document-lifecycle-archived",
        description: "Captures the temporary Slice 91 patient document after archive with review-approved/archived lifecycle facts and active-count return.",
        expected: {
          document: {
            name: documentName,
            deleted: 1,
            reviewStatus: "approved",
            reviewedBy: "admin"
          },
          lifecycleCodes: ["filed", "current-version", "review-approved", "archived"],
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
          archived,
          derivedLifecycleCodes: deriveLifecycleCodes(archived!),
          apiArchived
        },
        context: {
          canonicalId: documentLifecycleAnchorPatientId,
          suite: "workflow-document-lifecycle",
          workflow: "patient-document-lifecycle-archived"
        }
      });

      await workflow.restorePatientDocument(documentId);

      const restored = await workflow.getPatientDocument(documentId);
      expect(restored).toMatchObject({
        deleted: 0,
        reviewStatus: "approved",
        reviewedBy: "admin"
      });
      expect(restored!.contentPreview).toContain(body);
      expectLifecycleCodes(restored!, ["filed", "current-version", "review-approved", "active"]);

      const afterRestoreCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterRestoreCounts.documents).toBe(beforeCounts.documents + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-91-document-lifecycle-restored",
        description: "Captures the temporary Slice 91 patient document after restore with review-approved/active lifecycle facts and restored active document count.",
        expected: {
          document: {
            name: documentName,
            deleted: 0,
            reviewStatus: "approved",
            reviewedBy: "admin",
            contentPreviewIncludes: body
          },
          lifecycleCodes: ["filed", "current-version", "review-approved", "active"],
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
          restored,
          derivedLifecycleCodes: deriveLifecycleCodes(restored!)
        },
        context: {
          canonicalId: documentLifecycleAnchorPatientId,
          suite: "workflow-document-lifecycle",
          workflow: "patient-document-lifecycle-restored"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, documentName);
        await expectRenderedText(page, "Medical Record");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-91-document-lifecycle-surface",
          description: "Captures the legacy Documents category rendering facts for the temporary restored Slice 91 lifecycle patient document.",
          expected: {
            category: "Medical Record",
            documentName,
            lifecycleCodes: ["filed", "current-version", "review-approved", "active"]
          },
          actual: {
            patient,
            documentId,
            restored,
            surface: {
              application: "legacy-openemr",
              page: "patient-documents",
              category: "Medical Record",
              renderedDocumentName: documentName
            }
          },
          context: {
            canonicalId: documentLifecycleAnchorPatientId,
            suite: "workflow-document-lifecycle",
            workflow: "patient-document-lifecycle-legacy-surface"
          }
        });
      } else {
        const apiRestored = await expectModernizedLifecycle(page, target, patient.pubpid, Number(documentId), [
          "filed",
          "current-version",
          "review-approved",
          "active"
        ]);

        const restoredCard = await openModernizedPatientDocumentCard(page, target, patient.pubpid, documentName);
        await expect(restoredCard).toContainText("Review approved");
        await expect(restoredCard).toContainText("Active");
        await expect(restoredCard).toContainText(body);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-91-document-lifecycle-surface",
          description: "Captures the modernized Documents API lifecycle facts and Documents card/viewer UI anchors for the temporary restored Slice 91 lifecycle document.",
          expected: {
            apiDocument: {
              name: documentName,
              deleted: 0,
              reviewStatus: "approved",
              reviewedBy: "admin"
            },
            lifecycleCodes: ["filed", "current-version", "review-approved", "active"],
            ui: {
              page: "documents",
              reviewText: "Review approved",
              activeText: "Active",
              contentPreviewIncludes: body
            }
          },
          actual: {
            patient,
            documentId,
            restored,
            apiRestored,
            surface: {
              application: "modernized-openemr",
              api: `/api/documents/${encodeURIComponent(patient.pubpid)}?includeArchived=true`,
              page: "documents",
              renderedDocumentName: documentName
            }
          },
          context: {
            canonicalId: documentLifecycleAnchorPatientId,
            suite: "workflow-document-lifecycle",
            workflow: "patient-document-lifecycle-modernized-surface"
          }
        });
      }
    } finally {
      if (documentId !== null) {
        await workflow.deletePatientDocument(documentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.documents).toBe(beforeCounts.documents);
    if (documentId !== null) {
      const afterCleanup = await workflow.getPatientDocument(documentId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-91-document-lifecycle-cleanup",
        description: "Captures the final Slice 91 hard-delete cleanup state for the temporary lifecycle patient document.",
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
          canonicalId: documentLifecycleAnchorPatientId,
          suite: "workflow-document-lifecycle",
          workflow: "patient-document-lifecycle-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function expectLifecycleCodes(document: PatientDocumentRecord, expectedCodes: string[]) {
  expect(deriveLifecycleCodes(document)).toEqual(expectedCodes);
}

function deriveLifecycleCodes(document: PatientDocumentRecord) {
  const reviewCode = document.reviewStatus === "approved"
    ? "review-approved"
    : document.reviewStatus === "denied"
      ? "review-denied"
      : "review-pending";

  return [
    "filed",
    "current-version",
    reviewCode,
    document.deleted === 0 ? "active" : "archived"
  ];
}

async function expectModernizedLifecycle(
  page: Page,
  target: RuntimeTarget,
  patientPublicId: string,
  documentId: number,
  expectedCodes: string[]
) {
  const response = await page.request.get(
    `${target.apiBaseUrl}/api/documents/${encodeURIComponent(patientPublicId)}?includeArchived=true`,
    { headers: await getModernizedAdminSessionHeaders(page, target) }
  );
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { documents: PatientDocumentApiItem[] };
  const document = payload.documents.find((item) => item.id === documentId);
  expect(document).toBeTruthy();
  expect(document!.lifecycleEvents).toBeTruthy();
  expect(document!.lifecycleEvents!.map((event) => event.code)).toEqual(expectedCodes);
  expect(document!.lifecycleEvents!.map((event) => event.label)).toEqual([
    "Filed",
    "Current version",
    expectedCodes[2] === "review-approved"
      ? "Review approved"
      : expectedCodes[2] === "review-denied"
        ? "Review denied"
        : "Review pending",
    expectedCodes[3] === "archived" ? "Archived" : "Active"
  ]);
  return document!;
}

async function openModernizedPatientDocumentCard(
  page: Page,
  target: RuntimeTarget,
  patientPublicId: string,
  documentName: string,
  includeArchived = false
) {
  await openAuthenticatedModernizedDocuments(page, target, patientPublicId);

  if (includeArchived) {
    await page.getByLabel("Show archived documents").check();
  }

  const documentCard = page.locator(".document-card").filter({ hasText: documentName }).first();
  await expect(documentCard).toBeVisible();
  return documentCard;
}

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
