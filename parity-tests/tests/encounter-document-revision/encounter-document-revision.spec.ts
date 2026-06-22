import { test, expect } from "../../src/fixtures/parityTest.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";

const encounterDocumentRevisionAnchorPatientId = "MOD-PAT-0001";
const encounterDocumentRevisionAnchorEncounter = 1000013;
const encounterDocumentRevisionFromDate = "2026-01-01";

const expectedRevisionDocuments = [
  {
    documentKey: "DOC-MOD-PAT-0001-1",
    name: "Primary care intake packet",
    categoryName: "Medical Record",
    docDate: "2026-06-10",
    revisionAt: "2026-06-10 14:30:00"
  },
  {
    documentKey: "DOC-MOD-PAT-0001-2",
    name: "Advance directive acknowledgement",
    categoryName: "Advance Directive",
    docDate: "2026-06-12",
    revisionAt: "2026-06-12 15:00:00"
  }
] as const;

type RevisionDocument = {
  id: number;
  documentKey: string;
  name: string;
  categoryName: string;
  docDate: string;
  encounter?: number | null;
  revisionAt: string;
  currentVersion: number;
  versionLabel: string;
  versionStatus: string;
  versionHistoryCount: number;
  hasPriorVersions: boolean;
  revisionHash: string;
  hash: string;
};

test.describe("encounter document revision readiness parity @slice122 @encounter-document-revision @documents", () => {
  test("stable encounter document anchors expose current revision facts", async ({
    page,
    target,
    targetDb
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentRevisionAnchorPatientId);
    expect(patient).not.toBeNull();

    const documents = await targetDb.getPatientDocumentsForEncounter(
      patient!.pid,
      encounterDocumentRevisionAnchorEncounter
    );
    expect(documents.patientId).toBe(patient!.pid);
    expect(documents.documents).toHaveLength(2);

    for (const expectedDocument of expectedRevisionDocuments) {
      const document = documents.documents.find((candidate) => candidate.documentKey === expectedDocument.documentKey);
      expect(document).toBeTruthy();
      expectRevisionDocument(document as RevisionDocument, expectedDocument);

      const content = await targetDb.getPatientDocumentContent(document!.id);
      expect(content).toBeTruthy();
      expectRevisionDocument(content as RevisionDocument, expectedDocument);
    }

    if (target.type === "legacy-openemr") {
      return;
    }

    const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounterDocumentRevisionAnchorEncounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
    expect(detailResponse.ok()).toBe(true);
    const detailPayload = await detailResponse.json() as { documents: RevisionDocument[] };
    expect(detailPayload.documents).toHaveLength(2);

    for (const expectedDocument of expectedRevisionDocuments) {
      const apiDocument = detailPayload.documents.find((candidate) => candidate.documentKey === expectedDocument.documentKey);
      expect(apiDocument).toBeTruthy();
      expectRevisionDocument(apiDocument!, expectedDocument);
    }

    await openAuthenticatedModernizedEncounters(page, target, patient!.pubpid, encounterDocumentRevisionFromDate);

    const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
    await expect(encounterButton).toBeVisible();
    await encounterButton.click();

    const attachments = page.getByRole("region", { name: "Encounter attached documents" });
    await expect(attachments).toBeVisible();

    for (const expectedDocument of expectedRevisionDocuments) {
      const card = attachments.locator(".encounter-document-card").filter({ hasText: expectedDocument.name }).first();
      await expect(card).toBeVisible();
      await expect(card).toContainText(`${expectedDocument.categoryName}`);
      await expect(card).toContainText("Version 1 / Current version");
      await expect(card).toContainText(expectedRevisionText(expectedDocument.revisionAt));
      await expect(card).toContainText("No prior versions");
    }
  });
});

function expectRevisionDocument(
  document: RevisionDocument,
  expected: typeof expectedRevisionDocuments[number]
) {
  expect(document).toMatchObject({
    documentKey: expected.documentKey,
    name: expected.name,
    categoryName: expected.categoryName,
    docDate: expected.docDate,
    currentVersion: 1,
    versionLabel: "Version 1",
    versionStatus: "Current version",
    versionHistoryCount: 1,
    hasPriorVersions: false
  });
  if (Object.hasOwn(document, "encounter")) {
    expect(document.encounter).toBe(encounterDocumentRevisionAnchorEncounter);
  }
  expect(document.revisionAt).toMatch(revisionPattern(expected.revisionAt));
  expect(document.revisionHash).toBe(document.hash);
}

function revisionPattern(revisionAt: string) {
  const withoutSeconds = expectedRevisionText(revisionAt);
  return new RegExp(`^${withoutSeconds}(:00)?$`);
}

function expectedRevisionText(revisionAt: string) {
  return revisionAt.replace(/:00$/, "");
}
