import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureReportReviewQueueDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedReports } from "../../src/ui/modernizedOpenEmr.js";

const reviewQueueFilterPatientId = "MOD-PAT-0009";
const orderDate = "2026-06-21";
const outsideDate = "2026-06-20";
const reportDateTime = "2026-06-21 09:15:00";
const reportDateDisplay = "2026-06-21 09:15";

test.describe("procedure report review queue filter parity @slice136 @workflow-procedure-report-review-queue-filters @mutation", () => {
  test("filters procedure report review queue by patient and order date", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(reviewQueueFilterPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Missing seeded procedure report review filter patient ${reviewQueueFilterPatientId}`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeMatchingUnreviewedQueue = await targetDb.getProcedureReportReviewQueue("unreviewed", {
      patientId: String(patient.pid),
      fromDate: orderDate,
      toDate: orderDate
    });
    const beforeOutsideDateQueue = await targetDb.getProcedureReportReviewQueue("unreviewed", {
      patientId: String(patient.pid),
      fromDate: outsideDate,
      toDate: outsideDate
    });
    const suffix = workflowSuffix();
    const procedureName = `Parity Queue Filter ${suffix}`;
    const specimenNumber = `RF${suffix.slice(-8)}`;
    const encounterInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateTime: "2026-06-21 09:00:00",
      reason: `Parity Queue Filter Encounter ${suffix}`,
      facilityId: 10,
      facilityName: "OpenEMR Modernization Clinic",
      billingFacilityId: 10,
      sensitivity: "normal",
      referralSource: "Parity suite",
      externalId: `RQF${suffix.slice(-8)}`,
      posCode: 11,
      billingNote: "Procedure report review queue filter workflow test encounter."
    };
    const procedureOrderInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateOrdered: orderDate,
      priority: "routine",
      status: "complete",
      procedureCode: "80053",
      procedureName,
      procedureType: "laboratory",
      diagnosis: "Z00.00",
      instructions: "Created by the parity procedure report review queue filter suite."
    };
    const procedureReportInput = {
      dateCollected: "2026-06-21 09:05:00",
      dateReport: reportDateTime,
      specimenNumber,
      reportStatus: "final",
      reviewStatus: "received",
      notes: "Queued for filtered review."
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
    let matchingBeforeReview: Awaited<ReturnType<typeof targetDb.getProcedureReportReviewQueue>>["reports"][number] | undefined;
    let matchingAfterReview: Awaited<ReturnType<typeof targetDb.getProcedureReportReviewQueue>>["reports"][number] | undefined;
    let surfaceFacts: Record<string, unknown> = {};

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-136-procedure-report-review-filters-precondition",
      description:
        "Seeded patient, baseline patient/date-filtered queues, and proposed temporary encounter/order/report/sign-off payload before review filter checks.",
      expected: {
        patientCanonicalId: reviewQueueFilterPatientId,
        matchingFilter: {
          patientId: String(patient.pid),
          fromDate: orderDate,
          toDate: orderDate
        },
        outsideDateFilter: {
          patientId: String(patient.pid),
          fromDate: outsideDate,
          toDate: outsideDate
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
        beforeMatchingUnreviewedQueue,
        beforeOutsideDateQueue,
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
        dateCollected: orderDate,
        dateReport: orderDate,
        specimenNumber,
        reportStatus: "final",
        reviewStatus: "received",
        reportNotes: "Queued for filtered review."
      });

      const matchingUnreviewedQueue = await targetDb.getProcedureReportReviewQueue("unreviewed", {
        patientId: String(patient.pid),
        fromDate: orderDate,
        toDate: orderDate
      });
      expect(matchingUnreviewedQueue.patientFilter).toBe(String(patient.pid));
      matchingBeforeReview = matchingUnreviewedQueue.reports.find((report) => report.reportId === procedureReportId);
      expect(matchingBeforeReview).toMatchObject({
        orderId: procedureOrderId,
        patientId: patient.pid,
        pubpid: patient.pubpid,
        procedureName,
        orderDate,
        reportDate: reportDateDisplay,
        reportStatus: "final",
        reviewStatus: "received",
        specimenNumber
      });

      const outsideDateQueue = await targetDb.getProcedureReportReviewQueue("unreviewed", {
        patientId: String(patient.pid),
        fromDate: outsideDate,
        toDate: outsideDate
      });
      expect(outsideDateQueue.reports.some((report) => report.reportId === procedureReportId)).toBe(false);
      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterCreateCounts.procedureOrders).toBe(beforeCounts.procedureOrders + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-136-procedure-report-review-filters-matched",
        description:
          "Temporary received report appears under the matching patient/date unreviewed queue filter and is excluded by the outside-date filter.",
        expected: {
          matchingFilter: {
            patientFilter: String(patient.pid),
            fromDate: orderDate,
            toDate: orderDate,
            containsTemporaryReport: true
          },
          outsideDateFilter: {
            fromDate: outsideDate,
            toDate: outsideDate,
            containsTemporaryReport: false
          },
          counts: {
            encounters: beforeCounts.encounters + 1,
            procedureOrders: beforeCounts.procedureOrders + 1
          }
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
          matchingUnreviewedQueue,
          matchingBeforeReview,
          outsideDateQueue
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureReportReviewQueueDirect(page, target, patient.pid, orderDate, orderDate, "3");
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, patient.pubpid);
        surfaceFacts = {
          legacyMatchingUnreviewedQueue: {
            patientPid: patient.pid,
            fromDate: orderDate,
            toDate: orderDate,
            reviewStatusFilter: "3",
            renderedProcedureName: procedureName,
            renderedPatientPubpid: patient.pubpid
          }
        };
      } else {
        await openAuthenticatedModernizedReports(page, target);
        const reviewQueue = page.locator('[aria-label="Procedure report review queue"]');
        await reviewQueue.getByLabel("Patient").fill(reviewQueueFilterPatientId);
        await reviewQueue.getByLabel("From").fill(orderDate);
        await reviewQueue.getByLabel("To").fill(orderDate);
        await expect(reviewQueue).toContainText(procedureName);
        await expect(reviewQueue).toContainText(patient.pubpid);

        await reviewQueue.getByLabel("From").fill(outsideDate);
        await reviewQueue.getByLabel("To").fill(outsideDate);
        await expect(reviewQueue).not.toContainText(procedureName);
        await reviewQueue.getByLabel("From").fill(orderDate);
        await reviewQueue.getByLabel("To").fill(orderDate);
        await expect(reviewQueue).toContainText(procedureName);
        surfaceFacts = {
          modernizedMatchingUnreviewedQueue: {
            patientInput: reviewQueueFilterPatientId,
            fromDate: orderDate,
            toDate: orderDate,
            outsideDate,
            renderedProcedureName: procedureName,
            renderedPatientPubpid: patient.pubpid,
            outsideDateExcludedProcedureName: true
          }
        };
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-136-procedure-report-review-filters-rendered",
        description:
          "Browser/API surface evidence for patient/date filter inclusion and outside-date exclusion while the report is unreviewed.",
        expected: {
          matchingFilterRendersProcedure: true,
          matchingFilterRendersPatient: patient.pubpid,
          outsideDateExcludesProcedure: true
        },
        actual: {
          patient,
          procedureOrderId,
          procedureReportId,
          matchingBeforeReview,
          surfaceFacts
        }
      });

      await workflow.signProcedureReport(procedureReportId, signOffInput);
      signedReport = await workflow.getProcedureReport(procedureReportId);
      expect(signedReport).toMatchObject({
        orderId: procedureOrderId,
        reviewStatus: "reviewed",
        reviewedBy: "admin",
        reviewedAt: reportDateDisplay,
        reportNotes: "Queued for filtered review."
      });

      const matchingReviewedQueue = await targetDb.getProcedureReportReviewQueue("reviewed", {
        patientId: String(patient.pid),
        fromDate: orderDate,
        toDate: orderDate
      });
      matchingAfterReview = matchingReviewedQueue.reports.find((report) => report.reportId === procedureReportId);
      expect(matchingAfterReview).toMatchObject({
        procedureName,
        reviewStatus: "reviewed",
        reviewedBy: "admin",
        reviewedAt: reportDateDisplay
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-136-procedure-report-review-filters-reviewed",
        description:
          "Temporary report appears under the matching patient/date reviewed queue filter after sign-off with reviewer and timestamp facts.",
        expected: {
          matchingReviewedFilter: {
            patientFilter: String(patient.pid),
            fromDate: orderDate,
            toDate: orderDate,
            reviewStatus: "reviewed",
            reviewedBy: "admin",
            reviewedAt: reportDateDisplay
          }
        },
        actual: {
          patient,
          procedureOrderId,
          procedureReportId,
          signedReport,
          matchingReviewedQueue,
          matchingAfterReview,
          signOffInput
        }
      });

      if (target.type === "legacy-openemr") {
        await openProcedureReportReviewQueueDirect(page, target, patient.pid, orderDate, orderDate, "2");
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, patient.pubpid);
        surfaceFacts = {
          ...surfaceFacts,
          legacyMatchingReviewedQueue: {
            patientPid: patient.pid,
            fromDate: orderDate,
            toDate: orderDate,
            reviewStatusFilter: "2",
            renderedProcedureName: procedureName,
            renderedPatientPubpid: patient.pubpid
          }
        };
      } else {
        const reviewQueue = page.locator('[aria-label="Procedure report review queue"]');
        await page.getByRole("button", { name: "Reviewed", exact: true }).click();
        await expect(reviewQueue).toContainText(procedureName);
        await expect(reviewQueue).toContainText("admin");
        await expect(reviewQueue).toContainText(reportDateDisplay);
        surfaceFacts = {
          ...surfaceFacts,
          modernizedMatchingReviewedQueue: {
            tab: "Reviewed",
            renderedProcedureName: procedureName,
            renderedReviewer: "admin",
            renderedReviewedAt: reportDateDisplay
          }
        };
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-136-procedure-report-review-filters-reviewed-rendered",
        description:
          "Browser/API surface evidence for the matching patient/date reviewed queue after sign-off.",
        expected: {
          matchingFilterRendersProcedure: true,
          renderedReviewer: "admin",
          renderedReviewedAt: reportDateDisplay
        },
        actual: {
          patient,
          procedureOrderId,
          procedureReportId,
          matchingAfterReview,
          signedReport,
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
    const afterCleanupMatchingQueue = await targetDb.getProcedureReportReviewQueue("unreviewed", {
      patientId: String(patient.pid),
      fromDate: orderDate,
      toDate: orderDate
    });
    const afterCleanupReviewedQueue = await targetDb.getProcedureReportReviewQueue("reviewed", {
      patientId: String(patient.pid),
      fromDate: orderDate,
      toDate: orderDate
    });
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.procedureOrders).toBe(beforeCounts.procedureOrders);
    const deletedOrder = procedureOrderId !== null ? await workflow.getProcedureOrder(procedureOrderId) : null;
    const deletedReport = procedureReportId !== null ? await workflow.getProcedureReport(procedureReportId) : null;
    const unreviewedContainsDeletedReport =
      procedureReportId !== null
        ? afterCleanupMatchingQueue.reports.some((report) => report.reportId === procedureReportId)
        : false;
    const reviewedContainsDeletedReport =
      procedureReportId !== null
        ? afterCleanupReviewedQueue.reports.some((report) => report.reportId === procedureReportId)
        : false;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-136-procedure-report-review-filters-cleanup",
      description:
        "Temporary filtered review queue order/report tree and encounter were deleted, restoring counts and removing the report from filtered queues.",
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
        afterCleanupMatchingQueue,
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
