import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedDocuments } from "../../src/ui/modernizedOpenEmr.js";

const documentVersionHistoryAnchorPatientId = "MOD-PAT-0001";

test.describe("patient document version history parity @slice597 @workflow-document-version-history @mutation @documents", () => {
  test("preserves prior document versions after repeated content replacement on the modernized target", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(documentVersionHistoryAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${documentVersionHistoryAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const suffix = workflowSuffix();
    const documentName = `Parity Version History Document ${suffix}`;
    const firstBody = `Original version-history payload for ${documentName}.`;
    const secondBody = `Second version-history payload for ${documentName}.`;
    const thirdBody = `Third version-history payload for ${documentName}.`;
    const documentInput = {
      patientId: patient.pid,
      categoryId: 3,
      categoryName: "Medical Record",
      name: documentName,
      docDate: "2026-06-22",
      encounter: 1000013,
      content: firstBody,
      notes: "Created by the parity document version-history suite."
    };
    let documentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-597-document-version-history-precondition",
        description: "Captures the Slice 597 version-history anchor patient, baseline document count, original document payload, and two proposed replacement bodies before create.",
        expected: {
          patient: {
            pubpid: documentVersionHistoryAnchorPatientId,
            displayName: "Stone, Avery"
          },
          modernizedVersionHistory: {
            currentVersion: 3,
            versionHistoryCount: 3,
            priorVersionCount: 2,
            currentIncludes: thirdBody,
            priorIncludes: [secondBody, firstBody]
          },
          legacyBaseline: {
            currentVersion: 1,
            versionHistoryCount: 1,
            currentIncludes: thirdBody,
            priorVersionsPreserved: false
          },
          countChange: {
            documentsAfterCreate: beforeCounts.documents + 1,
            documentsAfterCleanup: beforeCounts.documents
          }
        },
        actual: {
          patient,
          beforeCounts,
          proposedDocument: documentInput,
          replacements: [secondBody, thirdBody]
        },
        context: {
          canonicalId: documentVersionHistoryAnchorPatientId,
          suite: "workflow-document-version-history",
          workflow: "patient-document-version-history"
        }
      });

      documentId = await workflow.createPatientDocument(documentInput);
      await page.waitForTimeout(1100);
      await workflow.replacePatientDocumentContent(documentId, {
        fileName: `${documentName}-v2.txt`,
        content: secondBody
      });
      await page.waitForTimeout(1100);
      await workflow.replacePatientDocumentContent(documentId, {
        fileName: `${documentName}-v3.txt`,
        content: thirdBody
      });

      const afterReplace = await targetDb.getPatientDocumentContent(Number(documentId));
      expect(afterReplace).not.toBeNull();
      expect(afterReplace!.content).toContain(thirdBody);
      expect(afterReplace!.content).not.toContain(firstBody);
      expect(afterReplace!.content).not.toContain(secondBody);

      if (target.type === "modernized-openemr") {
        expect(afterReplace).toMatchObject({
          currentVersion: 3,
          versionLabel: "Version 3",
          versionStatus: "Current version",
          versionHistoryCount: 3,
          hasPriorVersions: true
        });
        expect(afterReplace!.versionHistory).toHaveLength(3);
        expect(afterReplace!.versionHistory![0]).toMatchObject({
          version: 3,
          versionStatus: "Current version",
          contentPreview: thirdBody
        });
        expect(afterReplace!.versionHistory![1]).toMatchObject({
          version: 2,
          versionStatus: "Prior version",
          contentPreview: secondBody
        });
        expect(afterReplace!.versionHistory![2]).toMatchObject({
          version: 1,
          versionStatus: "Prior version",
          contentPreview: firstBody
        });

        await openAuthenticatedModernizedDocuments(page, target, patient.pubpid);
        const documentCard = page.locator(".document-card").filter({ hasText: documentName }).first();
        await expect(documentCard).toBeVisible();
        await expect(documentCard).toContainText("Version 3 / Current version");
        await expect(documentCard).toContainText("3 versions");

        await documentCard.getByRole("button", { name: "View" }).click();
        const viewer = page.getByLabel("Document viewer");
        await expect(viewer).toContainText("Version 3");
        await expect(viewer).toContainText("Version 2");
        await expect(viewer).toContainText("Version 1");
        await expect(viewer).toContainText(thirdBody);
        await expect(viewer).toContainText(secondBody);
        await expect(viewer).toContainText(firstBody);
      } else {
        expect(afterReplace).toMatchObject({
          currentVersion: 1,
          versionLabel: "Version 1",
          versionStatus: "Current version",
          versionHistoryCount: 1,
          hasPriorVersions: false
        });
        expect(afterReplace!.versionHistory ?? []).toHaveLength(0);
      }

      const afterReplaceCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterReplaceCounts.documents).toBe(beforeCounts.documents + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-597-document-version-history-replaced",
        description: "Captures document version-history state after two content replacements, including modernized prior-version rows and the legacy overwrite-only baseline.",
        expected: target.type === "modernized-openemr"
          ? {
              currentVersion: 3,
              versionHistoryCount: 3,
              hasPriorVersions: true,
              currentIncludes: thirdBody,
              priorVersionsInclude: [secondBody, firstBody]
            }
          : {
              currentVersion: 1,
              versionHistoryCount: 1,
              hasPriorVersions: false,
              currentIncludes: thirdBody
            },
        actual: {
          patient,
          beforeCounts,
          afterReplaceCounts,
          documentId,
          afterReplace
        },
        context: {
          canonicalId: documentVersionHistoryAnchorPatientId,
          suite: "workflow-document-version-history",
          workflow: "patient-document-version-history-replaced"
        }
      });
    } finally {
      if (documentId !== null) {
        await workflow.deletePatientDocument(documentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.documents).toBe(beforeCounts.documents);
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
