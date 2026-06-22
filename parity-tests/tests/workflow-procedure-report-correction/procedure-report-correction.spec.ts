import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openProcedureResultsDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedProcedures } from "../../src/ui/modernizedOpenEmr.js";

const procedureReportCorrectionAnchorPatientId = "MOD-PAT-0009";

test.describe("procedure report correction parity @slice133 @workflow-procedure-report-correction @mutation", () => {
  test("corrects temporary lab report metadata and cleans up the workflow", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureReportCorrectionAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Report Correction ${suffix}`;
    const resultText = `Parity Report Correction Glucose ${suffix}`;
    const initialSpecimenNumber = `RPCINIT${suffix.slice(-6)}`;
    const correctedSpecimenNumber = `RPCCORR${suffix.slice(-6)}`;
    const correctedNotes = `Corrected report notes ${suffix}`;
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;
    let procedureResultId: number | null = null;

    try {
      encounterId = await workflow.createEncounter({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        dateTime: "2026-06-18 12:00:00",
        reason: `Parity Report Correction Encounter ${suffix}`,
        facilityId: 10,
        facilityName: "OpenEMR Modernization Clinic",
        billingFacilityId: 10,
        sensitivity: "normal",
        referralSource: "Parity suite",
        externalId: `PRC${suffix.slice(-8)}`,
        posCode: 11,
        billingNote: "Procedure report correction workflow test encounter."
      });
      const encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      procedureOrderId = await workflow.createProcedureOrder({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        encounterId: encounter!.encounter,
        dateOrdered: "2026-06-18",
        priority: "routine",
        status: "complete",
        procedureCode: "80053",
        procedureName,
        procedureType: "laboratory",
        diagnosis: "Z00.00",
        instructions: "Created by the parity procedure report correction suite."
      });

      procedureReportId = await workflow.createProcedureReport({
        orderId: procedureOrderId,
        dateCollected: "2026-06-18 12:30:00",
        dateReport: "2026-06-18 13:00:00",
        specimenNumber: initialSpecimenNumber,
        reportStatus: "final",
        reviewStatus: "pending",
        notes: "Initial report metadata before correction."
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
        comments: "Result row keeps the corrected report visible.",
        status: "final"
      });

      const correctedReportInput = {
        dateCollected: "2026-06-19 10:20:00",
        dateReport: "2026-06-19 11:00:00",
        specimenNumber: correctedSpecimenNumber,
        reportStatus: "corrected",
        reviewStatus: "reviewed",
        notes: correctedNotes
      };

      if (target.type === "legacy-openemr") {
        await workflow.updateProcedureReport(procedureReportId, correctedReportInput);

        await loginToLegacyOpenEmr(page, target);
        await openProcedureResultsDirect(page, target, patient!.pid);
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, correctedSpecimenNumber);
        await expectRenderedText(page, resultText);
      } else {
        await openAuthenticatedModernizedProcedures(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText(procedureName);
        const reportCard = page.locator(".procedure-report-card", { hasText: initialSpecimenNumber }).first();
        await expect(reportCard).toBeVisible();
        await reportCard.getByRole("button", { name: "Correct Report" }).click();
        await reportCard.getByLabel("Procedure corrected report collected date").fill("2026-06-19 10:20");
        await reportCard.getByLabel("Procedure corrected report date").fill("2026-06-19 11:00");
        await reportCard.getByLabel("Procedure corrected report specimen number").fill(correctedSpecimenNumber);
        await reportCard.getByLabel("Procedure corrected report status").selectOption("corrected");
        await reportCard.getByLabel("Procedure corrected report review status").selectOption("reviewed");
        await reportCard.getByLabel("Procedure corrected report notes").fill(correctedNotes);
        await reportCard.getByRole("button", { name: /Save Report Correction/i }).click();

        await expect(page.locator("body")).toContainText(`Specimen ${correctedSpecimenNumber}`);
        await expect(page.locator("body")).toContainText("Collected 2026-06-19 10:20");
        await expect(page.locator("body")).toContainText("corrected");
        await expect(page.locator("body")).toContainText("reviewed");
        await expect(page.locator("body")).toContainText(correctedNotes);
        await expect(page.locator("body")).toContainText(resultText);
      }

      await expect(workflow.getProcedureReport(procedureReportId)).resolves.toMatchObject({
        orderId: procedureOrderId,
        dateCollected: "2026-06-19",
        dateReport: "2026-06-19",
        specimenNumber: correctedSpecimenNumber,
        reportStatus: "corrected",
        reviewStatus: "reviewed",
        reportNotes: correctedNotes
      });

      const procedureSummary = await targetDb.getProcedureResultsForPatient(patient!.pid);
      const correctedOrder = procedureSummary.orders.find((order) => order.procedureName === procedureName);
      expect(correctedOrder).not.toBeUndefined();
      expect(correctedOrder!.reports).toHaveLength(1);
      expect(correctedOrder!.reports[0]).toMatchObject({
        dateCollected: "2026-06-19",
        reportDate: "2026-06-19",
        specimenNumber: correctedSpecimenNumber,
        status: "corrected",
        reviewStatus: "reviewed",
        reportNotes: correctedNotes
      });
      expect(correctedOrder!.reports[0].results).toHaveLength(1);
      expect(correctedOrder!.reports[0].results[0]).toMatchObject({
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
