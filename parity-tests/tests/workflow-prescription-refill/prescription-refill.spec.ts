import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedClinicalLists } from "../../src/ui/modernizedOpenEmr.js";

const prescriptionRefillAnchorPatientId = "MOD-PAT-0008";
const refillDate = "2026-08-20";
const refillNote = "Refill authorized from the modernized Lists workspace.";

test.describe("prescription refill parity @slice579 @workflow-prescription-refill @clinical-lists @prescriptions", () => {
  test("authorizes a focused prescription refill without ending the prescription", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(prescriptionRefillAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const drug = `Refill Readiness ${workflowSuffix()}`;
    let prescriptionId: number | string | null = null;

    try {
      prescriptionId = await workflow.createPrescription({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        startDate: "2026-08-01",
        drug,
        rxNormCode: "1049502",
        dosage: "1 tablet daily",
        quantity: "30",
        refills: 1,
        note: "Created by the Slice 579 prescription refill suite.",
        diagnosis: "Z00.00"
      });

      const created = await workflow.getPrescription(prescriptionId);
      expect(created).toMatchObject({
        refills: 1,
        active: 1,
        endDate: null
      });

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedClinicalLists(page, target, patient!.pubpid);
        const prescriptionCard = page.locator("article", { hasText: drug });
        await expect(prescriptionCard).toContainText("1 refill");
        await prescriptionCard.getByRole("button", { name: "Refill" }).click();
      } else {
        await workflow.refillPrescription(prescriptionId, refillDate, 1, refillNote);
      }

      const refilled = await workflow.getPrescription(prescriptionId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-579-prescription-refill-authorized",
        description:
          "Captures the Slice 579 temporary prescription after authorizing one additional refill while keeping the prescription active.",
        expected: {
          prescription: {
            drug,
            refills: 2,
            active: 1,
            modifiedDate: refillDate,
            endDate: null,
            note: refillNote
          },
          counts: {
            prescriptions: beforeCounts.prescriptions + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          prescriptionId,
          created,
          refilled
        },
        context: {
          canonicalId: prescriptionRefillAnchorPatientId,
          suite: "workflow-prescription-refill",
          workflow: "prescription-refill"
        }
      });

      expect(refilled).toMatchObject({
        refills: 2,
        active: 1,
        modifiedDate: refillDate,
        endDate: null,
        note: refillNote
      });

      if (target.type === "modernized-openemr") {
        const prescriptionCard = page.locator("article", { hasText: drug });
        await expect(prescriptionCard).toContainText("2 refills");
        await expect(prescriptionCard).toContainText(refillNote);
      }
    } finally {
      if (prescriptionId !== null) {
        await workflow.deletePrescription(prescriptionId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-579-prescription-refill-cleanup",
      description: "Captures the Slice 579 cleanup state after hard-deleting the temporary refill prescription.",
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
        canonicalId: prescriptionRefillAnchorPatientId,
        suite: "workflow-prescription-refill",
        workflow: "prescription-refill-cleanup"
      }
    });
    expect(afterCleanupCounts.prescriptions).toBe(beforeCounts.prescriptions);
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
