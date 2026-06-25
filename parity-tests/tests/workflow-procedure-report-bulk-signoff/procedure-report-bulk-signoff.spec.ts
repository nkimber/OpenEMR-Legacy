import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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
  }, testInfo) => {
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
    const encounterPayload = {
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
    };
    const orderPayloads = entries.map((entry) => ({
      patientId: patient!.pid,
      providerId: patient!.providerId,
      dateOrdered: orderDate,
      priority: "routine",
      status: "complete",
      procedureCode: entry.code,
      procedureName: entry.name,
      procedureType: "laboratory",
      diagnosis: "Z00.00",
      instructions: "Created by the parity procedure report bulk sign-off suite."
    }));
    const reportPayloads = entries.map((entry) => ({
      dateCollected: "2026-06-21 11:00:00",
      dateReport: "2026-06-21 11:10:00",
      specimenNumber: entry.specimen,
      reportStatus: "final",
      reviewStatus: "received",
      notes: entry.notes
    }));
    let encounterId: number | null = null;
    const procedureOrderIds: number[] = [];
    const procedureReportIds: number[] = [];

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-153-procedure-report-bulk-signoff-precondition",
      description:
        "Temporary procedure report bulk sign-off inputs before creating an encounter, two lab orders, and two unreviewed reports.",
      expected: {
        anchorPatientCanonicalId: bulkSignAnchorPatientId,
        orderDate,
        bulkSignedAt,
        bulkSignedAtDisplay,
        encounterPayload,
        orderPayloads,
        reportPayloads
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

      for (let index = 0; index < entries.length; index += 1) {
        const orderId = await workflow.createProcedureOrder({
          ...orderPayloads[index],
          encounterId: encounter!.encounter,
        });
        procedureOrderIds.push(orderId);

        const reportId = await workflow.createProcedureReport({
          orderId,
          ...reportPayloads[index]
        });
        procedureReportIds.push(reportId);
      }
      const createdOrders = await Promise.all(procedureOrderIds.map((orderId) => workflow.getProcedureOrder(orderId)));
      const createdReports = await Promise.all(
        procedureReportIds.map((reportId) => workflow.getProcedureReport(reportId))
      );
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-153-procedure-report-bulk-signoff-created",
        description:
          "Temporary encounter, two completed procedure orders, and two received final reports are created before bulk sign-off.",
        expected: {
          encounter: {
            id: encounterId,
            ...encounterPayload
          },
          orders: orderPayloads.map((payload, index) => ({
            id: procedureOrderIds[index],
            ...payload,
            encounterId: encounter!.encounter
          })),
          reports: reportPayloads.map((payload, index) => ({
            id: procedureReportIds[index],
            orderId: procedureOrderIds[index],
            ...payload
          }))
        },
        actual: {
          encounter,
          orders: createdOrders,
          reports: createdReports
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-153-procedure-report-bulk-signoff-unreviewed",
        description:
          "Both temporary reports appear in the unreviewed queue with blank reviewer metadata before bulk sign-off.",
        expected: {
          queue: "unreviewed",
          reportIds: procedureReportIds,
          orderIds: procedureOrderIds,
          patientPubpid: patient!.pubpid,
          orderDate,
          reviewStatus: "received",
          reviewedBy: "",
          reviewedAt: "",
          reportCount: 2
        },
        actual: {
          unreviewedQueue,
          matchedReports: procedureReportIds.map((reportId) =>
            unreviewedQueue.reports.find((report) => report.reportId === reportId)
          )
        }
      });

      let unreviewedSurfaceFacts: Record<string, unknown> = {};

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureReportReviewQueueDirect(page, target, patient!.pid, orderDate, orderDate, "3");
        for (const entry of entries) {
          await expectRenderedText(page, entry.name);
        }
        unreviewedSurfaceFacts = {
          legacyProcedureReportReviewQueue: {
            renderedQueueOption: "3",
            renderedProcedureNames: entries.map((entry) => entry.name),
            renderedPatientPubpid: patient!.pubpid
          }
        };

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
        unreviewedSurfaceFacts = {
          modernizedProcedureReportReviewQueue: {
            renderedProcedureNames: entries.map((entry) => entry.name),
            renderedSpecimenNumbers: entries.map((entry) => entry.specimen),
            filterPatient: patient!.pubpid,
            filterFrom: orderDate,
            filterTo: orderDate,
            renderedBulkAction: "Sign visible"
          }
        };

        await reviewQueue.getByRole("button", { name: "Sign visible" }).click();
        await expect(reviewQueue).toContainText("Signed 2");
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-153-procedure-report-bulk-signoff-unreviewed-rendered",
        description:
          "Browser/API surface evidence for both temporary reports before bulk sign-off.",
        expected: {
          rendersProcedureNames: entries.map((entry) => entry.name),
          rendersBulkSignAction: true
        },
        actual: {
          unreviewedQueue,
          surfaceFacts: unreviewedSurfaceFacts
        }
      });

      const signedReports = await Promise.all(
        procedureReportIds.map((reportId) => workflow.getProcedureReport(reportId))
      );
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-153-procedure-report-bulk-signoff-action",
        description:
          "Bulk sign-off action stamps both temporary reports with reviewed status, reviewer, and timestamp.",
        expected: {
          reportIds: procedureReportIds,
          reviewedBy: "admin",
          reviewedAt: bulkSignedAt,
          reviewedAtDisplay: bulkSignedAtDisplay
        },
        actual: {
          reports: signedReports
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-153-procedure-report-bulk-signoff-reviewed",
        description:
          "After bulk sign-off both temporary reports leave unreviewed and appear in the reviewed queue.",
        expected: {
          unreviewedContainsSignedReports: false,
          reviewedQueue: "reviewed",
          reportIds: procedureReportIds,
          orderIds: procedureOrderIds,
          patientPubpid: patient!.pubpid,
          reviewStatus: "reviewed",
          reviewedBy: "admin",
          reviewedAt: bulkSignedAtDisplay,
          reportCount: 2
        },
        actual: {
          reviewedQueueAfter,
          unreviewedQueueAfter,
          matchedReviewedReports: procedureReportIds.map((reportId) =>
            reviewedQueueAfter.reports.find((report) => report.reportId === reportId)
          )
        }
      });

      let reviewedSurfaceFacts: Record<string, unknown> = {};

      if (target.type === "legacy-openemr") {
        await openProcedureReportReviewQueueDirect(page, target, patient!.pid, orderDate, orderDate, "2");
        for (const entry of entries) {
          await expectRenderedText(page, entry.name);
        }
        reviewedSurfaceFacts = {
          legacyProcedureReportReviewQueue: {
            renderedQueueOption: "2",
            renderedProcedureNames: entries.map((entry) => entry.name),
            renderedPatientPubpid: patient!.pubpid
          }
        };
      } else {
        const reviewQueue = page.locator('[aria-label="Procedure report review queue"]');
        for (const entry of entries) {
          await expect(reviewQueue).toContainText(entry.name);
          await expect(reviewQueue).toContainText("admin");
          await expect(reviewQueue).toContainText(bulkSignedAtDisplay);
        }
        reviewedSurfaceFacts = {
          modernizedProcedureReportReviewQueue: {
            renderedProcedureNames: entries.map((entry) => entry.name),
            renderedReviewer: "admin",
            renderedReviewedAt: bulkSignedAtDisplay,
            renderedSignedCount: "Signed 2"
          }
        };
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-153-procedure-report-bulk-signoff-reviewed-rendered",
        description:
          "Browser/API surface evidence for both temporary reports after they move into the reviewed queue.",
        expected: {
          rendersProcedureNames: entries.map((entry) => entry.name),
          rendersReviewer: "admin",
          rendersReviewedAt: target.type !== "legacy-openemr" ? bulkSignedAtDisplay : undefined
        },
        actual: {
          reviewedQueueAfter,
          surfaceFacts: reviewedSurfaceFacts
        }
      });
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-153-procedure-report-bulk-signoff-cleanup",
      description:
        "Temporary encounter, two orders, and two reports cleanup restores patient workflow counts and deletes all temporary rows.",
      expected: {
        restoredEncounterCount: beforeCounts.encounters,
        restoredProcedureOrderCount: beforeCounts.procedureOrders,
        deletedOrders: procedureOrderIds.map(() => null),
        deletedReports: procedureReportIds.map(() => null)
      },
      actual: {
        beforeCounts,
        afterCleanupCounts,
        procedureOrderIds,
        procedureReportIds,
        deletedOrders: await Promise.all(procedureOrderIds.map((orderId) => workflow.getProcedureOrder(orderId))),
        deletedReports: await Promise.all(procedureReportIds.map((reportId) => workflow.getProcedureReport(reportId)))
      }
    });
  });
});

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-12) || "local";
}
