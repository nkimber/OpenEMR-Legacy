import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openProcedureResultsDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedProcedures } from "../../src/ui/modernizedOpenEmr.js";

const procedureCorrectionAnchorPatientId = "MOD-PAT-0009";

test.describe("procedure result correction parity @slice129 @workflow-procedure-result-correction @mutation", () => {
  test("corrects an existing lab result and cleans up the temporary workflow", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureCorrectionAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Missing seeded procedure result correction patient ${procedureCorrectionAnchorPatientId}`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeProcedures = await targetDb.getProcedureResultsForPatient(patient.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Corrected Procedure ${suffix}`;
    const initialResultText = `Parity Initial Glucose ${suffix}`;
    const correctedResultText = `Parity Corrected Glucose ${suffix}`;
    const encounterInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateTime: "2026-06-18 12:00:00",
      reason: `Parity Corrected Lab Encounter ${suffix}`,
      facilityId: 10,
      facilityName: "OpenEMR Modernization Clinic",
      billingFacilityId: 10,
      sensitivity: "normal",
      referralSource: "Parity suite",
      externalId: `PCR${suffix.slice(-8)}`,
      posCode: 11,
      billingNote: "Procedure result correction workflow test encounter."
    };
    const procedureOrderInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateOrdered: "2026-06-18 12:15:00",
      priority: "routine",
      status: "complete",
      procedureCode: "80053",
      procedureName,
      procedureType: "laboratory",
      diagnosis: "Z00.00",
      instructions: "Created by the parity procedure correction suite."
    };
    const procedureReportInput = {
      dateCollected: "2026-06-18 12:30:00",
      dateReport: "2026-06-18 13:00:00",
      specimenNumber: `PARITY-CORR-${suffix}`,
      reportStatus: "final",
      reviewStatus: "reviewed",
      notes: "Parity procedure correction report."
    };
    const initialResultInput = {
      resultCode: "2345-7",
      resultText: initialResultText,
      dateTime: "2026-06-18 13:05:00",
      facility: "OpenEMR Modernization Clinic",
      units: "mg/dL",
      result: "104",
      range: "70-99",
      abnormal: "high",
      comments: "Initial result before correction.",
      status: "final"
    };
    const correctedPayload = {
      resultCode: "2345-7",
      resultText: correctedResultText,
      dateTime: "2026-06-18 13:35:00",
      facility: "OpenEMR Modernization Clinic",
      units: "mg/dL",
      result: "118",
      range: "70-110",
      abnormal: "borderline",
      comments: "Corrected from the parity procedure correction suite.",
      status: "corrected"
    };
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;
    let procedureResultId: number | null = null;
    let encounter: Awaited<ReturnType<typeof workflow.getEncounter>> = null;
    let createdOrder: Awaited<ReturnType<typeof workflow.getProcedureOrder>> = null;
    let createdReport: Awaited<ReturnType<typeof workflow.getProcedureReport>> = null;
    let initialResult: Awaited<ReturnType<typeof workflow.getProcedureResult>> = null;
    let correctedResult: Awaited<ReturnType<typeof workflow.getProcedureResult>> = null;
    let afterCreateCounts: Awaited<ReturnType<typeof targetDb.getPatientWorkflowCounts>> | null = null;
    let afterInitialCreate: Awaited<ReturnType<typeof targetDb.getProcedureResultsForPatient>> | null = null;
    let afterCorrection: Awaited<ReturnType<typeof targetDb.getProcedureResultsForPatient>> | null = null;
    let correctedOrder: Awaited<ReturnType<typeof targetDb.getProcedureResultsForPatient>>["orders"][number] | undefined;
    let surfaceFacts: Record<string, unknown> = {};

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-129-procedure-result-correction-precondition",
      description:
        "Seeded patient, baseline workflow counts, baseline procedure summary, proposed temporary encounter/order/report/result, and correction payload before result correction.",
      expected: {
        patientCanonicalId: procedureCorrectionAnchorPatientId,
        create: {
          encounter: {
            facilityId: 10,
            billingFacilityId: 10,
            posCode: 11,
            sensitivity: "normal"
          },
          order: {
            status: "complete",
            priority: "routine",
            procedureCode: "80053",
            procedureType: "laboratory",
            diagnosis: "Z00.00"
          },
          report: {
            reportStatus: "final",
            reviewStatus: "reviewed"
          },
          initialResult: {
            resultCode: "2345-7",
            result: "104",
            range: "70-99",
            abnormal: "high",
            status: "final"
          },
          correctedResult: {
            resultCode: "2345-7",
            result: "118",
            range: "70-110",
            abnormal: "borderline",
            status: "corrected"
          }
        },
        countChange: {
          encountersAfterCreate: beforeCounts.encounters + 1,
          procedureOrdersAfterCreate: beforeCounts.procedureOrders + 1,
          encountersAfterCleanup: beforeCounts.encounters,
          procedureOrdersAfterCleanup: beforeCounts.procedureOrders
        }
      },
      actual: {
        patient,
        beforeCounts,
        beforeProcedures,
        proposed: {
          encounter: encounterInput,
          order: procedureOrderInput,
          report: procedureReportInput,
          initialResult: initialResultInput,
          correction: correctedPayload
        }
      }
    });

    try {
      encounterId = await workflow.createEncounter(encounterInput);
      encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      procedureOrderId = await workflow.createProcedureOrder({
        encounterId: encounter!.encounter,
        ...procedureOrderInput
      });
      createdOrder = await workflow.getProcedureOrder(procedureOrderId);
      expect(createdOrder).toMatchObject({
        patientId: patient.pid,
        encounterId: encounter!.encounter,
        orderStatus: "complete",
        orderPriority: "routine",
        procedureCode: "80053",
        procedureName,
        procedureType: "laboratory"
      });

      procedureReportId = await workflow.createProcedureReport({
        orderId: procedureOrderId,
        ...procedureReportInput
      });
      createdReport = await workflow.getProcedureReport(procedureReportId);
      expect(createdReport).toMatchObject({
        orderId: procedureOrderId,
        reportStatus: "final",
        reviewStatus: "reviewed",
        reportNotes: "Parity procedure correction report."
      });

      procedureResultId = await workflow.createProcedureResult({
        reportId: procedureReportId,
        ...initialResultInput
      });
      initialResult = await workflow.getProcedureResult(procedureResultId);
      expect(initialResult).toMatchObject({
        reportId: procedureReportId,
        resultCode: "2345-7",
        resultText: initialResultText,
        result: "104",
        abnormal: "high",
        status: "final"
      });

      afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      afterInitialCreate = await targetDb.getProcedureResultsForPatient(patient.pid);
      const initialOrder = afterInitialCreate.orders.find((order) => order.procedureName === procedureName);
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterCreateCounts.procedureOrders).toBe(beforeCounts.procedureOrders + 1);
      expect(initialOrder).not.toBeUndefined();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-129-procedure-result-correction-created",
        description:
          "Temporary encounter, completed procedure order, reviewed final report, and initial final result before correction.",
        expected: {
          counts: {
            encounters: beforeCounts.encounters + 1,
            procedureOrders: beforeCounts.procedureOrders + 1
          },
          order: {
            orderStatus: "complete",
            orderPriority: "routine",
            procedureCode: "80053",
            procedureName,
            procedureType: "laboratory"
          },
          report: {
            reportStatus: "final",
            reviewStatus: "reviewed"
          },
          result: {
            resultCode: "2345-7",
            resultText: initialResultText,
            result: "104",
            range: "70-99",
            abnormal: "high",
            status: "final"
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          beforeProcedures,
          afterInitialCreate,
          encounterId,
          encounter,
          procedureOrderId,
          createdOrder,
          procedureReportId,
          createdReport,
          procedureResultId,
          initialResult,
          initialOrder
        }
      });

      const correctionInput = {
        reportId: procedureReportId,
        ...correctedPayload
      };

      if (target.type === "legacy-openemr") {
        await workflow.updateProcedureResult(procedureResultId, correctionInput);

        await loginToLegacyOpenEmr(page, target);
        await openProcedureResultsDirect(page, target, patient.pid);
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, correctedResultText);
        await expectRenderedText(page, "118");
        surfaceFacts = {
          legacyProcedureResults: {
            page: "Procedure Results",
            patientPid: patient.pid,
            renderedProcedureName: procedureName,
            renderedResultText: correctedResultText,
            renderedResult: "118"
          }
        };
      } else {
        await openAuthenticatedModernizedProcedures(page, target, patient.pubpid);

        await expect(page.locator("body")).toContainText(procedureName);
        const resultCard = page.locator(".procedure-result-card", { hasText: initialResultText }).first();
        await expect(resultCard).toBeVisible();
        await resultCard.getByRole("button", { name: "Correct" }).click();
        await resultCard.getByLabel("Procedure corrected result text").fill(correctedResultText);
        await resultCard.getByLabel("Procedure corrected result date").fill("2026-06-18 13:35");
        await resultCard.getByLabel("Procedure corrected result status").selectOption("corrected");
        await resultCard.getByLabel("Procedure corrected result value").fill("118");
        await resultCard.getByLabel("Procedure corrected result range").fill("70-110");
        await resultCard.getByLabel("Procedure corrected result abnormal flag").fill("borderline");
        await resultCard.getByRole("button", { name: /Save Correction/i }).click();

        await expect(page.locator("body")).toContainText(correctedResultText);
        await expect(page.locator("body")).toContainText("118");
        await expect(page.locator("body")).toContainText("corrected");
        await expect(page.locator("body")).toContainText("borderline");
        surfaceFacts = {
          modernizedProcedures: {
            page: "procedures",
            searchPatientId: patient.pubpid,
            procedureName,
            initialResultText,
            correctedResultText,
            renderedBodyIncludes: ["118", "corrected", "borderline"]
          }
        };
      }

      correctedResult = await workflow.getProcedureResult(procedureResultId);
      expect(correctedResult).toMatchObject({
        reportId: procedureReportId,
        resultCode: "2345-7",
        resultText: correctedResultText,
        result: "118",
        abnormal: "borderline",
        status: "corrected"
      });

      afterCorrection = await targetDb.getProcedureResultsForPatient(patient.pid);
      correctedOrder = afterCorrection.orders.find((order) => order.procedureName === procedureName);
      expect(correctedOrder).not.toBeUndefined();
      expect(correctedOrder!.reports).toHaveLength(1);
      expect(correctedOrder!.reports[0].results).toHaveLength(1);
      expect(correctedOrder!.reports[0].results[0]).toMatchObject({
        code: "2345-7",
        text: correctedResultText,
        units: "mg/dL",
        result: "118",
        range: "70-110",
        abnormal: "borderline",
        resultStatus: "corrected"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-129-procedure-result-correction-corrected",
        description:
          "Corrected procedure result row after in-place update, including corrected value/range/abnormal/status, patient procedure projection, and UI/API surface facts.",
        expected: {
          resultIdStable: true,
          correctedResult: {
            reportId: procedureReportId,
            resultCode: "2345-7",
            resultText: correctedResultText,
            result: "118",
            range: "70-110",
            abnormal: "borderline",
            status: "corrected"
          },
          projection: {
            orderName: procedureName,
            reportCount: 1,
            resultCount: 1,
            units: "mg/dL",
            resultStatus: "corrected"
          }
        },
        actual: {
          patient,
          procedureOrderId,
          procedureReportId,
          procedureResultId,
          initialResult,
          correctedResult,
          afterCorrection,
          correctedOrder,
          correctionInput,
          surfaceFacts
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
    const afterCleanupProcedures = await targetDb.getProcedureResultsForPatient(patient.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.procedureOrders).toBe(beforeCounts.procedureOrders);
    const deletedOrder = procedureOrderId !== null ? await workflow.getProcedureOrder(procedureOrderId) : null;
    const deletedReport = procedureReportId !== null ? await workflow.getProcedureReport(procedureReportId) : null;
    const deletedResult = procedureResultId !== null ? await workflow.getProcedureResult(procedureResultId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-129-procedure-result-correction-cleanup",
      description:
        "Temporary procedure correction order tree and temporary encounter were deleted, restoring encounter/procedure counts and removing order/report/result rows.",
      expected: {
        counts: {
          encounters: beforeCounts.encounters,
          procedureOrders: beforeCounts.procedureOrders
        },
        deletedOrder: null,
        deletedReport: null,
        deletedResult: null
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        beforeProcedures,
        afterCleanupProcedures,
        encounterId,
        procedureOrderId,
        procedureReportId,
        procedureResultId,
        deletedOrder,
        deletedReport,
        deletedResult
      }
    });
    if (procedureOrderId !== null) {
      expect(deletedOrder).toBeNull();
    }
    if (procedureReportId !== null) {
      expect(deletedReport).toBeNull();
    }
    if (procedureResultId !== null) {
      expect(deletedResult).toBeNull();
    }
  });
});

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-12) || "local";
}
