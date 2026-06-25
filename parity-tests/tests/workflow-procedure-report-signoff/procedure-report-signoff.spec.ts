import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openProcedureResultsDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedProcedures } from "../../src/ui/modernizedOpenEmr.js";

const procedureReportSignOffAnchorPatientId = "MOD-PAT-0009";
const signedAt = "2026-06-19 14:15:00";
const signedAtDisplay = "2026-06-19 14:15";

test.describe("procedure report sign-off parity @slice134 @workflow-procedure-report-signoff @mutation", () => {
  test("signs a temporary lab report and cleans up the workflow", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureReportSignOffAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Missing seeded procedure report sign-off patient ${procedureReportSignOffAnchorPatientId}`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeProcedures = await targetDb.getProcedureResultsForPatient(patient.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Report Signoff ${suffix}`;
    const resultText = `Parity Report Signoff Glucose ${suffix}`;
    const specimenNumber = `RPSIGN${suffix.slice(-6)}`;
    const encounterInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateTime: "2026-06-19 13:30:00",
      reason: `Parity Report Signoff Encounter ${suffix}`,
      facilityId: 10,
      facilityName: "OpenEMR Modernization Clinic",
      billingFacilityId: 10,
      sensitivity: "normal",
      referralSource: "Parity suite",
      externalId: `PRS${suffix.slice(-8)}`,
      posCode: 11,
      billingNote: "Procedure report sign-off workflow test encounter."
    };
    const procedureOrderInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateOrdered: "2026-06-19",
      priority: "routine",
      status: "complete",
      procedureCode: "80053",
      procedureName,
      procedureType: "laboratory",
      diagnosis: "Z00.00",
      instructions: "Created by the parity procedure report sign-off suite."
    };
    const procedureReportInput = {
      dateCollected: "2026-06-19 14:00:00",
      dateReport: signedAt,
      specimenNumber,
      reportStatus: "final",
      reviewStatus: "pending",
      notes: "Pending report review before sign-off."
    };
    const procedureResultInput = {
      reportId: 0,
      resultCode: "2345-7",
      resultText,
      dateTime: "2026-06-19 14:20:00",
      facility: "OpenEMR Modernization Clinic",
      units: "mg/dL",
      result: "96",
      range: "70-99",
      abnormal: "normal",
      comments: "Result row keeps the signed report visible.",
      status: "final"
    };
    const signOffInput = {
      reviewedBy: "admin",
      reviewedAt: signedAt
    };
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;
    let procedureResultId: number | null = null;
    let encounter: Awaited<ReturnType<typeof workflow.getEncounter>> = null;
    let createdOrder: Awaited<ReturnType<typeof workflow.getProcedureOrder>> = null;
    let initialReport: Awaited<ReturnType<typeof workflow.getProcedureReport>> = null;
    let initialResult: Awaited<ReturnType<typeof workflow.getProcedureResult>> = null;
    let afterCreateCounts: Awaited<ReturnType<typeof targetDb.getPatientWorkflowCounts>> | null = null;
    let afterCreateProcedures: Awaited<ReturnType<typeof targetDb.getProcedureResultsForPatient>> | null = null;
    let signedReport: Awaited<ReturnType<typeof workflow.getProcedureReport>> = null;
    let afterSignOff: Awaited<ReturnType<typeof targetDb.getProcedureResultsForPatient>> | null = null;
    let signedOrder: Awaited<ReturnType<typeof targetDb.getProcedureResultsForPatient>>["orders"][number] | undefined;
    let surfaceFacts: Record<string, unknown> = {};

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-134-procedure-report-signoff-precondition",
      description:
        "Seeded patient, baseline workflow counts, baseline procedure summary, proposed temporary encounter/order/report/result, and report sign-off payload before signing.",
      expected: {
        patientCanonicalId: procedureReportSignOffAnchorPatientId,
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
            dateCollected: "2026-06-19",
            reportDate: "2026-06-19",
            specimenNumber,
            reportStatus: "final",
            reviewStatus: "pending"
          },
          result: {
            resultCode: "2345-7",
            result: "96",
            range: "70-99",
            abnormal: "normal",
            status: "final"
          },
          signOff: {
            reviewedBy: "admin",
            reviewedAt: signedAtDisplay,
            reviewStatus: "reviewed"
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
          result: { ...procedureResultInput, reportId: "<created-report-id>" },
          signOff: signOffInput
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
        dateCollected: "2026-06-19",
        dateReport: "2026-06-19",
        specimenNumber,
        reportStatus: "final",
        reviewStatus: "pending",
        reportNotes: "Pending report review before sign-off."
      });

      procedureResultId = await workflow.createProcedureResult({
        ...procedureResultInput,
        reportId: procedureReportId,
      });
      initialResult = await workflow.getProcedureResult(procedureResultId);
      expect(initialResult).toMatchObject({
        reportId: procedureReportId,
        resultCode: "2345-7",
        resultText,
        result: "96",
        abnormal: "normal",
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
        probe: "slice-134-procedure-report-signoff-created",
        description:
          "Temporary encounter, completed procedure order, pending-review report, linked result row, count deltas, and patient procedure projection before report sign-off.",
        expected: {
          counts: {
            encounters: beforeCounts.encounters + 1,
            procedureOrders: beforeCounts.procedureOrders + 1
          },
          report: {
            dateCollected: "2026-06-19",
            reportDate: "2026-06-19",
            specimenNumber,
            reportStatus: "final",
            reviewStatus: "pending",
            reviewedBy: null,
            reviewedAt: null
          },
          result: {
            resultCode: "2345-7",
            resultText,
            result: "96",
            range: "70-99",
            abnormal: "normal",
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
        await workflow.signProcedureReport(procedureReportId, signOffInput);

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
        const reportCard = page.locator(".procedure-report-card", { hasText: specimenNumber }).first();
        await expect(reportCard).toBeVisible();
        await reportCard.getByRole("button", { name: /Sign procedure report/i }).click();

        await expect(reportCard).toContainText("reviewed");
        await expect(reportCard).toContainText("Signed by admin");
        await expect(reportCard).toContainText(`Signed ${signedAtDisplay}`);
        await expect(reportCard).toContainText(resultText);
        surfaceFacts = {
          modernizedProcedures: {
            page: "procedures",
            searchPatientId: patient.pubpid,
            procedureName,
            specimenNumber,
            renderedReportCardIncludes: [
              "reviewed",
              "Signed by admin",
              `Signed ${signedAtDisplay}`,
              resultText
            ]
          }
        };
      }

      signedReport = await workflow.getProcedureReport(procedureReportId);
      expect(signedReport).toMatchObject({
        orderId: procedureOrderId,
        dateCollected: "2026-06-19",
        dateReport: "2026-06-19",
        specimenNumber,
        reportStatus: "final",
        reviewStatus: "reviewed",
        reviewedBy: "admin",
        reviewedAt: signedAtDisplay,
        reportNotes: "Pending report review before sign-off."
      });
      afterSignOff = await targetDb.getProcedureResultsForPatient(patient.pid);
      signedOrder = afterSignOff.orders.find((order) => order.procedureName === procedureName);
      expect(signedOrder).not.toBeUndefined();
      expect(signedOrder!.reports).toHaveLength(1);
      expect(signedOrder!.reports[0]).toMatchObject({
        dateCollected: "2026-06-19",
        reportDate: "2026-06-19",
        specimenNumber,
        status: "final",
        reviewStatus: "reviewed",
        reviewedBy: "admin",
        reviewedAt: signedAtDisplay,
        reportNotes: "Pending report review before sign-off."
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-134-procedure-report-signoff-signed",
        description:
          "Signed in-place procedure report metadata after applying reviewed status, reviewer, and reviewed timestamp while preserving report/result details.",
        expected: {
          reportIdStable: true,
          signedReport: {
            orderId: procedureOrderId,
            dateCollected: "2026-06-19",
            reportDate: "2026-06-19",
            specimenNumber,
            reportStatus: "final",
            reviewStatus: "reviewed",
            reviewedBy: "admin",
            reviewedAt: signedAtDisplay,
            reportNotes: "Pending report review before sign-off."
          },
          resultPreserved: {
            resultId: procedureResultId,
            resultText,
            result: "96",
            resultStatus: "final"
          }
        },
        actual: {
          patient,
          procedureOrderId,
          procedureReportId,
          procedureResultId,
          initialReport,
          signedReport,
          initialResult,
          afterSignOff,
          signedOrder,
          signOffInput,
          surfaceFacts
        }
      });

      const procedureSummary = await targetDb.getProcedureResultsForPatient(patient.pid);
      signedOrder = procedureSummary.orders.find((order) => order.procedureName === procedureName);
      expect(signedOrder).not.toBeUndefined();
      expect(signedOrder!.reports).toHaveLength(1);
      expect(signedOrder!.reports[0]).toMatchObject({
        dateCollected: "2026-06-19",
        reportDate: "2026-06-19",
        specimenNumber,
        status: "final",
        reviewStatus: "reviewed",
        reviewedBy: "admin",
        reviewedAt: signedAtDisplay,
        reportNotes: "Pending report review before sign-off."
      });
      expect(signedOrder!.reports[0].results).toHaveLength(1);
      expect(signedOrder!.reports[0].results[0]).toMatchObject({
        text: resultText,
        result: "96",
        resultStatus: "final"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-134-procedure-report-signoff-rendered",
        description:
          "Signed report/result projection after UI/API rendering, proving reviewed report metadata and linked result preservation.",
        expected: {
          projection: {
            orderName: procedureName,
            reportCount: 1,
            resultCount: 1,
            dateCollected: "2026-06-19",
            reportDate: "2026-06-19",
            specimenNumber,
            reportStatus: "final",
            reviewStatus: "reviewed",
            reviewedBy: "admin",
            reviewedAt: signedAtDisplay,
            resultStatus: "final"
          }
        },
        actual: {
          patient,
          procedureOrderId,
          procedureReportId,
          procedureResultId,
          signedReport,
          initialResult,
          procedureSummary,
          signedOrder,
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
      probe: "slice-134-procedure-report-signoff-cleanup",
      description:
        "Temporary procedure report sign-off order tree and temporary encounter were deleted, restoring encounter/procedure counts and removing order/report/result rows.",
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
