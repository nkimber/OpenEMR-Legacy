import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedDocuments } from "../../src/ui/modernizedOpenEmr.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
} from "../../src/ui/legacyOpenEmr.js";

const documentAnchorPatientId = "MOD-PAT-0001";

test.describe("patient documents parity @slice25 @documents", () => {
  test("stable document anchor has filed document metadata and previews", async ({ target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(documentAnchorPatientId);
    const documents = patient ? await targetDb.getPatientDocumentsForPatient(patient.pid) : null;
    const selectedDocuments = documents ? selectDocumentAnchors(documents.documents) : emptyDocumentAnchors();

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-25-patient-documents-anchor",
      description: "Verifies the Slice 25 patient document anchor, filed document metadata, categories, storage mode, and text preview facts.",
      expected: {
        patient: {
          pubpid: documentAnchorPatientId
        },
        documents: {
          count: 2,
          names: ["Advance directive acknowledgement", "Primary care intake packet"],
          intakePacket: {
            categoryId: 3,
            categoryName: "Medical Record",
            docDate: "2026-06-10",
            mimetype: "text/plain",
            storageMethod: "database",
            contentPreviewIncludes: "Gold synthetic document DOC-MOD-PAT-0001-1"
          },
          advanceDirective: {
            categoryId: 6,
            categoryName: "Advance Directive",
            docDate: "2026-06-12",
            mimetype: "text/plain",
            storageMethod: "database",
            contentPreviewIncludes: "Gold synthetic document DOC-MOD-PAT-0001-2"
          }
        }
      },
      actual: {
        patient,
        documents,
        selectedDocuments
      },
      context: {
        canonicalId: documentAnchorPatientId,
        suite: "documents",
        workflow: "patient-documents-readiness"
      }
    });

    expect(patient).not.toBeNull();
    expect(documents).not.toBeNull();
    expect(documents!.patientId).toBe(patient!.pid);
    expect(documents!.documents).toHaveLength(2);
    expect(documents!.documents.map((document) => document.name)).toEqual([
      "Advance directive acknowledgement",
      "Primary care intake packet"
    ]);

    const { intakePacket, advanceDirective } = selectedDocuments;
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

  test("patient documents are visible in the application UI", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(documentAnchorPatientId);
    const documents = patient ? await targetDb.getPatientDocumentsForPatient(patient.pid) : null;
    const selectedDocuments = documents ? selectDocumentAnchors(documents.documents) : emptyDocumentAnchors();

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-25-patient-documents-ui-precondition",
      description: "Captures the patient document rows used before steering the Slice 25 document list UI parity flow.",
      expected: {
        patient: {
          pubpid: documentAnchorPatientId
        },
        visibleDocuments: ["Primary care intake packet", "Advance directive acknowledgement"],
        visibleCategories: ["Medical Record", "Advance Directive"],
        visiblePreviewText: "Gold synthetic document DOC-MOD-PAT-0001-1"
      },
      actual: {
        patient,
        documents,
        selectedDocuments
      },
      context: {
        canonicalId: documentAnchorPatientId,
        suite: "documents",
        workflow: "patient-documents-ui"
      }
    });

    expect(patient).not.toBeNull();
    expect(documents).not.toBeNull();
    expect(documents!.documents).toHaveLength(2);
    expect(selectedDocuments.intakePacket).not.toBeNull();
    expect(selectedDocuments.advanceDirective).not.toBeNull();

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

    await openAuthenticatedModernizedDocuments(page, target, patient!.pubpid);

    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText("Primary care intake packet");
    await expect(page.locator("body")).toContainText("Advance directive acknowledgement");
    await expect(page.locator("body")).toContainText("Medical Record");
    await expect(page.locator("body")).toContainText("Gold synthetic document DOC-MOD-PAT-0001-1");
  });
});

function selectDocumentAnchors(
  documents: Array<{
    name: string;
    categoryId: number;
    categoryName: string;
    docDate: string;
    mimetype: string;
    storageMethod: string;
    contentPreview: string;
  }>
) {
  return {
    intakePacket: documents.find((document) => document.name === "Primary care intake packet") ?? null,
    advanceDirective: documents.find((document) => document.name === "Advance directive acknowledgement") ?? null
  };
}

function emptyDocumentAnchors() {
  return {
    intakePacket: null,
    advanceDirective: null
  };
}
