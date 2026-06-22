import { test, expect } from "../../src/fixtures/parityTest.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import { expectRenderedText, loginToLegacyOpenEmr, openProcedureResultsDirect } from "../../src/ui/legacyOpenEmr.js";

const encounterProcedureAnchorPatientId = "MOD-PAT-0001";
const encounterProcedureAnchorFromDate = "2025-01-01";
const anchorEncounter = 1000011;
const anchorProcedureOrderId = 5000001;
const anchorProcedureReportId = 6000001;

test.describe("encounter procedure order linkage readiness parity @slice70 @encounter-procedures @procedures", () => {
  test("stable encounter anchor exposes linked procedure order facts", async ({ targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterProcedureAnchorPatientId);
    expect(patient).not.toBeNull();

    const procedures = await targetDb.getProcedureResultsForEncounter(patient!.pid, anchorEncounter);
    expect(procedures.patientId).toBe(patient!.pid);
    expect(procedures.orders).toHaveLength(1);

    const order = procedures.orders[0];
    expect(order).toMatchObject({
      id: anchorProcedureOrderId,
      patientId: patient!.pid,
      encounterId: anchorEncounter,
      dateOrdered: "2026-02-18",
      orderStatus: "complete",
      procedureCode: "83036",
      procedureName: "Hemoglobin A1c"
    });
    expect(order.reports).toHaveLength(1);

    const report = order.reports[0];
    expect(report).toMatchObject({
      id: anchorProcedureReportId,
      orderId: anchorProcedureOrderId,
      status: "complete",
      reviewStatus: "reviewed"
    });
    expect(report.results).toHaveLength(4);
    expect(report.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "4548-4",
          text: "Hemoglobin A1c",
          result: "5.7",
          units: "%",
          range: "4.0-5.6",
          resultStatus: "final"
        })
      ])
    );
  });

  test("encounter-linked procedure order is reachable from the application surface", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterProcedureAnchorPatientId);
    expect(patient).not.toBeNull();

    const procedures = await targetDb.getProcedureResultsForEncounter(patient!.pid, anchorEncounter);
    expect(procedures.orders).toHaveLength(1);
    const order = procedures.orders[0];
    const report = order.reports[0];
    const a1c = report.results.find((result) => result.text === "Hemoglobin A1c");
    expect(a1c).toBeDefined();

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openProcedureResultsDirect(page, target, patient!.pid);

      await expectRenderedText(page, "Order Report Results");
      await expectRenderedText(page, order.procedureName);
      await expectRenderedText(page, `SP-${report.id}`);
      await expectRenderedText(page, a1c!.text);
      await expectRenderedText(page, a1c!.code);
      await expectRenderedText(page, a1c!.result);
      return;
    }

    const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${anchorEncounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
    expect(detailResponse.ok()).toBe(true);
    const detailPayload = await detailResponse.json();
    expect(detailPayload.procedureOrders).toHaveLength(1);
    expect(detailPayload.procedureOrders[0]).toMatchObject({
      id: anchorProcedureOrderId,
      encounter: anchorEncounter,
      orderDate: "2026-02-18",
      orderStatus: "complete",
      code: "83036",
      name: "Hemoglobin A1c",
      diagnosis: "E11.9"
    });
    expect(detailPayload.procedureOrders[0].reports).toHaveLength(1);
    expect(detailPayload.procedureOrders[0].reports[0].results).toHaveLength(4);

    await openAuthenticatedModernizedEncounters(page, target, patient!.pubpid, encounterProcedureAnchorFromDate);

    const encounterButton = page.getByRole("button", { name: /Comprehensive new patient evaluation/i }).first();
    await expect(encounterButton).toBeVisible();
    await encounterButton.click();

    const linkage = page.getByLabel("Encounter procedure order linkage");
    await expect(linkage).toBeVisible();
    await expect(linkage).toContainText("Procedure Orders");
    await expect(linkage).toContainText("Hemoglobin A1c");
    await expect(linkage).toContainText("83036");
    await expect(linkage).toContainText("complete");
    await expect(linkage).toContainText("6000001");
    await expect(linkage).toContainText("5.7");
    await expect(linkage).toContainText("%");
  });
});
