import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureReportReviewQueueDirect
} from "../../src/ui/legacyOpenEmr.js";

const reviewQueueLabFilterPatientId = "MOD-PAT-0009";
const orderDate = "2026-06-21";
const reportDateTime = "2026-06-21 10:45:00";
const reportDateDisplay = "2026-06-21 10:45";

test.describe("procedure report review queue lab filter parity @slice138 @workflow-procedure-report-review-queue-lab-filters @mutation", () => {
  test("filters procedure report review queue by processing lab", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(reviewQueueLabFilterPatientId);
    expect(patient).not.toBeNull();

    const providerId = patient!.providerId || 101;
    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Queue Lab ${suffix}`;
    const labName = `Parity Lab ${suffix}`;
    const outsideLabName = `Parity Outside Lab ${suffix}`;
    const specimenNumber = `RL${suffix.slice(-8)}`;
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;
    let labId: number | null = null;
    let outsideLabId: number | null = null;

    try {
      labId = await workflow.createProcedureLabProvider({
        name: labName,
        npi: `PL${suffix.slice(-8)}`
      });
      outsideLabId = await workflow.createProcedureLabProvider({
        name: outsideLabName,
        npi: `PX${suffix.slice(-8)}`
      });
      const matchingLabId = labId;
      const excludedLabId = outsideLabId;
      if (matchingLabId === null || excludedLabId === null) {
        throw new Error("Temporary lab providers were not created.");
      }

      encounterId = await workflow.createEncounter({
        patientId: patient!.pid,
        providerId,
        dateTime: "2026-06-21 10:30:00",
        reason: `Parity Queue Lab Encounter ${suffix}`,
        facilityId: 10,
        facilityName: "OpenEMR Modernization Clinic",
        billingFacilityId: 10,
        sensitivity: "normal",
        referralSource: "Parity suite",
        externalId: `RQL${suffix.slice(-8)}`,
        posCode: 11,
        billingNote: "Procedure report review queue lab filter workflow test encounter."
      });
      const encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      procedureOrderId = await workflow.createProcedureOrder({
        patientId: patient!.pid,
        providerId,
        labId: matchingLabId,
        encounterId: encounter!.encounter,
        dateOrdered: orderDate,
        priority: "routine",
        status: "complete",
        procedureCode: "80053",
        procedureName,
        procedureType: "laboratory",
        diagnosis: "Z00.00",
        instructions: "Created by the parity procedure report review queue lab filter suite."
      });

      procedureReportId = await workflow.createProcedureReport({
        orderId: procedureOrderId,
        dateCollected: "2026-06-21 10:35:00",
        dateReport: reportDateTime,
        specimenNumber,
        reportStatus: "final",
        reviewStatus: "received",
        notes: "Queued for lab-filtered review."
      });

      const matchingUnreviewedQueue = await targetDb.getProcedureReportReviewQueue("unreviewed", {
        patientId: String(patient!.pid),
        labId: matchingLabId,
        fromDate: orderDate,
        toDate: orderDate
      });
      expect(matchingUnreviewedQueue.labFilter).toBe(String(matchingLabId));
      const matchingBeforeReview = matchingUnreviewedQueue.reports.find((report) => report.reportId === procedureReportId);
      expect(matchingBeforeReview).toMatchObject({
        orderId: procedureOrderId,
        patientId: patient!.pid,
        pubpid: patient!.pubpid,
        labId: matchingLabId,
        labName,
        procedureName,
        orderDate,
        reportDate: reportDateDisplay,
        reportStatus: "final",
        reviewStatus: "received",
        specimenNumber
      });

      const outsideLabQueue = await targetDb.getProcedureReportReviewQueue("unreviewed", {
        patientId: String(patient!.pid),
        labId: excludedLabId,
        fromDate: orderDate,
        toDate: orderDate
      });
      expect(outsideLabQueue.reports.some((report) => report.reportId === procedureReportId)).toBe(false);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureReportReviewQueueDirect(page, target, patient!.pid, orderDate, orderDate, "3", undefined, matchingLabId);
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, patient!.pubpid);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Reports" }).click();
        await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
        const reviewQueue = page.locator('[aria-label="Procedure report review queue"]');
        await reviewQueue.getByLabel("Patient").fill(reviewQueueLabFilterPatientId);
        await reviewQueue.getByLabel("Lab").fill(String(matchingLabId));
        await reviewQueue.getByLabel("From").fill(orderDate);
        await reviewQueue.getByLabel("To").fill(orderDate);
        await expect(reviewQueue).toContainText(procedureName);
        await expect(reviewQueue).toContainText(labName);
        await expect(reviewQueue).toContainText(`#${matchingLabId}`);

        await reviewQueue.getByLabel("Lab").fill(String(excludedLabId));
        await expect(reviewQueue).not.toContainText(procedureName);
        await reviewQueue.getByLabel("Lab").fill(String(matchingLabId));
        await expect(reviewQueue).toContainText(procedureName);
      }

      await workflow.signProcedureReport(procedureReportId, {
        reviewedBy: "admin",
        reviewedAt: reportDateTime
      });

      const matchingReviewedQueue = await targetDb.getProcedureReportReviewQueue("reviewed", {
        patientId: String(patient!.pid),
        labId: matchingLabId,
        fromDate: orderDate,
        toDate: orderDate
      });
      const matchingAfterReview = matchingReviewedQueue.reports.find((report) => report.reportId === procedureReportId);
      expect(matchingAfterReview).toMatchObject({
        procedureName,
        labId: matchingLabId,
        labName,
        reviewStatus: "reviewed",
        reviewedBy: "admin",
        reviewedAt: reportDateDisplay
      });

      if (target.type === "legacy-openemr") {
        await openProcedureReportReviewQueueDirect(page, target, patient!.pid, orderDate, orderDate, "2", undefined, matchingLabId);
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, patient!.pubpid);
      } else {
        const reviewQueue = page.locator('[aria-label="Procedure report review queue"]');
        await page.getByRole("button", { name: "Reviewed", exact: true }).click();
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
      if (outsideLabId !== null) {
        await workflow.deleteProcedureLabProvider(outsideLabId);
      }
      if (labId !== null) {
        await workflow.deleteProcedureLabProvider(labId);
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
