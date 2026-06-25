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
const transmittedAt = "2026-06-21 10:40:00";
const transmittedAtDisplay = "2026-06-21 10:40";

test.describe("procedure order transmit parity @slice151 @workflow-procedure-order-transmit @mutation", () => {
  test("moves a temporary lab order from ready-to-send to sent-awaiting-results queue state", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(90_000);

    const patient = await targetDb.findPatientByCanonicalId(orderQueueAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Order Transmit ${suffix}`;
    const encounterPayload = {
      patientId: patient!.pid,
      providerId: patient!.providerId,
      dateTime: "2026-06-21 10:30:00",
      reason: `Parity Order Transmit Encounter ${suffix}`,
      facilityId: 10,
      facilityName: "OpenEMR Modernization Clinic",
      billingFacilityId: 10,
      sensitivity: "normal",
      referralSource: "Parity suite",
      externalId: `POT${suffix.slice(-8)}`,
      posCode: 11,
      billingNote: "Procedure order transmit workflow test encounter."
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
      instructions: "Created by the parity procedure order transmit suite."
    };
    const transmitPayload = {
      procedureOrderId: null as number | null,
      transmittedAt,
      transmittedAtDisplay
    };
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-151-procedure-order-transmit-precondition",
      description:
        "Temporary procedure order transmit inputs before creating an encounter and reportless lab order.",
      expected: {
        anchorPatientCanonicalId: orderQueueAnchorPatientId,
        labId: orderQueueLabId,
        orderDate,
        transmittedAt,
        transmittedAtDisplay,
        encounterPayload,
        orderPayload
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
      transmitPayload.procedureOrderId = procedureOrderId;
      const createdOrder = await workflow.getProcedureOrder(procedureOrderId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-151-procedure-order-transmit-created",
        description:
          "Temporary encounter and reportless procedure order are created before transmit queue checks.",
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
        dateTransmitted: "",
        reportCount: 0,
        resultCount: 0,
        canTransmit: true,
        queueState: "ready-to-send"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-151-procedure-order-transmit-ready",
        description:
          "Reportless temporary lab order appears in the ready-to-send queue before transmission.",
        expected: {
          queue: "ready-to-send",
          orderId: procedureOrderId,
          patientPubpid: patient!.pubpid,
          labId: orderQueueLabId,
          orderDate,
          procedureCode: "80053",
          procedureName,
          dateTransmitted: "",
          reportCount: 0,
          resultCount: 0,
          canTransmit: true
        },
        actual: {
          readyQueue,
          readyOrder
        }
      });

      const transmittedBefore = await targetDb.getProcedureOrderQueue("transmitted-pending", {
        patientId: patient!.pubpid,
        labId: orderQueueLabId,
        fromDate: orderDate,
        toDate: orderDate
      });
      expect(transmittedBefore.orders.some((order) => order.orderId === procedureOrderId)).toBe(false);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-151-procedure-order-transmit-sent-before",
        description:
          "Temporary reportless order is absent from the sent-awaiting-results queue before transmission.",
        expected: {
          transmittedContainsOrderBeforeTransmit: false,
          orderId: procedureOrderId
        },
        actual: {
          transmittedBefore
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
        await expectRenderedText(page, /Transmit Selected Orders/i);
        readySurfaceFacts = {
          legacyProcedureOrderQueue: {
            renderedQueueOption: "5",
            renderedProcedureName: procedureName,
            renderedPatientPubpid: patient!.pubpid,
            renderedLabId: orderQueueLabId,
            renderedTransmitAction: "Transmit Selected Orders"
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
        await expect(orderQueue.getByRole("button", { name: "Mark sent" })).toBeVisible();
        readySurfaceFacts = {
          modernizedProcedureOrderQueue: {
            renderedProcedureName: procedureName,
            renderedPatientPubpid: patient!.pubpid,
            renderedState: "Ready to send",
            renderedTransmitAction: "Mark sent",
            filterPatient: orderQueueAnchorPatientId,
            filterLabId: orderQueueLabId,
            filterFrom: orderDate,
            filterTo: orderDate
          }
        };
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-151-procedure-order-transmit-ready-rendered",
        description:
          "Browser/API surface evidence for the temporary order before it is transmitted.",
        expected: {
          rendersProcedureName: procedureName,
          rendersPatientPubpid: patient!.pubpid,
          rendersTransmitAction: true
        },
        actual: {
          readyOrder,
          surfaceFacts: readySurfaceFacts
        }
      });

      await workflow.transmitProcedureOrder(procedureOrderId, transmittedAt);
      const transmittedActionRecord = await workflow.getProcedureOrder(procedureOrderId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-151-procedure-order-transmit-action",
        description:
          "Transmit action stamps the temporary procedure order with the transmitted timestamp.",
        expected: transmitPayload,
        actual: {
          order: transmittedActionRecord
        }
      });

      const readyAfterTransmit = await targetDb.getProcedureOrderQueue("ready-to-send", {
        patientId: patient!.pubpid,
        labId: orderQueueLabId,
        fromDate: orderDate,
        toDate: orderDate
      });
      expect(readyAfterTransmit.orders.some((order) => order.orderId === procedureOrderId)).toBe(false);

      const transmittedAfter = await targetDb.getProcedureOrderQueue("transmitted-pending", {
        patientId: patient!.pubpid,
        labId: orderQueueLabId,
        fromDate: orderDate,
        toDate: orderDate
      });
      const transmittedOrder = transmittedAfter.orders.find((order) => order.orderId === procedureOrderId);
      expect(transmittedOrder).toMatchObject({
        patientId: patient!.pid,
        pubpid: patient!.pubpid,
        orderDate,
        labId: orderQueueLabId,
        procedureName,
        dateTransmitted: transmittedAtDisplay,
        reportCount: 0,
        resultCount: 0,
        canTransmit: false,
        queueState: "transmitted-pending"
      });

      const transmittedRecord = await workflow.getProcedureOrder(procedureOrderId);
      expect(transmittedRecord).toMatchObject({
        id: procedureOrderId,
        procedureName,
        dateTransmitted: transmittedAtDisplay
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-151-procedure-order-transmit-sent",
        description:
          "After transmission the temporary order leaves ready-to-send and appears in the sent-awaiting-results queue.",
        expected: {
          readyContainsOrderAfterTransmit: false,
          sentQueue: "transmitted-pending",
          orderId: procedureOrderId,
          labId: orderQueueLabId,
          procedureName,
          dateTransmitted: transmittedAtDisplay,
          reportCount: 0,
          resultCount: 0,
          canTransmit: false
        },
        actual: {
          readyAfterTransmit,
          transmittedAfter,
          transmittedOrder,
          transmittedRecord
        }
      });

      let transmittedSurfaceFacts: Record<string, unknown> = {};

      if (target.type === "legacy-openemr") {
        await openProcedureOrderQueueDirect(
          page,
          target,
          patient!.pid,
          orderDate,
          orderDate,
          "4",
          undefined,
          orderQueueLabId
        );
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, patient!.pubpid);
        transmittedSurfaceFacts = {
          legacyProcedureOrderQueue: {
            renderedQueueOption: "4",
            renderedProcedureName: procedureName,
            renderedPatientPubpid: patient!.pubpid,
            renderedLabId: orderQueueLabId
          }
        };
      } else {
        const orderQueue = page.locator('[aria-label="Procedure order queue"]');
        await orderQueue.getByRole("button", { name: "Sent, awaiting results" }).click();
        await expect(orderQueue).toContainText(procedureName);
        await expect(orderQueue).toContainText("Sent, awaiting results");
        await expect(orderQueue).toContainText(transmittedAtDisplay);
        transmittedSurfaceFacts = {
          modernizedProcedureOrderQueue: {
            renderedProcedureName: procedureName,
            renderedState: "Sent, awaiting results",
            renderedTransmittedAt: transmittedAtDisplay
          }
        };
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-151-procedure-order-transmit-sent-rendered",
        description:
          "Browser/API surface evidence for the temporary order after it moves into sent-awaiting-results.",
        expected: {
          rendersProcedureName: procedureName,
          rendersSentAwaitingResultsState: true,
          rendersTransmittedAt: target.type !== "legacy-openemr" ? transmittedAtDisplay : undefined
        },
        actual: {
          transmittedOrder,
          surfaceFacts: transmittedSurfaceFacts
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-151-procedure-order-transmit-cleanup",
      description:
        "Temporary encounter/order cleanup restores patient workflow counts and deletes the temporary order row.",
      expected: {
        restoredEncounterCount: beforeCounts.encounters,
        restoredProcedureOrderCount: beforeCounts.procedureOrders,
        deletedOrder: null
      },
      actual: {
        beforeCounts,
        afterCleanupCounts,
        procedureOrderId,
        deletedOrder: procedureOrderId === null ? null : await workflow.getProcedureOrder(procedureOrderId)
      }
    });
  });
});

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-12) || "local";
}
