import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureOrderQueueDirect
} from "../../src/ui/legacyOpenEmr.js";

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
  }) => {
    test.setTimeout(90_000);

    const patient = await targetDb.findPatientByCanonicalId(orderQueueAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Order Transmit ${suffix}`;
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;

    try {
      encounterId = await workflow.createEncounter({
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
      });
      const encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      procedureOrderId = await workflow.createProcedureOrder({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        labId: orderQueueLabId,
        encounterId: encounter!.encounter,
        dateOrdered: orderDate,
        priority: "routine",
        status: "pending",
        procedureCode: "80053",
        procedureName,
        procedureType: "laboratory",
        diagnosis: "Z00.00",
        instructions: "Created by the parity procedure order transmit suite."
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

      const transmittedBefore = await targetDb.getProcedureOrderQueue("transmitted-pending", {
        patientId: patient!.pubpid,
        labId: orderQueueLabId,
        fromDate: orderDate,
        toDate: orderDate
      });
      expect(transmittedBefore.orders.some((order) => order.orderId === procedureOrderId)).toBe(false);

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
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Reports" }).click();
        await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
        const orderQueue = page.locator('[aria-label="Procedure order queue"]');
        await orderQueue.getByLabel("Patient").fill(orderQueueAnchorPatientId);
        await orderQueue.getByLabel("Lab").fill(String(orderQueueLabId));
        await orderQueue.getByLabel("From").fill(orderDate);
        await orderQueue.getByLabel("To").fill(orderDate);
        await expect(orderQueue).toContainText(procedureName);
        await expect(orderQueue).toContainText(patient!.pubpid);
        await expect(orderQueue).toContainText("Ready to send");
        await expect(orderQueue.getByRole("button", { name: "Mark sent" })).toBeVisible();
      }

      await workflow.transmitProcedureOrder(procedureOrderId, transmittedAt);

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
      } else {
        const orderQueue = page.locator('[aria-label="Procedure order queue"]');
        await orderQueue.getByRole("button", { name: "Sent, awaiting results" }).click();
        await expect(orderQueue).toContainText(procedureName);
        await expect(orderQueue).toContainText("Sent, awaiting results");
        await expect(orderQueue).toContainText(transmittedAtDisplay);
      }
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
  });
});

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-12) || "local";
}
