import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedProcedures } from "../../src/ui/modernizedOpenEmr.js";

const procedureSpecimenDetailAnchorPatientId = "MOD-PAT-0009";

test.describe("procedure specimen detail parity @slice131 @workflow-procedure-specimen-detail @mutation", () => {
  test("preserves detailed order-level specimen facts for a temporary lab order", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureSpecimenDetailAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Missing seeded procedure specimen detail patient ${procedureSpecimenDetailAnchorPatientId}`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeProcedures = await targetDb.getProcedureResultsForPatient(patient.pid);
    const suffix = workflowSuffix();
    const procedureName = `Parity Specimen Detail ${suffix}`;
    const specimenIdentifier = `SID${suffix.slice(-8)}`;
    const accessionIdentifier = `ACC${suffix.slice(-8)}`;
    const encounterInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
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
    };
    const procedureOrderInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateOrdered: "2026-06-18 12:10:00",
      priority: "routine",
      status: "pending",
      procedureCode: "80053",
      procedureName,
      procedureType: "laboratory",
      diagnosis: "Z00.00",
      instructions: "Created by the parity procedure specimen detail suite."
    };
    const specimenInput = {
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
    };
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureSpecimenId: number | null = null;
    let encounter: Awaited<ReturnType<typeof workflow.getEncounter>> = null;
    let createdOrder: Awaited<ReturnType<typeof workflow.getProcedureOrder>> = null;
    let specimen: Awaited<ReturnType<typeof workflow.getProcedureSpecimen>> = null;
    let afterCreateCounts: Awaited<ReturnType<typeof targetDb.getPatientWorkflowCounts>> | null = null;
    let afterCreateProcedures: Awaited<ReturnType<typeof targetDb.getProcedureResultsForPatient>> | null = null;
    let specimenOrder: Awaited<ReturnType<typeof targetDb.getProcedureResultsForPatient>>["orders"][number] | undefined;
    let surfaceFacts: Record<string, unknown> = {};

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-131-procedure-specimen-detail-precondition",
      description:
        "Seeded patient, baseline workflow counts, baseline procedure summary, and proposed temporary encounter/order/specimen-detail payload before creating order-level specimen facts.",
      expected: {
        patientCanonicalId: procedureSpecimenDetailAnchorPatientId,
        create: {
          encounter: {
            facilityId: 10,
            billingFacilityId: 10,
            posCode: 11,
            sensitivity: "normal"
          },
          order: {
            status: "pending",
            priority: "routine",
            procedureCode: "80053",
            procedureType: "laboratory",
            diagnosis: "Z00.00"
          },
          specimen: {
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
            specimenCondition: "Acceptable"
          }
        },
        countChange: {
          encountersAfterCreate: beforeCounts.encounters + 1,
          procedureOrdersAfterCreate: beforeCounts.procedureOrders + 1,
          encountersAfterCleanup: beforeCounts.encounters,
          procedureOrdersAfterCleanup: beforeCounts.procedureOrders
        }
      },
      actual: {
        patient,
        beforeCounts,
        beforeProcedures,
        proposed: {
          encounter: encounterInput,
          order: procedureOrderInput,
          specimen: specimenInput
        }
      }
    });

    try {
      encounterId = await workflow.createEncounter(encounterInput);
      encounter = await workflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      procedureOrderId = await workflow.createProcedureOrder({
        encounterId: encounter!.encounter,
        ...procedureOrderInput
      });
      createdOrder = await workflow.getProcedureOrder(procedureOrderId);
      expect(createdOrder).toMatchObject({
        patientId: patient.pid,
        encounterId: encounter!.encounter,
        orderStatus: "pending",
        orderPriority: "routine",
        procedureCode: "80053",
        procedureName,
        procedureType: "laboratory"
      });

      procedureSpecimenId = await workflow.createProcedureSpecimen({
        orderId: procedureOrderId,
        ...specimenInput
      });

      specimen = await workflow.getProcedureSpecimen(procedureSpecimenId);
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

      afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      afterCreateProcedures = await targetDb.getProcedureResultsForPatient(patient.pid);
      specimenOrder = afterCreateProcedures.orders.find((order) => order.procedureName === procedureName);
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterCreateCounts.procedureOrders).toBe(beforeCounts.procedureOrders + 1);
      expect(specimenOrder).not.toBeUndefined();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-131-procedure-specimen-detail-created",
        description:
          "Temporary encounter, pending procedure order, order-level specimen detail row, count deltas, and patient procedure projection after specimen-detail creation.",
        expected: {
          counts: {
            encounters: beforeCounts.encounters + 1,
            procedureOrders: beforeCounts.procedureOrders + 1
          },
          order: {
            orderStatus: "pending",
            orderPriority: "routine",
            procedureCode: "80053",
            procedureName,
            procedureType: "laboratory"
          },
          specimen: {
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
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          beforeProcedures,
          afterCreateProcedures,
          encounterId,
          encounter,
          procedureOrderId,
          createdOrder,
          procedureSpecimenId,
          specimen,
          specimenOrder
        }
      });

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedProcedures(page, target, patient.pubpid);

        await expect(page.locator("body")).toContainText(procedureName);
        await expect(page.locator("body")).toContainText(specimenIdentifier);
        await expect(page.locator("body")).toContainText(`Accession ${accessionIdentifier}`);
        await expect(page.locator("body")).toContainText("Venipuncture");
        await expect(page.locator("body")).toContainText("Left antecubital");
        await expect(page.locator("body")).toContainText("Collected 2026-06-18 12:20");
        await expect(page.locator("body")).toContainText("4.5 mL");
        await expect(page.locator("body")).toContainText("Acceptable");
        surfaceFacts = {
          modernizedProcedures: {
            page: "procedures",
            searchPatientId: patient.pubpid,
            renderedProcedureName: procedureName,
            renderedSpecimenIdentifier: specimenIdentifier,
            renderedAccessionIdentifier: accessionIdentifier,
            renderedCollectionMethod: "Venipuncture",
            renderedSpecimenLocation: "Left antecubital",
            renderedCollectedDate: "2026-06-18 12:20",
            renderedVolume: "4.5 mL",
            renderedCondition: "Acceptable"
          }
        };
      } else {
        surfaceFacts = {
          legacyDatabaseProjection: {
            note:
              "Legacy OpenEMR stores order-level specimen detail in procedure_specimen; this parity slice validates the legacy side through normalized database projection rather than a dedicated browser surface.",
            table: "procedure_specimen",
            specimenIdentifier,
            accessionIdentifier
          }
        };
      }

      const procedureSummary = await targetDb.getProcedureResultsForPatient(patient.pid);
      specimenOrder = procedureSummary.orders.find((order) => order.procedureName === procedureName);
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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-131-procedure-specimen-detail-rendered",
        description:
          "Procedure specimen detail projection after target rendering/projection, including identifier, accession, collection, location, volume, condition, comments, and target-specific surface facts.",
        expected: {
          projection: {
            orderName: procedureName,
            specimenCount: 1,
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
            specimenCondition: "Acceptable"
          }
        },
        actual: {
          patient,
          procedureOrderId,
          procedureSpecimenId,
          specimen,
          procedureSummary,
          specimenOrder,
          surfaceFacts
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

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const afterCleanupProcedures = await targetDb.getProcedureResultsForPatient(patient.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.procedureOrders).toBe(beforeCounts.procedureOrders);
    const deletedOrder = procedureOrderId !== null ? await workflow.getProcedureOrder(procedureOrderId) : null;
    const deletedSpecimen = procedureSpecimenId !== null ? await workflow.getProcedureSpecimen(procedureSpecimenId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-131-procedure-specimen-detail-cleanup",
      description:
        "Temporary procedure specimen detail order tree and temporary encounter were deleted, restoring encounter/procedure counts and removing order/specimen rows.",
      expected: {
        counts: {
          encounters: beforeCounts.encounters,
          procedureOrders: beforeCounts.procedureOrders
        },
        deletedOrder: null,
        deletedSpecimen: null
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        beforeProcedures,
        afterCleanupProcedures,
        encounterId,
        procedureOrderId,
        procedureSpecimenId,
        deletedOrder,
        deletedSpecimen
      }
    });
    if (procedureOrderId !== null) {
      expect(deletedOrder).toBeNull();
    }
    if (procedureSpecimenId !== null) {
      expect(deletedSpecimen).toBeNull();
    }
  });
});

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-12) || "local";
}
