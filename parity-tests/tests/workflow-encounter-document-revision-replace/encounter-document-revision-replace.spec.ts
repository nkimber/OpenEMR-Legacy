import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterDocumentRevisionReplaceAnchorPatientId = "MOD-PAT-0001";
const encounterDocumentRevisionReplaceEncounter = 1000013;
const encounterDocumentRevisionReplaceFromDate = "2026-01-01";

test.describe("encounter document replacement revision parity @slice123 @workflow-encounter-document-revision-replace @mutation @documents", () => {
  test("replacement updates the current revision facts for an encounter-attached document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentRevisionReplaceAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Missing seeded encounter document replacement revision patient ${encounterDocumentRevisionReplaceAnchorPatientId}`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient.pid,
      encounterDocumentRevisionReplaceEncounter
    );
    const suffix = workflowSuffix();
    const documentName = `Parity Encounter Revision Replace Document ${suffix}`;
    const replacementFileName = `${documentName}.txt`;
    const originalBody = `Original encounter revision payload for ${documentName}.`;
    const replacementBody = `Replacement encounter revision payload for ${documentName}.`;
    let documentId: number | string | null = null;
    let createdContent: Awaited<ReturnType<typeof targetDb.getPatientDocumentContent>> = null;
    let replacedContent: Awaited<ReturnType<typeof targetDb.getPatientDocumentContent>> = null;
    let afterReplaceCounts: Awaited<ReturnType<typeof targetDb.getPatientWorkflowCounts>> | null = null;
    let afterReplaceEncounterDocuments: Awaited<ReturnType<typeof targetDb.getPatientDocumentsForEncounter>> | null = null;
    let replacedEncounterDocument: Record<string, unknown> | undefined;
    let surfaceFacts: Record<string, unknown> = {};

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-123-encounter-document-revision-replace-precondition",
      description:
        "Seeded patient, encounter, baseline document counts, and proposed temporary encounter document before replacement.",
      expected: {
        patientCanonicalId: encounterDocumentRevisionReplaceAnchorPatientId,
        encounterId: encounterDocumentRevisionReplaceEncounter,
        categoryId: 3,
        categoryName: "Medical Record",
        docDate: "2026-06-18",
        expectedDocumentDelta: 1,
        originalBody,
        replacementFileName,
        replacementBody
      },
      actual: {
        patient: {
          pid: patient.pid,
          pubpid: patient.pubpid,
          fname: patient.fname,
          lname: patient.lname
        },
        beforeCounts,
        beforeEncounterDocuments,
        proposedDocument: {
          name: documentName,
          fileName: replacementFileName,
          originalBody,
          replacementBody
        }
      }
    });

    try {
      documentId = await workflow.createEncounterDocument({
        patientId: patient.pid,
        encounter: encounterDocumentRevisionReplaceEncounter,
        categoryId: 3,
        categoryName: "Medical Record",
        name: documentName,
        docDate: "2026-06-18",
        content: originalBody,
        notes: "Created by the encounter document replacement revision suite."
      });

      createdContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(createdContent).not.toBeNull();
      expect(createdContent).toMatchObject({
        name: documentName,
        encounter: encounterDocumentRevisionReplaceEncounter,
        versionLabel: "Version 1",
        versionStatus: "Current version",
        versionHistoryCount: 1,
        hasPriorVersions: false
      });
      expect(createdContent!.content).toContain(originalBody);
      expect(createdContent!.revisionHash).toBe(createdContent!.hash);
      const createdRevisionAt = timestampSeconds(createdContent!.revisionAt);
      const createdHash = createdContent!.hash;

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-123-encounter-document-revision-replace-created",
        description:
          "Temporary encounter document was created with original content and a single current-version revision contract.",
        expected: {
          documentCreated: true,
          encounterId: encounterDocumentRevisionReplaceEncounter,
          versionLabel: "Version 1",
          versionStatus: "Current version",
          versionHistoryCount: 1,
          hasPriorVersions: false,
          contentContains: originalBody
        },
        actual: {
          documentId,
          createdContent,
          createdRevisionAt,
          createdHash
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.replaceEncounterDocumentContent(encounterDocumentRevisionReplaceEncounter, documentId, {
          fileName: replacementFileName,
          content: replacementBody
        });
      } else {
        await openAuthenticatedModernizedEncounters(page, target, patient.pubpid, encounterDocumentRevisionReplaceFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const documentCard = page
          .getByRole("region", { name: "Encounter attached documents" })
          .locator(".encounter-document-card")
          .filter({ hasText: documentName })
          .first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText("Version 1 / Current version");
        await documentCard.getByRole("button", { name: "Replace" }).click();
        await documentCard.getByLabel("Encounter replacement document file name").fill(replacementFileName);
        await documentCard.getByLabel("Encounter replacement document body").fill(replacementBody);
        await documentCard.getByRole("button", { name: "Save Content" }).click();
        await expect(documentCard).toContainText(replacementBody);
        await expect(documentCard).not.toContainText(originalBody);
        surfaceFacts = {
          modernizedReplacementForm: {
            searchPatientId: patient.pubpid,
            fromDate: encounterDocumentRevisionReplaceFromDate,
            documentName,
            replacementFileName,
            renderedAfterSave: await documentCard.innerText()
          }
        };
      }

      replacedContent = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(replacedContent).not.toBeNull();
      expect(replacedContent).toMatchObject({
        name: documentName,
        encounter: encounterDocumentRevisionReplaceEncounter,
        versionLabel: "Version 1",
        versionStatus: "Current version",
        versionHistoryCount: 1,
        hasPriorVersions: false
      });
      expect(replacedContent!.content).toContain(replacementBody);
      expect(replacedContent!.content).not.toContain(originalBody);
      expect(replacedContent!.fileName).toBe(target.type === "legacy-openemr" ? documentName : replacementFileName);
      expect(replacedContent!.hash).not.toBe(createdHash);
      expect(replacedContent!.revisionHash).toBe(replacedContent!.hash);
      expect(timestampSeconds(replacedContent!.revisionAt)).toBeGreaterThanOrEqual(createdRevisionAt);

      afterReplaceCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterReplaceCounts.documents).toBe(beforeCounts.documents + 1);
      afterReplaceEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterDocumentRevisionReplaceEncounter
      );
      expect(afterReplaceEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      replacedEncounterDocument = afterReplaceEncounterDocuments.documents.find(
        (document) => document.id === Number(documentId)
      );
      expect(replacedEncounterDocument).toMatchObject({
        name: documentName,
        categoryName: "Medical Record",
        versionLabel: "Version 1",
        versionStatus: "Current version",
        versionHistoryCount: 1,
        hasPriorVersions: false,
        revisionHash: replacedContent!.hash,
        hash: replacedContent!.hash
      });
      expect(replacedEncounterDocument!.contentPreview).toContain(replacementBody);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, documentName);
        surfaceFacts = {
          legacyDocuments: {
            patientPid: patient.pid,
            expandedCategory: "Medical Record",
            renderedDocumentName: documentName
          }
        };
      } else {
        const response = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterDocumentRevisionReplaceEncounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
        expect(response.ok()).toBe(true);
        const payload = await response.json() as { documents: Array<Record<string, unknown>> };
        const apiDocument = payload.documents.find((document) => document.id === Number(documentId));
        expect(apiDocument).toMatchObject({
          name: documentName,
          fileName: replacementFileName,
          versionLabel: "Version 1",
          versionStatus: "Current version",
          versionHistoryCount: 1,
          hasPriorVersions: false,
          revisionHash: replacedContent!.hash,
          hash: replacedContent!.hash
        });
        expect(String(apiDocument!.contentPreview)).toContain(replacementBody);

        const replacedCard = page
          .getByRole("region", { name: "Encounter attached documents" })
          .locator(".encounter-document-card")
          .filter({ hasText: documentName })
          .first();
        await expect(replacedCard).toBeVisible();
        await expect(replacedCard).toContainText("Version 1 / Current version");
        await expect(replacedCard).toContainText("No prior versions");
        await expect(replacedCard).toContainText(replacementBody);
        surfaceFacts = {
          ...surfaceFacts,
          modernizedApiAndCard: {
            apiDocument,
            renderedCard: await replacedCard.innerText()
          }
        };
      }

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-123-encounter-document-revision-replace-replaced",
        description:
          "Temporary encounter document replacement updates the current revision content/hash while preserving the single-current-version contract.",
        expected: {
          contentContains: replacementBody,
          contentOmits: originalBody,
          hashChanged: true,
          revisionHashMatchesHash: true,
          versionLabel: "Version 1",
          versionStatus: "Current version",
          versionHistoryCount: 1,
          hasPriorVersions: false,
          documentDelta: 1,
          encounterDocumentDelta: 1
        },
        actual: {
          documentId,
          createdContent,
          replacedContent,
          beforeCounts,
          afterReplaceCounts,
          beforeEncounterDocuments,
          afterReplaceEncounterDocuments,
          replacedEncounterDocument,
          surfaceFacts
        }
      });
    } finally {
      if (documentId !== null) {
        await workflow.deletePatientDocument(documentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.documents).toBe(beforeCounts.documents);
    const afterCleanupEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient.pid,
      encounterDocumentRevisionReplaceEncounter
    );
    expect(afterCleanupEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);
    const documentAfterCleanup = documentId !== null ? await workflow.getPatientDocument(documentId) : null;
    if (documentId !== null) {
      expect(documentAfterCleanup).toBeNull();
    }

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-123-encounter-document-revision-replace-cleanup",
      description:
        "Temporary replacement-revision document was deleted and patient/encounter document counts returned to baseline.",
      expected: {
        documentDeleted: true,
        documentCountRestored: true,
        encounterDocumentCountRestored: true
      },
      actual: {
        documentId,
        beforeCounts,
        afterCleanupCounts,
        beforeEncounterDocuments,
        afterCleanupEncounterDocuments,
        documentAfterCleanup
      }
    });
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function timestampSeconds(value: string) {
  return Math.floor(new Date(value.replace(" ", "T")).getTime() / 1000);
}
