import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureReportReviewQueueDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedProcedures } from "../../src/ui/modernizedOpenEmr.js";

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
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(reopenAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Report Reopen ${suffix}`;
    const specimenNumber = `RPREOPEN${suffix.slice(-5)}`;
    const encounterPayload = {
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
    };
    const orderPayload = {
      patientId: patient!.pid,
      providerId: patient!.providerId,
      dateOrdered: orderDate,
      priority: "routine",
      status: "complete",
      procedureCode: "80053",
      procedureName,
      procedureType: "laboratory",
      diagnosis: "Z00.00",
      instructions: "Created by the parity procedure report reopen review suite."
    };
    const reportPayload = {
      dateCollected: "2026-06-21 12:10:00",
      dateReport: signedAt,
      specimenNumber,
      reportStatus: "final",
      reviewStatus: "received",
      notes: "Report will be signed and reopened for review."
    };
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-154-procedure-report-reopen-review-precondition",
      description:
        "Temporary procedure report reopen-review inputs before creating and signing a final lab report.",
      expected: {
        anchorPatientCanonicalId: reopenAnchorPatientId,
        orderDate,
        signedAt,
        signedAtDisplay,
        encounterPayload,
        orderPayload,
        reportPayload
      },
      actual: {
        patient,
        beforeCounts,
        suffix,
        target: target.type
      }
    });

    try {
      encounterId = await workflow.createEncounter(encounterPayload);
      const encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      procedureOrderId = await workflow.createProcedureOrder({
        ...orderPayload,
        encounterId: encounter!.encounter,
      });

      procedureReportId = await workflow.createProcedureReport({
        orderId: procedureOrderId,
        ...reportPayload
      });

      await workflow.signProcedureReport(procedureReportId, {
        reviewedBy: "admin",
        reviewedAt: signedAt
      });
      const createdOrder = await workflow.getProcedureOrder(procedureOrderId);
      const signedReport = await workflow.getProcedureReport(procedureReportId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-154-procedure-report-reopen-review-created-signed",
        description:
          "Temporary encounter, completed procedure order, final report, and signed review metadata are created before reopen.",
        expected: {
          encounter: {
            id: encounterId,
            ...encounterPayload
          },
          order: {
            id: procedureOrderId,
            ...orderPayload,
            encounterId: encounter!.encounter
          },
          report: {
            id: procedureReportId,
            orderId: procedureOrderId,
            ...reportPayload,
            reviewStatus: "reviewed",
            reviewedBy: "admin",
            reviewedAt: signedAtDisplay
          }
        },
        actual: {
          encounter,
          order: createdOrder,
          report: signedReport
        }
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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-154-procedure-report-reopen-review-reviewed-before",
        description:
          "Signed temporary report appears in the reviewed queue with reviewer metadata before reopening.",
        expected: {
          queue: "reviewed",
          reportId: procedureReportId,
          orderId: procedureOrderId,
          patientPubpid: patient!.pubpid,
          procedureName,
          reviewStatus: "reviewed",
          reviewedBy: "admin",
          reviewedAt: signedAtDisplay,
          specimenNumber
        },
        actual: {
          reviewedQueueBefore,
          reviewedReportBefore: reviewedQueueBefore.reports.find((report) => report.reportId === procedureReportId)
        }
      });

      let reviewedSurfaceFacts: Record<string, unknown> = {};

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureReportReviewQueueDirect(page, target, patient!.pid, orderDate, orderDate, "2");
        await expectRenderedText(page, procedureName);
        reviewedSurfaceFacts = {
          legacyProcedureReportReviewQueue: {
            renderedQueueOption: "2",
            renderedProcedureName: procedureName,
            renderedPatientPubpid: patient!.pubpid
          }
        };

        await workflow.reopenProcedureReportReview(procedureReportId);

        await openProcedureReportReviewQueueDirect(page, target, patient!.pid, orderDate, orderDate, "3");
        await expectRenderedText(page, procedureName);
      } else {
        await openAuthenticatedModernizedProcedures(page, target, patient!.pubpid);

        const reportCard = page.locator(".procedure-report-card", { hasText: specimenNumber }).first();
        await expect(reportCard).toBeVisible();
        await expect(reportCard).toContainText("reviewed");
        await expect(reportCard).toContainText("Signed by admin");
        reviewedSurfaceFacts = {
          modernizedProcedureCard: {
            renderedProcedureName: procedureName,
            renderedSpecimenNumber: specimenNumber,
            renderedReviewStatus: "reviewed",
            renderedReviewer: "Signed by admin",
            renderedReopenAction: "Reopen procedure report review"
          }
        };
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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-154-procedure-report-reopen-review-reviewed-rendered",
        description:
          "Browser/API surface evidence for the signed temporary report before reopen.",
        expected: {
          rendersProcedureName: procedureName,
          rendersReviewedState: true,
          rendersReviewer: target.type !== "legacy-openemr" ? "Signed by admin" : undefined
        },
        actual: {
          reviewedQueueBefore,
          surfaceFacts: reviewedSurfaceFacts
        }
      });

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
      const reopenedReport = await workflow.getProcedureReport(procedureReportId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-154-procedure-report-reopen-review-action",
        description:
          "Reopen action returns the signed report to received state and clears reviewer metadata.",
        expected: {
          reportId: procedureReportId,
          orderId: procedureOrderId,
          reviewStatus: "received",
          reviewedBy: "",
          reviewedAt: "",
          reportNotes: "Report will be signed and reopened for review."
        },
        actual: {
          report: reopenedReport
        }
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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-154-procedure-report-reopen-review-unreviewed-after",
        description:
          "After reopening the temporary report appears in the unreviewed queue and is absent from the reviewed queue.",
        expected: {
          reviewedContainsReportAfterReopen: false,
          unreviewedQueue: "unreviewed",
          reportId: procedureReportId,
          orderId: procedureOrderId,
          patientPubpid: patient!.pubpid,
          procedureName,
          reviewStatus: "received",
          reviewedBy: "",
          reviewedAt: "",
          specimenNumber
        },
        actual: {
          unreviewedQueueAfter,
          reviewedQueueAfter,
          unreviewedReportAfter: unreviewedQueueAfter.reports.find((report) => report.reportId === procedureReportId)
        }
      });

      let unreviewedSurfaceFacts: Record<string, unknown> = {};
      if (target.type === "legacy-openemr") {
        unreviewedSurfaceFacts = {
          legacyProcedureReportReviewQueue: {
            renderedQueueOption: "3",
            renderedProcedureName: procedureName,
            renderedPatientPubpid: patient!.pubpid
          }
        };
      } else {
        unreviewedSurfaceFacts = {
          modernizedProcedureReportReviewQueue: {
            renderedProcedureName: procedureName,
            renderedSpecimenNumber: specimenNumber,
            renderedReviewStatus: "received",
            clearedReviewer: true,
            filterPatient: patient!.pubpid,
            filterFrom: orderDate,
            filterTo: orderDate
          }
        };
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-154-procedure-report-reopen-review-unreviewed-rendered",
        description:
          "Browser/API surface evidence for the reopened temporary report in the received/unreviewed state.",
        expected: {
          rendersProcedureName: procedureName,
          rendersSpecimenNumber: target.type !== "legacy-openemr" ? specimenNumber : undefined,
          rendersReceivedState: target.type !== "legacy-openemr"
        },
        actual: {
          unreviewedQueueAfter,
          surfaceFacts: unreviewedSurfaceFacts
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

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
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
      probe: "slice-154-procedure-report-reopen-review-cleanup",
      description:
        "Temporary encounter/order/report cleanup restores patient workflow counts and deletes the temporary rows.",
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
