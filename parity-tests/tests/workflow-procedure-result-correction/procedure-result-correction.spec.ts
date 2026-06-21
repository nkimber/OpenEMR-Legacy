import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openProcedureResultsDirect } from "../../src/ui/legacyOpenEmr.js";

const procedureCorrectionAnchorPatientId = "MOD-PAT-0009";

test.describe("procedure result correction parity @slice129 @workflow-procedure-result-correction @mutation", () => {
  test("corrects an existing lab result and cleans up the temporary workflow", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureCorrectionAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Corrected Procedure ${suffix}`;
    const initialResultText = `Parity Initial Glucose ${suffix}`;
    const correctedResultText = `Parity Corrected Glucose ${suffix}`;
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;
    let procedureResultId: number | null = null;

    try {
      encounterId = await workflow.createEncounter({
        patientId: patient!.pid,
        providerId: patient!.providerId,
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
      });
      const encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      procedureOrderId = await workflow.createProcedureOrder({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        encounterId: encounter!.encounter,
        dateOrdered: "2026-06-18 12:15:00",
        priority: "routine",
        status: "complete",
        procedureCode: "80053",
        procedureName,
        procedureType: "laboratory",
        diagnosis: "Z00.00",
        instructions: "Created by the parity procedure correction suite."
      });

      procedureReportId = await workflow.createProcedureReport({
        orderId: procedureOrderId,
        dateCollected: "2026-06-18 12:30:00",
        dateReport: "2026-06-18 13:00:00",
        specimenNumber: `PARITY-CORR-${suffix}`,
        reportStatus: "final",
        reviewStatus: "reviewed",
        notes: "Parity procedure correction report."
      });

      procedureResultId = await workflow.createProcedureResult({
        reportId: procedureReportId,
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
      });

      const correctedPayload = {
        reportId: procedureReportId,
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

      if (target.type === "legacy-openemr") {
        await workflow.updateProcedureResult(procedureResultId, correctedPayload);

        await loginToLegacyOpenEmr(page, target);
        await openProcedureResultsDirect(page, target, patient!.pid);
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, correctedResultText);
        await expectRenderedText(page, "118");
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Procedures" }).click();
        await expect(page.getByRole("heading", { name: "Procedures" })).toBeVisible();
        await page.getByLabel("Procedure patient ID").fill(patient!.pubpid);

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
      }

      const result = await workflow.getProcedureResult(procedureResultId);
      expect(result).toMatchObject({
        reportId: procedureReportId,
        resultCode: "2345-7",
        resultText: correctedResultText,
        result: "118",
        abnormal: "borderline",
        status: "corrected"
      });

      const afterCorrection = await targetDb.getProcedureResultsForPatient(patient!.pid);
      const correctedOrder = afterCorrection.orders.find((order) => order.procedureName === procedureName);
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
