import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openProcedureResultsDirect } from "../../src/ui/legacyOpenEmr.js";

const procedureMutationAnchorPatientId = "MOD-PAT-0009";

test.describe("procedure mutation parity @slice17 @workflow-procedures @mutation", () => {
  test("creates, completes, reports, renders, and removes a lab procedure workflow", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Procedure ${suffix}`;
    const resultText = `Parity Glucose ${suffix}`;
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;
    let procedureResultId: number | null = null;

    try {
      encounterId = await workflow.createEncounter({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        dateTime: "2026-06-18 12:00:00",
        reason: `Parity Lab Encounter ${suffix}`,
        facilityId: 10,
        facilityName: "OpenEMR Modernization Clinic",
        billingFacilityId: 10,
        billingNote: "Procedure workflow test encounter."
      });
      const encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      procedureOrderId = await workflow.createProcedureOrder({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        encounterId: encounter!.encounter,
        dateOrdered: "2026-06-18 12:15:00",
        priority: "routine",
        status: "pending",
        procedureCode: "80053",
        procedureName,
        procedureType: "laboratory",
        diagnosis: "Z00.00",
        instructions: "Created by the parity procedure mutation suite."
      });

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
      expect(afterOrderCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterOrderCounts.procedureOrders).toBe(beforeCounts.procedureOrders + 1);

      await workflow.updateProcedureOrderStatus(procedureOrderId, "complete");
      await expect(workflow.getProcedureOrder(procedureOrderId)).resolves.toMatchObject({
        orderStatus: "complete"
      });

      procedureReportId = await workflow.createProcedureReport({
        orderId: procedureOrderId,
        dateCollected: "2026-06-18 12:30:00",
        dateReport: "2026-06-18 13:00:00",
        specimenNumber: `PARITY-${suffix}`,
        reportStatus: "final",
        reviewStatus: "reviewed",
        notes: "Parity procedure report."
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

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureResultsDirect(page, target, patient!.pid);
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, resultText);
        await expectRenderedText(page, "104");
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Procedures" }).click();
        await expect(page.getByRole("heading", { name: "Procedures" })).toBeVisible();
        await page.getByLabel("Procedure patient ID").fill(patient!.pubpid);

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
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-12) || "local";
}
