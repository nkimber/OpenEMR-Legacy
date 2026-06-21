import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openProcedureResultsDirect } from "../../src/ui/legacyOpenEmr.js";

const procedureOrderCorrectionAnchorPatientId = "MOD-PAT-0009";

test.describe("procedure order correction parity @slice132 @workflow-procedure-order-correction @mutation", () => {
  test("corrects temporary lab order metadata and cleans up the workflow", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureOrderCorrectionAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const initialProcedureName = `Parity Order Initial ${suffix}`;
    const correctedProcedureName = `Parity Order Corrected ${suffix}`;
    const correctedInstructions = `Corrected order instructions ${suffix}`;
    const resultText = `Parity Order Correction Result ${suffix}`;
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;
    let procedureResultId: number | null = null;

    try {
      encounterId = await workflow.createEncounter({
        patientId: patient!.pid,
        providerId: patient!.providerId,
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
      });
      const encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      procedureOrderId = await workflow.createProcedureOrder({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        encounterId: encounter!.encounter,
        dateOrdered: "2026-06-18",
        priority: "routine",
        status: "pending",
        procedureCode: "80053",
        procedureName: initialProcedureName,
        procedureType: "laboratory",
        diagnosis: "Z00.00",
        instructions: "Initial procedure order correction fixture."
      });

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

      if (target.type === "legacy-openemr") {
        await workflow.updateProcedureOrder(procedureOrderId, correctedOrderInput);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Procedures" }).click();
        await expect(page.getByRole("heading", { name: "Procedures" })).toBeVisible();
        await page.getByLabel("Procedure patient ID").fill(patient!.pubpid);

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
      }

      await expect(workflow.getProcedureOrder(procedureOrderId)).resolves.toMatchObject({
        patientId: patient!.pid,
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

      procedureReportId = await workflow.createProcedureReport({
        orderId: procedureOrderId,
        dateCollected: "2026-06-19 12:30:00",
        dateReport: "2026-06-19 13:00:00",
        specimenNumber: `POC${suffix.slice(-8)}`,
        reportStatus: "final",
        reviewStatus: "reviewed",
        notes: "Parity procedure order correction report."
      });

      procedureResultId = await workflow.createProcedureResult({
        reportId: procedureReportId,
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
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureResultsDirect(page, target, patient!.pid);
        await expectRenderedText(page, correctedProcedureName);
        await expectRenderedText(page, resultText);
        await expectRenderedText(page, "6.4");
      }

      const procedureSummary = await targetDb.getProcedureResultsForPatient(patient!.pid);
      const correctedOrder = procedureSummary.orders.find((order) => order.id === procedureOrderId);
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
