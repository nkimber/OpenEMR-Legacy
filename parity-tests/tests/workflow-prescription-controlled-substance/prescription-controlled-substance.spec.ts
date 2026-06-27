import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedClinicalLists } from "../../src/ui/modernizedOpenEmr.js";

const controlledAnchorPatientId = "MOD-PAT-0008";
const pharmacyId = 9001;
const pharmacyName = "Northstar Community Pharmacy";
const pharmacyEmail = "rx@northstar.example.test";
const pharmacyNcpdp = 4501001;
const pharmacyNpi = 1800001001;
const sentAt = "2026-08-22 10:30:00";
const routeNote = "Controlled substance route attempt from the modernized Lists workspace.";
const blockedReason = "Controlled substance requires EPCS review before pharmacy routing.";

test.describe("prescription controlled substance parity @slice583 @workflow-prescription-controlled-substance @clinical-lists @prescriptions @pharmacy", () => {
  test("blocks ordinary pharmacy routing for a controlled-substance prescription", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(controlledAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const drug = `Oxycodone Controlled Routing ${suffix}`;
    let createdLegacyPharmacy = false;
    let prescriptionId: number | string | null = null;

    try {
      if (target.type === "legacy-openemr") {
        await workflow.createPharmacy({
          id: pharmacyId,
          name: pharmacyName,
          email: pharmacyEmail,
          ncpdp: pharmacyNcpdp,
          npi: pharmacyNpi
        });
        createdLegacyPharmacy = true;
      }

      prescriptionId = await workflow.createPrescription({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        startDate: "2026-08-01",
        drug,
        rxNormCode: "oxycodone-slice-583",
        dosage: "5 mg tablet",
        quantity: "12",
        refills: 0,
        note: "Created by the Slice 583 controlled-substance routing suite.",
        diagnosis: "G89.4"
      });

      const created = await workflow.getPrescription(prescriptionId);
      expect(created).toMatchObject({
        active: 1,
        pharmacyId: null,
        erxUploaded: 0
      });

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedClinicalLists(page, target, patient!.pubpid);
        const prescriptionCard = page.locator("article", { hasText: drug });
        await expect(prescriptionCard).toContainText("CII");
        await expect(prescriptionCard).toContainText(blockedReason);
        await prescriptionCard.getByRole("button", { name: "Route" }).click();
      }

      const routeResult = await workflow.attemptRoutePrescriptionToPharmacy(prescriptionId, pharmacyId, sentAt, routeNote);
      const routed = await workflow.getPrescription(prescriptionId);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-583-prescription-controlled-substance-route-blocked",
        description:
          "Captures the Slice 583 controlled-substance prescription after a normal pharmacy route attempt is blocked before transmit evidence is stamped.",
        expected: {
          routeResult: {
            routed: false,
            failureReason: blockedReason
          },
          prescription: {
            drug,
            active: 1,
            pharmacyId: null,
            erxUploaded: 0,
            erxSentAt: null,
            note: "Created by the Slice 583 controlled-substance routing suite."
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
          routeResult,
          routed
        },
        context: {
          canonicalId: controlledAnchorPatientId,
          suite: "workflow-prescription-controlled-substance",
          workflow: "prescription-controlled-substance-route-block"
        }
      });

      expect(routeResult).toMatchObject({
        routed: false,
        failureReason: blockedReason
      });
      expect(routed).toMatchObject({
        active: 1,
        pharmacyId: null,
        erxUploaded: 0,
        erxSentAt: null,
        note: "Created by the Slice 583 controlled-substance routing suite."
      });

      if (target.type === "modernized-openemr") {
        const prescriptionCard = page.locator("article", { hasText: drug });
        await expect(prescriptionCard).toContainText(blockedReason);
        await expect(prescriptionCard).not.toContainText(pharmacyName);
      }
    } finally {
      if (prescriptionId !== null) {
        await workflow.deletePrescription(prescriptionId);
      }
      if (createdLegacyPharmacy) {
        await workflow.deletePharmacy(pharmacyId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-583-prescription-controlled-substance-cleanup",
      description: "Captures the Slice 583 cleanup state after hard-deleting the temporary controlled prescription.",
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
        canonicalId: controlledAnchorPatientId,
        suite: "workflow-prescription-controlled-substance",
        workflow: "prescription-controlled-substance-cleanup"
      }
    });
    expect(afterCleanupCounts.prescriptions).toBe(beforeCounts.prescriptions);
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
