import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedDocuments } from "../../src/ui/modernizedOpenEmr.js";
const documentPreviewAnchorPatientId = "MOD-PAT-0001";
const intakePacketName = "Primary care intake packet";
const advanceDirectiveName = "Advance directive acknowledgement";

test.describe("patient document preview readiness parity @slice53 @document-preview @documents", () => {
  test("stable document anchors expose preview kind thumbnail and inline-readiness facts", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
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

    const previewAnchors = [intakePacket!, advanceDirective!].map((document) => ({
      id: document.id,
      documentKey: document.documentKey,
      categoryId: document.categoryId,
      categoryName: document.categoryName,
      name: document.name,
      docDate: document.docDate,
      mimetype: document.mimetype,
      fileName: document.fileName,
      sizeBytes: document.sizeBytes,
      pages: document.pages,
      encounter: document.encounter,
      storageMethod: document.storageMethod,
      hash: document.hash,
      notes: document.notes,
      contentPreview: document.contentPreview,
      previewKind: document.previewKind,
      previewStatus: document.previewStatus,
      thumbnailLabel: document.thumbnailLabel,
      thumbnailText: document.thumbnailText,
      thumbnailDataUri: document.thumbnailDataUri,
      canPreviewInline: document.canPreviewInline,
      canDownload: document.canDownload
    }));

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-53-document-preview-anchor",
      description: "Verifies the Slice 53 document preview anchor patient and deterministic text document preview database rows before application rendering.",
      expected: {
        patient: {
          pubpid: documentPreviewAnchorPatientId
        },
        documentCount: 2,
        documents: [
          {
            name: intakePacketName,
            documentKey: "DOC-MOD-PAT-0001-1",
            previewKind: "text",
            previewStatus: "Inline text preview",
            thumbnailLabel: "TXT",
            thumbnailTextIncludes: "Gold synthetic document DOC-MOD-PAT-0001-1",
            canPreviewInline: true,
            canDownload: true
          },
          {
            name: advanceDirectiveName,
            documentKey: "DOC-MOD-PAT-0001-2",
            previewKind: "text",
            previewStatus: "Inline text preview",
            thumbnailLabel: "TXT",
            thumbnailTextIncludes: "Gold synthetic document DOC-MOD-PAT-0001-2",
            canPreviewInline: true,
            canDownload: true
          }
        ]
      },
      actual: {
        patient,
        documentSummary: {
          patientId: documents.patientId,
          documentCount: documents.documents.length
        },
        previewAnchors
      },
      context: {
        canonicalId: documentPreviewAnchorPatientId,
        suite: "document-preview",
        workflow: "document-preview-readiness"
      }
    });

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-53-document-preview-render-precondition",
      description: "Captures the document preview rows and visible text expectations used by the Slice 53 Documents rendering assertions.",
      expected: {
        visibleText: [
          intakePacketName,
          advanceDirectiveName,
          "Inline text preview",
          "TXT",
          "Gold synthetic document DOC-MOD-PAT-0001-1",
          "Gold synthetic document DOC-MOD-PAT-0001-2"
        ]
      },
      actual: {
        patient,
        previewAnchors
      },
      context: {
        canonicalId: documentPreviewAnchorPatientId,
        suite: "document-preview",
        workflow: "document-preview-rendering"
      }
    });

    if (target.type === "legacy-openemr") {
      return;
    }

    await openAuthenticatedModernizedDocuments(page, target, patient!.pubpid);

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
