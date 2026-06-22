import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureResultsDirect
} from "../../src/ui/legacyOpenEmr.js";
import {
  getModernizedAdminSessionHeaders,
  openAuthenticatedModernizedProcedures
} from "../../src/ui/modernizedOpenEmr.js";

const procedureProtectionPatientId = "MOD-PAT-0009";

test.describe("procedure protection parity @slice172 @procedure-protection", () => {
  test("requires an active session before procedure and lab data are visible", async ({
    page,
    target,
    targetDb
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureProtectionPatientId);
    expect(patient).not.toBeNull();

    const procedures = await targetDb.getProcedureResultsForPatient(patient!.pid);
    const order = procedures.orders.find((item) => item.procedureName === "Complete blood count") ?? procedures.orders[0];
    expect(order).toBeDefined();
    const report = order!.reports.find((item) => item.status === "complete") ?? order!.reports[0];
    expect(report).toBeDefined();
    const hemoglobin = report!.results.find((item) => item.text === "Hemoglobin") ?? report!.results[0];
    expect(hemoglobin).toBeDefined();

    if (target.type === "legacy-openemr") {
      await page.goto(`${target.publicUrl}/interface/orders/orders_results.php?pid=${patient!.pid}`);
      await expect(page.locator("body")).not.toContainText("Order Report Results");
      await expect(page.locator("body")).not.toContainText(order!.procedureName);

      await loginToLegacyOpenEmr(page, target);
      await openProcedureResultsDirect(page, target, patient!.pid);
      await expectRenderedText(page, "Order Report Results");
      await expectRenderedText(page, order!.procedureName);
      await expectRenderedText(page, hemoglobin!.text);
      await expectRenderedText(page, /Final|Reviewed|complete/i);
      return;
    }

    const unauthenticatedProcedureResults = await page.request.get(
      `${target.apiBaseUrl}/api/procedures/${encodeURIComponent(patient!.pubpid)}`
    );
    expect(unauthenticatedProcedureResults.status()).toBe(401);
    await expectUnauthenticatedResponse(unauthenticatedProcedureResults);

    const unauthenticatedCatalog = await page.request.get(`${target.apiBaseUrl}/api/procedures/order-catalog`);
    expect(unauthenticatedCatalog.status()).toBe(401);
    await expectUnauthenticatedResponse(unauthenticatedCatalog);

    const unauthenticatedCreate = await page.request.post(`${target.apiBaseUrl}/api/procedures/orders`, {
      data: {
        patientId: patient!.pubpid,
        providerId: 101,
        labId: 501,
        encounterId: 1000013,
        dateOrdered: "2026-06-18",
        priority: "routine",
        status: "pending",
        procedureCode: "85025",
        procedureName: "Blocked Protection Procedure Order",
        procedureType: "laboratory",
        diagnosis: "Z00.00",
        instructions: "This should be blocked without a session."
      }
    });
    expect(unauthenticatedCreate.status()).toBe(401);
    await expectUnauthenticatedResponse(unauthenticatedCreate);

    const headers = await getModernizedAdminSessionHeaders(page, target);
    const authenticatedProcedureResults = await page.request.get(
      `${target.apiBaseUrl}/api/procedures/${encodeURIComponent(patient!.pubpid)}`,
      { headers }
    );
    expect(authenticatedProcedureResults.ok()).toBeTruthy();
    const authenticatedPayload = await authenticatedProcedureResults.json() as {
      patientId: string;
      orders: Array<{ name: string; code: string; reports: Array<{ results: Array<{ text: string; result: string }> }> }>;
    };
    expect(authenticatedPayload.patientId).toBe(patient!.pubpid);
    expect(authenticatedPayload.orders.some((item) => item.name === order!.procedureName && item.code === order!.procedureCode)).toBe(true);

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Procedures" }).click();
    await expect(page.getByRole("heading", { name: "Procedures", exact: true })).toBeVisible();
    await expect(page.locator('form[aria-label="Procedures access"]')).toBeVisible();
    await expect(page.locator("body")).toContainText("Sign in to load procedure results");
    await expect(page.getByLabel("Procedure patient ID")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save Order" })).toBeDisabled();
    await expect(page.locator("body")).not.toContainText(order!.procedureName);

    await openAuthenticatedModernizedProcedures(page, target, patient!.pubpid);
    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText("Order Report Results");
    await expect(page.locator("body")).toContainText(order!.procedureName);
    await expect(page.locator("body")).toContainText(order!.procedureCode);
    await expect(page.locator("body")).toContainText(hemoglobin!.text);
    await expect(page.locator("body")).toContainText(hemoglobin!.result);
  });
});

async function expectUnauthenticatedResponse(response: { json: () => Promise<unknown> }) {
  const payload = await response.json() as { authenticated?: boolean; sessionSource?: string };
  expect(payload).toMatchObject({
    authenticated: false,
    sessionSource: "modernized-openemr"
  });
}
