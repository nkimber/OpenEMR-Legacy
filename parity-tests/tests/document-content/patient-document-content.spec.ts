import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  getModernizedAdminSessionHeaders,
  openAuthenticatedModernizedDocuments
} from "../../src/ui/modernizedOpenEmr.js";
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
  test("stable document anchor exposes full stored document content", async ({ target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(documentAnchorPatientId);
    expect(patient).not.toBeNull();

    const documents = await targetDb.getPatientDocumentsForPatient(patient!.pid);
    const intakePacket = documents.documents.find((document) => document.name === intakePacketName);
    expect(intakePacket).toBeTruthy();

    const content = await targetDb.getPatientDocumentContent(intakePacket!.id);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-27-document-content-anchor",
      description: "Verifies the Slice 27 patient document content anchor, selected document metadata, and full stored text payload.",
      expected: {
        patient: {
          pubpid: documentAnchorPatientId
        },
        document: {
          documentKey: "DOC-MOD-PAT-0001-1",
          categoryId: 3,
          categoryName: "Medical Record",
          name: intakePacketName,
          mimetype: "text/plain",
          storageMethod: "database",
          encounter: 1000013,
          content: intakePacketContent,
          sizeBytes: Buffer.byteLength(intakePacketContent, "utf8")
        }
      },
      actual: {
        patient,
        documents,
        selectedDocument: intakePacket,
        content
      },
      context: {
        canonicalId: documentAnchorPatientId,
        suite: "document-content",
        workflow: "patient-document-content"
      }
    });

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

  test("document content is reachable from the application surface", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(documentAnchorPatientId);
    expect(patient).not.toBeNull();
    const documents = await targetDb.getPatientDocumentsForPatient(patient!.pid);
    const intakePacket = documents.documents.find((document) => document.name === intakePacketName);
    expect(intakePacket).toBeTruthy();
    const content = await targetDb.getPatientDocumentContent(intakePacket!.id);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-27-document-content-ui-precondition",
      description: "Captures the Slice 27 selected document and full content facts before steering legacy document viewing or modernized content/download retrieval.",
      expected: {
        patient: {
          pubpid: documentAnchorPatientId
        },
        document: {
          name: intakePacketName,
          fileName: "Primary care intake packet.txt",
          mimetype: "text/plain",
          contentIncludes: [
            "Gold synthetic document DOC-MOD-PAT-0001-1",
            "Purpose: Stable search and demographics navigation"
          ],
          canPreviewInline: true,
          canDownload: true
        }
      },
      actual: {
        patient,
        selectedDocument: intakePacket,
        content
      },
      context: {
        canonicalId: documentAnchorPatientId,
        suite: "document-content",
        workflow: "patient-document-content-ui"
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientDocumentsDirect(page, target, patient!.pid);
      await expandPatientDocumentCategories(page, ["Medical Record"]);
      await expectRenderedText(page, intakePacketName);
      await expectRenderedText(page, "Document Uploader/Viewer");
      return;
    }

    const headers = await getModernizedAdminSessionHeaders(page, target);
    const apiContent = await page.request.get(`${target.apiBaseUrl}/api/documents/${intakePacket!.id}/content`, {
      headers
    });
    expect(apiContent.ok()).toBe(true);
    const apiPayload = await apiContent.json();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-27-document-content-api-response",
      description: "Captures the modernized Slice 27 document content and download API response facts before browser-visible viewer assertions.",
      expected: {
        document: {
          id: intakePacket!.id,
          fileName: "Primary care intake packet.txt",
          mimetype: "text/plain",
          content: intakePacketContent,
          downloadContentType: "text/plain"
        }
      },
      actual: {
        patient,
        selectedDocument: intakePacket,
        databaseContent: content,
        apiPayload
      },
      context: {
        canonicalId: documentAnchorPatientId,
        suite: "document-content",
        workflow: "patient-document-content-api"
      }
    });

    expect(apiPayload).toMatchObject({
      id: intakePacket!.id,
      fileName: "Primary care intake packet.txt",
      mimetype: "text/plain",
      content: intakePacketContent
    });

    const download = await page.request.get(`${target.apiBaseUrl}/api/documents/${intakePacket!.id}/download`, {
      headers
    });
    expect(download.ok()).toBe(true);
    const downloadContentType = download.headers()["content-type"];
    const downloadText = await download.text();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-27-document-content-download-response",
      description: "Captures the modernized Slice 27 document download response facts before browser-visible viewer assertions.",
      expected: {
        document: {
          id: intakePacket!.id,
          contentTypeIncludes: "text/plain",
          content: intakePacketContent
        }
      },
      actual: {
        patient,
        selectedDocument: intakePacket,
        contentType: downloadContentType,
        downloadedText: downloadText
      },
      context: {
        canonicalId: documentAnchorPatientId,
        suite: "document-content",
        workflow: "patient-document-content-download"
      }
    });

    expect(downloadContentType).toContain("text/plain");
    expect(downloadText).toBe(intakePacketContent);

    await openAuthenticatedModernizedDocuments(page, target, patient!.pubpid);

    const intakeCard = page.locator(".document-card").filter({ hasText: intakePacketName }).first();
    await expect(intakeCard).toBeVisible();
    await intakeCard.getByRole("button", { name: "View" }).click();
    await expect(page.getByRole("heading", { name: "Document Viewer" })).toBeVisible();
    await expect(page.locator(".document-content-block")).toContainText("Gold synthetic document DOC-MOD-PAT-0001-1");
    await expect(page.locator(".document-content-block")).toContainText("Purpose: Stable search and demographics navigation");
    await expect(page.getByLabel("Document viewer").getByRole("button", { name: "Download" })).toBeVisible();
  });
});
