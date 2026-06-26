import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";

const appointmentBillingAnchorPatientId = "MOD-PAT-0004";
const chargeCode = "99213";
const chargeFee = "125.00";
const chargeJustify = "Z00.00";

test.describe("appointment to billing conversion parity @slice523 @workflow-appointment-billing-conversion @mutation", () => {
  test("creates a starter fee-sheet charge from a converted appointment", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentBillingAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentBillingAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const title = `Slice 523 Charge ${workflowSuffix()}`;
    const chargeText = `${title} appointment charge`;
    const appointmentInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      title,
      eventDate: "2026-10-23",
      startTime: "09:15:00",
      endTime: "09:45:00",
      durationSeconds: 1800,
      homeText: "Slice 523 appointment billing conversion source.",
      facilityId: 10,
      billingLocationId: 10,
      room: "Charge",
      categoryId: 9
    };

    let appointmentId: number | string | null = null;
    let encounterId: number | null = null;
    let billingLineId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-523-appointment-billing-conversion-precondition",
      description: "Captures the Slice 523 appointment-to-billing anchor patient, baseline counts, and expected starter charge.",
      expected: {
        patient: {
          pubpid: appointmentBillingAnchorPatientId,
          providerId: patient.providerId
        },
        appointment: {
          title,
          eventDate: "2026-10-23",
          startTime: "09:15:00",
          facilityId: 10,
          billingLocationId: 10,
          categoryId: 9
        },
        charge: {
          codeType: "CPT4",
          code: chargeCode,
          codeText: chargeText,
          fee: chargeFee,
          justify: chargeJustify
        }
      },
      actual: {
        patient,
        beforeCounts,
        proposedCreate: appointmentInput
      },
      context: {
        canonicalId: appointmentBillingAnchorPatientId,
        suite: "workflow-appointment-billing-conversion",
        workflow: "appointment-billing-conversion"
      }
    });

    try {
      appointmentId = await workflow.createAppointment(appointmentInput);
      const createdAppointment = await workflow.getAppointment(appointmentId);
      expect(createdAppointment).toMatchObject({
        patientId: patient.pid,
        providerId: patient.providerId,
        title,
        eventDate: "2026-10-23",
        startTime: "09:15:00",
        facilityId: 10,
        billingLocationId: 10,
        room: "Charge",
        categoryId: 9
      });

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedCalendar(page, target, patient.pubpid, "2026-10-23");

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

        await page.getByRole("button", { name: "Create charge" }).click();
        await expect(page.getByRole("button", { name: "Charge created" })).toBeVisible();
        await expect(page.getByText("Converted charges")).toBeVisible();
        await expect(page.getByText("1 active fee-sheet line")).toBeVisible();

        await expect
          .poll(async () => {
            const lines = await targetDb.getBillingLinesForEncounter(patient.pid, encounterId!);
            return lines.find((line) => line.code === chargeCode && line.codeText === chargeText)?.id ?? null;
          }, { timeout: 10000 })
          .not.toBeNull();
        const lines = await targetDb.getBillingLinesForEncounter(patient.pid, encounterId);
        billingLineId = lines.find((line) => line.code === chargeCode && line.codeText === chargeText)?.id ?? null;
      } else {
        encounterId = await workflow.createEncounter({
          patientId: patient.pid,
          providerId: patient.providerId,
          dateTime: "2026-10-23 09:15:00",
          reason: title,
          facilityId: 10,
          facilityName: "OpenEMR Modernization Clinic",
          billingFacilityId: 10,
          referralSource: "appointment",
          billingNote: appointmentInput.homeText,
          sourceAppointmentId: String(appointmentId)
        });
        billingLineId = await workflow.createBillingLine({
          patientId: patient.pid,
          providerId: patient.providerId,
          encounter: encounterId,
          dateTime: "2026-10-23 09:15:00",
          codeType: "CPT4",
          code: chargeCode,
          modifier: "",
          codeText: chargeText,
          fee: chargeFee,
          units: 1,
          justify: chargeJustify
        });
      }

      if (encounterId === null || billingLineId === null) {
        throw new Error("Appointment-to-billing conversion did not produce both encounter and billing line IDs.");
      }

      const convertedAppointment = await workflow.getAppointment(appointmentId);
      const createdEncounter = await workflow.getEncounter(encounterId);
      const billingLine = await workflow.getBillingLine(billingLineId);
      const encounterLines = await targetDb.getBillingLinesForEncounter(patient.pid, encounterId);

      expect(createdEncounter).toMatchObject({
        patientId: patient.pid,
        providerId: patient.providerId,
        date: "2026-10-23",
        reason: title,
        facilityId: 10,
        billingFacilityId: 10,
        sourceAppointmentId: String(appointmentId)
      });
      expect(billingLine).toMatchObject({
        patientId: patient.pid,
        encounter: encounterId,
        codeType: "CPT4",
        code: chargeCode,
        codeText: chargeText,
        fee: chargeFee,
        units: 1,
        activity: 1,
        billed: 0
      });
      expect(encounterLines.some((line) => line.id === String(billingLineId) && line.justify === chargeJustify)).toBe(true);

      if (target.type === "modernized-openemr") {
        expect(convertedAppointment?.convertedEncounterId).toBe(encounterId);
        expect(convertedAppointment?.convertedBillingLineCount).toBe(1);
      }

      const afterChargeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-523-appointment-billing-conversion-result",
        description: "Captures the converted appointment encounter and starter fee-sheet charge after Slice 523 charge handoff.",
        expected: {
          encounter: {
            patientId: patient.pid,
            providerId: patient.providerId,
            date: "2026-10-23",
            sourceAppointmentId: String(appointmentId)
          },
          charge: {
            encounter: encounterId,
            codeType: "CPT4",
            code: chargeCode,
            codeText: chargeText,
            fee: chargeFee,
            justify: chargeJustify
          },
          counts: {
            appointments: beforeCounts.appointments + 1,
            encounters: beforeCounts.encounters + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterChargeCounts,
          appointmentId,
          encounterId,
          billingLineId,
          convertedAppointment,
          createdEncounter,
          billingLine,
          encounterLines
        },
        context: {
          canonicalId: appointmentBillingAnchorPatientId,
          suite: "workflow-appointment-billing-conversion",
          workflow: "appointment-billing-conversion-result"
        }
      });

      expect(afterChargeCounts.appointments).toBe(beforeCounts.appointments + 1);
      expect(afterChargeCounts.encounters).toBe(beforeCounts.encounters + 1);
    } finally {
      if (billingLineId !== null) {
        await workflow.deleteBillingLine(billingLineId);
      }
      if (encounterId !== null) {
        await workflow.deleteEncounter(encounterId);
      }
      if (appointmentId !== null) {
        await workflow.deleteAppointment(appointmentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const deletedBillingLine = billingLineId !== null ? await workflow.getBillingLine(billingLineId) : null;
    const deletedEncounter = encounterId !== null ? await workflow.getEncounter(encounterId) : null;
    const deletedAppointment = appointmentId !== null ? await workflow.getAppointment(appointmentId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-523-appointment-billing-conversion-cleanup",
      description: "Captures the Slice 523 cleanup state after deleting the temporary starter charge, encounter, and appointment.",
      expected: {
        counts: {
          appointments: beforeCounts.appointments,
          encounters: beforeCounts.encounters
        },
        deletedBillingLine: null,
        deletedEncounter: null,
        deletedAppointment: null
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        appointmentId,
        encounterId,
        billingLineId,
        deletedBillingLine,
        deletedEncounter,
        deletedAppointment
      },
      context: {
        canonicalId: appointmentBillingAnchorPatientId,
        suite: "workflow-appointment-billing-conversion",
        workflow: "appointment-billing-conversion-cleanup"
      }
    });

    expect(afterCleanupCounts.appointments).toBe(beforeCounts.appointments);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    if (billingLineId !== null) {
      expect(deletedBillingLine).toBeNull();
    }
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
