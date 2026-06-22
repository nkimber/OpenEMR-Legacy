import type { Page } from "@playwright/test";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import { test, expect } from "../../src/fixtures/parityTest.js";
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
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterExternalLinkAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient!.pid,
      encounterExternalLinkAnchorEncounter
    );
    const suffix = workflowSuffix();
    const name = `Parity Encounter External Link ${suffix}`;
    const url = `https://example.test/openemr/encounter-record/${suffix}`;
    const notes = "Created by the parity encounter external-link document suite.";
    let documentId: number | string | null = null;

    try {
      documentId = await workflow.createEncounterExternalLinkDocument({
        patientId: patient!.pid,
        encounter: encounterExternalLinkAnchorEncounter,
        categoryId: 3,
        categoryName: "Medical Record",
        name,
        docDate: "2026-06-18",
        url,
        notes
      });

      const created = await workflow.getPatientDocument(documentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
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

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);
      const afterCreateEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient!.pid,
        encounterExternalLinkAnchorEncounter
      );
      expect(afterCreateEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDocumentsDirect(page, target, patient!.pid);
        await expandPatientDocumentCategories(page, ["Medical Record"]);
        await expectRenderedText(page, name);
        await expectRenderedText(page, "Medical Record");
      } else {
        const apiAttachment = await expectModernizedExternalLinkApi(page, target, Number(documentId), url);
        expect(apiAttachment.name).toBe(name);

        const documentCard = await openModernizedEncounterDocumentCard(page, target, patient!.pubpid, name);
        await expect(documentCard).toContainText("External link");
        await expect(documentCard).toContainText("text/uri-list");
        await expect(documentCard).toContainText(url);
        await expect(documentCard.getByRole("link", { name: "Open Link" })).toHaveAttribute("href", url);
      }

      await workflow.softDeleteEncounterDocument(encounterExternalLinkAnchorEncounter, documentId);
      const archived = await workflow.getPatientDocument(documentId);
      expect(archived).toMatchObject({
        deleted: 1,
        encounter: encounterExternalLinkAnchorEncounter,
        storageMethod: "web_url",
        url
      });

      const afterArchiveCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterArchiveCounts.documents).toBe(beforeCounts.documents);
      const afterArchiveEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
        patient!.pid,
        encounterExternalLinkAnchorEncounter
      );
      expect(afterArchiveEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);
    } finally {
      if (documentId !== null) {
        await workflow.deletePatientDocument(documentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.documents).toBe(beforeCounts.documents);
    const afterCleanupEncounterDocuments = await targetDb.getPatientDocumentsForEncounter(
      patient!.pid,
      encounterExternalLinkAnchorEncounter
    );
    expect(afterCleanupEncounterDocuments.documents).toHaveLength(beforeEncounterDocuments.documents.length);
    if (documentId !== null) {
      await expect(workflow.getPatientDocument(documentId)).resolves.toBeNull();
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
