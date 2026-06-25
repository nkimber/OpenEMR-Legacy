import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureReportReviewQueueDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedReports } from "../../src/ui/modernizedOpenEmr.js";

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
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(reviewQueueLabFilterPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Missing seeded procedure report review lab-filter patient ${reviewQueueLabFilterPatientId}`);
    }

    const providerId = patient.providerId || 101;
    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Queue Lab ${suffix}`;
    const labName = `Parity Lab ${suffix}`;
    const outsideLabName = `Parity Outside Lab ${suffix}`;
    const specimenNumber = `RL${suffix.slice(-8)}`;
    const labProviderInput = {
      name: labName,
      npi: `PL${suffix.slice(-8)}`
    };
    const outsideLabProviderInput = {
      name: outsideLabName,
      npi: `PX${suffix.slice(-8)}`
    };
    const encounterInput = {
      patientId: patient.pid,
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
    };
    const procedureReportInput = {
      dateCollected: "2026-06-21 10:35:00",
      dateReport: reportDateTime,
      specimenNumber,
      reportStatus: "final",
      reviewStatus: "received",
      notes: "Queued for lab-filtered review."
    };
    const signOffInput = {
      reviewedBy: "admin",
      reviewedAt: reportDateTime
    };
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;
    let labId: number | null = null;
    let outsideLabId: number | null = null;
    let matchingLabId: number | null = null;
    let excludedLabId: number | null = null;
    let labProvider: Awaited<ReturnType<typeof workflow.getProcedureLabProvider>> = null;
    let outsideLabProvider: Awaited<ReturnType<typeof workflow.getProcedureLabProvider>> = null;
    let encounter: Awaited<ReturnType<typeof workflow.getEncounter>> = null;
    let createdOrder: Awaited<ReturnType<typeof workflow.getProcedureOrder>> = null;
    let createdReport: Awaited<ReturnType<typeof workflow.getProcedureReport>> = null;
    let signedReport: Awaited<ReturnType<typeof workflow.getProcedureReport>> = null;
    let matchingBeforeReview: Awaited<ReturnType<typeof targetDb.getProcedureReportReviewQueue>>["reports"][number] | undefined;
    let matchingAfterReview: Awaited<ReturnType<typeof targetDb.getProcedureReportReviewQueue>>["reports"][number] | undefined;
    let surfaceFacts: Record<string, unknown> = {};

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-138-procedure-report-review-lab-filters-precondition",
      description:
        "Seeded patient, baseline workflow counts, and proposed temporary lab providers, encounter, report, and sign-off payload before lab filter checks.",
      expected: {
        patientCanonicalId: reviewQueueLabFilterPatientId,
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
        proposed: {
          labProvider: labProviderInput,
          outsideLabProvider: outsideLabProviderInput,
          encounter: encounterInput,
          report: procedureReportInput,
          signOff: signOffInput
        }
      }
    });

    try {
      labId = await workflow.createProcedureLabProvider(labProviderInput);
      outsideLabId = await workflow.createProcedureLabProvider(outsideLabProviderInput);
      matchingLabId = labId;
      excludedLabId = outsideLabId;
      if (matchingLabId === null || excludedLabId === null) {
        throw new Error("Temporary lab providers were not created.");
      }
      labProvider = await workflow.getProcedureLabProvider(matchingLabId);
      outsideLabProvider = await workflow.getProcedureLabProvider(excludedLabId);
      expect(labProvider).toMatchObject({
        id: matchingLabId,
        name: labName,
        npi: labProviderInput.npi
      });
      expect(outsideLabProvider).toMatchObject({
        id: excludedLabId,
        name: outsideLabName,
        npi: outsideLabProviderInput.npi
      });

      encounterId = await workflow.createEncounter(encounterInput);
      encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      const procedureOrderInput = {
        patientId: patient.pid,
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
      };
      procedureOrderId = await workflow.createProcedureOrder({
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
        reportNotes: "Queued for lab-filtered review."
      });

      const matchingUnreviewedQueue = await targetDb.getProcedureReportReviewQueue("unreviewed", {
        patientId: String(patient.pid),
        labId: matchingLabId,
        fromDate: orderDate,
        toDate: orderDate
      });
      expect(matchingUnreviewedQueue.labFilter).toBe(String(matchingLabId));
      matchingBeforeReview = matchingUnreviewedQueue.reports.find((report) => report.reportId === procedureReportId);
      expect(matchingBeforeReview).toMatchObject({
        orderId: procedureOrderId,
        patientId: patient.pid,
        pubpid: patient.pubpid,
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
        patientId: String(patient.pid),
        labId: excludedLabId,
        fromDate: orderDate,
        toDate: orderDate
      });
      expect(outsideLabQueue.reports.some((report) => report.reportId === procedureReportId)).toBe(false);
      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterCreateCounts.procedureOrders).toBe(beforeCounts.procedureOrders + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-138-procedure-report-review-lab-filters-matched",
        description:
          "Temporary received report appears under the matching lab-filtered unreviewed queue and is excluded by the alternate-lab filter.",
        expected: {
          matchingFilter: {
            labFilter: String(matchingLabId),
            patientId: String(patient.pid),
            fromDate: orderDate,
            toDate: orderDate,
            containsTemporaryReport: true
          },
          outsideLabFilter: {
            labId: excludedLabId,
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
          labId: matchingLabId,
          outsideLabId: excludedLabId,
          labProvider,
          outsideLabProvider,
          encounterId,
          encounter,
          procedureOrderId,
          createdOrder,
          procedureReportId,
          createdReport,
          matchingUnreviewedQueue,
          matchingBeforeReview,
          outsideLabQueue
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureReportReviewQueueDirect(page, target, patient.pid, orderDate, orderDate, "3", undefined, matchingLabId);
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, patient.pubpid);
        surfaceFacts = {
          legacyMatchingUnreviewedQueue: {
            patientPid: patient.pid,
            labId: matchingLabId,
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
        surfaceFacts = {
          modernizedMatchingUnreviewedQueue: {
            patientInput: reviewQueueLabFilterPatientId,
            labId: matchingLabId,
            excludedLabId,
            fromDate: orderDate,
            toDate: orderDate,
            renderedProcedureName: procedureName,
            renderedLabName: labName,
            renderedLabToken: `#${matchingLabId}`,
            outsideLabExcludedProcedureName: true
          }
        };
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-138-procedure-report-review-lab-filters-rendered",
        description:
          "Browser/API surface evidence for lab-filter inclusion and alternate-lab exclusion while the report is unreviewed.",
        expected: {
          matchingLabRendersProcedure: true,
          matchingLabRendersPatient: patient.pubpid,
          matchingLabRendersLabName: labName,
          outsideLabExcludesProcedure: true
        },
        actual: {
          patient,
          labId: matchingLabId,
          outsideLabId: excludedLabId,
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
        reportNotes: "Queued for lab-filtered review."
      });

      const matchingReviewedQueue = await targetDb.getProcedureReportReviewQueue("reviewed", {
        patientId: String(patient.pid),
        labId: matchingLabId,
        fromDate: orderDate,
        toDate: orderDate
      });
      matchingAfterReview = matchingReviewedQueue.reports.find((report) => report.reportId === procedureReportId);
      expect(matchingAfterReview).toMatchObject({
        procedureName,
        labId: matchingLabId,
        labName,
        reviewStatus: "reviewed",
        reviewedBy: "admin",
        reviewedAt: reportDateDisplay
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-138-procedure-report-review-lab-filters-reviewed",
        description:
          "Temporary report appears under the matching lab-filtered reviewed queue after sign-off with reviewer and timestamp facts.",
        expected: {
          matchingReviewedFilter: {
            labFilter: String(matchingLabId),
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
          labId: matchingLabId,
          labProvider,
          procedureOrderId,
          procedureReportId,
          signedReport,
          matchingReviewedQueue,
          matchingAfterReview,
          signOffInput
        }
      });

      if (target.type === "legacy-openemr") {
        await openProcedureReportReviewQueueDirect(page, target, patient.pid, orderDate, orderDate, "2", undefined, matchingLabId);
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, patient.pubpid);
        surfaceFacts = {
          ...surfaceFacts,
          legacyMatchingReviewedQueue: {
            patientPid: patient.pid,
            labId: matchingLabId,
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
        probe: "slice-138-procedure-report-review-lab-filters-reviewed-rendered",
        description:
          "Browser/API surface evidence for the matching lab-filtered reviewed queue after sign-off.",
        expected: {
          matchingLabRendersProcedure: true,
          renderedReviewer: "admin",
          renderedReviewedAt: reportDateDisplay
        },
        actual: {
          patient,
          labId: matchingLabId,
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
      if (outsideLabId !== null) {
        await workflow.deleteProcedureLabProvider(outsideLabId);
      }
      if (labId !== null) {
        await workflow.deleteProcedureLabProvider(labId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const afterCleanupMatchingQueue =
      matchingLabId !== null
        ? await targetDb.getProcedureReportReviewQueue("unreviewed", {
            patientId: String(patient.pid),
            labId: matchingLabId,
            fromDate: orderDate,
            toDate: orderDate
          })
        : null;
    const afterCleanupReviewedQueue =
      matchingLabId !== null
        ? await targetDb.getProcedureReportReviewQueue("reviewed", {
            patientId: String(patient.pid),
            labId: matchingLabId,
            fromDate: orderDate,
            toDate: orderDate
          })
        : null;
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.procedureOrders).toBe(beforeCounts.procedureOrders);
    const deletedOrder = procedureOrderId !== null ? await workflow.getProcedureOrder(procedureOrderId) : null;
    const deletedReport = procedureReportId !== null ? await workflow.getProcedureReport(procedureReportId) : null;
    const deletedLabProvider = matchingLabId !== null ? await workflow.getProcedureLabProvider(matchingLabId) : null;
    const deletedOutsideLabProvider = excludedLabId !== null ? await workflow.getProcedureLabProvider(excludedLabId) : null;
    const unreviewedContainsDeletedReport =
      procedureReportId !== null && afterCleanupMatchingQueue !== null
        ? afterCleanupMatchingQueue.reports.some((report) => report.reportId === procedureReportId)
        : false;
    const reviewedContainsDeletedReport =
      procedureReportId !== null && afterCleanupReviewedQueue !== null
        ? afterCleanupReviewedQueue.reports.some((report) => report.reportId === procedureReportId)
        : false;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-138-procedure-report-review-lab-filters-cleanup",
      description:
        "Temporary lab-filtered review queue order/report tree, encounter, and lab providers were deleted, restoring counts and removing the report from filtered queues.",
      expected: {
        counts: {
          encounters: beforeCounts.encounters,
          procedureOrders: beforeCounts.procedureOrders
        },
        deletedOrder: null,
        deletedReport: null,
        deletedLabProvider: null,
        deletedOutsideLabProvider: null,
        unreviewedContainsDeletedReport: false,
        reviewedContainsDeletedReport: false
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        labId: matchingLabId,
        outsideLabId: excludedLabId,
        encounterId,
        procedureOrderId,
        procedureReportId,
        deletedOrder,
        deletedReport,
        deletedLabProvider,
        deletedOutsideLabProvider,
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
    if (matchingLabId !== null) {
      expect(deletedLabProvider).toBeNull();
    }
    if (excludedLabId !== null) {
      expect(deletedOutsideLabProvider).toBeNull();
    }
  });
});

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-12) || "local";
}
