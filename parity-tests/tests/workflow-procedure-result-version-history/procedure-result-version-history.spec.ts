import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openProcedureResultsDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedProcedures } from "../../src/ui/modernizedOpenEmr.js";

const procedureVersionAnchorPatientId = "MOD-PAT-0009";

test.describe("procedure result version history parity @slice598 @workflow-procedure-result-version-history @mutation", () => {
  test("preserves prior result versions after repeated correction on the modernized target", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureVersionAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Missing seeded procedure result version-history patient ${procedureVersionAnchorPatientId}`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Versioned Procedure ${suffix}`;
    const firstResultText = `Parity Initial Potassium ${suffix}`;
    const secondResultText = `Parity Corrected Potassium ${suffix}`;
    const thirdResultText = `Parity Final Potassium ${suffix}`;
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;
    let procedureResultId: number | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-598-procedure-result-version-history-precondition",
      description:
        "Seeded patient, baseline workflow counts, and proposed temporary procedure result with two corrections.",
      expected: {
        patientCanonicalId: procedureVersionAnchorPatientId,
        targetBehavior: target.type === "modernized-openemr" ? "current-plus-prior result versions" : "overwrite-only result baseline",
        values: ["4.8", "5.2", "4.9"]
      },
      actual: {
        patient,
        beforeCounts,
        procedureName,
        firstResultText,
        secondResultText,
        thirdResultText
      }
    });

    try {
      encounterId = await workflow.createEncounter({
        patientId: patient.pid,
        providerId: patient.providerId,
        dateTime: "2026-06-18 14:00:00",
        reason: `Parity Versioned Lab Encounter ${suffix}`,
        facilityId: 10,
        facilityName: "OpenEMR Modernization Clinic",
        billingFacilityId: 10,
        sensitivity: "normal",
        referralSource: "Parity suite",
        externalId: `PVR${suffix.slice(-8)}`,
        posCode: 11,
        billingNote: "Procedure result version-history workflow test encounter."
      });

      procedureOrderId = await workflow.createProcedureOrder({
        patientId: patient.pid,
        providerId: patient.providerId,
        encounterId,
        dateOrdered: "2026-06-18 14:15:00",
        priority: "routine",
        status: "complete",
        procedureCode: "80053",
        procedureName,
        procedureType: "laboratory",
        diagnosis: "Z00.00",
        instructions: "Created by the parity procedure result version-history suite."
      });

      procedureReportId = await workflow.createProcedureReport({
        orderId: procedureOrderId,
        dateCollected: "2026-06-18 14:30:00",
        dateReport: "2026-06-18 15:00:00",
        specimenNumber: `PARITY-VERSION-${suffix}`,
        reportStatus: "final",
        reviewStatus: "reviewed",
        notes: "Parity procedure result version-history report."
      });

      procedureResultId = await workflow.createProcedureResult({
        reportId: procedureReportId,
        resultCode: "2823-3",
        resultText: firstResultText,
        dateTime: "2026-06-18 15:05:00",
        facility: "OpenEMR Modernization Clinic",
        units: "mmol/L",
        result: "4.8",
        range: "3.5-5.1",
        abnormal: "normal",
        comments: "Initial potassium result before corrections.",
        status: "final"
      });

      await workflow.updateProcedureResult(procedureResultId, {
        reportId: procedureReportId,
        resultCode: "2823-3",
        resultText: secondResultText,
        dateTime: "2026-06-18 15:35:00",
        facility: "OpenEMR Modernization Clinic",
        units: "mmol/L",
        result: "5.2",
        range: "3.5-5.1",
        abnormal: "high",
        comments: "First correction from the parity suite.",
        status: "corrected"
      });

      await workflow.updateProcedureResult(procedureResultId, {
        reportId: procedureReportId,
        resultCode: "2823-3",
        resultText: thirdResultText,
        dateTime: "2026-06-18 16:05:00",
        facility: "OpenEMR Modernization Clinic",
        units: "mmol/L",
        result: "4.9",
        range: "3.5-5.1",
        abnormal: "normal",
        comments: "Final correction from the parity suite.",
        status: "corrected"
      });

      const resultRecord = await workflow.getProcedureResult(procedureResultId);
      expect(resultRecord).toMatchObject({
        resultText: thirdResultText,
        result: "4.9",
        abnormal: "normal",
        status: "corrected"
      });

      const expectedVersionCount = target.type === "modernized-openemr" ? 3 : 1;
      expect(resultRecord?.currentVersion).toBe(expectedVersionCount);
      expect(resultRecord?.versionHistoryCount).toBe(expectedVersionCount);
      expect(resultRecord?.hasPriorVersions).toBe(target.type === "modernized-openemr");

      const afterCorrections = await targetDb.getProcedureResultsForPatient(patient.pid);
      const correctedOrder = afterCorrections.orders.find((order) => order.procedureName === procedureName);
      expect(correctedOrder).not.toBeUndefined();
      const correctedResult = correctedOrder?.reports[0]?.results[0];
      expect(correctedResult).toMatchObject({
        text: thirdResultText,
        result: "4.9",
        abnormal: "normal",
        resultStatus: "corrected",
        currentVersion: expectedVersionCount,
        versionHistoryCount: expectedVersionCount,
        hasPriorVersions: target.type === "modernized-openemr"
      });

      if (target.type === "modernized-openemr") {
        expect(correctedResult?.versionHistory).toHaveLength(3);
        expect(correctedResult?.versionHistory?.[0]).toMatchObject({
          version: 3,
          versionStatus: "Current version",
          text: thirdResultText,
          result: "4.9"
        });
        expect(correctedResult?.versionHistory?.[1]).toMatchObject({
          version: 2,
          versionStatus: "Prior version",
          text: secondResultText,
          result: "5.2"
        });
        expect(correctedResult?.versionHistory?.[2]).toMatchObject({
          version: 1,
          versionStatus: "Prior version",
          text: firstResultText,
          result: "4.8"
        });

        await openAuthenticatedModernizedProcedures(page, target, patient.pubpid);
        const resultCard = page.locator(".procedure-result-card", { hasText: thirdResultText }).first();
        await expect(resultCard).toBeVisible();
        await expect(resultCard).toContainText("Version 3");
        await expect(resultCard).toContainText("3 versions");
        await expect(resultCard).toContainText("Prior version");
        await expect(resultCard).toContainText(firstResultText);
        await expect(resultCard).toContainText(secondResultText);
        await expect(resultCard).toContainText("5.2");
      } else {
        expect(correctedResult?.versionHistory ?? []).toHaveLength(0);
        await loginToLegacyOpenEmr(page, target);
        await openProcedureResultsDirect(page, target, patient.pid);
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, thirdResultText);
        await expectRenderedText(page, "4.9");
      }

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-598-procedure-result-version-history-corrected",
        description:
          "Procedure result after two corrections, including modernized current-plus-prior version history or legacy overwrite-only baseline evidence.",
        expected: {
          resultIdStable: true,
          currentResult: {
            text: thirdResultText,
            result: "4.9",
            abnormal: "normal",
            status: "corrected",
            versionCount: expectedVersionCount
          },
          modernizedPriorVersions:
            target.type === "modernized-openemr"
              ? [
                  { text: secondResultText, result: "5.2" },
                  { text: firstResultText, result: "4.8" }
                ]
              : []
        },
        actual: {
          patient,
          procedureOrderId,
          procedureReportId,
          procedureResultId,
          resultRecord,
          correctedOrder,
          correctedResult,
          afterCorrections
        }
      });
    } finally {
      if (procedureOrderId !== null) {
        await workflow.deleteProcedureOrderCascade(procedureOrderId);
      }
      if (encounterId !== null) {
        await workflow.deleteEncounter(encounterId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.procedureOrders).toBe(beforeCounts.procedureOrders);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-598-procedure-result-version-history-cleanup",
      description:
        "Temporary procedure result version-history order tree and encounter were deleted, restoring patient workflow counts.",
      expected: {
        counts: beforeCounts
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        procedureOrderId,
        procedureReportId,
        procedureResultId
      }
    });
  });
});

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-12) || "local";
}
