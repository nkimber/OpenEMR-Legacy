import { test, expect } from "../../src/fixtures/parityTest.js";
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
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterProcedureResultAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();
    expect(encounter!.encounter).toBe(encounterProcedureResultEncounter);

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeEncounterProcedures = await targetDb.getProcedureResultsForEncounter(
      patient!.pid,
      encounterProcedureResultEncounter
    );
    const suffix = workflowSuffix();
    const procedureName = `Parity Encounter Procedure Result ${suffix}`;
    const resultText = `Parity Encounter Glucose ${suffix}`;
    const instructions = `Created by the encounter procedure result parity suite ${suffix}.`;
    const resultNotes = `Reviewed from the encounter result parity suite ${suffix}.`;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;
    let procedureResultId: number | null = null;

    try {
      procedureOrderId = await workflow.createProcedureOrder({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        encounterId: encounter!.encounter,
        dateOrdered: encounterProcedureResultOrderDate,
        priority: "routine",
        status: "pending",
        procedureCode: encounterProcedureResultCode,
        procedureName,
        procedureType: "laboratory",
        diagnosis: encounterProcedureResultDiagnosis,
        instructions
      });

      if (target.type === "legacy-openemr") {
        procedureReportId = await workflow.createProcedureReport({
          orderId: procedureOrderId,
          dateCollected: `${encounterProcedureResultOrderDate} 12:30:00`,
          dateReport: `${encounterProcedureResultOrderDate} 13:00:00`,
          specimenNumber: `PARITY-${suffix}`,
          reportStatus: "final",
          reviewStatus: "reviewed",
          notes: resultNotes
        });
        procedureResultId = await workflow.createProcedureResult({
          reportId: procedureReportId,
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
        });

        await loginToLegacyOpenEmr(page, target);
        await openProcedureResultsDirect(page, target, patient!.pid);
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, resultText);
        await expectRenderedText(page, "104");
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Encounters" }).click();
        await expect(page.getByRole("heading", { name: "Encounters" })).toBeVisible();

        await page.getByLabel("Encounter patient ID").fill(patient!.pubpid);
        await page.getByLabel("Encounter from date").fill(encounterProcedureResultAnchorFromDate);

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

        const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounter!.encounter}`);
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
      }

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters);
      expect(afterCreateCounts.procedureOrders).toBe(beforeCounts.procedureOrders + 1);

      const afterCreateEncounterProcedures = await targetDb.getProcedureResultsForEncounter(
        patient!.pid,
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
      expect(createdOrder!.reports).toHaveLength(1);
      const createdReport = createdOrder!.reports[0];
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
      procedureOrderId = createdOrder!.id;
      procedureReportId = createdReport.id;
      procedureResultId = createdResult.id;
    } finally {
      if (procedureOrderId !== null) {
        await workflow.deleteProcedureOrderCascade(procedureOrderId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.procedureOrders).toBe(beforeCounts.procedureOrders);
    if (procedureOrderId !== null) {
      await expect(workflow.getProcedureOrder(procedureOrderId)).resolves.toBeNull();
    }
    if (procedureReportId !== null) {
      await expect(workflow.getProcedureReport(procedureReportId)).resolves.toBeNull();
    }
    if (procedureResultId !== null) {
      await expect(workflow.getProcedureResult(procedureResultId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
