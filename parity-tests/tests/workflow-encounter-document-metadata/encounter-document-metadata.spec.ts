import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterDocumentMetadataAnchorPatientId = "MOD-PAT-0001";
const encounterDocumentMetadataAnchorEncounter = 1000013;
const encounterDocumentMetadataFromDate = "2026-01-01";

test.describe("encounter document metadata parity @slice82 @workflow-encounter-document-metadata @mutation", () => {
  test("creates, refiles, renders, deletes, and removes an encounter-attached document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentMetadataAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${encounterDocumentMetadataAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient.pid,
      encounterDocumentMetadataAnchorEncounter
    );
    const suffix = workflowSuffix();
    const originalName = `Parity Encounter Metadata Document ${suffix}`;
    const updatedName = `Parity Encounter Refiled Directive ${suffix}`;
    const body = `Created by the parity encounter document metadata suite for ${originalName}.`;
    const updatedNotes = "Updated by the parity encounter document metadata suite.";
    const documentInput = {
      patientId: patient.pid,
      encounter: encounterDocumentMetadataAnchorEncounter,
      categoryId: 3,
      categoryName: "Medical Record",
      name: originalName,
      docDate: "2026-06-18",
      content: body,
      notes: "Created by the parity encounter document metadata suite."
    };
    const metadataUpdate = {
      categoryId: 6,
      categoryName: "Advance Directive",
      name: updatedName,
      docDate: "2026-06-19",
      encounter: encounterDocumentMetadataAnchorEncounter,
      notes: updatedNotes
    };
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-82-encounter-document-metadata-precondition",
        description: "Captures the Slice 82 encounter document metadata anchor patient, baseline encounter document list, baseline document count, proposed temporary document payload, and planned refile metadata update before create.",
        expected: {
          patient: {
            pubpid: encounterDocumentMetadataAnchorPatientId,
            displayName: "Stone, Avery"
          },
          encounter: encounterDocumentMetadataAnchorEncounter,
          create: {
            categoryId: 3,
            categoryName: "Medical Record",
            docDate: "2026-06-18",
            encounter: encounterDocumentMetadataAnchorEncounter,
            mimetype: "text/plain",
            storageMethod: "database",
            deleted: 0,
            reviewStatus: "pending"
          },
          update: metadataUpdate,
          countChange: {
            documentsAfterCreate: beforeCounts.documents + 1,
            encounterDocumentsAfterCreate: beforeEncounterDocuments.documents.length + 1,
            documentsAfterUpdate: beforeCounts.documents + 1,
            encounterDocumentsAfterUpdate: beforeEncounterDocuments.documents.length + 1,
            documentsAfterCleanup: beforeCounts.documents,
            encounterDocumentsAfterCleanup: beforeEncounterDocuments.documents.length
          }
        },
        actual: {
          patient,
          beforeCounts,
          beforeEncounterDocuments,
          proposedDocument: documentInput,
          proposedMetadataUpdate: metadataUpdate
        },
        context: {
          canonicalId: encounterDocumentMetadataAnchorPatientId,
          encounter: encounterDocumentMetadataAnchorEncounter,
          suite: "workflow-encounter-document-metadata",
          workflow: "encounter-document-metadata"
        }
      });

      documentId = await workflow.createEncounterDocument(documentInput);

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: originalName,
        docDate: "2026-06-18",
        encounter: encounterDocumentMetadataAnchorEncounter,
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0,
        reviewStatus: "pending"
      });
      expect(created!.contentPreview).toContain(body);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      const afterCreateEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterDocumentMetadataAnchorEncounter
      );
      expect(afterCreateEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-82-encounter-document-metadata-created",
        description: "Captures the temporary Slice 82 original encounter document row and encounter document-count increment immediately after create.",
        expected: {
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: originalName,
            docDate: "2026-06-18",
            encounter: encounterDocumentMetadataAnchorEncounter,
            mimetype: "text/plain",
            storageMethod: "database",
            deleted: 0,
            reviewStatus: "pending"
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
          canonicalId: encounterDocumentMetadataAnchorPatientId,
          encounter: encounterDocumentMetadataAnchorEncounter,
          suite: "workflow-encounter-document-metadata",
          workflow: "encounter-document-metadata-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.updateEncounterDocumentMetadata(encounterDocumentMetadataAnchorEncounter, documentId, metadataUpdate);
      } else {
        await openAuthenticatedModernizedEncounters(page, target, patient.pubpid, encounterDocumentMetadataFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const attachments = page.getByRole("region", { name: "Encounter attached documents" });
        const originalCard = attachments.locator(".encounter-document-card").filter({ hasText: originalName }).first();
        await expect(originalCard).toBeVisible();
        await originalCard.getByRole("button", { name: "Edit" }).click();
        await originalCard.getByLabel("Encounter document metadata name").fill(updatedName);
        await originalCard.getByLabel("Encounter document metadata category").selectOption("6");
        await originalCard.getByLabel("Encounter document metadata date").fill("2026-06-19");
        await expect(originalCard.getByLabel("Encounter document metadata encounter")).toHaveValue(
          String(encounterDocumentMetadataAnchorEncounter)
        );
        await originalCard.getByLabel("Encounter document metadata notes").fill(updatedNotes);
        await originalCard.getByRole("button", { name: "Save Metadata" }).click();
        await expect(attachments.locator(".encounter-document-card").filter({ hasText: updatedName }).first()).toBeVisible();
      }

      const updated = await workflow.getPatientDocument(documentId);
      expect(updated).toMatchObject({
        patientId: patient.pid,
        categoryId: 6,
        categoryName: "Advance Directive",
        name: updatedName,
        docDate: "2026-06-19",
        encounter: encounterDocumentMetadataAnchorEncounter,
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0,
        reviewStatus: "pending",
        notes: updatedNotes
      });
      expect(updated!.contentPreview).toContain(body);

      const afterUpdateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterUpdateCounts.documents).toBe(beforeCounts.documents + 1);
      const afterUpdateEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterDocumentMetadataAnchorEncounter
      );
      expect(afterUpdateEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-82-encounter-document-metadata-updated",
        description: "Captures the temporary Slice 82 encounter document after category, name, date, and notes metadata are refiled while preserving the encounter link.",
        expected: {
          document: {
            patientId: patient.pid,
            categoryId: 6,
            categoryName: "Advance Directive",
            name: updatedName,
            docDate: "2026-06-19",
            encounter: encounterDocumentMetadataAnchorEncounter,
            notes: updatedNotes,
            mimetype: "text/plain",
            storageMethod: "database",
            deleted: 0,
            reviewStatus: "pending"
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
          afterUpdateCounts,
          afterUpdateEncounterDocuments,
          documentId,
          created,
          updated,
          metadataUpdate
        },
        context: {
          canonicalId: encounterDocumentMetadataAnchorPatientId,
          encounter: encounterDocumentMetadataAnchorEncounter,
          suite: "workflow-encounter-document-metadata",
          workflow: "encounter-document-metadata-updated"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient.pid);
        await expandPatientDocumentCategories(page, ["Advance Directive"]);
        await expectRenderedText(page, updatedName);
        await expectRenderedText(page, "Advance Directive");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-82-encounter-document-metadata-surface",
          description: "Captures the legacy Documents category rendering facts for the temporary refiled Slice 82 encounter document.",
          expected: {
            category: "Advance Directive",
            documentName: updatedName,
            docDate: "2026-06-19",
            notes: updatedNotes,
            encounter: encounterDocumentMetadataAnchorEncounter
          },
          actual: {
            patient,
            documentId,
            updated,
            surface: {
              application: "legacy-openemr",
              page: "patient-documents",
              category: "Advance Directive",
              renderedDocumentName: updatedName
            }
          },
          context: {
            canonicalId: encounterDocumentMetadataAnchorPatientId,
            encounter: encounterDocumentMetadataAnchorEncounter,
            suite: "workflow-encounter-document-metadata",
            workflow: "encounter-document-metadata-legacy-surface"
          }
        });
      } else {
        const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterDocumentMetadataAnchorEncounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
        expect(detailResponse.ok()).toBe(true);
        const detailPayload = await detailResponse.json();
        const apiDocument = detailPayload.documents.find((document: { name: string }) => document.name === updatedName);
        expect(apiDocument).toMatchObject({
          categoryName: "Advance Directive",
          docDate: "2026-06-19",
          notes: updatedNotes,
          reviewStatus: "pending",
          previewKind: "text",
          thumbnailLabel: "TXT"
        });

        const updatedCard = page
          .getByRole("region", { name: "Encounter attached documents" })
          .locator(".encounter-document-card")
          .filter({ hasText: updatedName })
          .first();
        await expect(updatedCard).toBeVisible();
        await expect(updatedCard).toContainText("Advance Directive");
        await expect(updatedCard).toContainText("2026-06-19");
        await expect(updatedCard).toContainText(updatedNotes);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-82-encounter-document-metadata-surface",
          description: "Captures the modernized encounter-detail API metadata facts and Encounters attached-document metadata UI anchors for the temporary refiled Slice 82 encounter document.",
          expected: {
            apiDocument: {
              categoryName: "Advance Directive",
              docDate: "2026-06-19",
              notes: updatedNotes,
              reviewStatus: "pending",
              previewKind: "text",
              thumbnailLabel: "TXT"
            },
            ui: {
              region: "Encounter attached documents",
              categoryText: "Advance Directive",
              dateText: "2026-06-19",
              notesText: updatedNotes
            }
          },
          actual: {
            patient,
            documentId,
            updated,
            apiDocument,
            surface: {
              application: "modernized-openemr",
              api: `/api/encounters/${encounterDocumentMetadataAnchorEncounter}`,
              page: "encounters",
              region: "Encounter attached documents",
              encounterButton: "Hyperlipidemia",
              renderedDocumentName: updatedName
            }
          },
          context: {
            canonicalId: encounterDocumentMetadataAnchorPatientId,
            encounter: encounterDocumentMetadataAnchorEncounter,
            suite: "workflow-encounter-document-metadata",
            workflow: "encounter-document-metadata-modernized-surface"
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
      encounterDocumentMetadataAnchorEncounter
    );
    expect(afterCleanupEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);
    if (documentId !== null) {
      const afterCleanup = await workflow.getPatientDocument(documentId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-82-encounter-document-metadata-cleanup",
        description: "Captures the final Slice 82 hard-delete cleanup state for the temporary refiled encounter document.",
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
          canonicalId: encounterDocumentMetadataAnchorPatientId,
          encounter: encounterDocumentMetadataAnchorEncounter,
          suite: "workflow-encounter-document-metadata",
          workflow: "encounter-document-metadata-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
