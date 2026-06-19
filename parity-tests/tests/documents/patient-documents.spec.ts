import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const documentAnchorPatientId = "MOD-PAT-0001";

test.describe("patient documents parity @slice25 @documents", () => {
  test("stable document anchor has filed document metadata and previews", async ({ targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(documentAnchorPatientId);
    expect(patient).not.toBeNull();

    const documents = await targetDb.getPatientDocumentsForPatient(patient!.pid);
    expect(documents.patientId).toBe(patient!.pid);
    expect(documents.documents).toHaveLength(2);
    expect(documents.documents.map((document) => document.name)).toEqual([
      "Advance directive acknowledgement",
      "Primary care intake packet"
    ]);

    const intakePacket = documents.documents.find((document) => document.name === "Primary care intake packet");
    const advanceDirective = documents.documents.find((document) => document.name === "Advance directive acknowledgement");
    expect(intakePacket).toMatchObject({
      categoryId: 3,
      categoryName: "Medical Record",
      docDate: "2026-06-10",
      mimetype: "text/plain",
      storageMethod: "database"
    });
    expect(intakePacket!.contentPreview).toContain("Gold synthetic document DOC-MOD-PAT-0001-1");
    expect(advanceDirective).toMatchObject({
      categoryId: 6,
      categoryName: "Advance Directive",
      docDate: "2026-06-12",
      mimetype: "text/plain",
      storageMethod: "database"
    });
    expect(advanceDirective!.contentPreview).toContain("Gold synthetic document DOC-MOD-PAT-0001-2");
  });

  test("patient documents are visible in the application UI", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(documentAnchorPatientId);
    expect(patient).not.toBeNull();

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientDocumentsDirect(page, target, patient!.pid);

      await expectRenderedText(page, "Documents");
      await expandPatientDocumentCategories(page, ["Medical Record", "Advance Directive"]);
      await expectRenderedText(page, "Primary care intake packet");
      await expectRenderedText(page, "Advance directive acknowledgement");
      await expectRenderedText(page, "Medical Record");
      return;
    }

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Documents" }).click();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();

    await page.getByLabel("Documents patient ID").fill(patient!.pubpid);

    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText("Primary care intake packet");
    await expect(page.locator("body")).toContainText("Advance directive acknowledgement");
    await expect(page.locator("body")).toContainText("Medical Record");
    await expect(page.locator("body")).toContainText("Gold synthetic document DOC-MOD-PAT-0001-1");
  });
});
