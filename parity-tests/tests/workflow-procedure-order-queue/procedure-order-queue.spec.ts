import { test, expect } from "../../src/fixtures/parityTest.js";
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
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(orderQueueAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Order Queue ${suffix}`;
    const specimenNumber = `OQ${suffix.slice(-8)}`;
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;

    try {
      encounterId = await workflow.createEncounter({
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
        instructions: "Created by the parity procedure order queue suite."
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

      const reportedBefore = await targetDb.getProcedureOrderQueue("reported", {
        patientId: patient!.pubpid,
        fromDate: orderDate,
        toDate: orderDate
      });
      expect(reportedBefore.orders.some((order) => order.orderId === procedureOrderId)).toBe(false);

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
      }

      procedureReportId = await workflow.createProcedureReport({
        orderId: procedureOrderId,
        dateCollected: "2026-06-21 10:10:00",
        dateReport: reportDateTime,
        specimenNumber,
        reportStatus: "final",
        reviewStatus: "received",
        notes: "Created to move the order into the reported queue."
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
      } else {
        const orderQueue = page.locator('[aria-label="Procedure order queue"]');
        await orderQueue.getByRole("button", { name: "Reported" }).click();
        await expect(orderQueue).toContainText(procedureName);
        await expect(orderQueue).toContainText("Reported");
        await expect(orderQueue).toContainText("Reports");
        await expect(orderQueue).toContainText("1");
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
    if (procedureReportId !== null) {
      await expect(workflow.getProcedureReport(procedureReportId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-12) || "local";
}
