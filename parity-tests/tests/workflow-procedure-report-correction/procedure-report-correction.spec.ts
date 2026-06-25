import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openProcedureResultsDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedProcedures } from "../../src/ui/modernizedOpenEmr.js";

const procedureReportCorrectionAnchorPatientId = "MOD-PAT-0009";

test.describe("procedure report correction parity @slice133 @workflow-procedure-report-correction @mutation", () => {
  test("corrects temporary lab report metadata and cleans up the workflow", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureReportCorrectionAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Missing seeded procedure report correction patient ${procedureReportCorrectionAnchorPatientId}`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeProcedures = await targetDb.getProcedureResultsForPatient(patient.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Report Correction ${suffix}`;
    const resultText = `Parity Report Correction Glucose ${suffix}`;
    const initialSpecimenNumber = `RPCINIT${suffix.slice(-6)}`;
    const correctedSpecimenNumber = `RPCCORR${suffix.slice(-6)}`;
    const correctedNotes = `Corrected report notes ${suffix}`;
    const encounterInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateTime: "2026-06-18 12:00:00",
      reason: `Parity Report Correction Encounter ${suffix}`,
      facilityId: 10,
      facilityName: "OpenEMR Modernization Clinic",
      billingFacilityId: 10,
      sensitivity: "normal",
      referralSource: "Parity suite",
      externalId: `PRC${suffix.slice(-8)}`,
      posCode: 11,
      billingNote: "Procedure report correction workflow test encounter."
    };
    const procedureOrderInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateOrdered: "2026-06-18",
      priority: "routine",
      status: "complete",
      procedureCode: "80053",
      procedureName,
      procedureType: "laboratory",
      diagnosis: "Z00.00",
      instructions: "Created by the parity procedure report correction suite."
    };
    const procedureReportInput = {
      dateCollected: "2026-06-18 12:30:00",
      dateReport: "2026-06-18 13:00:00",
      specimenNumber: initialSpecimenNumber,
      reportStatus: "final",
      reviewStatus: "pending",
      notes: "Initial report metadata before correction."
    };
    const procedureResultInput = {
      resultCode: "2345-7",
      resultText,
      dateTime: "2026-06-18 13:05:00",
      facility: "OpenEMR Modernization Clinic",
      units: "mg/dL",
      result: "104",
      range: "70-99",
      abnormal: "high",
      comments: "Result row keeps the corrected report visible.",
      status: "final"
    };
    const correctedReportInput = {
      dateCollected: "2026-06-19 10:20:00",
      dateReport: "2026-06-19 11:00:00",
      specimenNumber: correctedSpecimenNumber,
      reportStatus: "corrected",
      reviewStatus: "reviewed",
      notes: correctedNotes
    };
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;
    let procedureResultId: number | null = null;
    let encounter: Awaited<ReturnType<typeof workflow.getEncounter>> = null;
    let createdOrder: Awaited<ReturnType<typeof workflow.getProcedureOrder>> = null;
    let initialReport: Awaited<ReturnType<typeof workflow.getProcedureReport>> = null;
    let initialResult: Awaited<ReturnType<typeof workflow.getProcedureResult>> = null;
    let correctedReport: Awaited<ReturnType<typeof workflow.getProcedureReport>> = null;
    let afterCreateCounts: Awaited<ReturnType<typeof targetDb.getPatientWorkflowCounts>> | null = null;
    let afterCreateProcedures: Awaited<ReturnType<typeof targetDb.getProcedureResultsForPatient>> | null = null;
    let afterCorrection: Awaited<ReturnType<typeof targetDb.getProcedureResultsForPatient>> | null = null;
    let correctedOrder: Awaited<ReturnType<typeof targetDb.getProcedureResultsForPatient>>["orders"][number] | undefined;
    let surfaceFacts: Record<string, unknown> = {};

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-133-procedure-report-correction-precondition",
      description:
        "Seeded patient, baseline workflow counts, baseline procedure summary, proposed temporary encounter/order/report/result, and corrected report payload before report correction.",
      expected: {
        patientCanonicalId: procedureReportCorrectionAnchorPatientId,
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
          initialReport: {
            dateCollected: "2026-06-18",
            reportDate: "2026-06-18",
            specimenNumber: initialSpecimenNumber,
            reportStatus: "final",
            reviewStatus: "pending"
          },
          correctedReport: {
            dateCollected: "2026-06-19",
            reportDate: "2026-06-19",
            specimenNumber: correctedSpecimenNumber,
            reportStatus: "corrected",
            reviewStatus: "reviewed"
          },
          result: {
            resultCode: "2345-7",
            result: "104",
            range: "70-99",
            abnormal: "high",
            status: "final"
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
          result: procedureResultInput,
          correction: correctedReportInput
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
      initialReport = await workflow.getProcedureReport(procedureReportId);
      expect(initialReport).toMatchObject({
        orderId: procedureOrderId,
        dateCollected: "2026-06-18",
        dateReport: "2026-06-18",
        specimenNumber: initialSpecimenNumber,
        reportStatus: "final",
        reviewStatus: "pending",
        reportNotes: "Initial report metadata before correction."
      });

      procedureResultId = await workflow.createProcedureResult({
        reportId: procedureReportId,
        ...procedureResultInput
      });
      initialResult = await workflow.getProcedureResult(procedureResultId);
      expect(initialResult).toMatchObject({
        reportId: procedureReportId,
        resultCode: "2345-7",
        resultText,
        result: "104",
        abnormal: "high",
        status: "final"
      });

      afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      afterCreateProcedures = await targetDb.getProcedureResultsForPatient(patient.pid);
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterCreateCounts.procedureOrders).toBe(beforeCounts.procedureOrders + 1);
      const createdOrderProjection = afterCreateProcedures.orders.find((order) => order.id === procedureOrderId);
      expect(createdOrderProjection).not.toBeUndefined();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-133-procedure-report-correction-created",
        description:
          "Temporary encounter, completed procedure order, initial pending-review report, linked result row, count deltas, and patient procedure projection before report correction.",
        expected: {
          counts: {
            encounters: beforeCounts.encounters + 1,
            procedureOrders: beforeCounts.procedureOrders + 1
          },
          report: {
            dateCollected: "2026-06-18",
            reportDate: "2026-06-18",
            specimenNumber: initialSpecimenNumber,
            reportStatus: "final",
            reviewStatus: "pending"
          },
          result: {
            resultCode: "2345-7",
            resultText,
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
          afterCreateProcedures,
          encounterId,
          encounter,
          procedureOrderId,
          createdOrder,
          procedureReportId,
          initialReport,
          procedureResultId,
          initialResult,
          createdOrderProjection
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.updateProcedureReport(procedureReportId, correctedReportInput);

        await loginToLegacyOpenEmr(page, target);
        await openProcedureResultsDirect(page, target, patient.pid);
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, correctedSpecimenNumber);
        await expectRenderedText(page, resultText);
        surfaceFacts = {
          legacyProcedureResults: {
            page: "Procedure Results",
            patientPid: patient.pid,
            renderedProcedureName: procedureName,
            renderedSpecimenNumber: correctedSpecimenNumber,
            renderedResultText: resultText
          }
        };
      } else {
        await openAuthenticatedModernizedProcedures(page, target, patient.pubpid);

        await expect(page.locator("body")).toContainText(procedureName);
        const reportCard = page.locator(".procedure-report-card", { hasText: initialSpecimenNumber }).first();
        await expect(reportCard).toBeVisible();
        await reportCard.getByRole("button", { name: "Correct Report" }).click();
        await reportCard.getByLabel("Procedure corrected report collected date").fill("2026-06-19 10:20");
        await reportCard.getByLabel("Procedure corrected report date").fill("2026-06-19 11:00");
        await reportCard.getByLabel("Procedure corrected report specimen number").fill(correctedSpecimenNumber);
        await reportCard.getByLabel("Procedure corrected report status").selectOption("corrected");
        await reportCard.getByLabel("Procedure corrected report review status").selectOption("reviewed");
        await reportCard.getByLabel("Procedure corrected report notes").fill(correctedNotes);
        await reportCard.getByRole("button", { name: /Save Report Correction/i }).click();

        await expect(page.locator("body")).toContainText(`Specimen ${correctedSpecimenNumber}`);
        await expect(page.locator("body")).toContainText("Collected 2026-06-19 10:20");
        await expect(page.locator("body")).toContainText("corrected");
        await expect(page.locator("body")).toContainText("reviewed");
        await expect(page.locator("body")).toContainText(correctedNotes);
        await expect(page.locator("body")).toContainText(resultText);
        surfaceFacts = {
          modernizedProcedures: {
            page: "procedures",
            searchPatientId: patient.pubpid,
            procedureName,
            initialSpecimenNumber,
            correctedSpecimenNumber,
            renderedBodyIncludes: [
              `Specimen ${correctedSpecimenNumber}`,
              "Collected 2026-06-19 10:20",
              "corrected",
              "reviewed",
              correctedNotes,
              resultText
            ]
          }
        };
      }

      correctedReport = await workflow.getProcedureReport(procedureReportId);
      expect(correctedReport).toMatchObject({
        orderId: procedureOrderId,
        dateCollected: "2026-06-19",
        dateReport: "2026-06-19",
        specimenNumber: correctedSpecimenNumber,
        reportStatus: "corrected",
        reviewStatus: "reviewed",
        reportNotes: correctedNotes
      });
      afterCorrection = await targetDb.getProcedureResultsForPatient(patient.pid);
      correctedOrder = afterCorrection.orders.find((order) => order.procedureName === procedureName);
      expect(correctedOrder).not.toBeUndefined();
      expect(correctedOrder!.reports).toHaveLength(1);
      expect(correctedOrder!.reports[0]).toMatchObject({
        dateCollected: "2026-06-19",
        reportDate: "2026-06-19",
        specimenNumber: correctedSpecimenNumber,
        status: "corrected",
        reviewStatus: "reviewed",
        reportNotes: correctedNotes
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-133-procedure-report-correction-corrected",
        description:
          "Corrected in-place procedure report metadata after changing collected date, report date, specimen number, report status, review status, and notes.",
        expected: {
          reportIdStable: true,
          correctedReport: {
            orderId: procedureOrderId,
            dateCollected: "2026-06-19",
            reportDate: "2026-06-19",
            specimenNumber: correctedSpecimenNumber,
            reportStatus: "corrected",
            reviewStatus: "reviewed",
            reportNotes: correctedNotes
          },
          resultPreserved: {
            resultId: procedureResultId,
            resultText,
            result: "104",
            resultStatus: "final"
          }
        },
        actual: {
          patient,
          procedureOrderId,
          procedureReportId,
          procedureResultId,
          initialReport,
          correctedReport,
          initialResult,
          afterCorrection,
          correctedOrder,
          correctionInput: correctedReportInput,
          surfaceFacts
        }
      });

      const procedureSummary = await targetDb.getProcedureResultsForPatient(patient.pid);
      correctedOrder = procedureSummary.orders.find((order) => order.procedureName === procedureName);
      expect(correctedOrder).not.toBeUndefined();
      expect(correctedOrder!.reports).toHaveLength(1);
      expect(correctedOrder!.reports[0]).toMatchObject({
        dateCollected: "2026-06-19",
        reportDate: "2026-06-19",
        specimenNumber: correctedSpecimenNumber,
        status: "corrected",
        reviewStatus: "reviewed",
        reportNotes: correctedNotes
      });
      expect(correctedOrder!.reports[0].results).toHaveLength(1);
      expect(correctedOrder!.reports[0].results[0]).toMatchObject({
        text: resultText,
        result: "104",
        resultStatus: "final"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-133-procedure-report-correction-rendered",
        description:
          "Corrected report/result projection after UI/API rendering, proving corrected report metadata and linked result preservation.",
        expected: {
          projection: {
            orderName: procedureName,
            reportCount: 1,
            resultCount: 1,
            dateCollected: "2026-06-19",
            reportDate: "2026-06-19",
            specimenNumber: correctedSpecimenNumber,
            reportStatus: "corrected",
            reviewStatus: "reviewed",
            resultStatus: "final"
          }
        },
        actual: {
          patient,
          procedureOrderId,
          procedureReportId,
          procedureResultId,
          correctedReport,
          initialResult,
          procedureSummary,
          correctedOrder,
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
      probe: "slice-133-procedure-report-correction-cleanup",
      description:
        "Temporary procedure report correction order tree and temporary encounter were deleted, restoring encounter/procedure counts and removing order/report/result rows.",
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
