import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedProcedures } from "../../src/ui/modernizedOpenEmr.js";

const procedureSpecimenDetailAnchorPatientId = "MOD-PAT-0009";

test.describe("procedure specimen detail parity @slice131 @workflow-procedure-specimen-detail @mutation", () => {
  test("preserves detailed order-level specimen facts for a temporary lab order", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureSpecimenDetailAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Specimen Detail ${suffix}`;
    const specimenIdentifier = `SID${suffix.slice(-8)}`;
    const accessionIdentifier = `ACC${suffix.slice(-8)}`;
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureSpecimenId: number | null = null;

    try {
      encounterId = await workflow.createEncounter({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        dateTime: "2026-06-18 12:00:00",
        reason: `Parity Specimen Detail Encounter ${suffix}`,
        facilityId: 10,
        facilityName: "OpenEMR Modernization Clinic",
        billingFacilityId: 10,
        sensitivity: "normal",
        referralSource: "Parity suite",
        externalId: `PSD${suffix.slice(-7)}`,
        posCode: 11,
        billingNote: "Procedure specimen detail workflow test encounter."
      });
      const encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      procedureOrderId = await workflow.createProcedureOrder({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        encounterId: encounter!.encounter,
        dateOrdered: "2026-06-18 12:10:00",
        priority: "routine",
        status: "pending",
        procedureCode: "80053",
        procedureName,
        procedureType: "laboratory",
        diagnosis: "Z00.00",
        instructions: "Created by the parity procedure specimen detail suite."
      });

      procedureSpecimenId = await workflow.createProcedureSpecimen({
        orderId: procedureOrderId,
        specimenIdentifier,
        accessionIdentifier,
        specimenTypeCode: "BLD",
        specimenType: "Blood",
        collectionMethodCode: "VP",
        collectionMethod: "Venipuncture",
        specimenLocationCode: "LAC",
        specimenLocation: "Left antecubital",
        collectedDate: "2026-06-18 12:20:00",
        volumeValue: "4.500",
        volumeUnit: "mL",
        conditionCode: "OK",
        specimenCondition: "Acceptable",
        comments: "Parity procedure specimen detail row."
      });

      const specimen = await workflow.getProcedureSpecimen(procedureSpecimenId);
      expect(specimen).toMatchObject({
        orderId: procedureOrderId,
        specimenIdentifier,
        accessionIdentifier,
        specimenTypeCode: "BLD",
        specimenType: "Blood",
        collectionMethodCode: "VP",
        collectionMethod: "Venipuncture",
        specimenLocationCode: "LAC",
        specimenLocation: "Left antecubital",
        collectedDate: "2026-06-18",
        volumeValue: "4.500",
        volumeUnit: "mL",
        conditionCode: "OK",
        specimenCondition: "Acceptable",
        comments: "Parity procedure specimen detail row."
      });

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedProcedures(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText(procedureName);
        await expect(page.locator("body")).toContainText(specimenIdentifier);
        await expect(page.locator("body")).toContainText(`Accession ${accessionIdentifier}`);
        await expect(page.locator("body")).toContainText("Venipuncture");
        await expect(page.locator("body")).toContainText("Left antecubital");
        await expect(page.locator("body")).toContainText("Collected 2026-06-18 12:20");
        await expect(page.locator("body")).toContainText("4.5 mL");
        await expect(page.locator("body")).toContainText("Acceptable");
      }

      const procedureSummary = await targetDb.getProcedureResultsForPatient(patient!.pid);
      const specimenOrder = procedureSummary.orders.find((order) => order.procedureName === procedureName);
      expect(specimenOrder).not.toBeUndefined();
      expect(specimenOrder!.specimens).toHaveLength(1);
      expect(specimenOrder!.specimens[0]).toMatchObject({
        specimenIdentifier,
        accessionIdentifier,
        specimenTypeCode: "BLD",
        specimenType: "Blood",
        collectionMethodCode: "VP",
        collectionMethod: "Venipuncture",
        specimenLocationCode: "LAC",
        specimenLocation: "Left antecubital",
        collectedDate: "2026-06-18",
        volumeValue: "4.500",
        volumeUnit: "mL",
        conditionCode: "OK",
        specimenCondition: "Acceptable",
        comments: "Parity procedure specimen detail row."
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
    if (procedureSpecimenId !== null) {
      await expect(workflow.getProcedureSpecimen(procedureSpecimenId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-12) || "local";
}
