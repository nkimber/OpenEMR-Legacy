import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedClinicalLists } from "../../src/ui/modernizedOpenEmr.js";

const structuredDoseAnchorPatientId = "MOD-PAT-0008";

test.describe("prescription structured dose parity @slice585 @workflow-prescription-structured-dose @clinical-lists @prescriptions", () => {
  test("creates and renders structured dose, frequency, and duration for a temporary prescription", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(structuredDoseAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const drug = `Structured Dose Prescription ${workflowSuffix()}`;
    let prescriptionId: number | string | null = null;

    try {
      prescriptionId = await workflow.createPrescription({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        startDate: "2026-08-12",
        drug,
        rxNormCode: "structured-slice-585",
        dosage: "10 mg tablet",
        quantity: "28",
        doseAmount: 10,
        doseUnit: "mg",
        frequency: "twice daily",
        durationDays: 14,
        refills: 1,
        note: "Created by the Slice 585 structured dose suite.",
        diagnosis: "Z00.00"
      });

      const prescription = await workflow.getPrescription(prescriptionId);
      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-585-prescription-structured-dose-created",
        description:
          "Captures the Slice 585 temporary prescription after create, including structured dose, frequency, and duration evidence.",
        expected: {
          prescription: {
            patientId: patient!.pid,
            providerId: patient!.providerId,
            startDate: "2026-08-12",
            drug,
            dosage: "10 mg tablet",
            quantity: "28",
            doseAmount: 10,
            doseUnit: "mg",
            frequency: "twice daily",
            durationDays: 14,
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
          prescription
        },
        context: {
          canonicalId: structuredDoseAnchorPatientId,
          suite: "workflow-prescription-structured-dose",
          workflow: "prescription-structured-dose"
        }
      });

      expect(prescription).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        startDate: "2026-08-12",
        drug,
        dosage: "10 mg tablet",
        quantity: "28",
        doseAmount: 10,
        doseUnit: "mg",
        frequency: "twice daily",
        durationDays: 14,
        refills: 1,
        active: 1
      });
      expect(afterCreateCounts.prescriptions).toBe(beforeCounts.prescriptions + 1);

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedClinicalLists(page, target, patient!.pubpid);
        const prescriptionCard = page.locator("article", { hasText: drug });
        await expect(prescriptionCard).toContainText("Dose 10 mg");
        await expect(prescriptionCard).toContainText("Frequency twice daily");
        await expect(prescriptionCard).toContainText("Duration 14 days");
      }
    } finally {
      if (prescriptionId !== null) {
        await workflow.deletePrescription(prescriptionId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-585-prescription-structured-dose-cleanup",
      description: "Captures the Slice 585 cleanup state after hard-deleting the temporary structured-dose prescription.",
      expected: {
        counts: {
          prescriptions: beforeCounts.prescriptions
        }
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        prescriptionId
      },
      context: {
        canonicalId: structuredDoseAnchorPatientId,
        suite: "workflow-prescription-structured-dose",
        workflow: "prescription-structured-dose-cleanup"
      }
    });
    expect(afterCleanupCounts.prescriptions).toBe(beforeCounts.prescriptions);
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
