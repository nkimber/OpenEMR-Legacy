import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterDocumentSignoffAnchorPatientId = "MOD-PAT-0001";
const encounterDocumentSignoffAnchorEncounter = 1000013;
const encounterDocumentSignoffFromDate = "2026-01-01";

test.describe("encounter document sign-off parity @slice80 @workflow-encounter-document-signoff @mutation", () => {
  test("creates, signs, renders, deletes, and removes an encounter-attached document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentSignoffAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${encounterDocumentSignoffAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient.pid,
      encounterDocumentSignoffAnchorEncounter
    );
    const name = `Parity Encounter Signed Document ${workflowSuffix()}`;
    const body = `Created by the parity encounter document sign-off suite for ${name}.`;
    const documentInput = {
      patientId: patient.pid,
      encounter: encounterDocumentSignoffAnchorEncounter,
      categoryId: 3,
      categoryName: "Medical Record",
      name,
      docDate: "2026-06-18",
      content: body,
      notes: "Created by the parity encounter document sign-off suite."
    };
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-80-encounter-document-signoff-precondition",
        description: "Captures the Slice 80 encounter document sign-off anchor patient, baseline encounter document list, baseline document count, and proposed temporary reviewed text attachment before create.",
        expected: {
          patient: {
            pubpid: encounterDocumentSignoffAnchorPatientId,
            displayName: "Stone, Avery"
          },
          encounter: encounterDocumentSignoffAnchorEncounter,
          create: {
            categoryId: 3,
            categoryName: "Medical Record",
            docDate: "2026-06-18",
            encounter: encounterDocumentSignoffAnchorEncounter,
            mimetype: "text/plain",
            storageMethod: "database",
            reviewStatus: "pending",
            reviewedBy: "",
            reviewedAt: ""
          },
          sign: {
            reviewStatus: "approved",
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
          canonicalId: encounterDocumentSignoffAnchorPatientId,
          encounter: encounterDocumentSignoffAnchorEncounter,
          suite: "workflow-encounter-document-signoff",
          workflow: "encounter-document-signoff"
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
        encounter: encounterDocumentSignoffAnchorEncounter,
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
        encounterDocumentSignoffAnchorEncounter
      );
      expect(afterCreateEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-80-encounter-document-signoff-created",
        description: "Captures the temporary Slice 80 pending encounter-attached document row and encounter document-count increment immediately after create.",
        expected: {
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name,
            docDate: "2026-06-18",
            encounter: encounterDocumentSignoffAnchorEncounter,
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
          canonicalId: encounterDocumentSignoffAnchorPatientId,
          encounter: encounterDocumentSignoffAnchorEncounter,
          suite: "workflow-encounter-document-signoff",
          workflow: "encounter-document-signoff-created"
        }
      });

      await workflow.signEncounterDocument(encounterDocumentSignoffAnchorEncounter, documentId, "admin");

      const signed = await workflow.getPatientDocument(documentId);
      expect(signed).toMatchObject({
        reviewStatus: "approved",
        reviewedBy: "admin",
        deleted: 0
      });
      expect(signed!.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
      const afterSignCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterSignCounts.documents).toBe(beforeCounts.documents + 1);
      const afterSignEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterDocumentSignoffAnchorEncounter
      );
      expect(afterSignEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-80-encounter-document-signoff-signed",
        description: "Captures the temporary Slice 80 encounter document row after approved sign-off review state is applied.",
        expected: {
          document: {
            reviewStatus: "approved",
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
          afterSignCounts,
          afterSignEncounterDocuments,
          documentId,
          created,
          signed
        },
        context: {
          canonicalId: encounterDocumentSignoffAnchorPatientId,
          encounter: encounterDocumentSignoffAnchorEncounter,
          suite: "workflow-encounter-document-signoff",
          workflow: "encounter-document-signoff-signed"
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
          probe: "slice-80-encounter-document-signoff-surface",
          description: "Captures the legacy Documents category rendering facts for the temporary approved Slice 80 encounter document.",
          expected: {
            category: "Medical Record",
            documentName: name,
            reviewStatus: "approved",
            reviewedBy: "admin"
          },
          actual: {
            patient,
            documentId,
            signed,
            surface: {
              application: "legacy-openemr",
              page: "patient-documents",
              category: "Medical Record",
              renderedDocumentName: name
            }
          },
          context: {
            canonicalId: encounterDocumentSignoffAnchorPatientId,
            encounter: encounterDocumentSignoffAnchorEncounter,
            suite: "workflow-encounter-document-signoff",
            workflow: "encounter-document-signoff-legacy-surface"
          }
        });
      } else {
        const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterDocumentSignoffAnchorEncounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
        expect(detailResponse.ok()).toBe(true);
        const detailPayload = await detailResponse.json();
        const apiDocument = detailPayload.documents.find((document: { name: string }) => document.name === name);
        expect(apiDocument).toMatchObject({
          categoryName: "Medical Record",
          reviewStatus: "approved",
          reviewedBy: "admin",
          previewKind: "text",
          thumbnailLabel: "TXT"
        });
        expect(apiDocument.reviewedAt).toBeTruthy();

        await openAuthenticatedModernizedEncounters(page, target, patient!.pubpid, encounterDocumentSignoffFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const attachments = page.getByRole("region", { name: "Encounter attached documents" });
        const documentCard = attachments.locator(".encounter-document-card").filter({ hasText: name }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText("approved");
        await expect(documentCard).toContainText("Reviewed by admin");
        await expect(documentCard.getByRole("button", { name: "Sign" })).toBeDisabled();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-80-encounter-document-signoff-surface",
          description: "Captures the modernized encounter-detail API review facts and Encounters attached-document sign-off UI anchors for the temporary approved Slice 80 encounter document.",
          expected: {
            apiDocument: {
              categoryName: "Medical Record",
              reviewStatus: "approved",
              reviewedBy: "admin",
              previewKind: "text",
              thumbnailLabel: "TXT"
            },
            ui: {
              region: "Encounter attached documents",
              statusText: "approved",
              reviewerText: "Reviewed by admin",
              signButtonDisabled: true
            }
          },
          actual: {
            patient,
            documentId,
            signed,
            apiDocument,
            surface: {
              application: "modernized-openemr",
              api: `/api/encounters/${encounterDocumentSignoffAnchorEncounter}`,
              page: "encounters",
              region: "Encounter attached documents",
              encounterButton: "Hyperlipidemia",
              renderedDocumentName: name
            }
          },
          context: {
            canonicalId: encounterDocumentSignoffAnchorPatientId,
            encounter: encounterDocumentSignoffAnchorEncounter,
            suite: "workflow-encounter-document-signoff",
            workflow: "encounter-document-signoff-modernized-surface"
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
      encounterDocumentSignoffAnchorEncounter
    );
    expect(afterCleanupEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);
    if (documentId !== null) {
      const afterCleanup = await workflow.getPatientDocument(documentId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-80-encounter-document-signoff-cleanup",
        description: "Captures the final Slice 80 hard-delete cleanup state for the temporary signed encounter document.",
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
          canonicalId: encounterDocumentSignoffAnchorPatientId,
          encounter: encounterDocumentSignoffAnchorEncounter,
          suite: "workflow-encounter-document-signoff",
          workflow: "encounter-document-signoff-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
