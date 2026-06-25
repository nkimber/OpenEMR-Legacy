import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";

test.describe("appointment mutation parity @slice11 @workflow-appointments @mutation", () => {
  test("creates, cancels, renders, and removes a future appointment", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Appointment ${workflowSuffix()}`;
    const appointmentInput = {
      patientId: patient!.pid,
      providerId: patient!.providerId,
      title,
      eventDate: "2026-10-15",
      startTime: "10:30:00",
      endTime: "11:00:00",
      durationSeconds: 1800,
      homeText: "Created by the parity appointment mutation suite.",
      facilityId: 10,
      billingLocationId: 10,
      room: "Parity"
    };
    let appointmentId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-11-appointment-mutation-precondition",
      description: "Captures the Slice 11 appointment mutation anchor patient, workflow counts before mutation, and proposed future appointment create payload.",
      expected: {
        patient: {
          pubpid: appointmentAnchorPatientId
        },
        create: {
          eventDate: "2026-10-15",
          startTime: "10:30:00",
          endTime: "11:00:00",
          durationSeconds: 1800,
          facilityId: 10,
          billingLocationId: 10,
          room: "Parity",
          status: "-"
        }
      },
      actual: {
        patient,
        beforeCounts,
        proposed: appointmentInput
      },
      context: {
        canonicalId: appointmentAnchorPatientId,
        suite: "workflow-appointments",
        workflow: "appointment-mutation"
      }
    });

    try {
      appointmentId = await workflow.createAppointment(appointmentInput);

      const created = await workflow.getAppointment(appointmentId);
      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-11-appointment-mutation-created",
        description: "Captures the temporary appointment database row immediately after Slice 11 creates it, including the appointment-count increment.",
        expected: {
          appointment: {
            patientId: patient!.pid,
            providerId: patient!.providerId,
            title,
            eventDate: "2026-10-15",
            startTime: "10:30:00",
            endTime: "11:00:00",
            status: "-",
            room: "Parity"
          },
          counts: {
            appointments: beforeCounts.appointments + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          appointmentId,
          created
        },
        context: {
          canonicalId: appointmentAnchorPatientId,
          suite: "workflow-appointments",
          workflow: "appointment-mutation-created"
        }
      });

      expect(created).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-10-15",
        startTime: "10:30:00",
        endTime: "11:00:00",
        status: "-"
      });

      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);

      const cancelledTitle = `${title} Cancelled`;
      await workflow.updateAppointmentStatus(appointmentId, "x", cancelledTitle);
      const cancelled = await workflow.getAppointment(appointmentId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-11-appointment-mutation-cancelled",
        description: "Captures the temporary appointment database row after Slice 11 cancels it and before browser-visible rendering assertions.",
        expected: {
          appointment: {
            title: cancelledTitle,
            status: "x",
            eventDate: "2026-10-15",
            startTime: "10:30:00",
            endTime: "11:00:00",
            room: "Parity"
          }
        },
        actual: {
          patient,
          appointmentId,
          created,
          cancelled
        },
        context: {
          canonicalId: appointmentAnchorPatientId,
          suite: "workflow-appointments",
          workflow: "appointment-mutation-cancelled"
        }
      });

      expect(cancelled).toMatchObject({
        title: cancelledTitle,
        status: "x"
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(cancelledTitle);
        await expect(page.locator('select[name="form_apptstatus"]')).toHaveValue("x");
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-10-15");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(cancelledTitle), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: cancelledTitle })).toBeVisible();
        await expect(page.locator("body")).toContainText("x");
        await expect(page.locator("body")).toContainText("Parity");
      }
    } finally {
      if (appointmentId !== null) {
        await workflow.deleteAppointment(appointmentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const deleted = appointmentId !== null ? await workflow.getAppointment(appointmentId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-11-appointment-mutation-cleanup",
      description: "Captures the Slice 11 appointment mutation cleanup state after deleting the temporary appointment.",
      expected: {
        counts: {
          appointments: beforeCounts.appointments
        },
        deletedAppointment: null
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        appointmentId,
        deleted
      },
      context: {
        canonicalId: appointmentAnchorPatientId,
        suite: "workflow-appointments",
        workflow: "appointment-mutation-cleanup"
      }
    });

    expect(afterCleanupCounts.appointments).toBe(beforeCounts.appointments);
    if (appointmentId !== null) {
      expect(deleted).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
