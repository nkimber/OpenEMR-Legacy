import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterDocumentAnchorPatientId = "MOD-PAT-0001";
const encounterDocumentAnchorFromDate = "2026-01-01";
const intakePacketName = "Primary care intake packet";
const advanceDirectiveName = "Advance directive acknowledgement";

test.describe("encounter document attachment readiness parity @slice67 @encounter-documents @documents", () => {
  test("stable encounter anchor exposes attached document facts", async ({ targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();
    expect(encounter!.encounter).toBe(1000013);

    const documents = await targetDb.getPatientDocumentsForEncounter(patient!.pid, encounter!.encounter);
    expect(documents.patientId).toBe(patient!.pid);
    expect(documents.documents).toHaveLength(2);
    expect(documents.documents.map((document) => document.name)).toEqual([
      advanceDirectiveName,
      intakePacketName
    ]);

    const intakePacket = documents.documents.find((document) => document.name === intakePacketName);
    const advanceDirective = documents.documents.find((document) => document.name === advanceDirectiveName);
    expect(intakePacket).toMatchObject({
      documentKey: "DOC-MOD-PAT-0001-1",
      categoryName: "Medical Record",
      docDate: "2026-06-10",
      encounter: 1000013,
      previewKind: "text",
      thumbnailLabel: "TXT"
    });
    expect(advanceDirective).toMatchObject({
      documentKey: "DOC-MOD-PAT-0001-2",
      categoryName: "Advance Directive",
      docDate: "2026-06-12",
      encounter: 1000013,
      previewKind: "text",
      thumbnailLabel: "TXT"
    });
  });

  test("encounter-attached documents are reachable from the application surface", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentAnchorPatientId);
    expect(patient).not.toBeNull();
    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientDocumentsDirect(page, target, patient!.pid);
      await expandPatientDocumentCategories(page, ["Medical Record", "Advance Directive"]);
      await expectRenderedText(page, intakePacketName);
      await expectRenderedText(page, advanceDirectiveName);
      await expectRenderedText(page, "Medical Record");
      await expectRenderedText(page, "Advance Directive");
      return;
    }

    const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounter!.encounter}`);
    expect(detailResponse.ok()).toBe(true);
    const detailPayload = await detailResponse.json();
    expect(detailPayload.documents).toHaveLength(2);
    expect(detailPayload.documents.map((document: { name: string }) => document.name)).toEqual([
      advanceDirectiveName,
      intakePacketName
    ]);

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Encounters" }).click();
    await expect(page.getByRole("heading", { name: "Encounters" })).toBeVisible();

    await page.getByLabel("Encounter patient ID").fill(patient!.pubpid);
    await page.getByLabel("Encounter from date").fill(encounterDocumentAnchorFromDate);

    const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
    await expect(encounterButton).toBeVisible();
    await encounterButton.click();

    const attachments = page.getByLabel("Encounter attached documents");
    await expect(attachments).toBeVisible();
    await expect(attachments).toContainText("Attached Documents");
    await expect(attachments).toContainText(intakePacketName);
    await expect(attachments).toContainText(advanceDirectiveName);
    await expect(attachments).toContainText("Medical Record");
    await expect(attachments).toContainText("Advance Directive");
    await expect(attachments).toContainText("Inline text preview");
    await expect(attachments.getByRole("link", { name: "Download" })).toHaveCount(2);
  });
});
