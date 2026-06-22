import { test, expect } from "../../src/fixtures/parityTest.js";
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
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureReportSignOffAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Report Signoff ${suffix}`;
    const resultText = `Parity Report Signoff Glucose ${suffix}`;
    const specimenNumber = `RPSIGN${suffix.slice(-6)}`;
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;
    let procedureResultId: number | null = null;

    try {
      encounterId = await workflow.createEncounter({
        patientId: patient!.pid,
        providerId: patient!.providerId,
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
      });
      const encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      procedureOrderId = await workflow.createProcedureOrder({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        encounterId: encounter!.encounter,
        dateOrdered: "2026-06-19",
        priority: "routine",
        status: "complete",
        procedureCode: "80053",
        procedureName,
        procedureType: "laboratory",
        diagnosis: "Z00.00",
        instructions: "Created by the parity procedure report sign-off suite."
      });

      procedureReportId = await workflow.createProcedureReport({
        orderId: procedureOrderId,
        dateCollected: "2026-06-19 14:00:00",
        dateReport: signedAt,
        specimenNumber,
        reportStatus: "final",
        reviewStatus: "pending",
        notes: "Pending report review before sign-off."
      });

      procedureResultId = await workflow.createProcedureResult({
        reportId: procedureReportId,
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
      });

      if (target.type === "legacy-openemr") {
        await workflow.signProcedureReport(procedureReportId, {
          reviewedBy: "admin",
          reviewedAt: signedAt
        });

        await loginToLegacyOpenEmr(page, target);
        await openProcedureResultsDirect(page, target, patient!.pid);
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, specimenNumber);
        await expectRenderedText(page, resultText);
      } else {
        await openAuthenticatedModernizedProcedures(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText(procedureName);
        const reportCard = page.locator(".procedure-report-card", { hasText: specimenNumber }).first();
        await expect(reportCard).toBeVisible();
        await reportCard.getByRole("button", { name: /Sign procedure report/i }).click();

        await expect(reportCard).toContainText("reviewed");
        await expect(reportCard).toContainText("Signed by admin");
        await expect(reportCard).toContainText(`Signed ${signedAtDisplay}`);
        await expect(reportCard).toContainText(resultText);
      }

      await expect(workflow.getProcedureReport(procedureReportId)).resolves.toMatchObject({
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

      const procedureSummary = await targetDb.getProcedureResultsForPatient(patient!.pid);
      const signedOrder = procedureSummary.orders.find((order) => order.procedureName === procedureName);
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
