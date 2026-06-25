import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openProcedureResultsDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedProcedures } from "../../src/ui/modernizedOpenEmr.js";

const procedureOrderCorrectionAnchorPatientId = "MOD-PAT-0009";

test.describe("procedure order correction parity @slice132 @workflow-procedure-order-correction @mutation", () => {
  test("corrects temporary lab order metadata and cleans up the workflow", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureOrderCorrectionAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Missing seeded procedure order correction patient ${procedureOrderCorrectionAnchorPatientId}`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeProcedures = await targetDb.getProcedureResultsForPatient(patient.pid);
    const suffix = workflowSuffix();
    const initialProcedureName = `Parity Order Initial ${suffix}`;
    const correctedProcedureName = `Parity Order Corrected ${suffix}`;
    const correctedInstructions = `Corrected order instructions ${suffix}`;
    const resultText = `Parity Order Correction Result ${suffix}`;
    const encounterInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateTime: "2026-06-18 12:00:00",
      reason: `Parity Order Correction Encounter ${suffix}`,
      facilityId: 10,
      facilityName: "OpenEMR Modernization Clinic",
      billingFacilityId: 10,
      sensitivity: "normal",
      referralSource: "Parity suite",
      externalId: `POC${suffix.slice(-8)}`,
      posCode: 11,
      billingNote: "Procedure order correction workflow test encounter."
    };
    const procedureOrderInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateOrdered: "2026-06-18",
      priority: "routine",
      status: "pending",
      procedureCode: "80053",
      procedureName: initialProcedureName,
      procedureType: "laboratory",
      diagnosis: "Z00.00",
      instructions: "Initial procedure order correction fixture."
    };
    const correctedOrderInput = {
      dateOrdered: "2026-06-19",
      priority: "urgent",
      status: "complete",
      procedureCode: "85025",
      procedureName: correctedProcedureName,
      procedureType: "hematology",
      diagnosis: "R53.83",
      instructions: correctedInstructions
    };
    const procedureReportInput = {
      dateCollected: "2026-06-19 12:30:00",
      dateReport: "2026-06-19 13:00:00",
      specimenNumber: `POC${suffix.slice(-8)}`,
      reportStatus: "final",
      reviewStatus: "reviewed",
      notes: "Parity procedure order correction report."
    };
    const procedureResultInput = {
      resultCode: "718-7",
      resultText,
      dateTime: "2026-06-19 13:05:00",
      facility: "OpenEMR Modernization Clinic",
      units: "10*3/uL",
      result: "6.4",
      range: "4.0-10.5",
      abnormal: "normal",
      comments: "Result after order correction.",
      status: "final"
    };
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;
    let procedureResultId: number | null = null;
    let encounter: Awaited<ReturnType<typeof workflow.getEncounter>> = null;
    let initialOrder: Awaited<ReturnType<typeof workflow.getProcedureOrder>> = null;
    let correctedOrderRow: Awaited<ReturnType<typeof workflow.getProcedureOrder>> = null;
    let createdReport: Awaited<ReturnType<typeof workflow.getProcedureReport>> = null;
    let createdResult: Awaited<ReturnType<typeof workflow.getProcedureResult>> = null;
    let afterInitialCreateCounts: Awaited<ReturnType<typeof targetDb.getPatientWorkflowCounts>> | null = null;
    let afterInitialCreate: Awaited<ReturnType<typeof targetDb.getProcedureResultsForPatient>> | null = null;
    let afterCorrection: Awaited<ReturnType<typeof targetDb.getProcedureResultsForPatient>> | null = null;
    let afterResultCreate: Awaited<ReturnType<typeof targetDb.getProcedureResultsForPatient>> | null = null;
    let correctedOrder: Awaited<ReturnType<typeof targetDb.getProcedureResultsForPatient>>["orders"][number] | undefined;
    let surfaceFacts: Record<string, unknown> = {};

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-132-procedure-order-correction-precondition",
      description:
        "Seeded patient, baseline workflow counts, baseline procedure summary, proposed temporary encounter/order, corrected order payload, and follow-up report/result payloads before order correction.",
      expected: {
        patientCanonicalId: procedureOrderCorrectionAnchorPatientId,
        create: {
          encounter: {
            facilityId: 10,
            billingFacilityId: 10,
            posCode: 11,
            sensitivity: "normal"
          },
          initialOrder: {
            status: "pending",
            priority: "routine",
            procedureCode: "80053",
            procedureType: "laboratory",
            diagnosis: "Z00.00"
          },
          correctedOrder: {
            status: "complete",
            priority: "urgent",
            procedureCode: "85025",
            procedureType: "hematology",
            diagnosis: "R53.83"
          },
          report: {
            reportStatus: "final",
            reviewStatus: "reviewed"
          },
          result: {
            resultCode: "718-7",
            result: "6.4",
            range: "4.0-10.5",
            abnormal: "normal",
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
          initialOrder: procedureOrderInput,
          correctedOrder: correctedOrderInput,
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
      initialOrder = await workflow.getProcedureOrder(procedureOrderId);
      expect(initialOrder).toMatchObject({
        patientId: patient.pid,
        encounterId: encounter!.encounter,
        dateOrdered: "2026-06-18",
        orderStatus: "pending",
        orderPriority: "routine",
        procedureCode: "80053",
        procedureName: initialProcedureName,
        procedureType: "laboratory",
        diagnosis: "Z00.00",
        instructions: "Initial procedure order correction fixture."
      });

      afterInitialCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      afterInitialCreate = await targetDb.getProcedureResultsForPatient(patient.pid);
      expect(afterInitialCreateCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterInitialCreateCounts.procedureOrders).toBe(beforeCounts.procedureOrders + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-132-procedure-order-correction-created",
        description:
          "Temporary encounter and pending initial procedure order before correction, including count deltas and initial order projection.",
        expected: {
          counts: {
            encounters: beforeCounts.encounters + 1,
            procedureOrders: beforeCounts.procedureOrders + 1
          },
          order: {
            dateOrdered: "2026-06-18",
            orderStatus: "pending",
            orderPriority: "routine",
            procedureCode: "80053",
            procedureName: initialProcedureName,
            procedureType: "laboratory",
            diagnosis: "Z00.00"
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterInitialCreateCounts,
          beforeProcedures,
          afterInitialCreate,
          encounterId,
          encounter,
          procedureOrderId,
          initialOrder
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.updateProcedureOrder(procedureOrderId, correctedOrderInput);
      } else {
        await openAuthenticatedModernizedProcedures(page, target, patient.pubpid);

        const orderCard = page.locator(".procedure-order-card", { hasText: initialProcedureName }).first();
        await expect(orderCard).toBeVisible();
        await orderCard.getByRole("button", { name: "Correct Order" }).click();
        await orderCard.getByLabel("Procedure corrected order date").fill(correctedOrderInput.dateOrdered);
        await orderCard.getByLabel("Procedure corrected order code").fill(correctedOrderInput.procedureCode);
        await orderCard.getByLabel("Procedure corrected order name").fill(correctedOrderInput.procedureName);
        await orderCard.getByLabel("Procedure corrected order type").fill(correctedOrderInput.procedureType);
        await orderCard.getByLabel("Procedure corrected order priority").selectOption(correctedOrderInput.priority);
        await orderCard.getByLabel("Procedure corrected order status").selectOption(correctedOrderInput.status);
        await orderCard.getByLabel("Procedure corrected order diagnosis").fill(correctedOrderInput.diagnosis);
        await orderCard.getByLabel("Procedure corrected order instructions").fill(correctedOrderInput.instructions);
        await orderCard.getByRole("button", { name: /Save Order Correction/i }).click();

        await expect(page.locator("body")).toContainText(correctedProcedureName);
        await expect(page.locator("body")).toContainText("85025");
        await expect(page.locator("body")).toContainText("urgent");
        await expect(page.locator("body")).toContainText("hematology");
        await expect(page.locator("body")).toContainText("R53.83");
        await expect(page.locator("body")).toContainText(correctedInstructions);
        surfaceFacts = {
          modernizedProcedures: {
            page: "procedures",
            searchPatientId: patient.pubpid,
            initialProcedureName,
            correctedProcedureName,
            renderedBodyIncludes: ["85025", "urgent", "hematology", "R53.83", correctedInstructions]
          }
        };
      }

      correctedOrderRow = await workflow.getProcedureOrder(procedureOrderId);
      expect(correctedOrderRow).toMatchObject({
        patientId: patient.pid,
        encounterId: encounter!.encounter,
        dateOrdered: "2026-06-19",
        orderStatus: "complete",
        orderPriority: "urgent",
        procedureCode: "85025",
        procedureName: correctedProcedureName,
        procedureType: "hematology",
        diagnosis: "R53.83",
        instructions: correctedInstructions
      });
      afterCorrection = await targetDb.getProcedureResultsForPatient(patient.pid);
      correctedOrder = afterCorrection.orders.find((order) => order.id === procedureOrderId);
      expect(correctedOrder).toMatchObject({
        dateOrdered: "2026-06-19",
        orderStatus: "complete",
        orderPriority: "urgent",
        procedureCode: "85025",
        procedureName: correctedProcedureName,
        procedureType: "hematology",
        diagnosis: "R53.83",
        instructions: correctedInstructions
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-132-procedure-order-correction-corrected",
        description:
          "Corrected in-place procedure order after changing date, code, name, type, diagnosis, priority, status, and instructions.",
        expected: {
          orderIdStable: true,
          correctedOrder: {
            dateOrdered: "2026-06-19",
            orderStatus: "complete",
            orderPriority: "urgent",
            procedureCode: "85025",
            procedureName: correctedProcedureName,
            procedureType: "hematology",
            diagnosis: "R53.83",
            instructions: correctedInstructions
          }
        },
        actual: {
          patient,
          procedureOrderId,
          initialOrder,
          correctedOrderRow,
          afterCorrection,
          correctedOrder,
          correctionInput: correctedOrderInput,
          surfaceFacts
        }
      });

      procedureReportId = await workflow.createProcedureReport({
        orderId: procedureOrderId,
        ...procedureReportInput
      });
      createdReport = await workflow.getProcedureReport(procedureReportId);
      expect(createdReport).toMatchObject({
        orderId: procedureOrderId,
        dateCollected: "2026-06-19",
        specimenNumber: procedureReportInput.specimenNumber,
        reportStatus: "final",
        reviewStatus: "reviewed",
        reportNotes: "Parity procedure order correction report."
      });

      procedureResultId = await workflow.createProcedureResult({
        reportId: procedureReportId,
        ...procedureResultInput
      });
      createdResult = await workflow.getProcedureResult(procedureResultId);
      expect(createdResult).toMatchObject({
        reportId: procedureReportId,
        resultCode: "718-7",
        resultText,
        result: "6.4",
        abnormal: "normal",
        status: "final"
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureResultsDirect(page, target, patient.pid);
        await expectRenderedText(page, correctedProcedureName);
        await expectRenderedText(page, resultText);
        await expectRenderedText(page, "6.4");
        surfaceFacts = {
          legacyProcedureResults: {
            page: "Procedure Results",
            patientPid: patient.pid,
            renderedProcedureName: correctedProcedureName,
            renderedResultText: resultText,
            renderedResult: "6.4"
          }
        };
      }

      const procedureSummary = await targetDb.getProcedureResultsForPatient(patient.pid);
      afterResultCreate = procedureSummary;
      correctedOrder = procedureSummary.orders.find((order) => order.id === procedureOrderId);
      expect(correctedOrder).toMatchObject({
        dateOrdered: "2026-06-19",
        orderStatus: "complete",
        orderPriority: "urgent",
        procedureCode: "85025",
        procedureName: correctedProcedureName,
        procedureType: "hematology",
        diagnosis: "R53.83",
        instructions: correctedInstructions
      });
      expect(correctedOrder!.reports).toHaveLength(1);
      expect(correctedOrder!.reports[0].results).toHaveLength(1);
      expect(correctedOrder!.reports[0].results[0]).toMatchObject({
        code: "718-7",
        text: resultText,
        result: "6.4",
        resultStatus: "final"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-132-procedure-order-correction-resulted",
        description:
          "Corrected procedure order after follow-up report/result creation and UI/API rendering, proving corrected metadata and linked result projection.",
        expected: {
          order: {
            dateOrdered: "2026-06-19",
            orderStatus: "complete",
            orderPriority: "urgent",
            procedureCode: "85025",
            procedureName: correctedProcedureName,
            procedureType: "hematology",
            diagnosis: "R53.83",
            instructions: correctedInstructions
          },
          report: {
            reportStatus: "final",
            reviewStatus: "reviewed",
            specimenNumber: procedureReportInput.specimenNumber
          },
          result: {
            code: "718-7",
            text: resultText,
            result: "6.4",
            resultStatus: "final"
          }
        },
        actual: {
          patient,
          procedureOrderId,
          procedureReportId,
          procedureResultId,
          correctedOrderRow,
          createdReport,
          createdResult,
          afterResultCreate,
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
      probe: "slice-132-procedure-order-correction-cleanup",
      description:
        "Temporary procedure order correction tree and temporary encounter were deleted, restoring encounter/procedure counts and removing order/report/result rows.",
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
