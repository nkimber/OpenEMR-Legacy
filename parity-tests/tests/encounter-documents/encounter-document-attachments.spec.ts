import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
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
  test("stable encounter anchor exposes attached document facts", async ({ target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (patient === null) {
      throw new Error(`Encounter document anchor patient ${encounterDocumentAnchorPatientId} was not found.`);
    }

    const encounter = await targetDb.getLatestEncounterForPatient(patient.pid);
    expect(encounter).not.toBeNull();
    if (encounter === null) {
      throw new Error(`Encounter document anchor encounter for ${encounterDocumentAnchorPatientId} was not found.`);
    }
    expect(encounter.encounter).toBe(1000013);

    const documents = await targetDb.getPatientDocumentsForEncounter(patient.pid, encounter.encounter);
    expect(documents.patientId).toBe(patient.pid);
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-67-encounter-documents-source",
      description: "Captures the Slice 67 encounter-attached document source contract: anchor patient, encounter 1000013, and the two seeded active text document attachments.",
      expected: {
        anchorCanonicalId: encounterDocumentAnchorPatientId,
        encounter: 1000013,
        documentCount: 2,
        orderedNames: [advanceDirectiveName, intakePacketName],
        requiredCategories: ["Advance Directive", "Medical Record"],
        previewKind: "text",
        thumbnailLabel: "TXT"
      },
      actual: {
        patient,
        encounter,
        documents,
        selectedDocuments: {
          intakePacket,
          advanceDirective
        }
      },
      context: {
        suite: "encounter-documents",
        workflow: "encounter-document-source"
      }
    });
  });

  test("encounter-attached documents are reachable from the application surface", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDocumentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (patient === null) {
      throw new Error(`Encounter document anchor patient ${encounterDocumentAnchorPatientId} was not found.`);
    }
    const encounter = await targetDb.getLatestEncounterForPatient(patient.pid);
    expect(encounter).not.toBeNull();
    if (encounter === null) {
      throw new Error(`Encounter document anchor encounter for ${encounterDocumentAnchorPatientId} was not found.`);
    }
    const documents = await targetDb.getPatientDocumentsForEncounter(patient.pid, encounter.encounter);

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientDocumentsDirect(page, target, patient.pid);
      await expandPatientDocumentCategories(page, ["Medical Record", "Advance Directive"]);
      await expectRenderedText(page, intakePacketName);
      await expectRenderedText(page, advanceDirectiveName);
      await expectRenderedText(page, "Medical Record");
      await expectRenderedText(page, "Advance Directive");
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-67-encounter-documents-surface",
        description: "Captures the Slice 67 legacy application-surface evidence: patient document categories and encounter-linked document names rendered through OpenEMR Documents.",
        expected: {
          anchorCanonicalId: encounterDocumentAnchorPatientId,
          encounter: 1000013,
          renderedDocumentNames: [intakePacketName, advanceDirectiveName],
          renderedCategories: ["Medical Record", "Advance Directive"]
        },
        actual: {
          patient,
          encounter,
          documents,
          legacySurface: {
            page: "patient documents",
            expandedCategories: ["Medical Record", "Advance Directive"],
            renderedDocumentNames: [intakePacketName, advanceDirectiveName]
          }
        },
        context: {
          suite: "encounter-documents",
          workflow: "encounter-document-surface"
        }
      });
      return;
    }

    const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounter.encounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
    expect(detailResponse.ok()).toBe(true);
    const detailPayload = await detailResponse.json();
    expect(detailPayload.documents).toHaveLength(2);
    expect(detailPayload.documents.map((document: { name: string }) => document.name)).toEqual([
      advanceDirectiveName,
      intakePacketName
    ]);

    await openAuthenticatedModernizedEncounters(page, target, patient.pubpid, encounterDocumentAnchorFromDate);

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
    await expect(attachments.getByRole("button", { name: "Download" })).toHaveCount(2);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-67-encounter-documents-surface",
      description: "Captures the Slice 67 modernized application-surface evidence: encounter detail API documents and Encounters workspace attached-document rendering anchors.",
      expected: {
        anchorCanonicalId: encounterDocumentAnchorPatientId,
        encounter: 1000013,
        apiDocumentNames: [advanceDirectiveName, intakePacketName],
        uiPanelLabel: "Encounter attached documents",
        uiHeading: "Attached Documents",
        downloadButtonCount: 2,
        renderedCategories: ["Medical Record", "Advance Directive"],
        previewText: "Inline text preview"
      },
      actual: {
        patient,
        encounter,
        documents,
        apiDocuments: detailPayload.documents,
        modernizedSurface: {
          fromDate: encounterDocumentAnchorFromDate,
          selectedEncounterLabel: "Hyperlipidemia",
          panelLabel: "Encounter attached documents",
          renderedDocumentNames: [intakePacketName, advanceDirectiveName]
        }
      },
      context: {
        suite: "encounter-documents",
        workflow: "encounter-document-surface"
      }
    });
  });
});
