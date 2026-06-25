import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openProcedureResultsDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedProcedures } from "../../src/ui/modernizedOpenEmr.js";

const procedureMutationAnchorPatientId = "MOD-PAT-0009";

test.describe("procedure mutation parity @slice17 @workflow-procedures @mutation", () => {
  test("creates, completes, reports, renders, and removes a lab procedure workflow", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Procedure ${suffix}`;
    const resultText = `Parity Glucose ${suffix}`;
    const encounterInput = {
      patientId: patient!.pid,
      providerId: patient!.providerId,
      dateTime: "2026-06-18 12:00:00",
      reason: `Parity Lab Encounter ${suffix}`,
      facilityId: 10,
      facilityName: "OpenEMR Modernization Clinic",
      billingFacilityId: 10,
      sensitivity: "normal",
      referralSource: "Parity suite",
      externalId: `PR${suffix.slice(-8)}`,
      posCode: 11,
      billingNote: "Procedure workflow test encounter."
    };
    const orderTemplate = {
      dateOrdered: "2026-06-18 12:15:00",
      priority: "routine",
      status: "pending",
      procedureCode: "80053",
      procedureName,
      procedureType: "laboratory",
      diagnosis: "Z00.00",
      instructions: "Created by the parity procedure mutation suite."
    };
    const reportTemplate = {
      dateCollected: "2026-06-18 12:30:00",
      dateReport: "2026-06-18 13:00:00",
      specimenNumber: `PARITY-${suffix}`,
      reportStatus: "final",
      reviewStatus: "reviewed",
      notes: "Parity procedure report."
    };
    const resultTemplate = {
      resultCode: "2345-7",
      resultText,
      dateTime: "2026-06-18 13:05:00",
      facility: "OpenEMR Modernization Clinic",
      units: "mg/dL",
      result: "104",
      range: "70-99",
      abnormal: "high",
      comments: "Parity result outside the reference range.",
      status: "final"
    };
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;
    let procedureResultId: number | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-17-procedure-mutation-precondition",
      description: "Captures the Slice 17 procedure mutation anchor patient, workflow counts before mutation, and proposed encounter, order, report, and result payloads.",
      expected: {
        patient: {
          pubpid: procedureMutationAnchorPatientId
        },
        create: {
          encounter: {
            facilityId: 10,
            billingFacilityId: 10,
            posCode: 11
          },
          order: {
            status: "pending",
            priority: "routine",
            procedureCode: "80053",
            procedureType: "laboratory",
            diagnosis: "Z00.00"
          },
          report: {
            reportStatus: "final",
            reviewStatus: "reviewed"
          },
          result: {
            resultCode: "2345-7",
            result: "104",
            abnormal: "high",
            status: "final"
          }
        }
      },
      actual: {
        patient,
        beforeCounts,
        proposed: {
          encounter: encounterInput,
          order: orderTemplate,
          report: reportTemplate,
          result: resultTemplate
        }
      },
      context: {
        canonicalId: procedureMutationAnchorPatientId,
        suite: "workflow-procedures",
        workflow: "procedure-mutation"
      }
    });

    try {
      encounterId = await workflow.createEncounter(encounterInput);
      const encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      const orderInput = {
        patientId: patient!.pid,
        providerId: patient!.providerId,
        encounterId: encounter!.encounter,
        ...orderTemplate
      };

      procedureOrderId = await workflow.createProcedureOrder(orderInput);

      const order = await workflow.getProcedureOrder(procedureOrderId);
      expect(order).toMatchObject({
        patientId: patient!.pid,
        encounterId: encounter!.encounter,
        orderStatus: "pending",
        orderPriority: "routine",
        procedureCode: "80053",
        procedureName,
        procedureType: "laboratory"
      });

      const afterOrderCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-17-procedure-mutation-order-created",
        description: "Captures the temporary encounter and procedure order immediately after Slice 17 creates them, including encounter and procedure-order count increments.",
        expected: {
          counts: {
            encounters: beforeCounts.encounters + 1,
            procedureOrders: beforeCounts.procedureOrders + 1
          },
          order: {
            patientId: patient!.pid,
            encounterId: encounter!.encounter,
            orderStatus: "pending",
            orderPriority: "routine",
            procedureCode: "80053",
            procedureName,
            procedureType: "laboratory"
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterOrderCounts,
          encounterId,
          encounter,
          procedureOrderId,
          order,
          orderInput
        },
        context: {
          canonicalId: procedureMutationAnchorPatientId,
          suite: "workflow-procedures",
          workflow: "procedure-mutation-order-created"
        }
      });

      expect(afterOrderCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterOrderCounts.procedureOrders).toBe(beforeCounts.procedureOrders + 1);

      await workflow.updateProcedureOrderStatus(procedureOrderId, "complete");
      const completedOrder = await workflow.getProcedureOrder(procedureOrderId);
      expect(completedOrder).toMatchObject({
        orderStatus: "complete"
      });

      procedureReportId = await workflow.createProcedureReport({
        orderId: procedureOrderId,
        ...reportTemplate
      });

      const report = await workflow.getProcedureReport(procedureReportId);
      expect(report).toMatchObject({
        orderId: procedureOrderId,
        reportStatus: "final",
        reviewStatus: "reviewed",
        reportNotes: "Parity procedure report."
      });

      procedureResultId = await workflow.createProcedureResult({
        reportId: procedureReportId,
        ...resultTemplate
      });

      const result = await workflow.getProcedureResult(procedureResultId);
      expect(result).toMatchObject({
        reportId: procedureReportId,
        resultCode: "2345-7",
        resultText,
        result: "104",
        abnormal: "high",
        status: "final"
      });

      const procedureSummary = await targetDb.getProcedureResultsForPatient(patient!.pid);
      const createdProcedure = procedureSummary.orders.find((procedureOrder) => procedureOrder.procedureName === procedureName);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-17-procedure-mutation-result-created",
        description: "Captures the temporary completed procedure order, final report, final result, and patient procedure summary before browser-visible assertions.",
        expected: {
          completedOrder: {
            orderStatus: "complete",
            procedureCode: "80053",
            procedureName
          },
          report: {
            reportStatus: "final",
            reviewStatus: "reviewed",
            reportNotes: "Parity procedure report."
          },
          result: {
            resultCode: "2345-7",
            resultText,
            result: "104",
            abnormal: "high",
            status: "final"
          }
        },
        actual: {
          patient,
          encounter,
          procedureOrderId,
          completedOrder,
          procedureReportId,
          report,
          procedureResultId,
          result,
          procedureSummary,
          createdProcedure,
          reportInput: {
            orderId: procedureOrderId,
            ...reportTemplate
          },
          resultInput: {
            reportId: procedureReportId,
            ...resultTemplate
          }
        },
        context: {
          canonicalId: procedureMutationAnchorPatientId,
          suite: "workflow-procedures",
          workflow: "procedure-mutation-result-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureResultsDirect(page, target, patient!.pid);
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, resultText);
        await expectRenderedText(page, "104");
      } else {
        await openAuthenticatedModernizedProcedures(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText(procedureName);
        await expect(page.locator("body")).toContainText("80053");
        await expect(page.locator("body")).toContainText(resultText);
        await expect(page.locator("body")).toContainText("104");
        await expect(page.locator("body")).toContainText("reviewed");
      }
    } finally {
      if (procedureOrderId !== null) {
        await workflow.deleteProcedureOrderCascade(procedureOrderId);
      }
      if (encounterId !== null) {
        await workflow.deleteEncounter(encounterId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const deletedOrder = procedureOrderId !== null ? await workflow.getProcedureOrder(procedureOrderId) : null;
    const deletedReport = procedureReportId !== null ? await workflow.getProcedureReport(procedureReportId) : null;
    const deletedResult = procedureResultId !== null ? await workflow.getProcedureResult(procedureResultId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-17-procedure-mutation-cleanup",
      description: "Captures the Slice 17 cleanup state after deleting the temporary procedure order cascade and temporary encounter.",
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
        encounterId,
        procedureOrderId,
        procedureReportId,
        procedureResultId,
        deletedOrder,
        deletedReport,
        deletedResult
      },
      context: {
        canonicalId: procedureMutationAnchorPatientId,
        suite: "workflow-procedures",
        workflow: "procedure-mutation-cleanup"
      }
    });

    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.procedureOrders).toBe(beforeCounts.procedureOrders);
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
