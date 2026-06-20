import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureOrdersAndReportsForPatient
} from "../../src/ui/legacyOpenEmr.js";

const encounterProcedureEntryAnchorPatientId = "MOD-PAT-0001";
const encounterProcedureEntryAnchorFromDate = "2026-01-01";
const encounterProcedureEntryEncounter = 1000013;
const encounterProcedureEntryOrderDate = "2026-06-18";
const encounterProcedureEntryCode = "80053";
const encounterProcedureEntryDiagnosis = "E78.5";

test.describe("encounter procedure order entry parity @slice75 @workflow-encounter-procedures @mutation", () => {
  test("adds a pending procedure order from the encounter workflow and cleans up", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterProcedureEntryAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();
    expect(encounter!.encounter).toBe(encounterProcedureEntryEncounter);

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeEncounterProcedures = await targetDb.getProcedureResultsForEncounter(
      patient!.pid,
      encounterProcedureEntryEncounter
    );
    const suffix = workflowSuffix();
    const procedureName = `Parity Encounter Procedure Order ${suffix}`;
    const instructions = `Created by the encounter procedure order parity suite ${suffix}.`;
    let procedureOrderId: number | null = null;

    try {
      if (target.type === "legacy-openemr") {
        procedureOrderId = await workflow.createProcedureOrder({
          patientId: patient!.pid,
          providerId: patient!.providerId,
          encounterId: encounter!.encounter,
          dateOrdered: encounterProcedureEntryOrderDate,
          priority: "routine",
          status: "pending",
          procedureCode: encounterProcedureEntryCode,
          procedureName,
          procedureType: "laboratory",
          diagnosis: encounterProcedureEntryDiagnosis,
          instructions
        });

        await loginToLegacyOpenEmr(page, target);
        await openProcedureOrdersAndReportsForPatient(
          page,
          target,
          patient!.pid,
          encounterProcedureEntryOrderDate,
          encounterProcedureEntryOrderDate
        );
        await expectRenderedText(page, "Procedure Orders and Reports");
        await expectRenderedText(page, procedureName);
        await expectRenderedText(page, encounterProcedureEntryCode);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Encounters" }).click();
        await expect(page.getByRole("heading", { name: "Encounters" })).toBeVisible();

        await page.getByLabel("Encounter patient ID").fill(patient!.pubpid);
        await page.getByLabel("Encounter from date").fill(encounterProcedureEntryAnchorFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const procedureEntry = page.getByLabel("Encounter procedure order entry");
        await expect(procedureEntry).toBeVisible();
        await procedureEntry.getByLabel("Encounter procedure order date").fill(encounterProcedureEntryOrderDate);
        await procedureEntry.getByLabel("Encounter procedure order code").fill(encounterProcedureEntryCode);
        await procedureEntry.getByLabel("Encounter procedure order name").fill(procedureName);
        await procedureEntry.getByLabel("Encounter procedure order diagnosis").fill(encounterProcedureEntryDiagnosis);
        await procedureEntry.getByLabel("Encounter procedure order priority").selectOption("routine");
        await procedureEntry.getByLabel("Encounter procedure order status").selectOption("pending");
        await procedureEntry.getByLabel("Encounter procedure order type").fill("laboratory");
        await procedureEntry.getByLabel("Encounter procedure order instructions").fill(instructions);
        await procedureEntry.getByRole("button", { name: /Add Order/i }).click();
        await expect(procedureEntry).toContainText("Saved");

        const linkage = page.getByLabel("Encounter procedure order linkage");
        await expect(linkage).toContainText(procedureName);
        await expect(linkage).toContainText(encounterProcedureEntryCode);
        await expect(linkage).toContainText(encounterProcedureEntryDiagnosis);
        await expect(linkage).toContainText("pending");
        await expect(linkage).toContainText("routine");
        await expect(linkage).toContainText("laboratory");
        await expect(linkage).toContainText(instructions);
        await expect(linkage).toContainText("0 reports / 0 results");
        await expect(linkage).toContainText("No reports recorded for this order");
      }

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters);
      expect(afterCreateCounts.procedureOrders).toBe(beforeCounts.procedureOrders + 1);

      const afterCreateEncounterProcedures = await targetDb.getProcedureResultsForEncounter(
        patient!.pid,
        encounterProcedureEntryEncounter
      );
      expect(afterCreateEncounterProcedures.orders).toHaveLength(beforeEncounterProcedures.orders.length + 1);

      const createdOrder = afterCreateEncounterProcedures.orders.find((order) => order.procedureName === procedureName);
      expect(createdOrder).toMatchObject({
        encounterId: encounterProcedureEntryEncounter,
        dateOrdered: encounterProcedureEntryOrderDate,
        orderStatus: "pending",
        procedureCode: encounterProcedureEntryCode,
        procedureName,
        diagnosis: encounterProcedureEntryDiagnosis
      });
      expect(createdOrder!.reports).toHaveLength(0);
      procedureOrderId = createdOrder!.id;

      if (target.type === "modernized-openemr") {
        const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounter!.encounter}`);
        expect(detailResponse.ok()).toBe(true);
        const detailPayload = await detailResponse.json();
        const apiOrder = detailPayload.procedureOrders.find(
          (order: { name?: string }) => order.name === procedureName
        );
        expect(apiOrder).toMatchObject({
          encounter: encounterProcedureEntryEncounter,
          orderDate: encounterProcedureEntryOrderDate,
          orderStatus: "pending",
          code: encounterProcedureEntryCode,
          name: procedureName,
          diagnosis: encounterProcedureEntryDiagnosis
        });
        expect(apiOrder.reports).toHaveLength(0);
      }
    } finally {
      if (procedureOrderId !== null) {
        await workflow.deleteProcedureOrderCascade(procedureOrderId);
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
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
