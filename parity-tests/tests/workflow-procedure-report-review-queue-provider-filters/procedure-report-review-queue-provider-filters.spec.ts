import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(reviewQueueProviderFilterPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Missing seeded procedure report review provider-filter patient ${reviewQueueProviderFilterPatientId}`);
    }

    const providerId = patient.providerId || 101;
    const outsideProviderId = providerId === 101 ? 102 : 101;
    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeMatchingUnreviewedQueue = await targetDb.getProcedureReportReviewQueue("unreviewed", {
      patientId: String(patient.pid),
      providerId,
      fromDate: orderDate,
      toDate: orderDate
    });
    const beforeOutsideProviderQueue = await targetDb.getProcedureReportReviewQueue("unreviewed", {
      patientId: String(patient.pid),
      providerId: outsideProviderId,
      fromDate: orderDate,
      toDate: orderDate
    });
    const suffix = workflowSuffix();
    const procedureName = `Parity Queue Provider ${suffix}`;
    const specimenNumber = `RP${suffix.slice(-8)}`;
    const encounterInput = {
      patientId: patient.pid,
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
    };
    const procedureOrderInput = {
      patientId: patient.pid,
      providerId,
      dateOrdered: orderDate,
      priority: "routine",
      status: "complete",
      procedureCode: "80053",
      procedureName,
      procedureType: "laboratory",
      diagnosis: "Z00.00",
      instructions: "Created by the parity procedure report review queue provider filter suite."
    };
    const procedureReportInput = {
      dateCollected: "2026-06-21 10:05:00",
      dateReport: reportDateTime,
      specimenNumber,
      reportStatus: "final",
      reviewStatus: "received",
      notes: "Queued for provider-filtered review."
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
      probe: "slice-137-procedure-report-review-provider-filters-precondition",
      description:
        "Seeded patient, baseline provider-filtered queues, and proposed temporary encounter/order/report/sign-off payload before provider filter checks.",
      expected: {
        patientCanonicalId: reviewQueueProviderFilterPatientId,
        matchingFilter: {
          patientId: String(patient.pid),
          providerId,
          fromDate: orderDate,
          toDate: orderDate
        },
        outsideProviderFilter: {
          patientId: String(patient.pid),
          providerId: outsideProviderId,
          fromDate: orderDate,
          toDate: orderDate
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
        beforeOutsideProviderQueue,
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
        reportNotes: "Queued for provider-filtered review."
      });

      const matchingUnreviewedQueue = await targetDb.getProcedureReportReviewQueue("unreviewed", {
        patientId: String(patient.pid),
        providerId,
        fromDate: orderDate,
        toDate: orderDate
      });
      expect(matchingUnreviewedQueue.providerFilter).toBe(String(providerId));
      matchingBeforeReview = matchingUnreviewedQueue.reports.find((report) => report.reportId === procedureReportId);
      expect(matchingBeforeReview).toMatchObject({
        orderId: procedureOrderId,
        patientId: patient.pid,
        pubpid: patient.pubpid,
        providerId,
        procedureName,
        orderDate,
        reportDate: reportDateDisplay,
        reportStatus: "final",
        reviewStatus: "received",
        specimenNumber
      });

      const outsideProviderQueue = await targetDb.getProcedureReportReviewQueue("unreviewed", {
        patientId: String(patient.pid),
        providerId: outsideProviderId,
        fromDate: orderDate,
        toDate: orderDate
      });
      expect(outsideProviderQueue.reports.some((report) => report.reportId === procedureReportId)).toBe(false);
      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterCreateCounts.procedureOrders).toBe(beforeCounts.procedureOrders + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-137-procedure-report-review-provider-filters-matched",
        description:
          "Temporary received report appears under the matching provider-filtered unreviewed queue and is excluded by the alternate-provider filter.",
        expected: {
          matchingFilter: {
            providerFilter: String(providerId),
            patientId: String(patient.pid),
            fromDate: orderDate,
            toDate: orderDate,
            containsTemporaryReport: true
          },
          outsideProviderFilter: {
            providerId: outsideProviderId,
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
          outsideProviderQueue
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureReportReviewQueueDirect(page, target, patient.pid, orderDate, orderDate, "3", providerId);
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, patient.pubpid);
        surfaceFacts = {
          legacyMatchingUnreviewedQueue: {
            patientPid: patient.pid,
            providerId,
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
        surfaceFacts = {
          modernizedMatchingUnreviewedQueue: {
            patientInput: reviewQueueProviderFilterPatientId,
            providerId,
            outsideProviderId,
            fromDate: orderDate,
            toDate: orderDate,
            renderedProcedureName: procedureName,
            renderedProviderToken: `#${providerId}`,
            outsideProviderExcludedProcedureName: true
          }
        };
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-137-procedure-report-review-provider-filters-rendered",
        description:
          "Browser/API surface evidence for provider-filter inclusion and alternate-provider exclusion while the report is unreviewed.",
        expected: {
          matchingProviderRendersProcedure: true,
          matchingProviderRendersPatient: patient.pubpid,
          outsideProviderExcludesProcedure: true
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
        reportNotes: "Queued for provider-filtered review."
      });

      const matchingReviewedQueue = await targetDb.getProcedureReportReviewQueue("reviewed", {
        patientId: String(patient.pid),
        providerId,
        fromDate: orderDate,
        toDate: orderDate
      });
      matchingAfterReview = matchingReviewedQueue.reports.find((report) => report.reportId === procedureReportId);
      expect(matchingAfterReview).toMatchObject({
        procedureName,
        providerId,
        reviewStatus: "reviewed",
        reviewedBy: "admin",
        reviewedAt: reportDateDisplay
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-137-procedure-report-review-provider-filters-reviewed",
        description:
          "Temporary report appears under the matching provider-filtered reviewed queue after sign-off with reviewer and timestamp facts.",
        expected: {
          matchingReviewedFilter: {
            providerFilter: String(providerId),
            patientId: String(patient.pid),
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
        await openProcedureReportReviewQueueDirect(page, target, patient.pid, orderDate, orderDate, "2", providerId);
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, patient.pubpid);
        surfaceFacts = {
          ...surfaceFacts,
          legacyMatchingReviewedQueue: {
            patientPid: patient.pid,
            providerId,
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
        probe: "slice-137-procedure-report-review-provider-filters-reviewed-rendered",
        description:
          "Browser/API surface evidence for the matching provider-filtered reviewed queue after sign-off.",
        expected: {
          matchingProviderRendersProcedure: true,
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
      providerId,
      fromDate: orderDate,
      toDate: orderDate
    });
    const afterCleanupReviewedQueue = await targetDb.getProcedureReportReviewQueue("reviewed", {
      patientId: String(patient.pid),
      providerId,
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
      probe: "slice-137-procedure-report-review-provider-filters-cleanup",
      description:
        "Temporary provider-filtered review queue order/report tree and encounter were deleted, restoring counts and removing the report from filtered queues.",
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
