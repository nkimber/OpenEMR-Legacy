import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openProcedureResultsDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedProcedures } from "../../src/ui/modernizedOpenEmr.js";

const procedureSpecimenAnchorPatientId = "MOD-PAT-0009";

test.describe("procedure specimen metadata parity @slice130 @workflow-procedure-specimen @mutation", () => {
  test("preserves collected date and specimen number for a temporary lab report", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureSpecimenAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Missing seeded procedure specimen patient ${procedureSpecimenAnchorPatientId}`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeProcedures = await targetDb.getProcedureResultsForPatient(patient.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Specimen Procedure ${suffix}`;
    const resultText = `Parity Specimen Glucose ${suffix}`;
    const specimenNumber = `SPC${suffix.slice(-8)}`;
    const encounterInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateTime: "2026-06-18 12:00:00",
      reason: `Parity Specimen Lab Encounter ${suffix}`,
      facilityId: 10,
      facilityName: "OpenEMR Modernization Clinic",
      billingFacilityId: 10,
      sensitivity: "normal",
      referralSource: "Parity suite",
      externalId: `PS${suffix.slice(-8)}`,
      posCode: 11,
      billingNote: "Procedure specimen workflow test encounter."
    };
    const procedureOrderInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateOrdered: "2026-06-18 12:10:00",
      priority: "routine",
      status: "complete",
      procedureCode: "80053",
      procedureName,
      procedureType: "laboratory",
      diagnosis: "Z00.00",
      instructions: "Created by the parity procedure specimen suite."
    };
    const procedureReportInput = {
      dateCollected: "2026-06-18 12:30:00",
      dateReport: "2026-06-18 13:00:00",
      specimenNumber,
      reportStatus: "final",
      reviewStatus: "reviewed",
      notes: "Parity procedure specimen report."
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
      comments: "Result row makes the specimen report visible in procedure results.",
      status: "final"
    };
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;
    let procedureResultId: number | null = null;
    let encounter: Awaited<ReturnType<typeof workflow.getEncounter>> = null;
    let createdOrder: Awaited<ReturnType<typeof workflow.getProcedureOrder>> = null;
    let report: Awaited<ReturnType<typeof workflow.getProcedureReport>> = null;
    let resultRow: Awaited<ReturnType<typeof workflow.getProcedureResult>> = null;
    let afterCreateCounts: Awaited<ReturnType<typeof targetDb.getPatientWorkflowCounts>> | null = null;
    let afterCreateProcedures: Awaited<ReturnType<typeof targetDb.getProcedureResultsForPatient>> | null = null;
    let specimenOrder: Awaited<ReturnType<typeof targetDb.getProcedureResultsForPatient>>["orders"][number] | undefined;
    let surfaceFacts: Record<string, unknown> = {};

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-130-procedure-specimen-precondition",
      description:
        "Seeded patient, baseline workflow counts, baseline procedure summary, and proposed temporary encounter/order/report/result before procedure specimen creation.",
      expected: {
        patientCanonicalId: procedureSpecimenAnchorPatientId,
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
            dateCollected: "2026-06-18",
            reportDate: "2026-06-18",
            specimenNumber,
            reportStatus: "final",
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
          result: procedureResultInput
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

      report = await workflow.getProcedureReport(procedureReportId);
      expect(report).toMatchObject({
        orderId: procedureOrderId,
        dateCollected: "2026-06-18",
        specimenNumber,
        reportStatus: "final",
        reviewStatus: "reviewed",
        reportNotes: "Parity procedure specimen report."
      });

      procedureResultId = await workflow.createProcedureResult({
        reportId: procedureReportId,
        ...procedureResultInput
      });
      resultRow = await workflow.getProcedureResult(procedureResultId);
      expect(resultRow).toMatchObject({
        reportId: procedureReportId,
        resultCode: "2345-7",
        resultText,
        result: "104",
        abnormal: "high",
        status: "final"
      });

      afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      afterCreateProcedures = await targetDb.getProcedureResultsForPatient(patient.pid);
      specimenOrder = afterCreateProcedures.orders.find((order) => order.procedureName === procedureName);
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterCreateCounts.procedureOrders).toBe(beforeCounts.procedureOrders + 1);
      expect(specimenOrder).not.toBeUndefined();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-130-procedure-specimen-created",
        description:
          "Temporary encounter, completed procedure order, final reviewed report with specimen number, linked result row, and patient procedure projection after specimen creation.",
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
            dateCollected: "2026-06-18",
            reportDate: "2026-06-18",
            specimenNumber,
            reportStatus: "final",
            reviewStatus: "reviewed"
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
          report,
          procedureResultId,
          resultRow,
          specimenOrder
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureResultsDirect(page, target, patient.pid);
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, specimenNumber);
        await expectRenderedText(page, resultText);
        surfaceFacts = {
          legacyProcedureResults: {
            page: "Procedure Results",
            patientPid: patient.pid,
            renderedProcedureName: procedureName,
            renderedSpecimenNumber: specimenNumber,
            renderedResultText: resultText
          }
        };
      } else {
        await openAuthenticatedModernizedProcedures(page, target, patient.pubpid);

        await expect(page.locator("body")).toContainText(procedureName);
        await expect(page.locator("body")).toContainText(`Specimen ${specimenNumber}`);
        await expect(page.locator("body")).toContainText("Collected 2026-06-18 12:30");
        await expect(page.locator("body")).toContainText(resultText);
        surfaceFacts = {
          modernizedProcedures: {
            page: "procedures",
            searchPatientId: patient.pubpid,
            renderedProcedureName: procedureName,
            renderedSpecimenNumber: specimenNumber,
            renderedCollectedDate: "2026-06-18 12:30",
            renderedResultText: resultText
          }
        };
      }

      const procedureSummary = await targetDb.getProcedureResultsForPatient(patient.pid);
      specimenOrder = procedureSummary.orders.find((order) => order.procedureName === procedureName);
      expect(specimenOrder).not.toBeUndefined();
      expect(specimenOrder!.reports).toHaveLength(1);
      expect(specimenOrder!.reports[0]).toMatchObject({
        dateCollected: "2026-06-18",
        reportDate: "2026-06-18",
        specimenNumber,
        status: "final",
        reviewStatus: "reviewed"
      });
      expect(specimenOrder!.reports[0].results).toHaveLength(1);
      expect(specimenOrder!.reports[0].results[0]).toMatchObject({
        text: resultText,
        result: "104",
        resultStatus: "final"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-130-procedure-specimen-rendered",
        description:
          "Procedure specimen report/result projection after UI/API rendering, including collected date, specimen number, result linkage, and target-specific surface facts.",
        expected: {
          projection: {
            orderName: procedureName,
            reportCount: 1,
            resultCount: 1,
            dateCollected: "2026-06-18",
            reportDate: "2026-06-18",
            specimenNumber,
            reportStatus: "final",
            reviewStatus: "reviewed",
            resultStatus: "final"
          }
        },
        actual: {
          patient,
          procedureOrderId,
          procedureReportId,
          procedureResultId,
          report,
          resultRow,
          procedureSummary,
          specimenOrder,
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
      probe: "slice-130-procedure-specimen-cleanup",
      description:
        "Temporary procedure specimen order tree and temporary encounter were deleted, restoring encounter/procedure counts and removing order/report/result rows.",
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
