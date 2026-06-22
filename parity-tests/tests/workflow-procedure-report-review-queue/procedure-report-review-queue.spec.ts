import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureReportReviewQueueDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedReports } from "../../src/ui/modernizedOpenEmr.js";

const reviewQueueAnchorPatientId = "MOD-PAT-0009";
const reportDateTime = "2026-06-21 08:45:00";
const reportDateDisplay = "2026-06-21 08:45";

test.describe("procedure report review queue parity @slice135 @workflow-procedure-report-review-queue @mutation", () => {
  test("moves a temporary lab report from unreviewed to reviewed queue state", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(reviewQueueAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Review Queue ${suffix}`;
    const specimenNumber = `RQ${suffix.slice(-8)}`;
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;

    try {
      encounterId = await workflow.createEncounter({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        dateTime: "2026-06-21 08:00:00",
        reason: `Parity Review Queue Encounter ${suffix}`,
        facilityId: 10,
        facilityName: "OpenEMR Modernization Clinic",
        billingFacilityId: 10,
        sensitivity: "normal",
        referralSource: "Parity suite",
        externalId: `PRQ${suffix.slice(-8)}`,
        posCode: 11,
        billingNote: "Procedure report review queue workflow test encounter."
      });
      const encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      procedureOrderId = await workflow.createProcedureOrder({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        encounterId: encounter!.encounter,
        dateOrdered: "2026-06-21",
        priority: "routine",
        status: "complete",
        procedureCode: "80053",
        procedureName,
        procedureType: "laboratory",
        diagnosis: "Z00.00",
        instructions: "Created by the parity procedure report review queue suite."
      });

      procedureReportId = await workflow.createProcedureReport({
        orderId: procedureOrderId,
        dateCollected: "2026-06-21 08:30:00",
        dateReport: reportDateTime,
        specimenNumber,
        reportStatus: "final",
        reviewStatus: "received",
        notes: "Queued for focused report review."
      });

      const unreviewedQueue = await targetDb.getProcedureReportReviewQueue("unreviewed");
      const queuedBeforeReview = unreviewedQueue.reports.find((report) => report.reportId === procedureReportId);
      expect(queuedBeforeReview).toMatchObject({
        orderId: procedureOrderId,
        patientId: patient!.pid,
        pubpid: patient!.pubpid,
        procedureCode: "80053",
        procedureName,
        reportDate: reportDateDisplay,
        reportStatus: "final",
        reviewStatus: "received",
        reviewedBy: "",
        reviewedAt: "",
        specimenNumber,
        notes: "Queued for focused report review."
      });

      const reviewedQueueBefore = await targetDb.getProcedureReportReviewQueue("reviewed");
      expect(reviewedQueueBefore.reports.some((report) => report.reportId === procedureReportId)).toBe(false);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureReportReviewQueueDirect(page, target, patient!.pid, "2026-06-21", "2026-06-21", "3");
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, patient!.pubpid);
      } else {
        await openAuthenticatedModernizedReports(page, target);
        const reviewQueue = page.locator('[aria-label="Procedure report review queue"]');
        await expect(reviewQueue).toContainText(procedureName);
        await expect(reviewQueue).toContainText(patient!.pubpid);
        await expect(reviewQueue).toContainText("received");
      }

      await workflow.signProcedureReport(procedureReportId, {
        reviewedBy: "admin",
        reviewedAt: reportDateTime
      });

      const reviewedQueueAfter = await targetDb.getProcedureReportReviewQueue("reviewed");
      const queuedAfterReview = reviewedQueueAfter.reports.find((report) => report.reportId === procedureReportId);
      expect(queuedAfterReview).toMatchObject({
        orderId: procedureOrderId,
        patientId: patient!.pid,
        pubpid: patient!.pubpid,
        procedureName,
        reportStatus: "final",
        reviewStatus: "reviewed",
        reviewedBy: "admin",
        reviewedAt: reportDateDisplay,
        specimenNumber
      });

      const unreviewedQueueAfter = await targetDb.getProcedureReportReviewQueue("unreviewed");
      expect(unreviewedQueueAfter.reports.some((report) => report.reportId === procedureReportId)).toBe(false);

      if (target.type === "legacy-openemr") {
        await openProcedureReportReviewQueueDirect(page, target, patient!.pid, "2026-06-21", "2026-06-21", "2");
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, patient!.pubpid);
      } else {
        await page.getByRole("button", { name: "Reviewed", exact: true }).click();
        const reviewQueue = page.locator('[aria-label="Procedure report review queue"]');
        await expect(reviewQueue).toContainText(procedureName);
        await expect(reviewQueue).toContainText("admin");
        await expect(reviewQueue).toContainText(reportDateDisplay);
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
  });
});

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-12) || "local";
}
