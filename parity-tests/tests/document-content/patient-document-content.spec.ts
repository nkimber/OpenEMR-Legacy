import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const documentAnchorPatientId = "MOD-PAT-0001";
const intakePacketName = "Primary care intake packet";
const intakePacketContent = [
  "Gold synthetic document DOC-MOD-PAT-0001-1",
  "Patient: Avery Stone (MOD-PAT-0001)",
  "Category: Medical Record",
  "Document: Primary care intake packet",
  "Document date: 2026-06-10",
  "Encounter: 1000013",
  "Purpose: Stable search and demographics navigation"
].join("\n");

test.describe("patient document content parity @slice27 @documents", () => {
  test("stable document anchor exposes full stored document content", async ({ targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(documentAnchorPatientId);
    expect(patient).not.toBeNull();

    const documents = await targetDb.getPatientDocumentsForPatient(patient!.pid);
    const intakePacket = documents.documents.find((document) => document.name === intakePacketName);
    expect(intakePacket).toBeTruthy();

    const content = await targetDb.getPatientDocumentContent(intakePacket!.id);
    expect(content).toMatchObject({
      id: intakePacket!.id,
      documentKey: "DOC-MOD-PAT-0001-1",
      categoryId: 3,
      categoryName: "Medical Record",
      name: intakePacketName,
      mimetype: "text/plain",
      storageMethod: "database",
      encounter: 1000013,
      content: intakePacketContent
    });
    expect(content!.sizeBytes).toBe(Buffer.byteLength(intakePacketContent, "utf8"));
    expect(content!.contentPreview).toContain("Gold synthetic document DOC-MOD-PAT-0001-1");
  });

  test("document content is reachable from the application surface", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(documentAnchorPatientId);
    expect(patient).not.toBeNull();
    const documents = await targetDb.getPatientDocumentsForPatient(patient!.pid);
    const intakePacket = documents.documents.find((document) => document.name === intakePacketName);
    expect(intakePacket).toBeTruthy();

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientDocumentsDirect(page, target, patient!.pid);
      await expandPatientDocumentCategories(page, ["Medical Record"]);
      await expectRenderedText(page, intakePacketName);
      await expectRenderedText(page, "Document Uploader/Viewer");
      return;
    }

    const apiContent = await page.request.get(`${target.apiBaseUrl}/api/documents/${intakePacket!.id}/content`);
    expect(apiContent.ok()).toBe(true);
    const apiPayload = await apiContent.json();
    expect(apiPayload).toMatchObject({
      id: intakePacket!.id,
      fileName: "Primary care intake packet.txt",
      mimetype: "text/plain",
      content: intakePacketContent
    });

    const download = await page.request.get(`${target.apiBaseUrl}/api/documents/${intakePacket!.id}/download`);
    expect(download.ok()).toBe(true);
    expect(download.headers()["content-type"]).toContain("text/plain");
    expect(await download.text()).toBe(intakePacketContent);

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Documents" }).click();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await page.getByLabel("Documents patient ID").fill(patient!.pubpid);

    const intakeCard = page.locator(".document-card").filter({ hasText: intakePacketName }).first();
    await expect(intakeCard).toBeVisible();
    await intakeCard.getByRole("button", { name: "View" }).click();
    await expect(page.getByRole("heading", { name: "Document Viewer" })).toBeVisible();
    await expect(page.locator(".document-content-block")).toContainText("Gold synthetic document DOC-MOD-PAT-0001-1");
    await expect(page.locator(".document-content-block")).toContainText("Purpose: Stable search and demographics navigation");
    await expect(page.getByLabel("Document viewer").getByRole("link", { name: "Download" })).toHaveAttribute(
      "href",
      `${target.apiBaseUrl}/api/documents/${intakePacket!.id}/download`
    );
  });
});
