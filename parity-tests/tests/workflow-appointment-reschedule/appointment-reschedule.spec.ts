import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";

test.describe("appointment reschedule parity @slice93 @workflow-appointment-reschedule @mutation", () => {
  test("reschedules, renders, and removes a future appointment", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const title = `Parity Reschedule ${workflowSuffix()}`;
    const rescheduledTitle = `${title} Updated`;
    const appointmentInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      title,
      eventDate: "2026-10-15",
      startTime: "10:30:00",
      endTime: "11:00:00",
      durationSeconds: 1800,
      homeText: "Created by the appointment reschedule suite.",
      facilityId: 10,
      billingLocationId: 10,
      room: "Parity"
    };
    const rescheduleInput = {
      providerId: patient.providerId,
      title: rescheduledTitle,
      eventDate: "2026-10-22",
      startTime: "14:15:00",
      endTime: "15:00:00",
      durationSeconds: 2700,
      homeText: "Rescheduled by the appointment reschedule suite.",
      facilityId: 10,
      billingLocationId: 10,
      room: "Resched",
      status: "@"
    };
    let appointmentId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-93-appointment-reschedule-precondition",
      description: "Captures the Slice 93 appointment reschedule anchor patient, baseline appointment count, proposed create payload, and proposed reschedule payload.",
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
        },
        reschedule: {
          eventDate: "2026-10-22",
          startTime: "14:15:00",
          endTime: "15:00:00",
          durationSeconds: 2700,
          room: "Resched",
          status: "@"
        }
      },
      actual: {
        patient,
        beforeCounts,
        proposedCreate: appointmentInput,
        proposedReschedule: rescheduleInput
      },
      context: {
        canonicalId: appointmentAnchorPatientId,
        suite: "workflow-appointment-reschedule",
        workflow: "appointment-reschedule"
      }
    });

    try {
      appointmentId = await workflow.createAppointment(appointmentInput);

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        providerId: patient.providerId,
        title,
        eventDate: "2026-10-15",
        startTime: "10:30:00",
        endTime: "11:00:00",
        status: "-",
        room: "Parity"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-93-appointment-reschedule-created",
        description: "Captures the temporary appointment database row immediately after Slice 93 creates it and before rescheduling.",
        expected: {
          appointment: {
            patientId: patient.pid,
            providerId: patient.providerId,
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
          suite: "workflow-appointment-reschedule",
          workflow: "appointment-reschedule-created"
        }
      });

      await workflow.updateAppointment(appointmentId, rescheduleInput);

      const updated = await workflow.getAppointment(appointmentId);
      expect(updated).toMatchObject({
        patientId: patient.pid,
        providerId: patient.providerId,
        title: rescheduledTitle,
        eventDate: "2026-10-22",
        startTime: "14:15:00",
        endTime: "15:00:00",
        status: "@",
        room: "Resched"
      });

      const afterUpdateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterUpdateCounts.appointments).toBe(beforeCounts.appointments + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-93-appointment-reschedule-rescheduled",
        description: "Captures the temporary appointment database row after Slice 93 updates date, time, duration, status, room, and title.",
        expected: {
          appointment: {
            patientId: patient.pid,
            providerId: patient.providerId,
            title: rescheduledTitle,
            eventDate: "2026-10-22",
            startTime: "14:15:00",
            endTime: "15:00:00",
            durationSeconds: 2700,
            status: "@",
            room: "Resched"
          },
          counts: {
            appointments: beforeCounts.appointments + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterUpdateCounts,
          appointmentId,
          created,
          updated
        },
        context: {
          canonicalId: appointmentAnchorPatientId,
          suite: "workflow-appointment-reschedule",
          workflow: "appointment-reschedule-updated"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(rescheduledTitle);
        await expect(page.locator('select[name="form_apptstatus"]')).toHaveValue("@");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-93-appointment-reschedule-surface",
          description: "Captures the legacy appointment edit rendering facts for the rescheduled Slice 93 temporary appointment.",
          expected: {
            formTitle: rescheduledTitle,
            formApptStatus: "@",
            eventDate: "2026-10-22",
            startTime: "14:15:00",
            durationText: "45 minutes",
            room: "Resched"
          },
          actual: {
            patient,
            appointmentId,
            updated,
            surface: {
              application: "legacy-openemr",
              page: "appointment-edit",
              renderedTitle: rescheduledTitle,
              renderedStatus: "@"
            }
          },
          context: {
            canonicalId: appointmentAnchorPatientId,
            suite: "workflow-appointment-reschedule",
            workflow: "appointment-reschedule-legacy-surface"
          }
        });
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-10-22");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(rescheduledTitle), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: rescheduledTitle })).toBeVisible();
        await expect(page.locator("body")).toContainText("2026-10-22");
        await expect(page.locator("body")).toContainText("14:15");
        await expect(page.locator("body")).toContainText("45 minutes");
        await expect(page.locator("body")).toContainText("Resched");
        await expect(page.locator("body")).toContainText("@");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-93-appointment-reschedule-surface",
          description: "Captures the modernized Calendar list/detail rendering facts for the rescheduled Slice 93 temporary appointment.",
          expected: {
            calendarFilter: {
              patientId: appointmentAnchorPatientId,
              fromDate: "2026-10-22"
            },
            detail: {
              title: rescheduledTitle,
              eventDate: "2026-10-22",
              startTime: "14:15",
              durationText: "45 minutes",
              status: "@",
              room: "Resched"
            }
          },
          actual: {
            patient,
            appointmentId,
            updated,
            surface: {
              application: "modernized-openemr",
              page: "calendar",
              renderedTitle: rescheduledTitle,
              renderedDate: "2026-10-22",
              renderedStatus: "@",
              renderedRoom: "Resched"
            }
          },
          context: {
            canonicalId: appointmentAnchorPatientId,
            suite: "workflow-appointment-reschedule",
            workflow: "appointment-reschedule-modernized-surface"
          }
        });
      }
    } finally {
      if (appointmentId !== null) {
        await workflow.deleteAppointment(appointmentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const deleted = appointmentId !== null ? await workflow.getAppointment(appointmentId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-93-appointment-reschedule-cleanup",
      description: "Captures the Slice 93 appointment reschedule cleanup state after deleting the temporary appointment.",
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
        suite: "workflow-appointment-reschedule",
        workflow: "appointment-reschedule-cleanup"
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
