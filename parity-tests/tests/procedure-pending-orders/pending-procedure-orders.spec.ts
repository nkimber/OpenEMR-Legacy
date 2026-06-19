import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureOrdersAndReportsForPatient
} from "../../src/ui/legacyOpenEmr.js";

const pendingProcedureAnchorPatientId = "MOD-PAT-0701";
const pendingProcedureAfterDate = "2026-06-18";

test.describe("pending scheduled procedure orders parity @slice23 @procedure-pending-orders", () => {
  test("stable procedure anchor has a future scheduled order without report rows", async ({ targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(pendingProcedureAnchorPatientId);
    expect(patient).not.toBeNull();

    const scheduledOrder = await targetDb.getFutureScheduledProcedureOrderForPatient(
      patient!.pid,
      pendingProcedureAfterDate
    );
    expect(scheduledOrder).not.toBeNull();
    expect(scheduledOrder!.dateOrdered).toBe("2026-06-25");
    expect(scheduledOrder!.orderStatus).toBe("scheduled");
    expect(scheduledOrder!.procedureCode).toBe("85025");
    expect(scheduledOrder!.procedureName).toBe("Complete blood count");

    const procedures = await targetDb.getProcedureResultsForPatient(patient!.pid);
    const orderWithReports = procedures.orders.find((order) => order.id === scheduledOrder!.id);
    expect(orderWithReports).toBeDefined();
    expect(orderWithReports!.reports).toHaveLength(0);
  });

  test("future scheduled procedure orders are visible in the application UI", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(pendingProcedureAnchorPatientId);
    expect(patient).not.toBeNull();

    const scheduledOrder = await targetDb.getFutureScheduledProcedureOrderForPatient(
      patient!.pid,
      pendingProcedureAfterDate
    );
    expect(scheduledOrder).not.toBeNull();
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

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Procedures" }).click();
    await expect(page.getByRole("heading", { name: "Procedures" })).toBeVisible();

    await page.getByLabel("Procedure patient ID").fill(patient!.pubpid);

    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText("Pending/Scheduled Orders");
    await expect(page.locator("body")).toContainText(order.procedureName);
    await expect(page.locator("body")).toContainText(order.procedureCode);
    await expect(page.locator("body")).toContainText(order.orderStatus);
    await expect(page.locator("body")).toContainText("No report has been filed");
  });
});
