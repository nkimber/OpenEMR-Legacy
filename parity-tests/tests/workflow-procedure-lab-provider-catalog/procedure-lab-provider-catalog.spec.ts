import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureReportReviewQueueDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedReports } from "../../src/ui/modernizedOpenEmr.js";

const anchorPatientId = "MOD-PAT-0009";
const anchorOrderId = 5000009;
const anchorReportId = 6000009;
const anchorLabId = 504;
const outsideLabId = 501;
const anchorOrderDate = "2026-02-26";
const anchorReportDateDisplay = "2026-02-28 14:00";
const anchorProcedureCode = "85025";
const anchorProcedureName = "Complete blood count";
const anchorLabName = "Pacific Women's Health Laboratory";
const anchorSpecimenNumber = "SP-6000009";

test.describe("procedure lab provider catalog parity @slice139 @workflow-procedure-lab-provider-catalog @read-only", () => {
  test("renders seeded processing lab ownership for reviewed procedure reports", async ({
    page,
    target,
    targetDb
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(anchorPatientId);
    expect(patient).not.toBeNull();

    const reviewedQueue = await targetDb.getProcedureReportReviewQueue("reviewed", {
      patientId: anchorPatientId,
      labId: anchorLabId,
      fromDate: anchorOrderDate,
      toDate: anchorOrderDate
    });

    expect(reviewedQueue.labFilter).toBe(String(anchorLabId));
    expect(reviewedQueue.reviewedReports).toBeGreaterThanOrEqual(1);
    const anchorReport = reviewedQueue.reports.find((report) => report.reportId === anchorReportId);
    expect(anchorReport).toMatchObject({
      reportId: anchorReportId,
      orderId: anchorOrderId,
      patientId: patient!.pid,
      pubpid: anchorPatientId,
      labId: anchorLabId,
      labName: anchorLabName,
      procedureCode: anchorProcedureCode,
      procedureName: anchorProcedureName,
      orderDate: anchorOrderDate,
      reportDate: anchorReportDateDisplay,
      reportStatus: "complete",
      reviewStatus: "reviewed",
      reviewedBy: "admin",
      reviewedAt: anchorReportDateDisplay,
      specimenNumber: anchorSpecimenNumber,
      notes: "Gold dataset result"
    });

    const outsideLabQueue = await targetDb.getProcedureReportReviewQueue("reviewed", {
      patientId: anchorPatientId,
      labId: outsideLabId,
      fromDate: anchorOrderDate,
      toDate: anchorOrderDate
    });
    expect(outsideLabQueue.reports.some((report) => report.reportId === anchorReportId)).toBe(false);

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openProcedureReportReviewQueueDirect(
        page,
        target,
        patient!.pid,
        anchorOrderDate,
        anchorOrderDate,
        "2",
        undefined,
        anchorLabId
      );
      await expectRenderedText(page, anchorLabName);
      await expectRenderedText(page, anchorOrderDate);
      await expectRenderedText(page, "Reviewed");
    } else {
      await openAuthenticatedModernizedReports(page, target);
      const reviewQueue = page.locator('[aria-label="Procedure report review queue"]');
      await page.getByRole("button", { name: "Reviewed", exact: true }).click();
      await reviewQueue.getByLabel("Patient").fill(anchorPatientId);
      await reviewQueue.getByLabel("Lab").fill(String(anchorLabId));
      await reviewQueue.getByLabel("From").fill(anchorOrderDate);
      await reviewQueue.getByLabel("To").fill(anchorOrderDate);
      await expect(reviewQueue).toContainText(anchorProcedureName);
      await expect(reviewQueue).toContainText(anchorLabName);
      await expect(reviewQueue).toContainText(`#${anchorLabId}`);

      await reviewQueue.getByLabel("Lab").fill(String(outsideLabId));
      await expect(reviewQueue).not.toContainText(anchorProcedureName);
    }
  });
});
