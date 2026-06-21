import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureReportReviewQueueDirect
} from "../../src/ui/legacyOpenEmr.js";

const reopenAnchorPatientId = "MOD-PAT-0009";
const orderDate = "2026-06-21";
const signedAt = "2026-06-21 12:25:00";
const signedAtDisplay = "2026-06-21 12:25";

test.describe("procedure report reopen review parity @slice154 @workflow-procedure-report-reopen-review @mutation", () => {
  test("reopens a signed temporary lab report into received unreviewed queue state", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(reopenAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Report Reopen ${suffix}`;
    const specimenNumber = `RPREOPEN${suffix.slice(-5)}`;
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;

    try {
      encounterId = await workflow.createEncounter({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        dateTime: "2026-06-21 12:00:00",
        reason: `Parity Report Reopen Encounter ${suffix}`,
        facilityId: 10,
        facilityName: "OpenEMR Modernization Clinic",
        billingFacilityId: 10,
        sensitivity: "normal",
        referralSource: "Parity suite",
        externalId: `RPR${suffix.slice(-8)}`,
        posCode: 11,
        billingNote: "Procedure report reopen review workflow test encounter."
      });
      const encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      procedureOrderId = await workflow.createProcedureOrder({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        encounterId: encounter!.encounter,
        dateOrdered: orderDate,
        priority: "routine",
        status: "complete",
        procedureCode: "80053",
        procedureName,
        procedureType: "laboratory",
        diagnosis: "Z00.00",
        instructions: "Created by the parity procedure report reopen review suite."
      });

      procedureReportId = await workflow.createProcedureReport({
        orderId: procedureOrderId,
        dateCollected: "2026-06-21 12:10:00",
        dateReport: signedAt,
        specimenNumber,
        reportStatus: "final",
        reviewStatus: "received",
        notes: "Report will be signed and reopened for review."
      });

      await workflow.signProcedureReport(procedureReportId, {
        reviewedBy: "admin",
        reviewedAt: signedAt
      });

      const reviewedQueueBefore = await targetDb.getProcedureReportReviewQueue("reviewed", {
        patientId: patient!.pubpid,
        fromDate: orderDate,
        toDate: orderDate
      });
      expect(reviewedQueueBefore.reports.find((report) => report.reportId === procedureReportId)).toMatchObject({
        orderId: procedureOrderId,
        procedureName,
        reviewStatus: "reviewed",
        reviewedBy: "admin",
        reviewedAt: signedAtDisplay,
        specimenNumber
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureReportReviewQueueDirect(page, target, patient!.pid, orderDate, orderDate, "2");
        await expectRenderedText(page, procedureName);

        await workflow.reopenProcedureReportReview(procedureReportId);

        await openProcedureReportReviewQueueDirect(page, target, patient!.pid, orderDate, orderDate, "3");
        await expectRenderedText(page, procedureName);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Procedures" }).click();
        await expect(page.getByRole("heading", { name: "Procedures" })).toBeVisible();
        await page.getByLabel("Procedure patient ID").fill(patient!.pubpid);

        const reportCard = page.locator(".procedure-report-card", { hasText: specimenNumber }).first();
        await expect(reportCard).toBeVisible();
        await expect(reportCard).toContainText("reviewed");
        await expect(reportCard).toContainText("Signed by admin");
        await reportCard.getByRole("button", { name: /Reopen procedure report review/i }).click();

        await expect(reportCard).toContainText("received");
        await expect(reportCard).not.toContainText("Signed by admin");
        await expect(reportCard).not.toContainText(`Signed ${signedAtDisplay}`);

        await page.getByRole("button", { name: "Reports" }).click();
        const reviewQueue = page.locator('[aria-label="Procedure report review queue"]');
        await reviewQueue.getByLabel("Patient").fill(patient!.pubpid);
        await reviewQueue.getByLabel("From").fill(orderDate);
        await reviewQueue.getByLabel("To").fill(orderDate);
        await expect(reviewQueue).toContainText(procedureName);
        await expect(reviewQueue).toContainText(specimenNumber);
      }

      await expect(workflow.getProcedureReport(procedureReportId)).resolves.toMatchObject({
        orderId: procedureOrderId,
        dateCollected: "2026-06-21",
        dateReport: "2026-06-21",
        specimenNumber,
        reportStatus: "final",
        reviewStatus: "received",
        reviewedBy: "",
        reviewedAt: "",
        reportNotes: "Report will be signed and reopened for review."
      });

      const unreviewedQueueAfter = await targetDb.getProcedureReportReviewQueue("unreviewed", {
        patientId: patient!.pubpid,
        fromDate: orderDate,
        toDate: orderDate
      });
      expect(unreviewedQueueAfter.reports.find((report) => report.reportId === procedureReportId)).toMatchObject({
        orderId: procedureOrderId,
        procedureName,
        reviewStatus: "received",
        reviewedBy: "",
        reviewedAt: "",
        specimenNumber
      });

      const reviewedQueueAfter = await targetDb.getProcedureReportReviewQueue("reviewed", {
        patientId: patient!.pubpid,
        fromDate: orderDate,
        toDate: orderDate
      });
      expect(reviewedQueueAfter.reports.some((report) => report.reportId === procedureReportId)).toBe(false);
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
