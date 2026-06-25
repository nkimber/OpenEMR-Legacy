import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(reviewQueueAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Missing seeded procedure report review queue patient ${reviewQueueAnchorPatientId}`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeUnreviewedQueue = await targetDb.getProcedureReportReviewQueue("unreviewed");
    const beforeReviewedQueue = await targetDb.getProcedureReportReviewQueue("reviewed");
    const suffix = workflowSuffix();
    const procedureName = `Parity Review Queue ${suffix}`;
    const specimenNumber = `RQ${suffix.slice(-8)}`;
    const encounterInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
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
    };
    const procedureOrderInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateOrdered: "2026-06-21",
      priority: "routine",
      status: "complete",
      procedureCode: "80053",
      procedureName,
      procedureType: "laboratory",
      diagnosis: "Z00.00",
      instructions: "Created by the parity procedure report review queue suite."
    };
    const procedureReportInput = {
      dateCollected: "2026-06-21 08:30:00",
      dateReport: reportDateTime,
      specimenNumber,
      reportStatus: "final",
      reviewStatus: "received",
      notes: "Queued for focused report review."
    };
    const signOffInput = {
      reviewedBy: "admin",
      reviewedAt: reportDateTime
    };
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;
    let encounter: Awaited<ReturnType<typeof workflow.getEncounter>> = null;
    let createdOrder: Awaited<ReturnType<typeof workflow.getProcedureOrder>> = null;
    let createdReport: Awaited<ReturnType<typeof workflow.getProcedureReport>> = null;
    let signedReport: Awaited<ReturnType<typeof workflow.getProcedureReport>> = null;
    let queuedBeforeReview: Awaited<ReturnType<typeof targetDb.getProcedureReportReviewQueue>>["reports"][number] | undefined;
    let queuedAfterReview: Awaited<ReturnType<typeof targetDb.getProcedureReportReviewQueue>>["reports"][number] | undefined;
    let surfaceFacts: Record<string, unknown> = {};

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-135-procedure-report-review-queue-precondition",
      description:
        "Seeded patient, baseline workflow counts, baseline review queues, and proposed temporary encounter/order/report/sign-off payload before review queue movement.",
      expected: {
        patientCanonicalId: reviewQueueAnchorPatientId,
        create: {
          encounter: {
            facilityId: 10,
            billingFacilityId: 10,
            posCode: 11,
            sensitivity: "normal"
          },
          order: {
            status: "complete",
            priority: "routine",
            procedureCode: "80053",
            procedureType: "laboratory",
            diagnosis: "Z00.00"
          },
          report: {
            dateCollected: "2026-06-21",
            reportDate: reportDateDisplay,
            specimenNumber,
            reportStatus: "final",
            reviewStatus: "received",
            reviewedBy: "",
            reviewedAt: ""
          },
          signOff: {
            reviewedBy: "admin",
            reviewedAt: reportDateDisplay,
            reviewStatus: "reviewed"
          }
        },
        countChange: {
          encountersAfterCreate: beforeCounts.encounters + 1,
          procedureOrdersAfterCreate: beforeCounts.procedureOrders + 1,
          encountersAfterCleanup: beforeCounts.encounters,
          procedureOrdersAfterCleanup: beforeCounts.procedureOrders
        }
      },
      actual: {
        patient,
        beforeCounts,
        beforeUnreviewedQueue,
        beforeReviewedQueue,
        proposed: {
          encounter: encounterInput,
          order: procedureOrderInput,
          report: procedureReportInput,
          signOff: signOffInput
        }
      }
    });

    try {
      encounterId = await workflow.createEncounter(encounterInput);
      encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      procedureOrderId = await workflow.createProcedureOrder({
        encounterId: encounter!.encounter,
        ...procedureOrderInput
      });
      createdOrder = await workflow.getProcedureOrder(procedureOrderId);
      expect(createdOrder).toMatchObject({
        patientId: patient.pid,
        encounterId: encounter!.encounter,
        orderStatus: "complete",
        orderPriority: "routine",
        procedureCode: "80053",
        procedureName,
        procedureType: "laboratory"
      });

      procedureReportId = await workflow.createProcedureReport({
        orderId: procedureOrderId,
        ...procedureReportInput
      });
      createdReport = await workflow.getProcedureReport(procedureReportId);
      expect(createdReport).toMatchObject({
        orderId: procedureOrderId,
        dateCollected: "2026-06-21",
        dateReport: "2026-06-21",
        specimenNumber,
        reportStatus: "final",
        reviewStatus: "received",
        reportNotes: "Queued for focused report review."
      });

      const unreviewedQueue = await targetDb.getProcedureReportReviewQueue("unreviewed");
      queuedBeforeReview = unreviewedQueue.reports.find((report) => report.reportId === procedureReportId);
      expect(queuedBeforeReview).toMatchObject({
        orderId: procedureOrderId,
        patientId: patient.pid,
        pubpid: patient.pubpid,
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
      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterCreateCounts.procedureOrders).toBe(beforeCounts.procedureOrders + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-135-procedure-report-review-queue-unreviewed",
        description:
          "Temporary report appears in the unreviewed procedure report review queue and is absent from the reviewed queue before sign-off.",
        expected: {
          counts: {
            encounters: beforeCounts.encounters + 1,
            procedureOrders: beforeCounts.procedureOrders + 1
          },
          unreviewedQueueRow: {
            orderId: procedureOrderId,
            patientId: patient.pid,
            pubpid: patient.pubpid,
            procedureCode: "80053",
            procedureName,
            reportDate: reportDateDisplay,
            reportStatus: "final",
            reviewStatus: "received",
            reviewedBy: "",
            reviewedAt: "",
            specimenNumber,
            notes: "Queued for focused report review."
          },
          reviewedQueueContainsTemporaryReport: false
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          encounterId,
          encounter,
          procedureOrderId,
          createdOrder,
          procedureReportId,
          createdReport,
          unreviewedQueue,
          reviewedQueueBefore,
          queuedBeforeReview
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureReportReviewQueueDirect(page, target, patient.pid, "2026-06-21", "2026-06-21", "3");
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, patient.pubpid);
        surfaceFacts = {
          legacyUnreviewedQueue: {
            page: "Procedure Report Review Queue",
            reviewStatusFilter: "3",
            patientPid: patient.pid,
            renderedProcedureName: procedureName,
            renderedPatientPubpid: patient.pubpid
          }
        };
      } else {
        await openAuthenticatedModernizedReports(page, target);
        const reviewQueue = page.locator('[aria-label="Procedure report review queue"]');
        await expect(reviewQueue).toContainText(procedureName);
        await expect(reviewQueue).toContainText(patient.pubpid);
        await expect(reviewQueue).toContainText("received");
        surfaceFacts = {
          modernizedUnreviewedQueue: {
            page: "reports",
            queueRegion: "Procedure report review queue",
            renderedProcedureName: procedureName,
            renderedPatientPubpid: patient.pubpid,
            renderedReviewStatus: "received"
          }
        };
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-135-procedure-report-review-queue-unreviewed-rendered",
        description:
          "Browser/API surface evidence for the temporary report while it is still in the unreviewed review queue.",
        expected: {
          queue: "unreviewed",
          renderedProcedureName: procedureName,
          renderedPatientPubpid: patient.pubpid,
          renderedReviewStatus: "received"
        },
        actual: {
          patient,
          procedureOrderId,
          procedureReportId,
          createdReport,
          queuedBeforeReview,
          surfaceFacts
        }
      });

      await workflow.signProcedureReport(procedureReportId, signOffInput);
      signedReport = await workflow.getProcedureReport(procedureReportId);
      expect(signedReport).toMatchObject({
        orderId: procedureOrderId,
        dateCollected: "2026-06-21",
        dateReport: "2026-06-21",
        specimenNumber,
        reportStatus: "final",
        reviewStatus: "reviewed",
        reviewedBy: "admin",
        reviewedAt: reportDateDisplay,
        reportNotes: "Queued for focused report review."
      });

      const reviewedQueueAfter = await targetDb.getProcedureReportReviewQueue("reviewed");
      queuedAfterReview = reviewedQueueAfter.reports.find((report) => report.reportId === procedureReportId);
      expect(queuedAfterReview).toMatchObject({
        orderId: procedureOrderId,
        patientId: patient.pid,
        pubpid: patient.pubpid,
        procedureName,
        reportStatus: "final",
        reviewStatus: "reviewed",
        reviewedBy: "admin",
        reviewedAt: reportDateDisplay,
        specimenNumber
      });

      const unreviewedQueueAfter = await targetDb.getProcedureReportReviewQueue("unreviewed");
      expect(unreviewedQueueAfter.reports.some((report) => report.reportId === procedureReportId)).toBe(false);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-135-procedure-report-review-queue-reviewed",
        description:
          "Temporary report moves into the reviewed procedure report review queue after sign-off and is removed from the unreviewed queue.",
        expected: {
          reviewedQueueRow: {
            orderId: procedureOrderId,
            patientId: patient.pid,
            pubpid: patient.pubpid,
            procedureName,
            reportStatus: "final",
            reviewStatus: "reviewed",
            reviewedBy: "admin",
            reviewedAt: reportDateDisplay,
            specimenNumber
          },
          unreviewedQueueContainsTemporaryReport: false
        },
        actual: {
          patient,
          procedureOrderId,
          procedureReportId,
          createdReport,
          signedReport,
          reviewedQueueAfter,
          queuedAfterReview,
          unreviewedQueueAfter,
          signOffInput
        }
      });

      if (target.type === "legacy-openemr") {
        await openProcedureReportReviewQueueDirect(page, target, patient.pid, "2026-06-21", "2026-06-21", "2");
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, patient.pubpid);
        surfaceFacts = {
          ...surfaceFacts,
          legacyReviewedQueue: {
            page: "Procedure Report Review Queue",
            reviewStatusFilter: "2",
            patientPid: patient.pid,
            renderedProcedureName: procedureName,
            renderedPatientPubpid: patient.pubpid
          }
        };
      } else {
        await page.getByRole("button", { name: "Reviewed", exact: true }).click();
        const reviewQueue = page.locator('[aria-label="Procedure report review queue"]');
        await expect(reviewQueue).toContainText(procedureName);
        await expect(reviewQueue).toContainText("admin");
        await expect(reviewQueue).toContainText(reportDateDisplay);
        surfaceFacts = {
          ...surfaceFacts,
          modernizedReviewedQueue: {
            page: "reports",
            queueRegion: "Procedure report review queue",
            renderedProcedureName: procedureName,
            renderedReviewer: "admin",
            renderedReviewedAt: reportDateDisplay
          }
        };
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-135-procedure-report-review-queue-reviewed-rendered",
        description:
          "Browser/API surface evidence for the temporary report after it moves to the reviewed review queue.",
        expected: {
          queue: "reviewed",
          renderedProcedureName: procedureName,
          renderedReviewer: "admin",
          renderedReviewedAt: reportDateDisplay
        },
        actual: {
          patient,
          procedureOrderId,
          procedureReportId,
          signedReport,
          queuedAfterReview,
          surfaceFacts
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
    const afterCleanupUnreviewedQueue = await targetDb.getProcedureReportReviewQueue("unreviewed");
    const afterCleanupReviewedQueue = await targetDb.getProcedureReportReviewQueue("reviewed");
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.procedureOrders).toBe(beforeCounts.procedureOrders);
    const deletedOrder = procedureOrderId !== null ? await workflow.getProcedureOrder(procedureOrderId) : null;
    const deletedReport = procedureReportId !== null ? await workflow.getProcedureReport(procedureReportId) : null;
    const unreviewedContainsDeletedReport =
      procedureReportId !== null
        ? afterCleanupUnreviewedQueue.reports.some((report) => report.reportId === procedureReportId)
        : false;
    const reviewedContainsDeletedReport =
      procedureReportId !== null
        ? afterCleanupReviewedQueue.reports.some((report) => report.reportId === procedureReportId)
        : false;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-135-procedure-report-review-queue-cleanup",
      description:
        "Temporary review-queue order/report tree and temporary encounter were deleted, restoring counts and removing the report from both review queues.",
      expected: {
        counts: {
          encounters: beforeCounts.encounters,
          procedureOrders: beforeCounts.procedureOrders
        },
        deletedOrder: null,
        deletedReport: null,
        unreviewedContainsDeletedReport: false,
        reviewedContainsDeletedReport: false
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        encounterId,
        procedureOrderId,
        procedureReportId,
        deletedOrder,
        deletedReport,
        afterCleanupUnreviewedQueue,
        afterCleanupReviewedQueue,
        unreviewedContainsDeletedReport,
        reviewedContainsDeletedReport
      }
    });
    if (procedureOrderId !== null) {
      expect(deletedOrder).toBeNull();
    }
    if (procedureReportId !== null) {
      expect(deletedReport).toBeNull();
    }
  });
});

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-12) || "local";
}
