import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import { expectRenderedText, loginToLegacyOpenEmr, openProcedureResultsDirect } from "../../src/ui/legacyOpenEmr.js";

const encounterProcedureResultAnchorPatientId = "MOD-PAT-0001";
const encounterProcedureResultAnchorFromDate = "2026-01-01";
const encounterProcedureResultEncounter = 1000013;
const encounterProcedureResultOrderDate = "2026-06-18";
const encounterProcedureResultCode = "80053";
const encounterProcedureResultDiagnosis = "E78.5";

test.describe("encounter procedure result entry parity @slice76 @workflow-encounter-procedure-results @mutation", () => {
  test("adds a reviewed final result from the encounter procedure workflow and cleans up", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterProcedureResultAnchorPatientId);
    expect(patient).not.toBeNull();
    if (patient === null) {
      throw new Error(`Encounter procedure-result entry anchor patient ${encounterProcedureResultAnchorPatientId} was not found.`);
    }

    const encounter = await targetDb.getLatestEncounterForPatient(patient.pid);
    expect(encounter).not.toBeNull();
    if (encounter === null) {
      throw new Error(`Encounter procedure-result entry anchor encounter for ${encounterProcedureResultAnchorPatientId} was not found.`);
    }
    expect(encounter.encounter).toBe(encounterProcedureResultEncounter);

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeEncounterProcedures = await targetDb.getProcedureResultsForEncounter(
      patient.pid,
      encounterProcedureResultEncounter
    );
    const suffix = workflowSuffix();
    const procedureName = `Parity Encounter Procedure Result ${suffix}`;
    const resultText = `Parity Encounter Glucose ${suffix}`;
    const instructions = `Created by the encounter procedure result parity suite ${suffix}.`;
    const resultNotes = `Reviewed from the encounter result parity suite ${suffix}.`;
    const procedureOrderInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      encounterId: encounter.encounter,
      dateOrdered: encounterProcedureResultOrderDate,
      priority: "routine",
      status: "pending",
      procedureCode: encounterProcedureResultCode,
      procedureName,
      procedureType: "laboratory",
      diagnosis: encounterProcedureResultDiagnosis,
      instructions
    };
    const procedureReportInput = {
      dateCollected: `${encounterProcedureResultOrderDate} 12:30:00`,
      dateReport: `${encounterProcedureResultOrderDate} 13:00:00`,
      specimenNumber: `PARITY-${suffix}`,
      reportStatus: "final",
      reviewStatus: "reviewed",
      notes: resultNotes
    };
    const procedureResultInput = {
      resultCode: "2345-7",
      resultText,
      dateTime: `${encounterProcedureResultOrderDate} 13:05:00`,
      facility: "OpenEMR Modernization Clinic",
      units: "mg/dL",
      result: "104",
      range: "70-99",
      abnormal: "high",
      comments: resultNotes,
      status: "final"
    };
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;
    let procedureResultId: number | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-76-encounter-procedure-result-entry-precondition",
      description: "Captures the Slice 76 encounter procedure-result entry precondition: anchor patient, encounter, baseline workflow counts, active encounter procedure projection, and proposed order/report/result payloads.",
      expected: {
        anchorCanonicalId: encounterProcedureResultAnchorPatientId,
        encounter: encounterProcedureResultEncounter,
        create: {
          order: {
            dateOrdered: encounterProcedureResultOrderDate,
            priority: "routine",
            status: "pending",
            procedureCode: encounterProcedureResultCode,
            procedureType: "laboratory",
            diagnosis: encounterProcedureResultDiagnosis
          },
          report: {
            reportStatus: "final",
            reviewStatus: "reviewed"
          },
          result: {
            resultCode: "2345-7",
            result: "104",
            units: "mg/dL",
            range: "70-99",
            abnormal: "high",
            status: "final"
          }
        },
        countChange: {
          encountersAfterCreate: beforeCounts.encounters,
          procedureOrdersAfterCreate: beforeCounts.procedureOrders + 1,
          encounterProcedureOrdersAfterCreate: beforeEncounterProcedures.orders.length + 1,
          procedureOrdersAfterCleanup: beforeCounts.procedureOrders
        }
      },
      actual: {
        patient,
        encounter,
        beforeCounts,
        beforeEncounterProcedures,
        proposed: {
          order: procedureOrderInput,
          report: procedureReportInput,
          result: procedureResultInput
        }
      },
      context: {
        canonicalId: encounterProcedureResultAnchorPatientId,
        suite: "workflow-encounter-procedure-results",
        workflow: "encounter-procedure-result-entry-precondition"
      }
    });

    try {
      procedureOrderId = await workflow.createProcedureOrder(procedureOrderInput);
      const orderAfterCreate = await workflow.getProcedureOrder(procedureOrderId);
      const afterOrderCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-76-encounter-procedure-result-entry-order-created",
        description: "Captures the temporary Slice 76 pending procedure order before the reviewed final report/result is added.",
        expected: {
          counts: {
            encounters: beforeCounts.encounters,
            procedureOrders: beforeCounts.procedureOrders + 1
          },
          order: {
            patientId: patient.pid,
            encounterId: encounterProcedureResultEncounter,
            orderStatus: "pending",
            orderPriority: "routine",
            procedureCode: encounterProcedureResultCode,
            procedureName,
            procedureType: "laboratory"
          }
        },
        actual: {
          patient,
          encounter,
          beforeCounts,
          afterOrderCounts,
          procedureOrderId,
          orderAfterCreate,
          orderInput: procedureOrderInput
        },
        context: {
          canonicalId: encounterProcedureResultAnchorPatientId,
          suite: "workflow-encounter-procedure-results",
          workflow: "encounter-procedure-result-entry-order-created"
        }
      });

      if (target.type === "legacy-openemr") {
        procedureReportId = await workflow.createProcedureReport({
          orderId: procedureOrderId,
          ...procedureReportInput
        });
        procedureResultId = await workflow.createProcedureResult({
          reportId: procedureReportId,
          ...procedureResultInput
        });

        await loginToLegacyOpenEmr(page, target);
        await openProcedureResultsDirect(page, target, patient.pid);
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, resultText);
        await expectRenderedText(page, "104");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-76-encounter-procedure-result-entry-surface",
          description: "Captures the Slice 76 legacy application-surface evidence for the temporary reviewed final procedure result after it renders in Procedure Results.",
          expected: {
            renderedProcedureName: procedureName,
            renderedResultText: resultText,
            renderedResult: "104"
          },
          actual: {
            patient,
            encounter,
            procedureOrderId,
            procedureReportId,
            procedureResultId,
            legacySurface: {
              page: "Procedure Results",
              renderedProcedureName: procedureName,
              renderedResultText: resultText,
              renderedResult: "104"
            }
          },
          context: {
            canonicalId: encounterProcedureResultAnchorPatientId,
            suite: "workflow-encounter-procedure-results",
            workflow: "encounter-procedure-result-entry-surface"
          }
        });
      } else {
        await openAuthenticatedModernizedEncounters(page, target, patient.pubpid, encounterProcedureResultAnchorFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const linkage = page.getByLabel("Encounter procedure order linkage");
        const orderCard = linkage.locator(".encounter-procedure-card", { hasText: procedureName }).first();
        await expect(orderCard).toBeVisible();
        await expect(orderCard).toContainText("0 reports / 0 results");

        const resultEntry = orderCard.getByLabel(`Encounter procedure result entry ${procedureOrderId}`);
        await expect(resultEntry).toBeVisible();
        await resultEntry.getByLabel("Encounter procedure report date").fill(encounterProcedureResultOrderDate);
        await resultEntry.getByLabel("Encounter procedure specimen number").fill(`PARITY-${suffix}`);
        await resultEntry.getByLabel("Encounter procedure review status").selectOption("reviewed");
        await resultEntry.getByLabel("Encounter procedure result status").selectOption("final");
        await resultEntry.getByLabel("Encounter procedure result code").fill("2345-7");
        await resultEntry.getByLabel("Encounter procedure result text").fill(resultText);
        await resultEntry.getByLabel("Encounter procedure result value").fill("104");
        await resultEntry.getByLabel("Encounter procedure result units").fill("mg/dL");
        await resultEntry.getByLabel("Encounter procedure result range").fill("70-99");
        await resultEntry.getByLabel("Encounter procedure result abnormal flag").fill("high");
        await resultEntry.getByLabel("Encounter procedure result notes").fill(resultNotes);
        await resultEntry.getByRole("button", { name: /Add Result/i }).click();
        await expect(resultEntry).toContainText("Saved");

        await expect(orderCard).toContainText(resultText);
        await expect(orderCard).toContainText("104");
        await expect(orderCard).toContainText("reviewed");
        await expect(orderCard).toContainText("final");

        const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounter.encounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
        expect(detailResponse.ok()).toBe(true);
        const detailPayload = await detailResponse.json();
        const apiOrder = detailPayload.procedureOrders.find(
          (order: { id?: number; name?: string }) => order.id === procedureOrderId && order.name === procedureName
        );
        expect(apiOrder).toMatchObject({
          encounter: encounterProcedureResultEncounter,
          orderStatus: "pending",
          code: encounterProcedureResultCode,
          name: procedureName,
          diagnosis: encounterProcedureResultDiagnosis
        });
        expect(apiOrder.reports).toHaveLength(1);
        expect(apiOrder.reports[0]).toMatchObject({
          status: "final",
          reviewStatus: "reviewed"
        });
        expect(apiOrder.reports[0].results).toHaveLength(1);
        expect(apiOrder.reports[0].results[0]).toMatchObject({
          code: "2345-7",
          text: resultText,
          units: "mg/dL",
          result: "104",
          range: "70-99",
          abnormal: "high",
          resultStatus: "final"
        });
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-76-encounter-procedure-result-entry-surface",
          description: "Captures the Slice 76 modernized application-surface evidence for the temporary reviewed final procedure result through encounter detail API and Encounters workspace panels.",
          expected: {
            api: {
              encounter: encounterProcedureResultEncounter,
              orderStatus: "pending",
              code: encounterProcedureResultCode,
              name: procedureName,
              diagnosis: encounterProcedureResultDiagnosis,
              reportStatus: "final",
              reviewStatus: "reviewed",
              resultCode: "2345-7",
              resultText,
              result: "104",
              abnormal: "high",
              resultStatus: "final"
            },
            ui: {
              procedureLinkagePanel: "Encounter procedure order linkage",
              resultEntryLabel: `Encounter procedure result entry ${procedureOrderId}`,
              renderedTexts: [procedureName, resultText, "104", "reviewed", "final"]
            }
          },
          actual: {
            patient,
            encounter,
            procedureOrderId,
            apiOrder,
            apiProcedureOrders: detailPayload.procedureOrders,
            modernizedSurface: {
              fromDate: encounterProcedureResultAnchorFromDate,
              selectedEncounterLabel: "Hyperlipidemia",
              procedureLinkagePanel: "Encounter procedure order linkage"
            }
          },
          context: {
            canonicalId: encounterProcedureResultAnchorPatientId,
            suite: "workflow-encounter-procedure-results",
            workflow: "encounter-procedure-result-entry-surface"
          }
        });
      }

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters);
      expect(afterCreateCounts.procedureOrders).toBe(beforeCounts.procedureOrders + 1);

      const afterCreateEncounterProcedures = await targetDb.getProcedureResultsForEncounter(
        patient.pid,
        encounterProcedureResultEncounter
      );
      expect(afterCreateEncounterProcedures.orders).toHaveLength(beforeEncounterProcedures.orders.length + 1);

      const createdOrder = afterCreateEncounterProcedures.orders.find((order) => order.procedureName === procedureName);
      expect(createdOrder).toMatchObject({
        encounterId: encounterProcedureResultEncounter,
        dateOrdered: encounterProcedureResultOrderDate,
        orderStatus: "pending",
        procedureCode: encounterProcedureResultCode,
        procedureName,
        diagnosis: encounterProcedureResultDiagnosis
      });
      if (!createdOrder) {
        throw new Error(`Created encounter procedure-result order ${procedureName} was not found after create.`);
      }
      expect(createdOrder.reports).toHaveLength(1);
      const createdReport = createdOrder.reports[0];
      expect(createdReport).toMatchObject({
        status: "final",
        reviewStatus: "reviewed"
      });
      expect(createdReport.results).toHaveLength(1);
      const createdResult = createdReport.results[0];
      expect(createdResult).toMatchObject({
        code: "2345-7",
        text: resultText,
        units: "mg/dL",
        result: "104",
        range: "70-99",
        abnormal: "high",
        resultStatus: "final"
      });
      procedureOrderId = createdOrder.id;
      procedureReportId = createdReport.id;
      procedureResultId = createdResult.id;
      const createdWorkflowOrder = await workflow.getProcedureOrder(procedureOrderId);
      const createdWorkflowReport = await workflow.getProcedureReport(procedureReportId);
      const createdWorkflowResult = await workflow.getProcedureResult(procedureResultId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-76-encounter-procedure-result-entry-created",
        description: "Captures the temporary Slice 76 order, reviewed final report, final result, encounter procedure projection, and count movement after result entry.",
        expected: {
          counts: {
            encounters: beforeCounts.encounters,
            procedureOrders: beforeCounts.procedureOrders + 1,
            encounterProcedureOrders: beforeEncounterProcedures.orders.length + 1
          },
          order: {
            encounterId: encounterProcedureResultEncounter,
            dateOrdered: encounterProcedureResultOrderDate,
            orderStatus: "pending",
            procedureCode: encounterProcedureResultCode,
            procedureName,
            diagnosis: encounterProcedureResultDiagnosis
          },
          report: {
            status: "final",
            reviewStatus: "reviewed"
          },
          result: {
            code: "2345-7",
            text: resultText,
            units: "mg/dL",
            result: "104",
            range: "70-99",
            abnormal: "high",
            resultStatus: "final"
          }
        },
        actual: {
          patient,
          encounter,
          beforeCounts,
          afterCreateCounts,
          beforeEncounterProcedures,
          afterCreateEncounterProcedures,
          procedureOrderId,
          procedureReportId,
          procedureResultId,
          createdOrder,
          createdReport,
          createdResult,
          createdWorkflowOrder,
          createdWorkflowReport,
          createdWorkflowResult
        },
        context: {
          canonicalId: encounterProcedureResultAnchorPatientId,
          suite: "workflow-encounter-procedure-results",
          workflow: "encounter-procedure-result-entry-created"
        }
      });
    } finally {
      if (procedureOrderId !== null) {
        await workflow.deleteProcedureOrderCascade(procedureOrderId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.procedureOrders).toBe(beforeCounts.procedureOrders);
    const deletedOrder = procedureOrderId !== null ? await workflow.getProcedureOrder(procedureOrderId) : null;
    const deletedReport = procedureReportId !== null ? await workflow.getProcedureReport(procedureReportId) : null;
    const deletedResult = procedureResultId !== null ? await workflow.getProcedureResult(procedureResultId) : null;
    if (procedureOrderId !== null) {
      expect(deletedOrder).toBeNull();
    }
    if (procedureReportId !== null) {
      expect(deletedReport).toBeNull();
    }
    if (procedureResultId !== null) {
      expect(deletedResult).toBeNull();
    }
    const afterCleanupEncounterProcedures = await targetDb.getProcedureResultsForEncounter(
      patient.pid,
      encounterProcedureResultEncounter
    );
    expect(afterCleanupEncounterProcedures.orders).toHaveLength(beforeEncounterProcedures.orders.length);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-76-encounter-procedure-result-entry-cleanup",
      description: "Captures the final Slice 76 hard-delete cascade cleanup state for the temporary encounter procedure order, report, and result.",
      expected: {
        counts: {
          encounters: beforeCounts.encounters,
          procedureOrders: beforeCounts.procedureOrders,
          encounterProcedureOrders: beforeEncounterProcedures.orders.length
        },
        deletedProcedureOrder: procedureOrderId === null ? null : { id: procedureOrderId, row: null },
        deletedProcedureReport: procedureReportId === null ? null : { id: procedureReportId, row: null },
        deletedProcedureResult: procedureResultId === null ? null : { id: procedureResultId, row: null }
      },
      actual: {
        patient,
        encounter,
        beforeCounts,
        afterCleanupCounts,
        beforeEncounterProcedures,
        afterCleanupEncounterProcedures,
        procedureOrderId,
        procedureReportId,
        procedureResultId,
        deletedOrder,
        deletedReport,
        deletedResult
      },
      context: {
        canonicalId: encounterProcedureResultAnchorPatientId,
        suite: "workflow-encounter-procedure-results",
        workflow: "encounter-procedure-result-entry-cleanup"
      }
    });
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
