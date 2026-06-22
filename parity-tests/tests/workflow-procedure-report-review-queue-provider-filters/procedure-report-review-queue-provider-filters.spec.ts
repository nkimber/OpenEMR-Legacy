import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureReportReviewQueueDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedReports } from "../../src/ui/modernizedOpenEmr.js";

const reviewQueueProviderFilterPatientId = "MOD-PAT-0009";
const orderDate = "2026-06-21";
const reportDateTime = "2026-06-21 10:15:00";
const reportDateDisplay = "2026-06-21 10:15";

test.describe("procedure report review queue provider filter parity @slice137 @workflow-procedure-report-review-queue-provider-filters @mutation", () => {
  test("filters procedure report review queue by ordering provider", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(reviewQueueProviderFilterPatientId);
    expect(patient).not.toBeNull();

    const providerId = patient!.providerId || 101;
    const outsideProviderId = providerId === 101 ? 102 : 101;
    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Queue Provider ${suffix}`;
    const specimenNumber = `RP${suffix.slice(-8)}`;
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;

    try {
      encounterId = await workflow.createEncounter({
        patientId: patient!.pid,
        providerId,
        dateTime: "2026-06-21 10:00:00",
        reason: `Parity Queue Provider Encounter ${suffix}`,
        facilityId: 10,
        facilityName: "OpenEMR Modernization Clinic",
        billingFacilityId: 10,
        sensitivity: "normal",
        referralSource: "Parity suite",
        externalId: `RQP${suffix.slice(-8)}`,
        posCode: 11,
        billingNote: "Procedure report review queue provider filter workflow test encounter."
      });
      const encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      procedureOrderId = await workflow.createProcedureOrder({
        patientId: patient!.pid,
        providerId,
        encounterId: encounter!.encounter,
        dateOrdered: orderDate,
        priority: "routine",
        status: "complete",
        procedureCode: "80053",
        procedureName,
        procedureType: "laboratory",
        diagnosis: "Z00.00",
        instructions: "Created by the parity procedure report review queue provider filter suite."
      });

      procedureReportId = await workflow.createProcedureReport({
        orderId: procedureOrderId,
        dateCollected: "2026-06-21 10:05:00",
        dateReport: reportDateTime,
        specimenNumber,
        reportStatus: "final",
        reviewStatus: "received",
        notes: "Queued for provider-filtered review."
      });

      const matchingUnreviewedQueue = await targetDb.getProcedureReportReviewQueue("unreviewed", {
        patientId: String(patient!.pid),
        providerId,
        fromDate: orderDate,
        toDate: orderDate
      });
      expect(matchingUnreviewedQueue.providerFilter).toBe(String(providerId));
      const matchingBeforeReview = matchingUnreviewedQueue.reports.find((report) => report.reportId === procedureReportId);
      expect(matchingBeforeReview).toMatchObject({
        orderId: procedureOrderId,
        patientId: patient!.pid,
        pubpid: patient!.pubpid,
        providerId,
        procedureName,
        orderDate,
        reportDate: reportDateDisplay,
        reportStatus: "final",
        reviewStatus: "received",
        specimenNumber
      });

      const outsideProviderQueue = await targetDb.getProcedureReportReviewQueue("unreviewed", {
        patientId: String(patient!.pid),
        providerId: outsideProviderId,
        fromDate: orderDate,
        toDate: orderDate
      });
      expect(outsideProviderQueue.reports.some((report) => report.reportId === procedureReportId)).toBe(false);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureReportReviewQueueDirect(page, target, patient!.pid, orderDate, orderDate, "3", providerId);
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, patient!.pubpid);
      } else {
        await openAuthenticatedModernizedReports(page, target);
        const reviewQueue = page.locator('[aria-label="Procedure report review queue"]');
        await reviewQueue.getByLabel("Patient").fill(reviewQueueProviderFilterPatientId);
        await reviewQueue.getByLabel("Provider").fill(String(providerId));
        await reviewQueue.getByLabel("From").fill(orderDate);
        await reviewQueue.getByLabel("To").fill(orderDate);
        await expect(reviewQueue).toContainText(procedureName);
        await expect(reviewQueue).toContainText(`#${providerId}`);

        await reviewQueue.getByLabel("Provider").fill(String(outsideProviderId));
        await expect(reviewQueue).not.toContainText(procedureName);
        await reviewQueue.getByLabel("Provider").fill(String(providerId));
        await expect(reviewQueue).toContainText(procedureName);
      }

      await workflow.signProcedureReport(procedureReportId, {
        reviewedBy: "admin",
        reviewedAt: reportDateTime
      });

      const matchingReviewedQueue = await targetDb.getProcedureReportReviewQueue("reviewed", {
        patientId: String(patient!.pid),
        providerId,
        fromDate: orderDate,
        toDate: orderDate
      });
      const matchingAfterReview = matchingReviewedQueue.reports.find((report) => report.reportId === procedureReportId);
      expect(matchingAfterReview).toMatchObject({
        procedureName,
        providerId,
        reviewStatus: "reviewed",
        reviewedBy: "admin",
        reviewedAt: reportDateDisplay
      });

      if (target.type === "legacy-openemr") {
        await openProcedureReportReviewQueueDirect(page, target, patient!.pid, orderDate, orderDate, "2", providerId);
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
