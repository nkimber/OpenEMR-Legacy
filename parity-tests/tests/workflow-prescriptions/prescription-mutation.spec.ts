import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedClinicalLists } from "../../src/ui/modernizedOpenEmr.js";

const prescriptionMutationAnchorPatientId = "MOD-PAT-0008";

test.describe("prescription mutation parity @slice15 @workflow-prescriptions @mutation", () => {
  test("creates, renders, deactivates, and removes a prescription", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(prescriptionMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const drug = `Parity Medication ${workflowSuffix()}`;
    const prescriptionInput = {
      patientId: patient!.pid,
      providerId: patient!.providerId,
      startDate: "2026-07-15",
      drug,
      rxNormCode: "1049502",
      dosage: "1 tablet daily",
      quantity: "30",
      refills: 1,
      note: "Created by the parity prescription mutation suite.",
      diagnosis: "Z00.00"
    };
    let prescriptionId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-15-prescription-mutation-precondition",
      description: "Captures the Slice 15 prescription mutation anchor patient, workflow counts before mutation, and proposed prescription create payload.",
      expected: {
        patient: {
          pubpid: prescriptionMutationAnchorPatientId
        },
        create: {
          startDate: "2026-07-15",
          rxNormCode: "1049502",
          dosage: "1 tablet daily",
          quantity: "30",
          refills: 1,
          active: 1,
          diagnosis: "Z00.00"
        }
      },
      actual: {
        patient,
        beforeCounts,
        proposed: prescriptionInput
      },
      context: {
        canonicalId: prescriptionMutationAnchorPatientId,
        suite: "workflow-prescriptions",
        workflow: "prescription-mutation"
      }
    });

    try {
      prescriptionId = await workflow.createPrescription(prescriptionInput);

      const created = await workflow.getPrescription(prescriptionId);
      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-15-prescription-mutation-created",
        description: "Captures the temporary prescription database row immediately after Slice 15 creates it, including the prescription-count increment.",
        expected: {
          prescription: {
            patientId: patient!.pid,
            providerId: patient!.providerId,
            startDate: "2026-07-15",
            drug,
            dosage: "1 tablet daily",
            quantity: "30",
            refills: 1,
            active: 1
          },
          counts: {
            prescriptions: beforeCounts.prescriptions + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          prescriptionId,
          created
        },
        context: {
          canonicalId: prescriptionMutationAnchorPatientId,
          suite: "workflow-prescriptions",
          workflow: "prescription-mutation-created"
        }
      });

      expect(created).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        startDate: "2026-07-15",
        drug,
        dosage: "1 tablet daily",
        quantity: "30",
        refills: 1,
        active: 1
      });

      expect(afterCreateCounts.prescriptions).toBe(beforeCounts.prescriptions + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, drug);
      } else {
        await openAuthenticatedModernizedClinicalLists(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText(drug);
        await expect(page.locator("body")).toContainText("1 tablet daily / oral / Z00.00");
        await expect(page.locator("body")).toContainText("Qty 30 / 1 refill");
      }

      const inactiveNote = "Deactivated by the parity prescription mutation suite.";
      await workflow.deactivatePrescription(prescriptionId, "2026-08-15", inactiveNote);
      const inactive = await workflow.getPrescription(prescriptionId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-15-prescription-mutation-deactivated",
        description: "Captures the temporary prescription database row after Slice 15 deactivates it and before cleanup.",
        expected: {
          prescription: {
            drug,
            active: 0,
            endDate: "2026-08-15",
            note: inactiveNote
          }
        },
        actual: {
          patient,
          prescriptionId,
          created,
          inactive
        },
        context: {
          canonicalId: prescriptionMutationAnchorPatientId,
          suite: "workflow-prescriptions",
          workflow: "prescription-mutation-deactivated"
        }
      });

      expect(inactive).toMatchObject({
        active: 0,
        endDate: "2026-08-15",
        note: inactiveNote
      });
    } finally {
      if (prescriptionId !== null) {
        await workflow.deletePrescription(prescriptionId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const deleted = prescriptionId !== null ? await workflow.getPrescription(prescriptionId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-15-prescription-mutation-cleanup",
      description: "Captures the Slice 15 cleanup state after hard-deleting the temporary prescription row.",
      expected: {
        counts: {
          prescriptions: beforeCounts.prescriptions
        },
        deletedPrescription: null
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        prescriptionId,
        deleted
      },
      context: {
        canonicalId: prescriptionMutationAnchorPatientId,
        suite: "workflow-prescriptions",
        workflow: "prescription-mutation-cleanup"
      }
    });

    expect(afterCleanupCounts.prescriptions).toBe(beforeCounts.prescriptions);
    if (prescriptionId !== null) {
      expect(deleted).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
