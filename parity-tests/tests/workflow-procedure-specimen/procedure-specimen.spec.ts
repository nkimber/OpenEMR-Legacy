import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openProcedureResultsDirect } from "../../src/ui/legacyOpenEmr.js";

const procedureSpecimenAnchorPatientId = "MOD-PAT-0009";

test.describe("procedure specimen metadata parity @slice130 @workflow-procedure-specimen @mutation", () => {
  test("preserves collected date and specimen number for a temporary lab report", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureSpecimenAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Specimen Procedure ${suffix}`;
    const resultText = `Parity Specimen Glucose ${suffix}`;
    const specimenNumber = `SPC${suffix.slice(-8)}`;
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;
    let procedureResultId: number | null = null;

    try {
      encounterId = await workflow.createEncounter({
        patientId: patient!.pid,
        providerId: patient!.providerId,
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
      });
      const encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      procedureOrderId = await workflow.createProcedureOrder({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        encounterId: encounter!.encounter,
        dateOrdered: "2026-06-18 12:10:00",
        priority: "routine",
        status: "complete",
        procedureCode: "80053",
        procedureName,
        procedureType: "laboratory",
        diagnosis: "Z00.00",
        instructions: "Created by the parity procedure specimen suite."
      });

      procedureReportId = await workflow.createProcedureReport({
        orderId: procedureOrderId,
        dateCollected: "2026-06-18 12:30:00",
        dateReport: "2026-06-18 13:00:00",
        specimenNumber,
        reportStatus: "final",
        reviewStatus: "reviewed",
        notes: "Parity procedure specimen report."
      });

      const report = await workflow.getProcedureReport(procedureReportId);
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
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureResultsDirect(page, target, patient!.pid);
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, specimenNumber);
        await expectRenderedText(page, resultText);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Procedures" }).click();
        await expect(page.getByRole("heading", { name: "Procedures" })).toBeVisible();
        await page.getByLabel("Procedure patient ID").fill(patient!.pubpid);

        await expect(page.locator("body")).toContainText(procedureName);
        await expect(page.locator("body")).toContainText(`Specimen ${specimenNumber}`);
        await expect(page.locator("body")).toContainText("Collected 2026-06-18 12:30");
        await expect(page.locator("body")).toContainText(resultText);
      }

      const procedureSummary = await targetDb.getProcedureResultsForPatient(patient!.pid);
      const specimenOrder = procedureSummary.orders.find((order) => order.procedureName === procedureName);
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
