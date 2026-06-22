import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureReportReviewQueueDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedReports } from "../../src/ui/modernizedOpenEmr.js";

const bulkSignAnchorPatientId = "MOD-PAT-0009";
const orderDate = "2026-06-21";
const bulkSignedAt = "2026-06-21 11:25:00";
const bulkSignedAtDisplay = "2026-06-21 11:25";

test.describe("procedure report bulk sign-off parity @slice153 @workflow-procedure-report-bulk-signoff @mutation", () => {
  test("bulk signs two temporary unreviewed lab reports and moves them to reviewed queue state", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(bulkSignAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const entries = [
      {
        code: "80053",
        name: `Parity Bulk CMP ${suffix}`,
        specimen: `BULKCMP${suffix.slice(-5)}`,
        notes: "Bulk sign-off queue report one."
      },
      {
        code: "85025",
        name: `Parity Bulk CBC ${suffix}`,
        specimen: `BULKCBC${suffix.slice(-5)}`,
        notes: "Bulk sign-off queue report two."
      }
    ];
    let encounterId: number | null = null;
    const procedureOrderIds: number[] = [];
    const procedureReportIds: number[] = [];

    try {
      encounterId = await workflow.createEncounter({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        dateTime: "2026-06-21 10:30:00",
        reason: `Parity Bulk Report Signoff Encounter ${suffix}`,
        facilityId: 10,
        facilityName: "OpenEMR Modernization Clinic",
        billingFacilityId: 10,
        sensitivity: "normal",
        referralSource: "Parity suite",
        externalId: `PBS${suffix.slice(-8)}`,
        posCode: 11,
        billingNote: "Procedure report bulk sign-off workflow test encounter."
      });
      const encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      for (const entry of entries) {
        const orderId = await workflow.createProcedureOrder({
          patientId: patient!.pid,
          providerId: patient!.providerId,
          encounterId: encounter!.encounter,
          dateOrdered: orderDate,
          priority: "routine",
          status: "complete",
          procedureCode: entry.code,
          procedureName: entry.name,
          procedureType: "laboratory",
          diagnosis: "Z00.00",
          instructions: "Created by the parity procedure report bulk sign-off suite."
        });
        procedureOrderIds.push(orderId);

        const reportId = await workflow.createProcedureReport({
          orderId,
          dateCollected: "2026-06-21 11:00:00",
          dateReport: "2026-06-21 11:10:00",
          specimenNumber: entry.specimen,
          reportStatus: "final",
          reviewStatus: "received",
          notes: entry.notes
        });
        procedureReportIds.push(reportId);
      }

      const unreviewedQueue = await targetDb.getProcedureReportReviewQueue("unreviewed", {
        patientId: patient!.pubpid,
        fromDate: orderDate,
        toDate: orderDate
      });
      for (let index = 0; index < entries.length; index += 1) {
        expect(unreviewedQueue.reports.find((report) => report.reportId === procedureReportIds[index])).toMatchObject({
          orderId: procedureOrderIds[index],
          patientId: patient!.pid,
          pubpid: patient!.pubpid,
          procedureCode: entries[index].code,
          procedureName: entries[index].name,
          reportStatus: "final",
          reviewStatus: "received",
          reviewedBy: "",
          reviewedAt: "",
          specimenNumber: entries[index].specimen,
          notes: entries[index].notes
        });
      }

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureReportReviewQueueDirect(page, target, patient!.pid, orderDate, orderDate, "3");
        for (const entry of entries) {
          await expectRenderedText(page, entry.name);
        }

        await workflow.bulkSignProcedureReports(procedureReportIds, {
          reviewedBy: "admin",
          reviewedAt: bulkSignedAt
        });
      } else {
        await openAuthenticatedModernizedReports(page, target);

        const reviewQueue = page.locator('[aria-label="Procedure report review queue"]');
        await reviewQueue.getByLabel("Patient").fill(patient!.pubpid);
        await reviewQueue.getByLabel("From").fill(orderDate);
        await reviewQueue.getByLabel("To").fill(orderDate);
        for (const entry of entries) {
          await expect(reviewQueue).toContainText(entry.name);
          await expect(reviewQueue).toContainText(entry.specimen);
        }

        await reviewQueue.getByRole("button", { name: "Sign visible" }).click();
        await expect(reviewQueue).toContainText("Signed 2");
      }

      const reviewedQueueAfter = await targetDb.getProcedureReportReviewQueue("reviewed", {
        patientId: patient!.pubpid,
        fromDate: orderDate,
        toDate: orderDate
      });
      for (let index = 0; index < entries.length; index += 1) {
        expect(reviewedQueueAfter.reports.find((report) => report.reportId === procedureReportIds[index])).toMatchObject({
          orderId: procedureOrderIds[index],
          patientId: patient!.pid,
          pubpid: patient!.pubpid,
          procedureName: entries[index].name,
          reportStatus: "final",
          reviewStatus: "reviewed",
          reviewedBy: "admin",
          reviewedAt: bulkSignedAtDisplay,
          specimenNumber: entries[index].specimen
        });
      }

      const unreviewedQueueAfter = await targetDb.getProcedureReportReviewQueue("unreviewed", {
        patientId: patient!.pubpid,
        fromDate: orderDate,
        toDate: orderDate
      });
      for (const reportId of procedureReportIds) {
        expect(unreviewedQueueAfter.reports.some((report) => report.reportId === reportId)).toBe(false);
      }

      if (target.type === "legacy-openemr") {
        await openProcedureReportReviewQueueDirect(page, target, patient!.pid, orderDate, orderDate, "2");
        for (const entry of entries) {
          await expectRenderedText(page, entry.name);
        }
      } else {
        const reviewQueue = page.locator('[aria-label="Procedure report review queue"]');
        for (const entry of entries) {
          await expect(reviewQueue).toContainText(entry.name);
          await expect(reviewQueue).toContainText("admin");
          await expect(reviewQueue).toContainText(bulkSignedAtDisplay);
        }
      }
    } finally {
      for (const orderId of procedureOrderIds) {
        await workflow.deleteProcedureOrderCascade(orderId);
      }
      if (encounterId !== null) {
        await workflow.deleteEncounter(encounterId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.procedureOrders).toBe(beforeCounts.procedureOrders);
    for (const orderId of procedureOrderIds) {
      await expect(workflow.getProcedureOrder(orderId)).resolves.toBeNull();
    }
    for (const reportId of procedureReportIds) {
      await expect(workflow.getProcedureReport(reportId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-12) || "local";
}
