import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureOrderQueueDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedReports } from "../../src/ui/modernizedOpenEmr.js";

const orderQueueAnchorPatientId = "MOD-PAT-0009";
const orderQueueLabId = 504;
const orderDate = "2026-06-21";
const reportDateTime = "2026-06-21 10:25:00";

test.describe("procedure order queue parity @slice149 @workflow-procedure-order-queue @mutation", () => {
  test("moves a temporary lab order from ready-to-send to reported queue state", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(orderQueueAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Order Queue ${suffix}`;
    const specimenNumber = `OQ${suffix.slice(-8)}`;
    const encounterPayload = {
      patientId: patient!.pid,
      providerId: patient!.providerId,
      dateTime: "2026-06-21 10:00:00",
      reason: `Parity Order Queue Encounter ${suffix}`,
      facilityId: 10,
      facilityName: "OpenEMR Modernization Clinic",
      billingFacilityId: 10,
      sensitivity: "normal",
      referralSource: "Parity suite",
      externalId: `POQ${suffix.slice(-8)}`,
      posCode: 11,
      billingNote: "Procedure order queue workflow test encounter."
    };
    const orderPayload = {
      patientId: patient!.pid,
      providerId: patient!.providerId,
      labId: orderQueueLabId,
      dateOrdered: orderDate,
      priority: "routine",
      status: "pending",
      procedureCode: "80053",
      procedureName,
      procedureType: "laboratory",
      diagnosis: "Z00.00",
      instructions: "Created by the parity procedure order queue suite."
    };
    const reportPayload = {
      dateCollected: "2026-06-21 10:10:00",
      dateReport: reportDateTime,
      specimenNumber,
      reportStatus: "final",
      reviewStatus: "received",
      notes: "Created to move the order into the reported queue."
    };
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-149-procedure-order-queue-precondition",
      description:
        "Temporary procedure order queue inputs before creating an encounter and reportless lab order.",
      expected: {
        anchorPatientCanonicalId: orderQueueAnchorPatientId,
        labId: orderQueueLabId,
        orderDate,
        reportDateTime,
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
      const createdOrder = await workflow.getProcedureOrder(procedureOrderId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-149-procedure-order-queue-created",
        description:
          "Temporary encounter and reportless procedure order are created before queue membership checks.",
        expected: {
          encounter: {
            id: encounterId,
            ...encounterPayload
          },
          order: {
            id: procedureOrderId,
            ...orderPayload,
            encounterId: encounter!.encounter
          }
        },
        actual: {
          encounter,
          order: createdOrder
        }
      });

      const readyQueue = await targetDb.getProcedureOrderQueue("ready-to-send", {
        patientId: patient!.pubpid,
        labId: orderQueueLabId,
        fromDate: orderDate,
        toDate: orderDate
      });
      const readyOrder = readyQueue.orders.find((order) => order.orderId === procedureOrderId);
      expect(readyOrder).toMatchObject({
        patientId: patient!.pid,
        pubpid: patient!.pubpid,
        encounterId: encounter!.encounter,
        orderDate,
        providerId: patient!.providerId,
        labId: orderQueueLabId,
        procedureCode: "80053",
        procedureName,
        procedureType: "laboratory",
        orderPriority: "routine",
        orderStatus: "pending",
        reportCount: 0,
        resultCount: 0,
        canTransmit: true,
        queueState: "ready-to-send"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-149-procedure-order-queue-ready",
        description:
          "Reportless temporary lab order appears in the ready-to-send queue with transmit eligibility and zero reports/results.",
        expected: {
          queue: "ready-to-send",
          orderId: procedureOrderId,
          patientPubpid: patient!.pubpid,
          labId: orderQueueLabId,
          orderDate,
          procedureCode: "80053",
          procedureName,
          reportCount: 0,
          resultCount: 0,
          canTransmit: true
        },
        actual: {
          readyQueue,
          readyOrder
        }
      });

      const reportedBefore = await targetDb.getProcedureOrderQueue("reported", {
        patientId: patient!.pubpid,
        fromDate: orderDate,
        toDate: orderDate
      });
      expect(reportedBefore.orders.some((order) => order.orderId === procedureOrderId)).toBe(false);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-149-procedure-order-queue-reported-before",
        description:
          "Temporary reportless order is absent from the reported queue before the report row is created.",
        expected: {
          reportedContainsOrderBeforeReport: false,
          orderId: procedureOrderId
        },
        actual: {
          reportedBefore
        }
      });

      let readySurfaceFacts: Record<string, unknown> = {};

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureOrderQueueDirect(
          page,
          target,
          patient!.pid,
          orderDate,
          orderDate,
          "5",
          undefined,
          orderQueueLabId
        );
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, patient!.pubpid);
        readySurfaceFacts = {
          legacyProcedureOrderQueue: {
            renderedQueueOption: "5",
            renderedProcedureName: procedureName,
            renderedPatientPubpid: patient!.pubpid,
            renderedLabId: orderQueueLabId
          }
        };
      } else {
        await openAuthenticatedModernizedReports(page, target);
        const orderQueue = page.locator('[aria-label="Procedure order queue"]');
        await orderQueue.getByLabel("Patient").fill(orderQueueAnchorPatientId);
        await orderQueue.getByLabel("Lab").fill(String(orderQueueLabId));
        await orderQueue.getByLabel("From").fill(orderDate);
        await orderQueue.getByLabel("To").fill(orderDate);
        await expect(orderQueue).toContainText(procedureName);
        await expect(orderQueue).toContainText(patient!.pubpid);
        await expect(orderQueue).toContainText("Ready to send");
        readySurfaceFacts = {
          modernizedProcedureOrderQueue: {
            renderedProcedureName: procedureName,
            renderedPatientPubpid: patient!.pubpid,
            renderedState: "Ready to send",
            filterPatient: orderQueueAnchorPatientId,
            filterLabId: orderQueueLabId,
            filterFrom: orderDate,
            filterTo: orderDate
          }
        };
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-149-procedure-order-queue-ready-rendered",
        description:
          "Browser/API surface evidence for the temporary order while it is ready to send.",
        expected: {
          rendersProcedureName: procedureName,
          rendersPatientPubpid: patient!.pubpid,
          rendersReadyToSendState: target.type !== "legacy-openemr"
        },
        actual: {
          readyOrder,
          surfaceFacts: readySurfaceFacts
        }
      });

      procedureReportId = await workflow.createProcedureReport({
        orderId: procedureOrderId,
        ...reportPayload
      });
      const createdReport = await workflow.getProcedureReport(procedureReportId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-149-procedure-order-queue-report-created",
        description:
          "Temporary procedure report is attached to move the order out of ready-to-send and into the reported queue.",
        expected: {
          reportId: procedureReportId,
          orderId: procedureOrderId,
          ...reportPayload
        },
        actual: {
          report: createdReport
        }
      });

      const readyAfterReport = await targetDb.getProcedureOrderQueue("ready-to-send", {
        patientId: patient!.pubpid,
        fromDate: orderDate,
        toDate: orderDate
      });
      expect(readyAfterReport.orders.some((order) => order.orderId === procedureOrderId)).toBe(false);

      const reportedAfter = await targetDb.getProcedureOrderQueue("reported", {
        patientId: patient!.pubpid,
        labId: orderQueueLabId,
        fromDate: orderDate,
        toDate: orderDate
      });
      const reportedOrder = reportedAfter.orders.find((order) => order.orderId === procedureOrderId);
      expect(reportedOrder).toMatchObject({
        patientId: patient!.pid,
        pubpid: patient!.pubpid,
        orderDate,
        labId: orderQueueLabId,
        procedureName,
        reportCount: 1,
        resultCount: 0,
        canTransmit: false,
        queueState: "reported"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-149-procedure-order-queue-reported",
        description:
          "After report creation the temporary order leaves the ready-to-send queue and appears in the reported queue.",
        expected: {
          readyContainsOrderAfterReport: false,
          reportedQueue: "reported",
          orderId: procedureOrderId,
          labId: orderQueueLabId,
          procedureName,
          reportCount: 1,
          resultCount: 0,
          canTransmit: false
        },
        actual: {
          readyAfterReport,
          reportedAfter,
          reportedOrder
        }
      });

      let reportedSurfaceFacts: Record<string, unknown> = {};

      if (target.type === "legacy-openemr") {
        await openProcedureOrderQueueDirect(
          page,
          target,
          patient!.pid,
          orderDate,
          orderDate,
          "3",
          undefined,
          orderQueueLabId
        );
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, reportDateTime.slice(0, 16));
        await expectRenderedText(page, "Final");
        reportedSurfaceFacts = {
          legacyProcedureOrderQueue: {
            renderedQueueOption: "3",
            renderedProcedureName: procedureName,
            renderedReportDateMinute: reportDateTime.slice(0, 16),
            renderedReportStatus: "Final",
            renderedLabId: orderQueueLabId
          }
        };
      } else {
        const orderQueue = page.locator('[aria-label="Procedure order queue"]');
        await orderQueue.getByRole("button", { name: "Reported" }).click();
        await expect(orderQueue).toContainText(procedureName);
        await expect(orderQueue).toContainText("Reported");
        await expect(orderQueue).toContainText("Reports");
        await expect(orderQueue).toContainText("1");
        reportedSurfaceFacts = {
          modernizedProcedureOrderQueue: {
            renderedProcedureName: procedureName,
            renderedState: "Reported",
            renderedReportLabel: "Reports",
            renderedReportCount: "1"
          }
        };
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-149-procedure-order-queue-reported-rendered",
        description:
          "Browser/API surface evidence for the temporary order after it moves into the reported queue.",
        expected: {
          rendersProcedureName: procedureName,
          rendersReportedState: true,
          rendersReportCount: 1
        },
        actual: {
          reportedOrder,
          surfaceFacts: reportedSurfaceFacts
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
      probe: "slice-149-procedure-order-queue-cleanup",
      description:
        "Temporary encounter/order/report cleanup restores patient workflow counts and deletes the temporary order/report rows.",
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
