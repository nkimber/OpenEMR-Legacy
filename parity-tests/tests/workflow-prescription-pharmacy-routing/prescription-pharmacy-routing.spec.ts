import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedClinicalLists } from "../../src/ui/modernizedOpenEmr.js";

const pharmacyRoutingAnchorPatientId = "MOD-PAT-0008";
const sentAt = "2026-08-21 09:15:00";
const routeNote = "Prescription routed to Northstar Community Pharmacy from the modernized Lists workspace.";

test.describe("prescription pharmacy routing parity @slice582 @workflow-prescription-pharmacy-routing @clinical-lists @prescriptions @pharmacy", () => {
  test("routes an active prescription to a selected pharmacy and records transmit evidence", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(pharmacyRoutingAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const drug = `Pharmacy Routing ${suffix}`;
    const pharmacyId = 9001;
    const pharmacyName = "Northstar Community Pharmacy";
    const pharmacyEmail = "rx@northstar.example.test";
    const pharmacyNcpdp = 4501001;
    const pharmacyNpi = 1800001001;
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
        rxNormCode: "1049502",
        dosage: "1 tablet daily",
        quantity: "30",
        refills: 1,
        note: "Created by the Slice 582 prescription pharmacy routing suite.",
        diagnosis: "Z00.00"
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
        await expect(prescriptionCard).toContainText("1 refill");
        await prescriptionCard.getByRole("button", { name: "Route" }).click();
      } else {
        await workflow.routePrescriptionToPharmacy(prescriptionId, pharmacyId, sentAt, routeNote);
      }

      const routed = await workflow.getPrescription(prescriptionId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-582-prescription-pharmacy-routed",
        description:
          "Captures the Slice 582 temporary prescription after routing it to a selected pharmacy with deterministic transmit evidence.",
        expected: {
          prescription: {
            drug,
            active: 1,
            pharmacyName,
            pharmacyNcpdp,
            erxUploaded: 1,
            erxSentAt: sentAt,
            note: routeNote
          },
          counts: {
            prescriptions: beforeCounts.prescriptions + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          pharmacyId,
          pharmacy: await workflow.getPharmacy(pharmacyId),
          prescriptionId,
          created,
          routed
        },
        context: {
          canonicalId: pharmacyRoutingAnchorPatientId,
          suite: "workflow-prescription-pharmacy-routing",
          workflow: "prescription-pharmacy-routing"
        }
      });

      expect(routed).toMatchObject({
        active: 1,
        pharmacyId,
        pharmacyName,
        pharmacyNcpdp,
        erxUploaded: 1,
        erxSentAt: sentAt,
        note: routeNote
      });
      expect(routed?.erxPayload).toContain(`Prescription ID: ${prescriptionId}`);
      expect(routed?.erxPayload).toContain(`Pharmacy: ${pharmacyName}`);
      expect(routed?.erxPayload).toContain(`NCPDP: ${pharmacyNcpdp}`);

      if (target.type === "modernized-openemr") {
        const prescriptionCard = page.locator("article", { hasText: drug });
        await expect(prescriptionCard).toContainText(pharmacyName);
        await expect(prescriptionCard).toContainText(`NCPDP ${pharmacyNcpdp}`);
        await expect(prescriptionCard).toContainText(sentAt);
        await expect(prescriptionCard).toContainText(routeNote);
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
      probe: "slice-582-prescription-pharmacy-routing-cleanup",
      description: "Captures the Slice 582 cleanup state after hard-deleting the temporary routed prescription and pharmacy.",
      expected: {
        counts: {
          prescriptions: beforeCounts.prescriptions
        }
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        prescriptionId,
        pharmacyId
      },
      context: {
        canonicalId: pharmacyRoutingAnchorPatientId,
        suite: "workflow-prescription-pharmacy-routing",
        workflow: "prescription-pharmacy-routing-cleanup"
      }
    });
    expect(afterCleanupCounts.prescriptions).toBe(beforeCounts.prescriptions);
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
