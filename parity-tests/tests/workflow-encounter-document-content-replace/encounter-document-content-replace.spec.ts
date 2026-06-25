import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterDocumentContentAnchorPatientId = "MOD-PAT-0001";
const encounterDocumentContentEncounter = 1000013;
const encounterDocumentContentFromDate = "2026-01-01";

test.describe("encounter document content replacement parity @slice84 @workflow-encounter-document-content-replace @mutation", () => {
  test("creates, replaces, renders, verifies revision facts, and removes an encounter-attached document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentContentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${encounterDocumentContentAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient.pid,
      encounterDocumentContentEncounter
    );
    const suffix = workflowSuffix();
    const documentName = `Parity Encounter Replace Content Document ${suffix}`;
    const replacementFileName = `${documentName}.txt`;
    const originalBody = `Original encounter attachment payload for ${documentName}.`;
    const replacementBody = `Replacement encounter attachment payload for ${documentName}.`;
    const notes = "Created by the parity encounter document content replacement suite.";
    const documentInput = {
      patientId: patient.pid,
      encounter: encounterDocumentContentEncounter,
      categoryId: 3,
      categoryName: "Medical Record",
      name: documentName,
      docDate: "2026-06-18",
      content: originalBody,
      notes
    };
    const replacementInput = {
      fileName: replacementFileName,
      content: replacementBody
    };
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-84-encounter-document-content-replace-precondition",
        description: "Captures the Slice 84 encounter document content replacement anchor patient, encounter document baseline, proposed original text attachment, and replacement text payload before create.",
        expected: {
          patient: {
            pubpid: encounterDocumentContentAnchorPatientId,
            displayName: "Stone, Avery"
          },
          encounter: encounterDocumentContentEncounter,
          create: {
            categoryId: 3,
            categoryName: "Medical Record",
            docDate: "2026-06-18",
            encounter: encounterDocumentContentEncounter,
            mimetype: "text/plain",
            storageMethod: "database",
            deleted: 0,
            reviewStatus: "pending"
          },
          replace: {
            fileName: replacementFileName,
            mimetype: "text/plain",
            contentIncludes: replacementBody,
            contentExcludes: originalBody
          },
          countChange: {
            documentsAfterCreate: beforeCounts.documents + 1,
            encounterDocumentsAfterCreate: beforeEncounterDocuments.documents.length + 1,
            documentsAfterReplace: beforeCounts.documents + 1,
            encounterDocumentsAfterReplace: beforeEncounterDocuments.documents.length + 1,
            documentsAfterCleanup: beforeCounts.documents,
            encounterDocumentsAfterCleanup: beforeEncounterDocuments.documents.length
          }
        },
        actual: {
          patient,
          beforeCounts,
          beforeEncounterDocuments,
          proposedDocument: documentInput,
          proposedReplacement: replacementInput
        },
        context: {
          canonicalId: encounterDocumentContentAnchorPatientId,
          encounter: encounterDocumentContentEncounter,
          suite: "workflow-encounter-document-content-replace",
          workflow: "encounter-document-content-replacement"
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
        encounter: encounterDocumentContentEncounter,
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0,
        reviewStatus: "pending",
        notes
      });
      expect(created!.contentPreview).toContain(originalBody);

      const createdContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(createdContent).not.toBeNull();
      expect(createdContent!.revisionHash).toBe(createdContent!.hash);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);
      const afterCreateEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterDocumentContentEncounter
      );
      expect(afterCreateEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-84-encounter-document-content-replace-created",
        description: "Captures the temporary Slice 84 original encounter document row, stored text payload, encounter document-list increment, and active document-count increment immediately after create.",
        expected: {
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: documentName,
            docDate: "2026-06-18",
            encounter: encounterDocumentContentEncounter,
            mimetype: "text/plain",
            storageMethod: "database",
            deleted: 0,
            reviewStatus: "pending",
            notes,
            contentPreviewIncludes: originalBody
          },
          content: {
            isBinary: false,
            mimetype: "text/plain",
            includes: originalBody,
            revisionHashEqualsHash: true
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
          created,
          createdContent
        },
        context: {
          canonicalId: encounterDocumentContentAnchorPatientId,
          encounter: encounterDocumentContentEncounter,
          suite: "workflow-encounter-document-content-replace",
          workflow: "encounter-document-content-replacement-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.replaceEncounterDocumentContent(encounterDocumentContentEncounter, documentId, replacementInput);
      } else {
        await openAuthenticatedModernizedEncounters(page, target, patient.pubpid, encounterDocumentContentFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const attachments = page.getByRole("region", { name: "Encounter attached documents" });
        const documentCard = attachments.locator(".encounter-document-card").filter({ hasText: documentName }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText("Version 1");
        await documentCard.getByRole("button", { name: "Replace" }).click();
        await documentCard.getByLabel("Encounter replacement document file name").fill(replacementFileName);
        await documentCard.getByLabel("Encounter replacement document body").fill(replacementBody);
        await documentCard.getByRole("button", { name: "Save Content" }).click();
        await expect(documentCard).toContainText(replacementBody);
        await expect(documentCard).not.toContainText(originalBody);
      }

      const replaced = await workflow.getPatientDocument(documentId);
      expect(replaced).toMatchObject({
        patientId: patient.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-18",
        encounter: encounterDocumentContentEncounter,
        mimetype: "text/plain",
        storageMethod: "database",
        deleted: 0,
        reviewStatus: "pending",
        notes
      });
      expect(replaced!.contentPreview).toContain(replacementBody);
      expect(replaced!.contentPreview).not.toContain(originalBody);

      const replacedContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(replacedContent).not.toBeNull();
      expect(replacedContent!.content).toContain(replacementBody);
      expect(replacedContent!.content).not.toContain(originalBody);
      expect(replacedContent!.fileName).toBe(target.type === "legacy-openemr" ? documentName : replacementFileName);
      expect(replacedContent!.revisionHash).toBe(replacedContent!.hash);
      expect(timestampSeconds(replacedContent!.revisionAt)).toBeGreaterThanOrEqual(
        timestampSeconds(createdContent!.revisionAt)
      );

      const afterReplaceCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterReplaceCounts.documents).toBe(beforeCounts.documents + 1);
      const afterReplaceEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterDocumentContentEncounter
      );
      expect(afterReplaceEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      const replacedEncounterDocument = afterReplaceEncounterDocuments.documents.find(
        (document) => document.id === Number(documentId)
      );
      expect(replacedEncounterDocument).toMatchObject({
        name: documentName,
        categoryName: "Medical Record",
        previewKind: "text",
        thumbnailLabel: "TXT",
        versionLabel: "Version 1",
        versionStatus: "Current version",
        revisionHash: replacedContent!.hash
      });
      expect(replacedEncounterDocument!.contentPreview).toContain(replacementBody);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-84-encounter-document-content-replace-replaced",
        description: "Captures the temporary Slice 84 encounter document after database-backed content replacement, including revision facts, preview/content assertions, stable encounter link, and stable active counts.",
        expected: {
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name: documentName,
            docDate: "2026-06-18",
            encounter: encounterDocumentContentEncounter,
            mimetype: "text/plain",
            storageMethod: "database",
            deleted: 0,
            reviewStatus: "pending",
            notes,
            contentPreviewIncludes: replacementBody,
            contentPreviewExcludes: originalBody
          },
          content: {
            isBinary: false,
            mimetype: "text/plain",
            includes: replacementBody,
            excludes: originalBody,
            revisionHashEqualsHash: true,
            revisionAtAfterOrEqualCreated: true
          },
          encounterDocument: {
            previewKind: "text",
            thumbnailLabel: "TXT",
            versionLabel: "Version 1",
            versionStatus: "Current version",
            contentPreviewIncludes: replacementBody
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
          afterReplaceCounts,
          afterReplaceEncounterDocuments,
          documentId,
          created,
          createdContent,
          replaced,
          replacedContent,
          replacedEncounterDocument,
          replacementInput
        },
        context: {
          canonicalId: encounterDocumentContentAnchorPatientId,
          encounter: encounterDocumentContentEncounter,
          suite: "workflow-encounter-document-content-replace",
          workflow: "encounter-document-content-replacement-replaced"
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
          probe: "slice-84-encounter-document-content-replace-surface",
          description: "Captures the legacy Documents category rendering facts for the temporary content-replaced Slice 84 encounter document.",
          expected: {
            category: "Medical Record",
            documentName,
            encounter: encounterDocumentContentEncounter,
            renderedDocumentName: documentName,
            contentIncludes: replacementBody,
            contentExcludes: originalBody
          },
          actual: {
            patient,
            documentId,
            replaced,
            replacedContent,
            afterReplaceEncounterDocuments,
            surface: {
              application: "legacy-openemr",
              page: "patient-documents",
              category: "Medical Record",
              renderedDocumentName: documentName
            }
          },
          context: {
            canonicalId: encounterDocumentContentAnchorPatientId,
            encounter: encounterDocumentContentEncounter,
            suite: "workflow-encounter-document-content-replace",
            workflow: "encounter-document-content-replacement-legacy-surface"
          }
        });
      } else {
        const response = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterDocumentContentEncounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
        expect(response.ok()).toBe(true);
        const payload = await response.json();
        const apiDocument = payload.documents.find((document: { id: number }) => document.id === Number(documentId));
        expect(apiDocument).toMatchObject({
          name: documentName,
          fileName: replacementFileName,
          previewKind: "text",
          thumbnailLabel: "TXT",
          versionLabel: "Version 1",
          versionStatus: "Current version",
          revisionHash: replacedContent!.hash
        });
        expect(apiDocument.contentPreview).toContain(replacementBody);

        const replacedCard = page
          .getByRole("region", { name: "Encounter attached documents" })
          .locator(".encounter-document-card")
          .filter({ hasText: documentName })
          .first();
        await expect(replacedCard).toBeVisible();
        await expect(replacedCard).toContainText("Version 1");
        await expect(replacedCard).toContainText("No prior versions");
        await expect(replacedCard).toContainText(replacementBody);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-84-encounter-document-content-replace-surface",
          description: "Captures the modernized encounter-detail API facts and Encounters attached-document UI anchors for the temporary content-replaced Slice 84 encounter document.",
          expected: {
            apiDocument: {
              name: documentName,
              fileName: replacementFileName,
              previewKind: "text",
              thumbnailLabel: "TXT",
              versionLabel: "Version 1",
              versionStatus: "Current version",
              revisionHash: replacedContent!.hash,
              contentPreviewIncludes: replacementBody
            },
            ui: {
              region: "Encounter attached documents",
              versionText: "Version 1",
              priorVersionText: "No prior versions",
              bodyText: replacementBody,
              excludes: originalBody
            }
          },
          actual: {
            patient,
            documentId,
            replaced,
            replacedContent,
            apiDocument,
            encounterDocuments: payload.documents,
            surface: {
              application: "modernized-openemr",
              api: `/api/encounters/${encounterDocumentContentEncounter}`,
              page: "encounters",
              region: "Encounter attached documents",
              encounterButton: "Hyperlipidemia",
              renderedDocumentName: documentName
            }
          },
          context: {
            canonicalId: encounterDocumentContentAnchorPatientId,
            encounter: encounterDocumentContentEncounter,
            suite: "workflow-encounter-document-content-replace",
            workflow: "encounter-document-content-replacement-modernized-surface"
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
      encounterDocumentContentEncounter
    );
    expect(afterCleanupEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);
    if (documentId !== null) {
      const afterCleanup = await workflow.getPatientDocument(documentId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-84-encounter-document-content-replace-cleanup",
        description: "Captures the final Slice 84 hard-delete cleanup state for the temporary content-replaced encounter document and restored encounter attachment list.",
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
          canonicalId: encounterDocumentContentAnchorPatientId,
          encounter: encounterDocumentContentEncounter,
          suite: "workflow-encounter-document-content-replace",
          workflow: "encounter-document-content-replacement-cleanup"
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
  return Math.floor(new Date(value).getTime() / 1000);
}
