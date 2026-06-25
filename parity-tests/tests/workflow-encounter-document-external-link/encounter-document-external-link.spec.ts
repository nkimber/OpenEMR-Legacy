import type { Page } from "@playwright/test";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterExternalLinkAnchorPatientId = "MOD-PAT-0001";
const encounterExternalLinkAnchorEncounter = 1000013;
const encounterExternalLinkFromDate = "2026-01-01";

type EncounterExternalLinkApiAttachment = {
  id: number;
  name: string;
  mimetype?: string | null;
  storageMethod?: string | null;
  url?: string | null;
  previewKind?: string | null;
  thumbnailLabel?: string | null;
  canDownload: boolean;
  deleted: number;
};

test.describe("encounter external-link document parity @slice87 @workflow-encounter-document-external-link @mutation", () => {
  test("creates, renders, archives, and removes an external-link encounter document", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterExternalLinkAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${encounterExternalLinkAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient.pid,
      encounterExternalLinkAnchorEncounter
    );
    const suffix = workflowSuffix();
    const name = `Parity Encounter External Link ${suffix}`;
    const url = `https://example.test/openemr/encounter-record/${suffix}`;
    const notes = "Created by the parity encounter external-link document suite.";
    const externalLinkInput = {
      patientId: patient.pid,
      encounter: encounterExternalLinkAnchorEncounter,
      categoryId: 3,
      categoryName: "Medical Record",
      name,
      docDate: "2026-06-18",
      url,
      notes
    };
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-87-encounter-document-external-link-precondition",
        description: "Captures the Slice 87 encounter external-link document anchor patient, encounter document baseline, proposed URL-backed attachment, and expected count movement before create.",
        expected: {
          patient: {
            pubpid: encounterExternalLinkAnchorPatientId,
            displayName: "Stone, Avery"
          },
          encounter: encounterExternalLinkAnchorEncounter,
          create: {
            categoryId: 3,
            categoryName: "Medical Record",
            docDate: "2026-06-18",
            mimetype: "text/uri-list",
            storageMethod: "web_url",
            deleted: 0,
            reviewStatus: "pending",
            reviewedBy: "",
            reviewedAt: ""
          },
          countChange: {
            documentsAfterCreate: beforeCounts.documents + 1,
            encounterDocumentsAfterCreate: beforeEncounterDocuments.documents.length + 1,
            documentsAfterArchive: beforeCounts.documents,
            encounterDocumentsAfterArchive: beforeEncounterDocuments.documents.length,
            documentsAfterCleanup: beforeCounts.documents,
            encounterDocumentsAfterCleanup: beforeEncounterDocuments.documents.length
          }
        },
        actual: {
          patient,
          beforeCounts,
          beforeEncounterDocuments,
          proposedDocument: externalLinkInput
        },
        context: {
          canonicalId: encounterExternalLinkAnchorPatientId,
          encounter: encounterExternalLinkAnchorEncounter,
          suite: "workflow-encounter-document-external-link",
          workflow: "encounter-document-external-link"
        }
      });

      documentId = await workflow.createEncounterExternalLinkDocument(externalLinkInput);

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        categoryId: 3,
        categoryName: "Medical Record",
        name,
        docDate: "2026-06-18",
        encounter: encounterExternalLinkAnchorEncounter,
        mimetype: "text/uri-list",
        storageMethod: "web_url",
        url,
        deleted: 0,
        reviewStatus: "pending",
        reviewedBy: "",
        reviewedAt: "",
        notes
      });
      expect(created!.contentPreview).toContain(url);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);
      const afterCreateEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterExternalLinkAnchorEncounter
      );
      expect(afterCreateEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-87-encounter-document-external-link-created",
        description: "Captures the temporary Slice 87 URL-backed encounter document row and encounter-scoped document-list increment immediately after create.",
        expected: {
          document: {
            patientId: patient.pid,
            categoryId: 3,
            categoryName: "Medical Record",
            name,
            docDate: "2026-06-18",
            encounter: encounterExternalLinkAnchorEncounter,
            mimetype: "text/uri-list",
            storageMethod: "web_url",
            url,
            deleted: 0,
            reviewStatus: "pending",
            reviewedBy: "",
            reviewedAt: "",
            notes
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
          canonicalId: encounterExternalLinkAnchorPatientId,
          encounter: encounterExternalLinkAnchorEncounter,
          suite: "workflow-encounter-document-external-link",
          workflow: "encounter-document-external-link-created"
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
          probe: "slice-87-encounter-document-external-link-surface",
          description: "Captures the legacy Documents category rendering facts for the temporary Slice 87 encounter external-link document.",
          expected: {
            category: "Medical Record",
            documentName: name,
            encounter: encounterExternalLinkAnchorEncounter,
            storageMethod: "web_url",
            url
          },
          actual: {
            patient,
            documentId,
            created,
            afterCreateEncounterDocuments,
            surface: {
              application: "legacy-openemr",
              page: "patient-documents",
              category: "Medical Record",
              renderedDocumentName: name
            }
          },
          context: {
            canonicalId: encounterExternalLinkAnchorPatientId,
            encounter: encounterExternalLinkAnchorEncounter,
            suite: "workflow-encounter-document-external-link",
            workflow: "encounter-document-external-link-legacy-surface"
          }
        });
      } else {
        const apiAttachment = await expectModernizedExternalLinkApi(page, target, Number(documentId), url);
        expect(apiAttachment.name).toBe(name);

        const documentCard = await openModernizedEncounterDocumentCard(page, target, patient.pubpid, name);
        await expect(documentCard).toContainText("External link");
        await expect(documentCard).toContainText("text/uri-list");
        await expect(documentCard).toContainText(url);
        await expect(documentCard.getByRole("link", { name: "Open Link" })).toHaveAttribute("href", url);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-87-encounter-document-external-link-surface",
          description: "Captures the modernized encounter-detail API external-link facts and Encounters attached-document UI anchors for the temporary Slice 87 URL-backed document.",
          expected: {
            apiDocument: {
              name,
              mimetype: "text/uri-list",
              storageMethod: "web_url",
              url,
              previewKind: "external-link",
              thumbnailLabel: "LINK",
              canDownload: true,
              deleted: 0
            },
            ui: {
              region: "Encounter attached documents",
              externalLinkText: "External link",
              mimetypeText: "text/uri-list",
              linkLabel: "Open Link",
              href: url
            }
          },
          actual: {
            patient,
            documentId,
            created,
            apiAttachment,
            surface: {
              application: "modernized-openemr",
              api: `/api/encounters/${encounterExternalLinkAnchorEncounter}`,
              page: "encounters",
              region: "Encounter attached documents",
              encounterButton: "Hyperlipidemia",
              renderedDocumentName: name
            }
          },
          context: {
            canonicalId: encounterExternalLinkAnchorPatientId,
            encounter: encounterExternalLinkAnchorEncounter,
            suite: "workflow-encounter-document-external-link",
            workflow: "encounter-document-external-link-modernized-surface"
          }
        });
      }

      await workflow.softDeleteEncounterDocument(encounterExternalLinkAnchorEncounter, documentId);
      const archived = await workflow.getPatientDocument(documentId);
      expect(archived).toMatchObject({
        deleted: 1,
        encounter: encounterExternalLinkAnchorEncounter,
        storageMethod: "web_url",
        url
      });

      const afterArchiveCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterArchiveCounts.documents).toBe(beforeCounts.documents);
      const afterArchiveEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient.pid,
        encounterExternalLinkAnchorEncounter
      );
      expect(afterArchiveEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-87-encounter-document-external-link-archived",
        description: "Captures the temporary Slice 87 URL-backed encounter document after archive and active encounter document-list return to baseline.",
        expected: {
          document: {
            patientId: patient.pid,
            encounter: encounterExternalLinkAnchorEncounter,
            storageMethod: "web_url",
            url,
            deleted: 1
          },
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
          created,
          archived
        },
        context: {
          canonicalId: encounterExternalLinkAnchorPatientId,
          encounter: encounterExternalLinkAnchorEncounter,
          suite: "workflow-encounter-document-external-link",
          workflow: "encounter-document-external-link-archived"
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
      encounterExternalLinkAnchorEncounter
    );
    expect(afterCleanupEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);
    if (documentId !== null) {
      const afterCleanup = await workflow.getPatientDocument(documentId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-87-encounter-document-external-link-cleanup",
        description: "Captures the final Slice 87 hard-delete cleanup state for the temporary URL-backed encounter document and restored encounter attachment list.",
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
          canonicalId: encounterExternalLinkAnchorPatientId,
          encounter: encounterExternalLinkAnchorEncounter,
          suite: "workflow-encounter-document-external-link",
          workflow: "encounter-document-external-link-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

async function expectModernizedExternalLinkApi(
  page: Page,
  target: RuntimeTarget,
  documentId: number,
  expectedUrl: string
) {
  const response = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterExternalLinkAnchorEncounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
  expect(response.ok()).toBe(true);
  const payload = await response.json() as { documents: EncounterExternalLinkApiAttachment[] };
  const document = payload.documents.find((item) => item.id === documentId);
  expect(document).toBeTruthy();
  expect(document).toMatchObject({
    mimetype: "text/uri-list",
    storageMethod: "web_url",
    url: expectedUrl,
    previewKind: "external-link",
    thumbnailLabel: "LINK",
    canDownload: true,
    deleted: 0
  });
  return document!;
}

async function openModernizedEncounterDocumentCard(
  page: Page,
  target: RuntimeTarget,
  patientPublicId: string,
  documentName: string
) {
  await openAuthenticatedModernizedEncounters(page, target, patientPublicId, encounterExternalLinkFromDate);

  const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
  await expect(encounterButton).toBeVisible();
  await encounterButton.click();

  const attachments = page.getByRole("region", { name: "Encounter attached documents" });
  const documentCard = attachments.locator(".encounter-document-card").filter({ hasText: documentName }).first();
  await expect(documentCard).toBeVisible();
  return documentCard;
}

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
