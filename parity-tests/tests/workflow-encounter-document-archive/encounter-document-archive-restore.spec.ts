import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterDocumentArchiveAnchorPatientId = "MOD-PAT-0001";
const encounterDocumentArchiveEncounter = 1000013;
const encounterDocumentArchiveFromDate = "2026-01-01";

test.describe("encounter document archive restore parity @slice85 @workflow-encounter-document-archive @mutation", () => {
  test("archives, hides, restores, renders, and removes an encounter-attached document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentArchiveAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${encounterDocumentArchiveAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient.pid,
      encounterDocumentArchiveEncounter
    );
    const suffix = workflowSuffix();
    const documentName = `Parity Encounter Archive Document ${suffix}`;
    const body = `Created by the parity encounter document archive restore suite for ${documentName}.`;
    const notes = "Created by the parity encounter document archive restore suite.";
    const documentInput = {
      patientId: patient.pid,
      encounter: encounterDocumentArchiveEncounter,
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
        probe: "slice-85-encounter-document-archive-precondition",
        description: "Captures the Slice 85 encounter document archive/restore anchor patient, encounter document baseline, proposed temporary text attachment, and expected archive/restore count movement before create.",
        expected: {
          patient: {
            pubpid: encounterDocumentArchiveAnchorPatientId,
            displayName: "Stone, Avery"
          },
          encounter: encounterDocumentArchiveEncounter,
          create: {
            categoryId: 3,
            categoryName: "Medical Record",
            docDate: "2026-06-18",
            encounter: encounterDocumentArchiveEncounter,
            mimetype: "text/plain",
            storageMethod: "database",
            deleted: 0,
            reviewStatus: "pending"
          },
          archive: {
            deleted: 1,
            activeContent: null
          },
          restore: {
            deleted: 0,
            contentPreviewIncludes: body
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
          canonicalId: encounterDocumentArchiveAnchorPatientId,
          encounter: encounterDocumentArchiveEncounter,
          suite: "workflow-encounter-document-archive",
          workflow: "encounter-document-archive-restore"
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
        encounter: encounterDocumentArchiveEncounter,
        deleted: 0,
        reviewStatus: "pending",
        notes
      });
      expect(created!.contentPreview).toContain(body);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);
      const afterCreateEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterDocumentArchiveEncounter
      );
      expect(afterCreateEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-85-encounter-document-archive-created",
        description: "Captures the temporary Slice 85 encounter document row, encounter document-list increment, and active document-count increment immediately after create.",
        expected: {
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: documentName,
            docDate: "2026-06-18",
            encounter: encounterDocumentArchiveEncounter,
            deleted: 0,
            reviewStatus: "pending",
            notes,
            contentPreviewIncludes: body
          },
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
          created
        },
        context: {
          canonicalId: encounterDocumentArchiveAnchorPatientId,
          encounter: encounterDocumentArchiveEncounter,
          suite: "workflow-encounter-document-archive",
          workflow: "encounter-document-archive-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.softDeleteEncounterDocument(encounterDocumentArchiveEncounter, documentId);
      } else {
        await openAuthenticatedModernizedEncounters(page, target, patient.pubpid, encounterDocumentArchiveFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const attachments = page.getByRole("region", { name: "Encounter attached documents" });
        const documentCard = attachments.locator(".encounter-document-card").filter({ hasText: documentName }).first();
        await expect(documentCard).toBeVisible();
        await documentCard.getByRole("button", { name: "Archive" }).click();
        await expect(documentCard).toContainText("Archived");
        await expect(documentCard.getByRole("button", { name: "Restore" })).toBeVisible();
        await expect(attachments.getByLabel("Show archived attached documents")).toBeChecked();
      }

      const archived = await workflow.getPatientDocument(documentId);
      expect(archived).toMatchObject({
        deleted: 1,
        name: documentName,
        categoryName: "Medical Record",
        encounter: encounterDocumentArchiveEncounter
      });
      await expect(targetDb.getPatientDocumentContent(Number(documentId))).resolves.toBeNull();
      const archivedContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(archivedContent).toBeNull();

      const afterArchiveCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterArchiveCounts.documents).toBe(beforeCounts.documents);
      const afterArchiveEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterDocumentArchiveEncounter
      );
      expect(afterArchiveEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);

      let activePayload: { documents: Array<{ id: number }> } | null = null;
      let archivedPayload: { documents: Array<Record<string, unknown>> } | null = null;
      let apiArchivedDocument: Record<string, unknown> | undefined;

      if (target.type === "legacy-openemr") {
        await workflow.restoreEncounterDocument(encounterDocumentArchiveEncounter, documentId);
      } else {
        const apiHiddenResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterDocumentArchiveEncounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
        expect(apiHiddenResponse.ok()).toBe(true);
        activePayload = await apiHiddenResponse.json();
        expect(activePayload!.documents.find((document) => document.id === Number(documentId))).toBeUndefined();

        const apiArchivedResponse = await page.request.get(
          `${target.apiBaseUrl}/api/encounters/${encounterDocumentArchiveEncounter}?includeArchivedDocuments=true`,
          { headers: await getModernizedAdminSessionHeaders(page, target) }
        );
        expect(apiArchivedResponse.ok()).toBe(true);
        archivedPayload = await apiArchivedResponse.json();
        apiArchivedDocument = archivedPayload!.documents.find((document) => Number(document.id) === Number(documentId));
        expect(apiArchivedDocument).toMatchObject({
          name: documentName,
          deleted: 1,
          previewKind: "text",
          thumbnailLabel: "TXT"
        });

        const archivedCard = page
          .getByRole("region", { name: "Encounter attached documents" })
          .locator(".encounter-document-card")
          .filter({ hasText: documentName })
          .first();
        await archivedCard.getByRole("button", { name: "Restore" }).click();
        await expect(archivedCard).not.toContainText("Archived");
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-85-encounter-document-archive-archived",
        description: "Captures the temporary Slice 85 encounter document after archive, including active-count return, active-detail hiding, archived-detail projection, and hidden content state.",
        expected: {
          document: {
            name: documentName,
            categoryName: "Medical Record",
            encounter: encounterDocumentArchiveEncounter,
            deleted: 1
          },
          counts: {
            documents: beforeCounts.documents,
            encounterDocuments: beforeEncounterDocuments.documents.length
          },
          activeContent: null,
          modernizedApi: target.type === "modernized-openemr"
            ? {
                activeDetailContainsDocument: false,
                archivedDetailContainsDocument: true,
                previewKind: "text",
                thumbnailLabel: "TXT"
              }
            : null
        },
        actual: {
          patient,
          beforeCounts,
          beforeEncounterDocuments,
          afterArchiveCounts,
          afterArchiveEncounterDocuments,
          documentId,
          created,
          archived,
          archivedContent,
          activeDocuments: activePayload?.documents ?? null,
          archivedDocuments: archivedPayload?.documents ?? null,
          apiArchivedDocument
        },
        context: {
          canonicalId: encounterDocumentArchiveAnchorPatientId,
          encounter: encounterDocumentArchiveEncounter,
          suite: "workflow-encounter-document-archive",
          workflow: "encounter-document-archive-archived"
        }
      });

      const restored = await workflow.getPatientDocument(documentId);
      expect(restored).toMatchObject({
        deleted: 0,
        name: documentName,
        categoryName: "Medical Record",
        encounter: encounterDocumentArchiveEncounter
      });
      expect(restored!.contentPreview).toContain(body);

      const afterRestoreCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterRestoreCounts.documents).toBe(beforeCounts.documents + 1);
      const afterRestoreEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterDocumentArchiveEncounter
      );
      expect(afterRestoreEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-85-encounter-document-archive-restored",
        description: "Captures the temporary Slice 85 encounter document after restore, including active document-count and encounter attachment-list restoration.",
        expected: {
          document: {
            name: documentName,
            categoryName: "Medical Record",
            encounter: encounterDocumentArchiveEncounter,
            deleted: 0,
            contentPreviewIncludes: body
          },
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
          restored
        },
        context: {
          canonicalId: encounterDocumentArchiveAnchorPatientId,
          encounter: encounterDocumentArchiveEncounter,
          suite: "workflow-encounter-document-archive",
          workflow: "encounter-document-archive-restored"
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
          probe: "slice-85-encounter-document-archive-surface",
          description: "Captures the legacy Documents category rendering facts for the temporary restored Slice 85 encounter document.",
          expected: {
            category: "Medical Record",
            documentName,
            encounter: encounterDocumentArchiveEncounter,
            restoredDeleted: 0,
            renderedDocumentName: documentName
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
            canonicalId: encounterDocumentArchiveAnchorPatientId,
            encounter: encounterDocumentArchiveEncounter,
            suite: "workflow-encounter-document-archive",
            workflow: "encounter-document-archive-legacy-surface"
          }
        });
      } else {
        const restoredResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterDocumentArchiveEncounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
        expect(restoredResponse.ok()).toBe(true);
        const restoredPayload = await restoredResponse.json();
        const apiRestoredDocument = restoredPayload.documents.find(
          (document: { id: number }) => document.id === Number(documentId)
        );
        expect(apiRestoredDocument).toMatchObject({
          name: documentName,
          deleted: 0,
          previewKind: "text",
          thumbnailLabel: "TXT"
        });

        const restoredCard = page
          .getByRole("region", { name: "Encounter attached documents" })
          .locator(".encounter-document-card")
          .filter({ hasText: documentName })
          .first();
        await expect(restoredCard).toBeVisible();
        await expect(restoredCard).not.toContainText("Archived");
        await expect(restoredCard).toContainText(body);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-85-encounter-document-archive-surface",
          description: "Captures the modernized encounter-detail API facts and Encounters attached-document UI anchors for the temporary restored Slice 85 encounter document.",
          expected: {
            apiDocument: {
              name: documentName,
              deleted: 0,
              previewKind: "text",
              thumbnailLabel: "TXT"
            },
            ui: {
              region: "Encounter attached documents",
              archivedTextAbsent: true,
              contentPreviewIncludes: body
            }
          },
          actual: {
            patient,
            documentId,
            restored,
            restoredDocuments: restoredPayload.documents,
            apiRestoredDocument,
            surface: {
              application: "modernized-openemr",
              api: `/api/encounters/${encounterDocumentArchiveEncounter}`,
              page: "encounters",
              region: "Encounter attached documents",
              encounterButton: "Hyperlipidemia",
              renderedDocumentName: documentName
            }
          },
          context: {
            canonicalId: encounterDocumentArchiveAnchorPatientId,
            encounter: encounterDocumentArchiveEncounter,
            suite: "workflow-encounter-document-archive",
            workflow: "encounter-document-archive-modernized-surface"
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
      encounterDocumentArchiveEncounter
    );
    expect(afterCleanupEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);
    if (documentId !== null) {
      const afterCleanup = await workflow.getPatientDocument(documentId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-85-encounter-document-archive-cleanup",
        description: "Captures the final Slice 85 hard-delete cleanup state for the temporary restored encounter document and restored encounter attachment list.",
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
          canonicalId: encounterDocumentArchiveAnchorPatientId,
          encounter: encounterDocumentArchiveEncounter,
          suite: "workflow-encounter-document-archive",
          workflow: "encounter-document-archive-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
