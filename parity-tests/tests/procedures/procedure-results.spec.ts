import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openProcedureResultsDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedProcedures } from "../../src/ui/modernizedOpenEmr.js";

const procedureAnchorPatientId = "MOD-PAT-0009";

test.describe("procedure results parity @slice6 @procedures", () => {
  test("stable procedure anchor has a completed order, report, and final result rows", async ({ targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureAnchorPatientId);
    expect(patient).not.toBeNull();

    const procedures = await targetDb.getProcedureResultsForPatient(patient!.pid);
    expect(procedures.patientId).toBe(patient!.pid);

    const cbcOrder = procedures.orders.find((order) => order.procedureName === "Complete blood count");
    expect(cbcOrder).toBeDefined();
    expect(cbcOrder!.orderStatus).toBe("complete");
    expect(cbcOrder!.procedureCode).toBe("85025");
    expect(cbcOrder!.reports.length).toBeGreaterThan(0);

    const report = cbcOrder!.reports.find((item) => item.status === "complete") ?? cbcOrder!.reports[0];
    expect(report.status).toBe("complete");
    expect(report.results.length).toBeGreaterThanOrEqual(4);
    expect(report.results.some((result) => result.text === "Hemoglobin" && result.resultStatus === "final")).toBe(true);
    expect(report.results.every((result) => result.resultDate.startsWith("2026-"))).toBe(true);
  });

  test("completed procedure results are visible in the application UI", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureAnchorPatientId);
    expect(patient).not.toBeNull();

    const procedures = await targetDb.getProcedureResultsForPatient(patient!.pid);
    const cbcOrder = procedures.orders.find((order) => order.procedureName === "Complete blood count") ?? procedures.orders[0];
    expect(cbcOrder).toBeDefined();
    const order = cbcOrder!;
    const report = order.reports.find((item) => item.status === "complete") ?? order.reports[0];
    expect(report).toBeDefined();
    const hemoglobin = report.results.find((result) => result.text === "Hemoglobin") ?? report.results[0];
    expect(hemoglobin).toBeDefined();
    const result = hemoglobin!;

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openProcedureResultsDirect(page, target, patient!.pid);

      await expectRenderedText(page, "Order Report Results");
      await expectRenderedText(page, order.procedureName);
      await expectRenderedText(page, result.text);
      await expectRenderedText(page, /Final|Reviewed|complete/i);
      return;
    }

    await openAuthenticatedModernizedProcedures(page, target, patient!.pubpid);

    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText("Order Report Results");
    await expect(page.locator("body")).toContainText(order.procedureName);
    await expect(page.locator("body")).toContainText(order.procedureCode);
    await expect(page.locator("body")).toContainText(result.text);
    await expect(page.locator("body")).toContainText(result.result);
    await expect(page.locator("body")).toContainText(result.resultStatus);
  });
});
