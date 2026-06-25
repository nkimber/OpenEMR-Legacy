import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterDocumentDenialAnchorPatientId = "MOD-PAT-0001";
const encounterDocumentDenialAnchorEncounter = 1000013;
const encounterDocumentDenialFromDate = "2026-01-01";

test.describe("encounter document denial parity @slice81 @workflow-encounter-document-denial @mutation", () => {
  test("creates, denies, renders, deletes, and removes an encounter-attached document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentDenialAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${encounterDocumentDenialAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient.pid,
      encounterDocumentDenialAnchorEncounter
    );
    const name = `Parity Encounter Denied Document ${workflowSuffix()}`;
    const body = `Created by the parity encounter document denial suite for ${name}.`;
    const documentInput = {
      patientId: patient.pid,
      encounter: encounterDocumentDenialAnchorEncounter,
      categoryId: 3,
      categoryName: "Medical Record",
      name,
      docDate: "2026-06-18",
      content: body,
      notes: "Created by the parity encounter document denial suite."
    };
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-81-encounter-document-denial-precondition",
        description: "Captures the Slice 81 encounter document denial anchor patient, baseline encounter document list, baseline document count, and proposed temporary reviewed text attachment before create.",
        expected: {
          patient: {
            pubpid: encounterDocumentDenialAnchorPatientId,
            displayName: "Stone, Avery"
          },
          encounter: encounterDocumentDenialAnchorEncounter,
          create: {
            categoryId: 3,
            categoryName: "Medical Record",
            docDate: "2026-06-18",
            encounter: encounterDocumentDenialAnchorEncounter,
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
            encounterDocumentsAfterCreate: beforeEncounterDocuments.documents.length + 1,
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
          canonicalId: encounterDocumentDenialAnchorPatientId,
          encounter: encounterDocumentDenialAnchorEncounter,
          suite: "workflow-encounter-document-denial",
          workflow: "encounter-document-denial"
        }
      });

      documentId = await workflow.createEncounterDocument(documentInput);

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name,
        docDate: "2026-06-18",
        encounter: encounterDocumentDenialAnchorEncounter,
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0,
        reviewStatus: "pending",
        reviewedBy: "",
        reviewedAt: ""
      });
      expect(created!.contentPreview).toContain(body);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      const afterCreateEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterDocumentDenialAnchorEncounter
      );
      expect(afterCreateEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-81-encounter-document-denial-created",
        description: "Captures the temporary Slice 81 pending encounter-attached document row and encounter document-count increment immediately after create.",
        expected: {
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name,
            docDate: "2026-06-18",
            encounter: encounterDocumentDenialAnchorEncounter,
            mimetype: "text/plain",
            storageMethod: "database",
            deleted: 0,
            reviewStatus: "pending",
            reviewedBy: "",
            reviewedAt: ""
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
          canonicalId: encounterDocumentDenialAnchorPatientId,
          encounter: encounterDocumentDenialAnchorEncounter,
          suite: "workflow-encounter-document-denial",
          workflow: "encounter-document-denial-created"
        }
      });

      await workflow.denyEncounterDocument(encounterDocumentDenialAnchorEncounter, documentId, "admin");

      const denied = await workflow.getPatientDocument(documentId);
      expect(denied).toMatchObject({
        reviewStatus: "denied",
        reviewedBy: "admin",
        deleted: 0
      });
      expect(denied!.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      const afterDenyCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterDenyCounts.documents).toBe(beforeCounts.documents + 1);
      const afterDenyEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterDocumentDenialAnchorEncounter
      );
      expect(afterDenyEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-81-encounter-document-denial-denied",
        description: "Captures the temporary Slice 81 encounter document row after denied review state is applied.",
        expected: {
          document: {
            reviewStatus: "denied",
            reviewedBy: "admin",
            deleted: 0
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
          afterDenyCounts,
          afterDenyEncounterDocuments,
          documentId,
          created,
          denied
        },
        context: {
          canonicalId: encounterDocumentDenialAnchorPatientId,
          encounter: encounterDocumentDenialAnchorEncounter,
          suite: "workflow-encounter-document-denial",
          workflow: "encounter-document-denial-denied"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, name);
        await expectRenderedText(page, "Medical Record");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-81-encounter-document-denial-surface",
          description: "Captures the legacy Documents category rendering facts for the temporary denied Slice 81 encounter document.",
          expected: {
            category: "Medical Record",
            documentName: name,
            reviewStatus: "denied",
            reviewedBy: "admin"
          },
          actual: {
            patient,
            documentId,
            denied,
            surface: {
              application: "legacy-openemr",
              page: "patient-documents",
              category: "Medical Record",
              renderedDocumentName: name
            }
          },
          context: {
            canonicalId: encounterDocumentDenialAnchorPatientId,
            encounter: encounterDocumentDenialAnchorEncounter,
            suite: "workflow-encounter-document-denial",
            workflow: "encounter-document-denial-legacy-surface"
          }
        });
      } else {
        const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterDocumentDenialAnchorEncounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
        expect(detailResponse.ok()).toBe(true);
        const detailPayload = await detailResponse.json();
        const apiDocument = detailPayload.documents.find((document: { name: string }) => document.name === name);
        expect(apiDocument).toMatchObject({
          categoryName: "Medical Record",
          reviewStatus: "denied",
          reviewedBy: "admin",
          previewKind: "text",
          thumbnailLabel: "TXT"
        });
        expect(apiDocument.reviewedAt).toBeTruthy();

        await openAuthenticatedModernizedEncounters(page, target, patient!.pubpid, encounterDocumentDenialFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const attachments = page.getByRole("region", { name: "Encounter attached documents" });
        const documentCard = attachments.locator(".encounter-document-card").filter({ hasText: name }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText("denied");
        await expect(documentCard).toContainText("Reviewed by admin");
        await expect(documentCard.getByRole("button", { name: "Sign" })).toBeDisabled();
        await expect(documentCard.getByRole("button", { name: "Deny" })).toBeDisabled();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-81-encounter-document-denial-surface",
          description: "Captures the modernized encounter-detail API review facts and Encounters attached-document denial UI anchors for the temporary denied Slice 81 encounter document.",
          expected: {
            apiDocument: {
              categoryName: "Medical Record",
              reviewStatus: "denied",
              reviewedBy: "admin",
              previewKind: "text",
              thumbnailLabel: "TXT"
            },
            ui: {
              region: "Encounter attached documents",
              statusText: "denied",
              reviewerText: "Reviewed by admin",
              signButtonDisabled: true,
              denyButtonDisabled: true
            }
          },
          actual: {
            patient,
            documentId,
            denied,
            apiDocument,
            surface: {
              application: "modernized-openemr",
              api: `/api/encounters/${encounterDocumentDenialAnchorEncounter}`,
              page: "encounters",
              region: "Encounter attached documents",
              encounterButton: "Hyperlipidemia",
              renderedDocumentName: name
            }
          },
          context: {
            canonicalId: encounterDocumentDenialAnchorPatientId,
            encounter: encounterDocumentDenialAnchorEncounter,
            suite: "workflow-encounter-document-denial",
            workflow: "encounter-document-denial-modernized-surface"
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
      encounterDocumentDenialAnchorEncounter
    );
    expect(afterCleanupEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);
    if (documentId !== null) {
      const afterCleanup = await workflow.getPatientDocument(documentId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-81-encounter-document-denial-cleanup",
        description: "Captures the final Slice 81 hard-delete cleanup state for the temporary denied encounter document.",
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
          canonicalId: encounterDocumentDenialAnchorPatientId,
          encounter: encounterDocumentDenialAnchorEncounter,
          suite: "workflow-encounter-document-denial",
          workflow: "encounter-document-denial-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
