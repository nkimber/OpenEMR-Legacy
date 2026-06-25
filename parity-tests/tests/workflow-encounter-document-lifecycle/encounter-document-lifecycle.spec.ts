import type { Page } from "@playwright/test";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { PatientDocumentRecord } from "../../src/workflows/legacyWorkflowActions.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterDocumentLifecycleAnchorPatientId = "MOD-PAT-0001";
const encounterDocumentLifecycleAnchorEncounter = 1000013;
const encounterDocumentLifecycleFromDate = "2026-01-01";

type EncounterDocumentLifecycleEvent = {
  code: string;
  label: string;
  occurredAt?: string | null;
  actor?: string | null;
  detail: string;
};

type EncounterDocumentApiAttachment = {
  id: number;
  name: string;
  deleted: number;
  reviewStatus: string;
  reviewedBy?: string | null;
  lifecycleEvents?: EncounterDocumentLifecycleEvent[];
};

test.describe("encounter document lifecycle timeline parity @slice86 @workflow-encounter-document-lifecycle @mutation", () => {
  test("tracks, renders, archives, restores, and removes encounter document lifecycle states", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentLifecycleAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${encounterDocumentLifecycleAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient.pid,
      encounterDocumentLifecycleAnchorEncounter
    );
    const documentName = `Parity Encounter Lifecycle Document ${workflowSuffix()}`;
    const body = `Created by the parity encounter document lifecycle suite for ${documentName}.`;
    const notes = "Created by the parity encounter document lifecycle suite.";
    const documentInput = {
      patientId: patient.pid,
      encounter: encounterDocumentLifecycleAnchorEncounter,
      categoryId: 3,
      categoryName: "Medical Record",
      name: documentName,
      docDate: "2026-06-18",
      content: body,
      notes
    };
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-86-encounter-document-lifecycle-precondition",
        description: "Captures the Slice 86 encounter document lifecycle anchor patient, encounter document baseline, proposed temporary text attachment, and expected lifecycle transitions before create.",
        expected: {
          patient: {
            pubpid: encounterDocumentLifecycleAnchorPatientId,
            displayName: "Stone, Avery"
          },
          encounter: encounterDocumentLifecycleAnchorEncounter,
          lifecycle: {
            created: ["filed", "current-version", "review-pending", "active"],
            signed: ["filed", "current-version", "review-approved", "active"],
            archived: ["filed", "current-version", "review-approved", "archived"],
            restored: ["filed", "current-version", "review-approved", "active"]
          },
          countChange: {
            documentsAfterCreate: beforeCounts.documents + 1,
            encounterDocumentsAfterCreate: beforeEncounterDocuments.documents.length + 1,
            documentsAfterArchive: beforeCounts.documents,
            encounterDocumentsAfterArchive: beforeEncounterDocuments.documents.length,
            documentsAfterRestore: beforeCounts.documents + 1,
            encounterDocumentsAfterRestore: beforeEncounterDocuments.documents.length + 1,
            documentsAfterCleanup: beforeCounts.documents,
            encounterDocumentsAfterCleanup: beforeEncounterDocuments.documents.length
          }
        },
        actual: {
          patient,
          beforeCounts,
          beforeEncounterDocuments,
          proposedDocument: documentInput
        },
        context: {
          canonicalId: encounterDocumentLifecycleAnchorPatientId,
          encounter: encounterDocumentLifecycleAnchorEncounter,
          suite: "workflow-encounter-document-lifecycle",
          workflow: "encounter-document-lifecycle"
        }
      });

      documentId = await workflow.createEncounterDocument(documentInput);

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-18",
        encounter: encounterDocumentLifecycleAnchorEncounter,
        deleted: 0,
        reviewStatus: "pending",
        notes
      });
      expect(created!.contentPreview).toContain(body);
      expectLifecycleCodes(created!, ["filed", "current-version", "review-pending", "active"]);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);
      const afterCreateEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterDocumentLifecycleAnchorEncounter
      );
      expect(afterCreateEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);

      let apiCreated: EncounterDocumentApiAttachment | null = null;
      if (target.type === "modernized-openemr") {
        apiCreated = await expectModernizedLifecycle(page, target, Number(documentId), [
          "filed",
          "current-version",
          "review-pending",
          "active"
        ]);

        const createdCard = await openModernizedEncounterDocumentCard(page, target, patient.pubpid, documentName);
        await expect(createdCard).toContainText("Filed");
        await expect(createdCard).toContainText("Current version");
        await expect(createdCard).toContainText("Review pending");
        await expect(createdCard).toContainText("Active");
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-86-encounter-document-lifecycle-created",
        description: "Captures the temporary Slice 86 encounter document after create with filed/current-version/review-pending/active lifecycle facts.",
        expected: {
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: documentName,
            docDate: "2026-06-18",
            encounter: encounterDocumentLifecycleAnchorEncounter,
            deleted: 0,
            reviewStatus: "pending",
            notes,
            contentPreviewIncludes: body
          },
          lifecycleCodes: ["filed", "current-version", "review-pending", "active"],
          counts: {
            documents: beforeCounts.documents + 1,
            encounterDocuments: beforeEncounterDocuments.documents.length + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          beforeEncounterDocuments,
          afterCreateCounts,
          afterCreateEncounterDocuments,
          documentId,
          created,
          derivedLifecycleCodes: deriveLifecycleCodes(created!),
          apiCreated
        },
        context: {
          canonicalId: encounterDocumentLifecycleAnchorPatientId,
          encounter: encounterDocumentLifecycleAnchorEncounter,
          suite: "workflow-encounter-document-lifecycle",
          workflow: "encounter-document-lifecycle-created"
        }
      });

      await workflow.signEncounterDocument(encounterDocumentLifecycleAnchorEncounter, documentId, "admin");

      const signed = await workflow.getPatientDocument(documentId);
      expect(signed).toMatchObject({
        deleted: 0,
        reviewStatus: "approved",
        reviewedBy: "admin"
      });
      expect(signed!.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      expectLifecycleCodes(signed!, ["filed", "current-version", "review-approved", "active"]);

      let apiSigned: EncounterDocumentApiAttachment | null = null;
      if (target.type === "modernized-openemr") {
        apiSigned = await expectModernizedLifecycle(page, target, Number(documentId), [
          "filed",
          "current-version",
          "review-approved",
          "active"
        ]);
        expect(apiSigned.reviewedBy).toBe("admin");

        const signedCard = await openModernizedEncounterDocumentCard(page, target, patient.pubpid, documentName);
        await expect(signedCard).toContainText("Review approved");
        await expect(signedCard).toContainText("By admin");
        await expect(signedCard).toContainText("Active");
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-86-encounter-document-lifecycle-signed",
        description: "Captures the temporary Slice 86 encounter document after sign-off with review-approved lifecycle facts.",
        expected: {
          document: {
            name: documentName,
            encounter: encounterDocumentLifecycleAnchorEncounter,
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
          canonicalId: encounterDocumentLifecycleAnchorPatientId,
          encounter: encounterDocumentLifecycleAnchorEncounter,
          suite: "workflow-encounter-document-lifecycle",
          workflow: "encounter-document-lifecycle-signed"
        }
      });

      await workflow.softDeleteEncounterDocument(encounterDocumentLifecycleAnchorEncounter, documentId);

      const archived = await workflow.getPatientDocument(documentId);
      expect(archived).toMatchObject({
        deleted: 1,
        reviewStatus: "approved",
        reviewedBy: "admin",
        encounter: encounterDocumentLifecycleAnchorEncounter
      });
      expectLifecycleCodes(archived!, ["filed", "current-version", "review-approved", "archived"]);

      const afterArchiveCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterArchiveCounts.documents).toBe(beforeCounts.documents);
      const afterArchiveEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterDocumentLifecycleAnchorEncounter
      );
      expect(afterArchiveEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);

      let apiArchived: EncounterDocumentApiAttachment | null = null;
      if (target.type === "modernized-openemr") {
        apiArchived = await expectModernizedLifecycle(page, target, Number(documentId), [
          "filed",
          "current-version",
          "review-approved",
          "archived"
        ]);

        const archivedCard = await openModernizedEncounterDocumentCard(page, target, patient.pubpid, documentName, true);
        await expect(archivedCard).toContainText("Review approved");
        await expect(archivedCard).toContainText("Archived");
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-86-encounter-document-lifecycle-archived",
        description: "Captures the temporary Slice 86 encounter document after archive with review-approved/archived lifecycle facts and active-count return.",
        expected: {
          document: {
            name: documentName,
            encounter: encounterDocumentLifecycleAnchorEncounter,
            deleted: 1,
            reviewStatus: "approved",
            reviewedBy: "admin"
          },
          lifecycleCodes: ["filed", "current-version", "review-approved", "archived"],
          counts: {
            documents: beforeCounts.documents,
            encounterDocuments: beforeEncounterDocuments.documents.length
          }
        },
        actual: {
          patient,
          beforeCounts,
          beforeEncounterDocuments,
          afterArchiveCounts,
          afterArchiveEncounterDocuments,
          documentId,
          signed,
          archived,
          derivedLifecycleCodes: deriveLifecycleCodes(archived!),
          apiArchived
        },
        context: {
          canonicalId: encounterDocumentLifecycleAnchorPatientId,
          encounter: encounterDocumentLifecycleAnchorEncounter,
          suite: "workflow-encounter-document-lifecycle",
          workflow: "encounter-document-lifecycle-archived"
        }
      });

      await workflow.restoreEncounterDocument(encounterDocumentLifecycleAnchorEncounter, documentId);

      const restored = await workflow.getPatientDocument(documentId);
      expect(restored).toMatchObject({
        deleted: 0,
        reviewStatus: "approved",
        reviewedBy: "admin",
        encounter: encounterDocumentLifecycleAnchorEncounter
      });
      expect(restored!.contentPreview).toContain(body);
      expectLifecycleCodes(restored!, ["filed", "current-version", "review-approved", "active"]);

      const afterRestoreCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterRestoreCounts.documents).toBe(beforeCounts.documents + 1);
      const afterRestoreEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterDocumentLifecycleAnchorEncounter
      );
      expect(afterRestoreEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-86-encounter-document-lifecycle-restored",
        description: "Captures the temporary Slice 86 encounter document after restore with review-approved/active lifecycle facts and restored encounter attachment counts.",
        expected: {
          document: {
            name: documentName,
            encounter: encounterDocumentLifecycleAnchorEncounter,
            deleted: 0,
            reviewStatus: "approved",
            reviewedBy: "admin",
            contentPreviewIncludes: body
          },
          lifecycleCodes: ["filed", "current-version", "review-approved", "active"],
          counts: {
            documents: beforeCounts.documents + 1,
            encounterDocuments: beforeEncounterDocuments.documents.length + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          beforeEncounterDocuments,
          afterRestoreCounts,
          afterRestoreEncounterDocuments,
          documentId,
          archived,
          restored,
          derivedLifecycleCodes: deriveLifecycleCodes(restored!)
        },
        context: {
          canonicalId: encounterDocumentLifecycleAnchorPatientId,
          encounter: encounterDocumentLifecycleAnchorEncounter,
          suite: "workflow-encounter-document-lifecycle",
          workflow: "encounter-document-lifecycle-restored"
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
          probe: "slice-86-encounter-document-lifecycle-surface",
          description: "Captures the legacy Documents category rendering facts for the temporary restored Slice 86 lifecycle encounter document.",
          expected: {
            category: "Medical Record",
            documentName,
            encounter: encounterDocumentLifecycleAnchorEncounter,
            lifecycleCodes: ["filed", "current-version", "review-approved", "active"]
          },
          actual: {
            patient,
            documentId,
            restored,
            afterRestoreEncounterDocuments,
            surface: {
              application: "legacy-openemr",
              page: "patient-documents",
              category: "Medical Record",
              renderedDocumentName: documentName
            }
          },
          context: {
            canonicalId: encounterDocumentLifecycleAnchorPatientId,
            encounter: encounterDocumentLifecycleAnchorEncounter,
            suite: "workflow-encounter-document-lifecycle",
            workflow: "encounter-document-lifecycle-legacy-surface"
          }
        });
      } else {
        const apiRestored = await expectModernizedLifecycle(page, target, Number(documentId), [
          "filed",
          "current-version",
          "review-approved",
          "active"
        ]);

        const restoredCard = await openModernizedEncounterDocumentCard(page, target, patient.pubpid, documentName);
        await expect(restoredCard).toContainText("Review approved");
        await expect(restoredCard).toContainText("Active");
        await expect(restoredCard).toContainText(body);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-86-encounter-document-lifecycle-surface",
          description: "Captures the modernized encounter-detail API lifecycle facts and Encounters attached-document UI anchors for the temporary restored Slice 86 lifecycle document.",
          expected: {
            apiDocument: {
              name: documentName,
              deleted: 0,
              reviewStatus: "approved",
              reviewedBy: "admin"
            },
            lifecycleCodes: ["filed", "current-version", "review-approved", "active"],
            ui: {
              region: "Encounter attached documents",
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
              api: `/api/encounters/${encounterDocumentLifecycleAnchorEncounter}?includeArchivedDocuments=true`,
              page: "encounters",
              region: "Encounter attached documents",
              encounterButton: "Hyperlipidemia",
              renderedDocumentName: documentName
            }
          },
          context: {
            canonicalId: encounterDocumentLifecycleAnchorPatientId,
            encounter: encounterDocumentLifecycleAnchorEncounter,
            suite: "workflow-encounter-document-lifecycle",
            workflow: "encounter-document-lifecycle-modernized-surface"
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
    const afterCleanupEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient.pid,
      encounterDocumentLifecycleAnchorEncounter
    );
    expect(afterCleanupEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);
    if (documentId !== null) {
      const afterCleanup = await workflow.getPatientDocument(documentId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-86-encounter-document-lifecycle-cleanup",
        description: "Captures the final Slice 86 hard-delete cleanup state for the temporary lifecycle encounter document and restored encounter attachment list.",
        expected: {
          counts: {
            documents: beforeCounts.documents,
            encounterDocuments: beforeEncounterDocuments.documents.length
          },
          deletedDocument: null
        },
        actual: {
          patient,
          beforeCounts,
          beforeEncounterDocuments,
          afterCleanupCounts,
          afterCleanupEncounterDocuments,
          documentId,
          afterCleanup
        },
        context: {
          canonicalId: encounterDocumentLifecycleAnchorPatientId,
          encounter: encounterDocumentLifecycleAnchorEncounter,
          suite: "workflow-encounter-document-lifecycle",
          workflow: "encounter-document-lifecycle-cleanup"
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
  documentId: number,
  expectedCodes: string[]
) {
  const response = await page.request.get(
    `${target.apiBaseUrl}/api/encounters/${encounterDocumentLifecycleAnchorEncounter}?includeArchivedDocuments=true`,
    { headers: await getModernizedAdminSessionHeaders(page, target) }
  );
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { documents: EncounterDocumentApiAttachment[] };
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

async function openModernizedEncounterDocumentCard(
  page: Page,
  target: RuntimeTarget,
  patientPublicId: string,
  documentName: string,
  includeArchived = false
) {
  await openAuthenticatedModernizedEncounters(page, target, patientPublicId, encounterDocumentLifecycleFromDate);

  const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
  await expect(encounterButton).toBeVisible();
  await encounterButton.click();

  const attachments = page.getByRole("region", { name: "Encounter attached documents" });
  if (includeArchived) {
    await attachments.getByLabel("Show archived attached documents").check();
  }

  const documentCard = attachments.locator(".encounter-document-card").filter({ hasText: documentName }).first();
  await expect(documentCard).toBeVisible();
  return documentCard;
}

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
