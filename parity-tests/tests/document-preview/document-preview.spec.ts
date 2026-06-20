import { test, expect } from "../../src/fixtures/parityTest.js";

const documentPreviewAnchorPatientId = "MOD-PAT-0001";
const intakePacketName = "Primary care intake packet";
const advanceDirectiveName = "Advance directive acknowledgement";

test.describe("patient document preview readiness parity @slice53 @document-preview @documents", () => {
  test("stable document anchors expose preview kind thumbnail and inline-readiness facts", async ({
    page,
    target,
    targetDb
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(documentPreviewAnchorPatientId);
    expect(patient).not.toBeNull();

    const documents = await targetDb.getPatientDocumentsForPatient(patient!.pid);
    expect(documents.patientId).toBe(patient!.pid);
    expect(documents.documents).toHaveLength(2);

    const intakePacket = documents.documents.find((document) => document.name === intakePacketName);
    const advanceDirective = documents.documents.find((document) => document.name === advanceDirectiveName);
    expect(intakePacket).toBeTruthy();
    expect(advanceDirective).toBeTruthy();

    for (const document of [intakePacket!, advanceDirective!]) {
      expect(document.previewKind).toBe("text");
      expect(document.previewStatus).toBe("Inline text preview");
      expect(document.thumbnailLabel).toBe("TXT");
      expect(document.canPreviewInline).toBe(true);
      expect(document.canDownload).toBe(true);
      expect(document.thumbnailText).toContain(`Gold synthetic document ${document.documentKey}`);
    }

    if (target.type === "legacy-openemr") {
      return;
    }

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Documents" }).click();
    await expect(page.getByRole("heading", { name: "Documents" })).toBeVisible();
    await page.getByLabel("Documents patient ID").fill(patient!.pubpid);

    const intakeCard = page.locator(".document-card").filter({ hasText: intakePacketName }).first();
    await expect(intakeCard).toBeVisible();
    await expect(intakeCard).toContainText("Inline text preview");
    await expect(intakeCard).toContainText("TXT");
    await expect(intakeCard).toContainText("Gold synthetic document DOC-MOD-PAT-0001-1");

    const advanceDirectiveCard = page.locator(".document-card").filter({ hasText: advanceDirectiveName }).first();
    await expect(advanceDirectiveCard).toBeVisible();
    await expect(advanceDirectiveCard).toContainText("Inline text preview");
    await expect(advanceDirectiveCard).toContainText("TXT");
    await expect(advanceDirectiveCard).toContainText("Gold synthetic document DOC-MOD-PAT-0001-2");
  });
});
