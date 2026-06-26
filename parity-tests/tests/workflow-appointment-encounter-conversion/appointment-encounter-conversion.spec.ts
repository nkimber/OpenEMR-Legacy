import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";

const appointmentConversionAnchorPatientId = "MOD-PAT-0004";

test.describe("appointment to encounter conversion parity @slice522 @workflow-appointment-encounter-conversion @mutation", () => {
  test("creates an appointment-backed encounter and preserves schedule context", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentConversionAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentConversionAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const title = `Slice 522 Conversion ${workflowSuffix()}`;
    const appointmentInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      title,
      eventDate: "2026-10-22",
      startTime: "09:15:00",
      endTime: "09:45:00",
      durationSeconds: 1800,
      homeText: "Slice 522 appointment conversion source.",
      facilityId: 10,
      billingLocationId: 10,
      room: "Conversion",
      categoryId: 9
    };

    let appointmentId: number | string | null = null;
    let encounterId: number | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-522-appointment-encounter-conversion-precondition",
      description: "Captures the Slice 522 appointment-to-encounter conversion anchor patient, baseline counts, and proposed appointment payload.",
      expected: {
        patient: {
          pubpid: appointmentConversionAnchorPatientId,
          providerId: patient.providerId
        },
        appointment: {
          title,
          eventDate: "2026-10-22",
          startTime: "09:15:00",
          endTime: "09:45:00",
          facilityId: 10,
          billingLocationId: 10,
          categoryId: 9
        },
        countChange: {
          appointmentsAfterCreate: beforeCounts.appointments + 1,
          encountersAfterConversion: beforeCounts.encounters + 1
        }
      },
      actual: {
        patient,
        beforeCounts,
        proposedCreate: appointmentInput
      },
      context: {
        canonicalId: appointmentConversionAnchorPatientId,
        suite: "workflow-appointment-encounter-conversion",
        workflow: "appointment-encounter-conversion"
      }
    });

    try {
      appointmentId = await workflow.createAppointment(appointmentInput);
      const createdAppointment = await workflow.getAppointment(appointmentId);
      expect(createdAppointment).toMatchObject({
        patientId: patient.pid,
        providerId: patient.providerId,
        title,
        eventDate: "2026-10-22",
        startTime: "09:15:00",
        endTime: "09:45:00",
        facilityId: 10,
        billingLocationId: 10,
        room: "Conversion",
        categoryId: 9
      });

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedCalendar(page, target, patient.pubpid, "2026-10-22");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        await page.getByRole("button", { name: "Create encounter" }).click();
        await expect(page.getByRole("button", { name: "Encounter created" })).toBeVisible();

        await expect
          .poll(async () => {
            const converted = await workflow.getAppointment(appointmentId!);
            return converted?.convertedEncounterId ?? null;
          }, { timeout: 10000 })
          .not.toBeNull();
        const converted = await workflow.getAppointment(appointmentId);
        encounterId = converted?.convertedEncounterId ?? null;
        if (encounterId === null) {
          throw new Error("Modernized appointment did not expose a converted encounter ID.");
        }
      } else {
        encounterId = await workflow.createEncounter({
          patientId: patient.pid,
          providerId: patient.providerId,
          dateTime: "2026-10-22 09:15:00",
          reason: title,
          facilityId: 10,
          facilityName: "OpenEMR Modernization Clinic",
          billingFacilityId: 10,
          referralSource: "appointment",
          billingNote: appointmentInput.homeText,
          sourceAppointmentId: String(appointmentId)
        });
      }

      const convertedAppointment = await workflow.getAppointment(appointmentId);
      if (encounterId === null) {
        throw new Error("Appointment-to-encounter conversion did not produce an encounter ID.");
      }
      const createdEncounter = await workflow.getEncounter(encounterId);
      expect(createdEncounter).toMatchObject({
        patientId: patient.pid,
        providerId: patient.providerId,
        date: "2026-10-22",
        reason: title,
        facilityId: 10,
        billingFacilityId: 10,
        sourceAppointmentId: String(appointmentId)
      });

      if (target.type === "modernized-openemr") {
        expect(convertedAppointment?.convertedEncounterId).toBe(encounterId);
        expect(convertedAppointment?.convertedEncounterDate).toBe("2026-10-22");
      }

      const afterConversionCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-522-appointment-encounter-conversion-result",
        description: "Captures the temporary appointment and appointment-backed encounter after Slice 522 conversion while preserving schedule context.",
        expected: {
          appointment: {
            patientId: patient.pid,
            providerId: patient.providerId,
            eventDate: "2026-10-22",
            startTime: "09:15:00",
            facilityId: 10,
            billingLocationId: 10
          },
          encounter: {
            patientId: patient.pid,
            providerId: patient.providerId,
            date: "2026-10-22",
            reason: title,
            facilityId: 10,
            billingFacilityId: 10,
            sourceAppointmentId: String(appointmentId)
          },
          counts: {
            appointments: beforeCounts.appointments + 1,
            encounters: beforeCounts.encounters + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterConversionCounts,
          appointmentId,
          encounterId,
          convertedAppointment,
          createdEncounter
        },
        context: {
          canonicalId: appointmentConversionAnchorPatientId,
          suite: "workflow-appointment-encounter-conversion",
          workflow: "appointment-encounter-conversion-result"
        }
      });

      expect(afterConversionCounts.appointments).toBe(beforeCounts.appointments + 1);
      expect(afterConversionCounts.encounters).toBe(beforeCounts.encounters + 1);
    } finally {
      if (encounterId !== null) {
        await workflow.deleteEncounter(encounterId);
      }
      if (appointmentId !== null) {
        await workflow.deleteAppointment(appointmentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const deletedEncounter = encounterId !== null ? await workflow.getEncounter(encounterId) : null;
    const deletedAppointment = appointmentId !== null ? await workflow.getAppointment(appointmentId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-522-appointment-encounter-conversion-cleanup",
      description: "Captures the Slice 522 cleanup state after deleting the temporary appointment-backed encounter and appointment.",
      expected: {
        counts: {
          appointments: beforeCounts.appointments,
          encounters: beforeCounts.encounters
        },
        deletedEncounter: null,
        deletedAppointment: null
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        appointmentId,
        encounterId,
        deletedEncounter,
        deletedAppointment
      },
      context: {
        canonicalId: appointmentConversionAnchorPatientId,
        suite: "workflow-appointment-encounter-conversion",
        workflow: "appointment-encounter-conversion-cleanup"
      }
    });

    expect(afterCleanupCounts.appointments).toBe(beforeCounts.appointments);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    if (encounterId !== null) {
      expect(deletedEncounter).toBeNull();
    }
    if (appointmentId !== null) {
      expect(deletedAppointment).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
