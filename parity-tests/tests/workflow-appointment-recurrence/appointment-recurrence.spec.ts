import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";
const initialEndDate = "2026-12-31";
const updatedEndDate = "2027-01-28";

test.describe("appointment recurrence parity @slice103 @workflow-appointment-recurrence @mutation", () => {
  test("creates, updates recurrence metadata, renders, and removes a future appointment", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const title = `Parity Recurrence ${workflowSuffix()}`;
    const updatedTitle = `${title} Updated`;
    const appointmentInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      title,
      eventDate: "2026-12-29",
      startTime: "10:00:00",
      endTime: "10:30:00",
      durationSeconds: 1800,
      homeText: "Created by the appointment recurrence suite.",
      facilityId: 10,
      billingLocationId: 10,
      room: "Repeat",
      categoryId: 9,
      recurrenceType: 1,
      repeatFrequency: 1,
      repeatUnit: 1,
      recurrenceEndDate: initialEndDate
    };
    const appointmentUpdate = {
      providerId: patient.providerId,
      title: updatedTitle,
      eventDate: "2026-12-29",
      startTime: "10:00:00",
      endTime: "10:30:00",
      durationSeconds: 1800,
      homeText: "Updated by the appointment recurrence suite.",
      facilityId: 10,
      billingLocationId: 10,
      room: "Repeat",
      status: "-",
      categoryId: 9,
      recurrenceType: 1,
      repeatFrequency: 2,
      repeatUnit: 1,
      recurrenceEndDate: updatedEndDate
    };
    let appointmentId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-103-appointment-recurrence-precondition",
      description: "Captures the Slice 103 appointment recurrence anchor patient, baseline appointment count, proposed recurring appointment payload, and expected cadence update.",
      expected: {
        patient: {
          pubpid: appointmentAnchorPatientId,
          providerId: patient.providerId
        },
        create: {
          eventDate: "2026-12-29",
          startTime: "10:00:00",
          endTime: "10:30:00",
          durationSeconds: 1800,
          facilityId: 10,
          billingLocationId: 10,
          room: "Repeat",
          categoryId: 9,
          status: "-",
          recurrenceType: 1,
          repeatFrequency: 1,
          repeatUnit: 1,
          recurrenceEndDate: initialEndDate
        },
        update: {
          title: updatedTitle,
          recurrenceType: 1,
          repeatFrequency: 2,
          repeatUnit: 1,
          recurrenceEndDate: updatedEndDate,
          recurrenceLabel: `Every 2 weeks until ${updatedEndDate}`
        },
        countChange: {
          appointmentsAfterCreate: beforeCounts.appointments + 1,
          appointmentsAfterCleanup: beforeCounts.appointments
        }
      },
      actual: {
        patient,
        beforeCounts,
        proposedCreate: appointmentInput,
        proposedUpdate: appointmentUpdate
      },
      context: {
        canonicalId: appointmentAnchorPatientId,
        suite: "workflow-appointment-recurrence",
        workflow: "appointment-recurrence"
      }
    });

    try {
      appointmentId = await workflow.createAppointment(appointmentInput);

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        providerId: patient.providerId,
        title,
        eventDate: "2026-12-29",
        startTime: "10:00:00",
        endTime: "10:30:00",
        status: "-",
        facilityId: 10,
        billingLocationId: 10,
        room: "Repeat",
        categoryId: 9,
        recurrenceType: 1,
        repeatFrequency: 1,
        repeatUnit: 1,
        recurrenceEndDate: initialEndDate
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-103-appointment-recurrence-created",
        description: "Captures the temporary appointment database row immediately after Slice 103 creates it with weekly recurrence metadata.",
        expected: {
          appointment: {
            patientId: patient.pid,
            providerId: patient.providerId,
            title,
            eventDate: "2026-12-29",
            startTime: "10:00:00",
            endTime: "10:30:00",
            status: "-",
            facilityId: 10,
            billingLocationId: 10,
            room: "Repeat",
            categoryId: 9,
            recurrenceType: 1,
            repeatFrequency: 1,
            repeatUnit: 1,
            recurrenceEndDate: initialEndDate
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
          suite: "workflow-appointment-recurrence",
          workflow: "appointment-recurrence-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.updateAppointment(appointmentId, appointmentUpdate);

        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(updatedTitle);
        await expect(page.locator('input[name="form_repeat"]')).toBeChecked();
        await expect(page.locator('select[name="form_repeat_freq"]')).toHaveValue("2");
        await expect(page.locator('select[name="form_repeat_type"]')).toHaveValue("1");
        await expect(page.locator('input[name="form_enddate"]')).toHaveValue(updatedEndDate);
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-12-29");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        await expect(page.getByLabel("Edit appointment repeats")).toBeChecked();
        await expect(page.getByLabel("Edit appointment repeat frequency")).toHaveValue("1");
        await expect(page.getByLabel("Edit appointment repeat unit")).toHaveValue("1");
        await expect(page.getByLabel("Edit appointment recurrence end date")).toHaveValue(initialEndDate);

        await page.getByLabel("Edit appointment title").fill(updatedTitle);
        await page.getByLabel("Edit appointment repeat frequency").fill("2");
        await page.getByLabel("Edit appointment recurrence end date").fill(updatedEndDate);
        await page.getByRole("button", { name: "Save schedule" }).click();
        await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
        await expect(page.getByLabel("Edit appointment repeat frequency")).toHaveValue("2");
        await expect(page.getByLabel("Edit appointment recurrence end date")).toHaveValue(updatedEndDate);
        await expect(page.locator("body")).toContainText(`Every 2 weeks until ${updatedEndDate}`);
      }

      const updated = await workflow.getAppointment(appointmentId);
      expect(updated).toMatchObject({
        providerId: patient.providerId,
        title: updatedTitle,
        eventDate: "2026-12-29",
        startTime: "10:00:00",
        endTime: "10:30:00",
        status: "-",
        facilityId: 10,
        billingLocationId: 10,
        room: "Repeat",
        categoryId: 9,
        categoryName: "Established Patient",
        recurrenceType: 1,
        repeatFrequency: 2,
        repeatUnit: 1,
        recurrenceEndDate: updatedEndDate
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-103-appointment-recurrence-updated",
        description: "Captures the temporary appointment database row after Slice 103 updates the recurrence cadence and end date while preserving schedule and location facts.",
        expected: {
          appointment: {
            providerId: patient.providerId,
            title: updatedTitle,
            eventDate: "2026-12-29",
            startTime: "10:00:00",
            endTime: "10:30:00",
            status: "-",
            facilityId: 10,
            billingLocationId: 10,
            room: "Repeat",
            categoryId: 9,
            categoryName: "Established Patient",
            recurrenceType: 1,
            repeatFrequency: 2,
            repeatUnit: 1,
            recurrenceEndDate: updatedEndDate
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
          created,
          updated
        },
        context: {
          canonicalId: appointmentAnchorPatientId,
          suite: "workflow-appointment-recurrence",
          workflow: "appointment-recurrence-updated"
        }
      });

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-103-appointment-recurrence-surface",
        description: target.type === "legacy-openemr"
          ? "Captures the legacy appointment edit rendering facts for the Slice 103 updated recurring appointment."
          : "Captures the modernized Calendar rendering facts for the Slice 103 updated recurring appointment.",
        expected: {
          title: updatedTitle,
          eventDate: "2026-12-29",
          startTime: "10:00",
          repeatFrequency: "2",
          repeatUnit: "1",
          recurrenceEndDate: updatedEndDate,
          recurrenceLabel: `Every 2 weeks until ${updatedEndDate}`
        },
        actual: {
          patient,
          appointmentId,
          updated,
          surface: {
            application: target.type,
            page: target.type === "legacy-openemr" ? "appointment-edit" : "calendar",
            renderedTitle: updatedTitle,
            renderedDate: "2026-12-29",
            renderedStartTime: "10:00",
            renderedRepeatFrequency: "2",
            renderedRepeatUnit: "1",
            renderedRecurrenceEndDate: updatedEndDate,
            renderedRecurrenceLabel: target.type === "legacy-openemr" ? null : `Every 2 weeks until ${updatedEndDate}`
          }
        },
        context: {
          canonicalId: appointmentAnchorPatientId,
          suite: "workflow-appointment-recurrence",
          workflow: target.type === "legacy-openemr" ? "appointment-recurrence-legacy-surface" : "appointment-recurrence-modernized-surface"
        }
      });
    } finally {
      if (appointmentId !== null) {
        await workflow.deleteAppointment(appointmentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const deleted = appointmentId !== null ? await workflow.getAppointment(appointmentId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-103-appointment-recurrence-cleanup",
      description: "Captures the Slice 103 appointment recurrence cleanup state after deleting the temporary recurring appointment.",
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
        suite: "workflow-appointment-recurrence",
        workflow: "appointment-recurrence-cleanup"
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
