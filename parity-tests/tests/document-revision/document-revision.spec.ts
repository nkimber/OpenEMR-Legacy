import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedDocuments } from "../../src/ui/modernizedOpenEmr.js";
const documentRevisionAnchorPatientId = "MOD-PAT-0001";
const intakePacketName = "Primary care intake packet";
const advanceDirectiveName = "Advance directive acknowledgement";

test.describe("patient document revision readiness parity @slice54 @document-revision @documents", () => {
  test("stable document anchors expose current revision and version-readiness facts", async ({
    page,
    target,
    targetDb
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(documentRevisionAnchorPatientId);
    expect(patient).not.toBeNull();

    const documents = await targetDb.getPatientDocumentsForPatient(patient!.pid);
    expect(documents.patientId).toBe(patient!.pid);
    expect(documents.documents).toHaveLength(2);

    const intakePacket = documents.documents.find((document) => document.name === intakePacketName);
    const advanceDirective = documents.documents.find((document) => document.name === advanceDirectiveName);
    expect(intakePacket).toBeTruthy();
    expect(advanceDirective).toBeTruthy();

    expect(intakePacket).toMatchObject({
      currentVersion: 1,
      versionLabel: "Version 1",
      versionStatus: "Current version",
      versionHistoryCount: 1,
      hasPriorVersions: false,
      revisionAt: "2026-06-10 14:30:00"
    });
    expect(intakePacket!.revisionHash).toBe(intakePacket!.hash);

    expect(advanceDirective).toMatchObject({
      currentVersion: 1,
      versionLabel: "Version 1",
      versionStatus: "Current version",
      versionHistoryCount: 1,
      hasPriorVersions: false,
      revisionAt: "2026-06-12 15:00:00"
    });
    expect(advanceDirective!.revisionHash).toBe(advanceDirective!.hash);

    const intakeContent = await targetDb.getPatientDocumentContent(intakePacket!.id);
    expect(intakeContent).toMatchObject({
      id: intakePacket!.id,
      currentVersion: 1,
      versionLabel: "Version 1",
      versionStatus: "Current version",
      versionHistoryCount: 1,
      hasPriorVersions: false,
      revisionAt: "2026-06-10 14:30:00"
    });
    expect(intakeContent!.revisionHash).toBe(intakeContent!.hash);

    if (target.type === "legacy-openemr") {
      return;
    }

    await openAuthenticatedModernizedDocuments(page, target, patient!.pubpid);

    const intakeCard = page.locator(".document-card").filter({ hasText: intakePacketName }).first();
    await expect(intakeCard).toBeVisible();
    await expect(intakeCard).toContainText("Version 1 / Current version");
    await expect(intakeCard).toContainText("2026-06-10 14:30:00");
    await expect(intakeCard).toContainText("No prior versions");

    await intakeCard.getByRole("button", { name: "View" }).click();
    await expect(page.getByRole("heading", { name: "Document Viewer" })).toBeVisible();
    const viewer = page.getByLabel("Document viewer");
    await expect(viewer).toContainText("Version 1");
    await expect(viewer).toContainText("2026-06-10 14:30:00");
    await expect(viewer).toContainText("1 current version");
  });
});
