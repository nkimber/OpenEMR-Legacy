import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureReportReviewQueueDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedProcedures } from "../../src/ui/modernizedOpenEmr.js";

const assignmentAnchorPatientId = "MOD-PAT-0009";
const orderDate = "2026-06-22";
const assignedAt = "2026-06-22 09:40:00";
const assignedAtDisplay = "2026-06-22 09:40";

test.describe("procedure report review assignment parity @slice599 @workflow-procedure-report-review-assignment @mutation", () => {
  test("assigns a temporary lab report reviewer and keeps it in the unreviewed queue", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(assignmentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Missing seeded procedure report assignment patient ${assignmentAnchorPatientId}`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Report Assignment ${suffix}`;
    const specimenNumber = `RPASSIGN${suffix.slice(-4)}`;
    const encounterPayload = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateTime: "2026-06-22 09:00:00",
      reason: `Parity Report Assignment Encounter ${suffix}`,
      facilityId: 10,
      facilityName: "OpenEMR Modernization Clinic",
      billingFacilityId: 10,
      sensitivity: "normal",
      referralSource: "Parity suite",
      externalId: `RPA${suffix.slice(-8)}`,
      posCode: 11,
      billingNote: "Procedure report reviewer assignment workflow test encounter."
    };
    const orderPayload = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateOrdered: orderDate,
      priority: "routine",
      status: "complete",
      procedureCode: "80053",
      procedureName,
      procedureType: "laboratory",
      diagnosis: "Z00.00",
      instructions: "Created by the parity procedure report reviewer assignment suite."
    };
    const reportPayload = {
      dateCollected: "2026-06-22 09:15:00",
      dateReport: "2026-06-22 09:30:00",
      specimenNumber,
      reportStatus: "final",
      reviewStatus: "received",
      notes: "Report is awaiting reviewer assignment."
    };
    const assignmentPayload = {
      assignedTo: "admin",
      assignedAt
    };
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-599-procedure-report-review-assignment-precondition",
      description:
        "Temporary procedure report reviewer-assignment inputs before creating a received lab report.",
      expected: {
        anchorPatientCanonicalId: assignmentAnchorPatientId,
        orderDate,
        assignedAt,
        assignedAtDisplay,
        reportReviewStatusBeforeAssignment: "received",
        reportReviewStatusAfterAssignment: "assigned",
        assignedReviewer: "admin"
      },
      actual: {
        patient,
        beforeCounts,
        encounterPayload,
        orderPayload,
        reportPayload,
        assignmentPayload,
        target: target.type
      }
    });

    try {
      encounterId = await workflow.createEncounter(encounterPayload);
      const encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      procedureOrderId = await workflow.createProcedureOrder({
        ...orderPayload,
        encounterId: encounter!.encounter
      });

      procedureReportId = await workflow.createProcedureReport({
        orderId: procedureOrderId,
        ...reportPayload
      });

      const receivedReport = await workflow.getProcedureReport(procedureReportId);
      expect(receivedReport).toMatchObject({
        orderId: procedureOrderId,
        dateCollected: "2026-06-22",
        dateReport: "2026-06-22",
        specimenNumber,
        reportStatus: "final",
        reviewStatus: "received",
        reviewedBy: "",
        reviewedAt: "",
        reportNotes: "Report is awaiting reviewer assignment."
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-599-procedure-report-review-assignment-created",
        description:
          "Temporary encounter, completed procedure order, and received report exist before reviewer assignment.",
        expected: {
          report: {
            id: procedureReportId,
            reviewStatus: "received",
            reviewedBy: "",
            reviewedAt: "",
            specimenNumber
          }
        },
        actual: {
          encounter,
          order: await workflow.getProcedureOrder(procedureOrderId),
          report: receivedReport
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.assignProcedureReportReviewer(procedureReportId, assignmentPayload);
        await loginToLegacyOpenEmr(page, target);
        await openProcedureReportReviewQueueDirect(page, target, patient.pid, orderDate, orderDate, "3");
        await expectRenderedText(page, procedureName);
      } else {
        await openAuthenticatedModernizedProcedures(page, target, patient.pubpid);
        const reportCard = page.locator(".procedure-report-card", { hasText: specimenNumber }).first();
        await expect(reportCard).toBeVisible();
        await reportCard.getByRole("button", { name: /Assign procedure report .* reviewer/i }).click();
        await expect(reportCard).toContainText("assigned");
        await expect(reportCard).toContainText("Assigned to admin");
        await expect(reportCard).toContainText(`Assigned ${assignedAtDisplay}`);
      }

      const assignedReport = await workflow.getProcedureReport(procedureReportId);
      expect(assignedReport).toMatchObject({
        orderId: procedureOrderId,
        dateCollected: "2026-06-22",
        dateReport: "2026-06-22",
        specimenNumber,
        reportStatus: "final",
        reviewStatus: "assigned",
        reviewedBy: "admin",
        reviewedAt: assignedAtDisplay,
        reportNotes: "Report is awaiting reviewer assignment."
      });

      const unreviewedQueue = await targetDb.getProcedureReportReviewQueue("unreviewed", {
        patientId: patient.pubpid,
        fromDate: orderDate,
        toDate: orderDate
      });
      expect(unreviewedQueue.reports.find((report) => report.reportId === procedureReportId)).toMatchObject({
        orderId: procedureOrderId,
        procedureName,
        reviewStatus: "assigned",
        reviewedBy: "admin",
        reviewedAt: assignedAtDisplay,
        specimenNumber
      });
      const reviewedQueue = await targetDb.getProcedureReportReviewQueue("reviewed", {
        patientId: patient.pubpid,
        fromDate: orderDate,
        toDate: orderDate
      });
      expect(reviewedQueue.reports.some((report) => report.reportId === procedureReportId)).toBe(false);

      const procedureSummary = await targetDb.getProcedureResultsForPatient(patient.pid);
      const assignedOrder = procedureSummary.orders.find((order) => order.id === procedureOrderId);
      expect(assignedOrder).not.toBeUndefined();
      expect(assignedOrder!.reports[0]).toMatchObject({
        specimenNumber,
        status: "final",
        reviewStatus: "assigned",
        reviewedBy: "admin",
        reviewedAt: assignedAtDisplay,
        reportNotes: "Report is awaiting reviewer assignment."
      });

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-599-procedure-report-review-assignment-assigned",
        description:
          "Reviewer assignment stores assigned status, assigned reviewer, and assignment timestamp while keeping the report in the unreviewed queue.",
        expected: {
          reportId: procedureReportId,
          orderId: procedureOrderId,
          reviewStatus: "assigned",
          reviewedBy: "admin",
          reviewedAt: assignedAtDisplay,
          unreviewedQueueContainsReport: true,
          reviewedQueueContainsReport: false
        },
        actual: {
          assignedReport,
          unreviewedQueue,
          reviewedQueue,
          assignedQueueReport: unreviewedQueue.reports.find((report) => report.reportId === procedureReportId),
          procedureSummary,
          assignedOrder
        }
      });
    } finally {
      if (procedureOrderId !== null) {
        await workflow.deleteProcedureOrderCascade(procedureOrderId);
      }
      if (encounterId !== null) {
        await workflow.deleteEncounter(encounterId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.procedureOrders).toBe(beforeCounts.procedureOrders);
    if (procedureOrderId !== null) {
      await expect(workflow.getProcedureOrder(procedureOrderId)).resolves.toBeNull();
    }
    if (procedureReportId !== null) {
      await expect(workflow.getProcedureReport(procedureReportId)).resolves.toBeNull();
    }
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-599-procedure-report-review-assignment-cleanup",
      description:
        "Temporary encounter/order/report cleanup restores patient workflow counts and removes reviewer-assignment rows.",
      expected: {
        restoredEncounterCount: beforeCounts.encounters,
        restoredProcedureOrderCount: beforeCounts.procedureOrders,
        deletedOrder: null,
        deletedReport: null
      },
      actual: {
        beforeCounts,
        afterCleanupCounts,
        procedureOrderId,
        procedureReportId,
        deletedOrder: procedureOrderId === null ? null : await workflow.getProcedureOrder(procedureOrderId),
        deletedReport: procedureReportId === null ? null : await workflow.getProcedureReport(procedureReportId)
      }
    });
  });
});

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-12) || "local";
}
