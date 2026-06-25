import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureOrdersAndReportsForPatient
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedProcedures } from "../../src/ui/modernizedOpenEmr.js";

const pendingProcedureAnchorPatientId = "MOD-PAT-0701";
const pendingProcedureAfterDate = "2026-06-18";

test.describe("pending scheduled procedure orders parity @slice23 @procedure-pending-orders", () => {
  test("stable procedure anchor has a future scheduled order without report rows", async ({ target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(pendingProcedureAnchorPatientId);
    const scheduledOrder = patient
      ? await targetDb.getFutureScheduledProcedureOrderForPatient(patient.pid, pendingProcedureAfterDate)
      : null;
    const procedures = patient ? await targetDb.getProcedureResultsForPatient(patient.pid) : null;
    const orderWithReports = procedures?.orders.find((order) => order.id === scheduledOrder?.id) ?? null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-23-pending-procedure-order-anchor",
      description: "Verifies the Slice 23 pending procedure anchor patient, future scheduled CBC order, and absence of linked report rows.",
      expected: {
        patient: {
          pubpid: pendingProcedureAnchorPatientId
        },
        order: {
          dateOrdered: "2026-06-25",
          orderStatus: "scheduled",
          procedureCode: "85025",
          procedureName: "Complete blood count"
        },
        reports: {
          count: 0
        }
      },
      actual: {
        patient,
        scheduledOrder,
        procedures,
        selected: {
          orderWithReports,
          reportCount: orderWithReports?.reports.length ?? null
        }
      },
      context: {
        canonicalId: pendingProcedureAnchorPatientId,
        afterDate: pendingProcedureAfterDate,
        suite: "procedure-pending-orders",
        workflow: "pending-procedure-order-readiness"
      }
    });

    expect(patient).not.toBeNull();
    expect(scheduledOrder).not.toBeNull();
    expect(scheduledOrder!.dateOrdered).toBe("2026-06-25");
    expect(scheduledOrder!.orderStatus).toBe("scheduled");
    expect(scheduledOrder!.procedureCode).toBe("85025");
    expect(scheduledOrder!.procedureName).toBe("Complete blood count");

    expect(procedures).not.toBeNull();
    expect(orderWithReports).not.toBeNull();
    expect(orderWithReports!.reports).toHaveLength(0);
  });

  test("future scheduled procedure orders are visible in the application UI", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(pendingProcedureAnchorPatientId);
    const scheduledOrder = patient
      ? await targetDb.getFutureScheduledProcedureOrderForPatient(patient.pid, pendingProcedureAfterDate)
      : null;
    const procedures = patient ? await targetDb.getProcedureResultsForPatient(patient.pid) : null;
    const orderWithReports = procedures?.orders.find((order) => order.id === scheduledOrder?.id) ?? null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-23-pending-procedure-order-ui-precondition",
      description: "Captures the pending scheduled procedure order used before steering the Slice 23 procedure UI parity flow.",
      expected: {
        patient: {
          pubpid: pendingProcedureAnchorPatientId
        },
        order: {
          dateOrdered: "2026-06-25",
          orderStatus: "scheduled",
          procedureCode: "85025",
          procedureName: "Complete blood count"
        },
        ui: {
          visibleSection: "Pending/Scheduled Orders",
          reportState: "No report has been filed"
        }
      },
      actual: {
        patient,
        scheduledOrder,
        selected: {
          orderWithReports,
          reportCount: orderWithReports?.reports.length ?? null
        }
      },
      context: {
        canonicalId: pendingProcedureAnchorPatientId,
        afterDate: pendingProcedureAfterDate,
        suite: "procedure-pending-orders",
        workflow: "pending-procedure-order-ui"
      }
    });

    expect(patient).not.toBeNull();
    expect(scheduledOrder).not.toBeNull();
    expect(orderWithReports).not.toBeNull();
    expect(orderWithReports!.reports).toHaveLength(0);
    const order = scheduledOrder!;

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openProcedureOrdersAndReportsForPatient(page, target, patient!.pid, pendingProcedureAfterDate, "2026-12-31");

      await expectRenderedText(page, "Procedure Orders and Reports");
      await expectRenderedText(page, patient!.pubpid);
      await expectRenderedText(page, order.dateOrdered);
      await expectRenderedText(page, order.procedureName);
      await expectRenderedText(page, order.procedureCode);
      return;
    }

    await openAuthenticatedModernizedProcedures(page, target, patient!.pubpid);

    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText("Pending/Scheduled Orders");
    await expect(page.locator("body")).toContainText(order.procedureName);
    await expect(page.locator("body")).toContainText(order.procedureCode);
    await expect(page.locator("body")).toContainText(order.orderStatus);
    await expect(page.locator("body")).toContainText("No report has been filed");
  });
});
