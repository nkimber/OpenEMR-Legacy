import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterDocumentMoveAnchorPatientId = "MOD-PAT-0001";
const encounterDocumentMoveSourceEncounter = 1000013;
const encounterDocumentMoveTargetEncounter = 1000011;
const encounterDocumentMoveFromDate = "2026-01-01";

test.describe("encounter document move parity @slice83 @workflow-encounter-document-move @mutation", () => {
  test("creates, moves, renders, deletes, and removes an encounter-attached document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentMoveAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${encounterDocumentMoveAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeSourceDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient.pid,
      encounterDocumentMoveSourceEncounter
    );
    const beforeTargetDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient.pid,
      encounterDocumentMoveTargetEncounter
    );
    const suffix = workflowSuffix();
    const documentName = `Parity Encounter Moved Document ${suffix}`;
    const body = `Created by the parity encounter document move suite for ${documentName}.`;
    const notes = "Created by the parity encounter document move suite.";
    const documentInput = {
      patientId: patient.pid,
      encounter: encounterDocumentMoveSourceEncounter,
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
        probe: "slice-83-encounter-document-move-precondition",
        description: "Captures the Slice 83 encounter document move anchor patient, source/target encounter document baselines, baseline document count, and proposed temporary source-encounter document payload before create.",
        expected: {
          patient: {
            pubpid: encounterDocumentMoveAnchorPatientId,
            displayName: "Stone, Avery"
          },
          sourceEncounter: encounterDocumentMoveSourceEncounter,
          targetEncounter: encounterDocumentMoveTargetEncounter,
          create: {
            categoryId: 3,
            categoryName: "Medical Record",
            docDate: "2026-06-18",
            encounter: encounterDocumentMoveSourceEncounter,
            mimetype: "text/plain",
            storageMethod: "database",
            deleted: 0,
            reviewStatus: "pending"
          },
          move: {
            sourceEncounterDocumentsAfterMove: beforeSourceDocuments.documents.length,
            targetEncounterDocumentsAfterMove: beforeTargetDocuments.documents.length + 1
          },
          countChange: {
            documentsAfterCreate: beforeCounts.documents + 1,
            sourceEncounterDocumentsAfterCreate: beforeSourceDocuments.documents.length + 1,
            targetEncounterDocumentsAfterCreate: beforeTargetDocuments.documents.length,
            documentsAfterMove: beforeCounts.documents + 1,
            documentsAfterCleanup: beforeCounts.documents,
            sourceEncounterDocumentsAfterCleanup: beforeSourceDocuments.documents.length,
            targetEncounterDocumentsAfterCleanup: beforeTargetDocuments.documents.length
          }
        },
        actual: {
          patient,
          beforeCounts,
          beforeSourceDocuments,
          beforeTargetDocuments,
          proposedDocument: documentInput
        },
        context: {
          canonicalId: encounterDocumentMoveAnchorPatientId,
          sourceEncounter: encounterDocumentMoveSourceEncounter,
          targetEncounter: encounterDocumentMoveTargetEncounter,
          suite: "workflow-encounter-document-move",
          workflow: "encounter-document-move"
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
        encounter: encounterDocumentMoveSourceEncounter,
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0,
        reviewStatus: "pending",
        notes
      });
      expect(created!.contentPreview).toContain(body);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      const afterCreateSourceDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterDocumentMoveSourceEncounter
      );
      const afterCreateTargetDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterDocumentMoveTargetEncounter
      );
      expect(afterCreateSourceDocuments.documents).toHaveLength(beforeSourceDocuments.documents.length + 1);
      expect(afterCreateSourceDocuments.documents.some((document) => document.id === Number(documentId))).toBe(true);
      expect(afterCreateTargetDocuments.documents).toHaveLength(beforeTargetDocuments.documents.length);
      expect(afterCreateTargetDocuments.documents.some((document) => document.id === Number(documentId))).toBe(false);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-83-encounter-document-move-created",
        description: "Captures the temporary Slice 83 document attached to the source encounter before movement.",
        expected: {
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: documentName,
            docDate: "2026-06-18",
            encounter: encounterDocumentMoveSourceEncounter,
            mimetype: "text/plain",
            storageMethod: "database",
            deleted: 0,
            reviewStatus: "pending",
            notes
          },
          counts: {
            documents: beforeCounts.documents + 1,
            sourceEncounterDocuments: beforeSourceDocuments.documents.length + 1,
            targetEncounterDocuments: beforeTargetDocuments.documents.length
          }
        },
        actual: {
          patient,
          beforeCounts,
          beforeSourceDocuments,
          beforeTargetDocuments,
          afterCreateCounts,
          afterCreateSourceDocuments,
          afterCreateTargetDocuments,
          documentId,
          created
        },
        context: {
          canonicalId: encounterDocumentMoveAnchorPatientId,
          sourceEncounter: encounterDocumentMoveSourceEncounter,
          targetEncounter: encounterDocumentMoveTargetEncounter,
          suite: "workflow-encounter-document-move",
          workflow: "encounter-document-move-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.moveEncounterDocument(
          encounterDocumentMoveSourceEncounter,
          documentId,
          encounterDocumentMoveTargetEncounter
        );
      } else {
        await openAuthenticatedModernizedEncounters(page, target, patient.pubpid, encounterDocumentMoveFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const attachments = page.getByRole("region", { name: "Encounter attached documents" });
        const originalCard = attachments.locator(".encounter-document-card").filter({ hasText: documentName }).first();
        await expect(originalCard).toBeVisible();
        await originalCard.getByRole("button", { name: "Move" }).click();
        const moveForm = originalCard.locator("form.document-edit-form").last();
        await moveForm.getByLabel("Encounter document move target encounter").fill(String(encounterDocumentMoveTargetEncounter));
        await moveForm.getByRole("button", { name: "Move" }).click();
        await expect(attachments.locator(".encounter-document-card").filter({ hasText: documentName }).first()).toBeVisible();
      }

      const moved = await workflow.getPatientDocument(documentId);
      expect(moved).toMatchObject({
        patientId: patient.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-18",
        encounter: encounterDocumentMoveTargetEncounter,
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0,
        reviewStatus: "pending",
        notes
      });
      expect(moved!.contentPreview).toContain(body);

      const afterMoveCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterMoveCounts.documents).toBe(beforeCounts.documents + 1);

      const afterMoveSourceDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterDocumentMoveSourceEncounter
      );
      const afterMoveTargetDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterDocumentMoveTargetEncounter
      );
      expect(afterMoveSourceDocuments.documents).toHaveLength(beforeSourceDocuments.documents.length);
      expect(afterMoveSourceDocuments.documents.some((document) => document.id === Number(documentId))).toBe(false);
      expect(afterMoveTargetDocuments.documents).toHaveLength(beforeTargetDocuments.documents.length + 1);
      expect(afterMoveTargetDocuments.documents.some((document) => document.id === Number(documentId))).toBe(true);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-83-encounter-document-move-moved",
        description: "Captures the temporary Slice 83 document after it is moved from the source encounter to the same-patient target encounter.",
        expected: {
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: documentName,
            docDate: "2026-06-18",
            encounter: encounterDocumentMoveTargetEncounter,
            mimetype: "text/plain",
            storageMethod: "database",
            deleted: 0,
            reviewStatus: "pending",
            notes
          },
          counts: {
            documents: beforeCounts.documents + 1,
            sourceEncounterDocuments: beforeSourceDocuments.documents.length,
            targetEncounterDocuments: beforeTargetDocuments.documents.length + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          beforeSourceDocuments,
          beforeTargetDocuments,
          afterMoveCounts,
          afterMoveSourceDocuments,
          afterMoveTargetDocuments,
          documentId,
          created,
          moved
        },
        context: {
          canonicalId: encounterDocumentMoveAnchorPatientId,
          sourceEncounter: encounterDocumentMoveSourceEncounter,
          targetEncounter: encounterDocumentMoveTargetEncounter,
          suite: "workflow-encounter-document-move",
          workflow: "encounter-document-move-moved"
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
          probe: "slice-83-encounter-document-move-surface",
          description: "Captures the legacy Documents category rendering facts for the temporary moved Slice 83 encounter document.",
          expected: {
            category: "Medical Record",
            documentName,
            sourceEncounter: encounterDocumentMoveSourceEncounter,
            targetEncounter: encounterDocumentMoveTargetEncounter,
            encounterAfterMove: encounterDocumentMoveTargetEncounter
          },
          actual: {
            patient,
            documentId,
            moved,
            afterMoveSourceDocuments,
            afterMoveTargetDocuments,
            surface: {
              application: "legacy-openemr",
              page: "patient-documents",
              category: "Medical Record",
              renderedDocumentName: documentName
            }
          },
          context: {
            canonicalId: encounterDocumentMoveAnchorPatientId,
            sourceEncounter: encounterDocumentMoveSourceEncounter,
            targetEncounter: encounterDocumentMoveTargetEncounter,
            suite: "workflow-encounter-document-move",
            workflow: "encounter-document-move-legacy-surface"
          }
        });
      } else {
        const sourceResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterDocumentMoveSourceEncounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
        expect(sourceResponse.ok()).toBe(true);
        const sourcePayload = await sourceResponse.json();
        expect(sourcePayload.documents.some((document: { id: number }) => document.id === Number(documentId))).toBe(false);

        const targetResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterDocumentMoveTargetEncounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
        expect(targetResponse.ok()).toBe(true);
        const targetPayload = await targetResponse.json();
        const apiDocument = targetPayload.documents.find((document: { id: number }) => document.id === Number(documentId));
        expect(apiDocument).toMatchObject({
          name: documentName,
          categoryName: "Medical Record",
          docDate: "2026-06-18",
          notes,
          reviewStatus: "pending",
          previewKind: "text",
          thumbnailLabel: "TXT"
        });

        const movedCard = page
          .getByRole("region", { name: "Encounter attached documents" })
          .locator(".encounter-document-card")
          .filter({ hasText: documentName })
          .first();
        await expect(movedCard).toBeVisible();
        await expect(movedCard).toContainText("Medical Record");
        await expect(movedCard).toContainText("2026-06-18");
        await expect(movedCard).toContainText(notes);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-83-encounter-document-move-surface",
          description: "Captures the modernized source/target encounter-detail API facts and Encounters attached-document UI anchors for the temporary moved Slice 83 encounter document.",
          expected: {
            sourceEncounter: {
              id: encounterDocumentMoveSourceEncounter,
              containsMovedDocument: false
            },
            targetEncounter: {
              id: encounterDocumentMoveTargetEncounter,
              containsMovedDocument: true
            },
            apiDocument: {
              name: documentName,
              categoryName: "Medical Record",
              docDate: "2026-06-18",
              notes,
              reviewStatus: "pending",
              previewKind: "text",
              thumbnailLabel: "TXT"
            },
            ui: {
              region: "Encounter attached documents",
              categoryText: "Medical Record",
              dateText: "2026-06-18",
              notesText: notes
            }
          },
          actual: {
            patient,
            documentId,
            moved,
            sourceDocuments: sourcePayload.documents,
            targetDocuments: targetPayload.documents,
            apiDocument,
            surface: {
              application: "modernized-openemr",
              sourceApi: `/api/encounters/${encounterDocumentMoveSourceEncounter}`,
              targetApi: `/api/encounters/${encounterDocumentMoveTargetEncounter}`,
              page: "encounters",
              region: "Encounter attached documents",
              encounterButton: "Hyperlipidemia",
              renderedDocumentName: documentName
            }
          },
          context: {
            canonicalId: encounterDocumentMoveAnchorPatientId,
            sourceEncounter: encounterDocumentMoveSourceEncounter,
            targetEncounter: encounterDocumentMoveTargetEncounter,
            suite: "workflow-encounter-document-move",
            workflow: "encounter-document-move-modernized-surface"
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
    const afterCleanupSourceDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient.pid,
      encounterDocumentMoveSourceEncounter
    );
    const afterCleanupTargetDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient.pid,
      encounterDocumentMoveTargetEncounter
    );
    expect(afterCleanupSourceDocuments.documents).toHaveLength(beforeSourceDocuments.documents.length);
    expect(afterCleanupTargetDocuments.documents).toHaveLength(beforeTargetDocuments.documents.length);
    if (documentId !== null) {
      const afterCleanup = await workflow.getPatientDocument(documentId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-83-encounter-document-move-cleanup",
        description: "Captures the final Slice 83 hard-delete cleanup state for the temporary moved encounter document and restored source/target encounter attachment lists.",
        expected: {
          counts: {
            documents: beforeCounts.documents,
            sourceEncounterDocuments: beforeSourceDocuments.documents.length,
            targetEncounterDocuments: beforeTargetDocuments.documents.length
          },
          deletedDocument: null
        },
        actual: {
          patient,
          beforeCounts,
          beforeSourceDocuments,
          beforeTargetDocuments,
          afterCleanupCounts,
          afterCleanupSourceDocuments,
          afterCleanupTargetDocuments,
          documentId,
          afterCleanup
        },
        context: {
          canonicalId: encounterDocumentMoveAnchorPatientId,
          sourceEncounter: encounterDocumentMoveSourceEncounter,
          targetEncounter: encounterDocumentMoveTargetEncounter,
          suite: "workflow-encounter-document-move",
          workflow: "encounter-document-move-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
