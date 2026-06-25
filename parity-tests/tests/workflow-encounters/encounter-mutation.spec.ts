import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";

const encounterAnchorPatientId = "MOD-PAT-0002";

test.describe("encounter mutation parity @slice12 @workflow-encounters @mutation", () => {
  test("creates, updates, renders, and removes an encounter with vitals and SOAP details", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const reason = `Parity Encounter ${workflowSuffix()}`;
    const encounterInput = {
      patientId: patient!.pid,
      providerId: patient!.providerId,
      dateTime: "2026-06-18 10:00:00",
      reason,
      facilityId: 10,
      facilityName: "OpenEMR Modernization Clinic",
      billingFacilityId: 10,
      billingNote: "Created by the parity encounter mutation suite."
    };
    const vitalsInput = {
      patientId: patient!.pid,
      dateTime: "2026-06-18 10:05:00",
      bps: "128",
      bpd: "76",
      weight: 186,
      height: 70,
      pulse: 72,
      oxygenSaturation: 98,
      note: "Parity vitals detail."
    };
    const soapInput = {
      patientId: patient!.pid,
      dateTime: "2026-06-18 10:10:00",
      subjective: "Patient reports parity workflow symptoms are stable.",
      objective: "Vitals reviewed during parity workflow.",
      assessment: "Stable parity workflow condition.",
      plan: "Continue parity workflow validation."
    };
    let encounterId: number | null = null;
    let vitalsId: number | null = null;
    let soapId: number | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-12-encounter-mutation-precondition",
      description: "Captures the Slice 12 encounter mutation anchor patient, workflow counts before mutation, and proposed encounter/vitals/SOAP payloads.",
      expected: {
        patient: {
          pubpid: encounterAnchorPatientId
        },
        create: {
          encounterDate: "2026-06-18",
          facilityId: 10,
          billingFacilityId: 10,
          bps: "128",
          bpd: "76",
          assessment: "Stable parity workflow condition."
        }
      },
      actual: {
        patient,
        beforeCounts,
        proposed: {
          encounter: encounterInput,
          vitals: vitalsInput,
          soap: soapInput
        }
      },
      context: {
        canonicalId: encounterAnchorPatientId,
        suite: "workflow-encounters",
        workflow: "encounter-mutation"
      }
    });

    try {
      encounterId = await workflow.createEncounter(encounterInput);

      const createdEncounter = await workflow.getEncounter(encounterId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-12-encounter-mutation-created-encounter",
        description: "Captures the temporary encounter database row immediately after Slice 12 creates it.",
        expected: {
          encounter: {
            patientId: patient!.pid,
            providerId: patient!.providerId,
            date: "2026-06-18",
            reason,
            facilityId: 10,
            billingFacilityId: 10
          }
        },
        actual: {
          patient,
          beforeCounts,
          encounterId,
          createdEncounter
        },
        context: {
          canonicalId: encounterAnchorPatientId,
          suite: "workflow-encounters",
          workflow: "encounter-mutation-created-encounter"
        }
      });

      expect(createdEncounter).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        date: "2026-06-18",
        reason,
        facilityId: 10,
        billingFacilityId: 10
      });

      vitalsId = await workflow.createVitals({
        ...vitalsInput,
        encounter: createdEncounter!.encounter,
      });

      const vitals = await workflow.getVitals(vitalsId);
      expect(vitals).toMatchObject({
        patientId: patient!.pid,
        bps: "128",
        bpd: "76",
        weight: 186,
        height: 70,
        pulse: 72,
        oxygenSaturation: 98,
        note: "Parity vitals detail."
      });

      soapId = await workflow.createSoapNote({
        ...soapInput,
        encounter: createdEncounter!.encounter,
      });

      const soap = await workflow.getSoapNote(soapId);
      expect(soap).toMatchObject({
        patientId: patient!.pid,
        subjective: "Patient reports parity workflow symptoms are stable.",
        objective: "Vitals reviewed during parity workflow.",
        assessment: "Stable parity workflow condition.",
        plan: "Continue parity workflow validation."
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-12-encounter-mutation-clinical-details",
        description: "Captures the temporary vitals and SOAP rows plus workflow-count increments after Slice 12 creates the clinical details.",
        expected: {
          counts: {
            encounters: beforeCounts.encounters + 1,
            vitals: beforeCounts.vitals + 1,
            clinicalNotes: beforeCounts.clinicalNotes + 1
          },
          vitals: {
            bps: "128",
            bpd: "76",
            weight: 186,
            height: 70,
            pulse: 72,
            oxygenSaturation: 98
          },
          soap: {
            assessment: "Stable parity workflow condition."
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          encounterId,
          vitalsId,
          soapId,
          createdEncounter,
          vitals,
          soap
        },
        context: {
          canonicalId: encounterAnchorPatientId,
          suite: "workflow-encounters",
          workflow: "encounter-mutation-clinical-details"
        }
      });

      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterCreateCounts.vitals).toBe(beforeCounts.vitals + 1);
      expect(afterCreateCounts.clinicalNotes).toBe(beforeCounts.clinicalNotes + 1);

      const updatedReason = `${reason} Updated`;
      const updatedBillingNote = "Updated by the parity encounter mutation suite.";
      await workflow.updateEncounterReason(encounterId, updatedReason, updatedBillingNote);
      const updatedEncounter = await workflow.getEncounter(encounterId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-12-encounter-mutation-updated-encounter",
        description: "Captures the temporary encounter database row after Slice 12 updates reason and billing note before browser-visible assertions.",
        expected: {
          encounter: {
            reason: updatedReason,
            billingNote: updatedBillingNote
          }
        },
        actual: {
          patient,
          encounterId,
          createdEncounter,
          updatedEncounter
        },
        context: {
          canonicalId: encounterAnchorPatientId,
          suite: "workflow-encounters",
          workflow: "encounter-mutation-updated-encounter"
        }
      });

      expect(updatedEncounter).toMatchObject({
        reason: updatedReason,
        billingNote: updatedBillingNote
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);

        await expect(page.locator("body")).toContainText(patient!.lname);
      } else {
        await openAuthenticatedModernizedEncounters(page, target, patient!.pubpid, "2026-06-18");

        const encounterButton = page.getByRole("button", { name: new RegExp(escapeRegex(updatedReason), "i") }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();
        await expect(page.getByRole("heading", { name: updatedReason })).toBeVisible();
        await expect(page.locator("body")).toContainText(updatedBillingNote);
        await expect(page.locator("body")).toContainText("128/76");
        await expect(page.locator("body")).toContainText("Stable parity workflow condition.");
      }
    } finally {
      if (soapId !== null) {
        await workflow.deleteSoapNote(soapId);
      }
      if (vitalsId !== null) {
        await workflow.deleteVitals(vitalsId);
      }
      if (encounterId !== null) {
        await workflow.deleteEncounter(encounterId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const deletedEncounter = encounterId !== null ? await workflow.getEncounter(encounterId) : null;
    const deletedVitals = vitalsId !== null ? await workflow.getVitals(vitalsId) : null;
    const deletedSoap = soapId !== null ? await workflow.getSoapNote(soapId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-12-encounter-mutation-cleanup",
      description: "Captures the Slice 12 cleanup state after deleting temporary SOAP, vitals, and encounter rows.",
      expected: {
        counts: {
          encounters: beforeCounts.encounters,
          vitals: beforeCounts.vitals,
          clinicalNotes: beforeCounts.clinicalNotes
        },
        deletedEncounter: null,
        deletedVitals: null,
        deletedSoap: null
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        encounterId,
        vitalsId,
        soapId,
        deletedEncounter,
        deletedVitals,
        deletedSoap
      },
      context: {
        canonicalId: encounterAnchorPatientId,
        suite: "workflow-encounters",
        workflow: "encounter-mutation-cleanup"
      }
    });

    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.vitals).toBe(beforeCounts.vitals);
    expect(afterCleanupCounts.clinicalNotes).toBe(beforeCounts.clinicalNotes);
    if (encounterId !== null) {
      expect(deletedEncounter).toBeNull();
    }
    if (vitalsId !== null) {
      expect(deletedVitals).toBeNull();
    }
    if (soapId !== null) {
      expect(deletedSoap).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
