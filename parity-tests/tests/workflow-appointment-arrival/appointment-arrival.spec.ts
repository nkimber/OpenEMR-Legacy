import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";

test.describe("appointment arrival parity @slice94 @workflow-appointment-arrival @mutation", () => {
  test("marks a scheduled future appointment as arrived, renders it, and removes it", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const title = `Parity Arrival ${workflowSuffix()}`;
    const arrivedTitle = `${title} Arrived`;
    const appointmentInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      title,
      eventDate: "2026-10-29",
      startTime: "09:00:00",
      endTime: "09:30:00",
      durationSeconds: 1800,
      homeText: "Created by the appointment arrival suite.",
      facilityId: 10,
      billingLocationId: 10,
      room: "Arrival"
    };
    let appointmentId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-94-appointment-arrival-precondition",
      description: "Captures the Slice 94 appointment arrival anchor patient, baseline appointment count, proposed scheduled appointment payload, and expected arrived-state mutation.",
      expected: {
        patient: {
          pubpid: appointmentAnchorPatientId
        },
        create: {
          eventDate: "2026-10-29",
          startTime: "09:00:00",
          endTime: "09:30:00",
          durationSeconds: 1800,
          facilityId: 10,
          billingLocationId: 10,
          room: "Arrival",
          status: "-"
        },
        arrival: {
          title: arrivedTitle,
          status: "@",
          room: "Arrival"
        },
        countChange: {
          appointmentsAfterCreate: beforeCounts.appointments + 1,
          appointmentsAfterCleanup: beforeCounts.appointments
        }
      },
      actual: {
        patient,
        beforeCounts,
        proposedCreate: appointmentInput
      },
      context: {
        canonicalId: appointmentAnchorPatientId,
        suite: "workflow-appointment-arrival",
        workflow: "appointment-arrival"
      }
    });

    try {
      appointmentId = await workflow.createAppointment(appointmentInput);

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        providerId: patient.providerId,
        title,
        eventDate: "2026-10-29",
        startTime: "09:00:00",
        endTime: "09:30:00",
        status: "-",
        room: "Arrival"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-94-appointment-arrival-created",
        description: "Captures the temporary scheduled appointment database row immediately after Slice 94 creates it and before marking it arrived.",
        expected: {
          appointment: {
            patientId: patient.pid,
            providerId: patient.providerId,
            title,
            eventDate: "2026-10-29",
            startTime: "09:00:00",
            endTime: "09:30:00",
            status: "-",
            room: "Arrival"
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
          suite: "workflow-appointment-arrival",
          workflow: "appointment-arrival-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.updateAppointmentStatus(appointmentId, "@", arrivedTitle);
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-10-29");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        await expect(page.locator("body")).toContainText("-");

        await page.getByRole("button", { name: "Mark arrived" }).click();
        await expect(page.getByRole("heading", { name: arrivedTitle })).toBeVisible();
        await expect(page.getByRole("button", { name: "Mark arrived" })).toBeDisabled();
      }

      const arrived = await workflow.getAppointment(appointmentId);
      expect(arrived).toMatchObject({
        title: arrivedTitle,
        eventDate: "2026-10-29",
        startTime: "09:00:00",
        endTime: "09:30:00",
        status: "@",
        room: "Arrival"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-94-appointment-arrival-arrived",
        description: "Captures the temporary appointment database row after Slice 94 marks it arrived with OpenEMR status @.",
        expected: {
          appointment: {
            title: arrivedTitle,
            eventDate: "2026-10-29",
            startTime: "09:00:00",
            endTime: "09:30:00",
            status: "@",
            room: "Arrival"
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
          arrived
        },
        context: {
          canonicalId: appointmentAnchorPatientId,
          suite: "workflow-appointment-arrival",
          workflow: "appointment-arrival-arrived"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(arrivedTitle);
        await expect(page.locator('select[name="form_apptstatus"]')).toHaveValue("@");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-94-appointment-arrival-surface",
          description: "Captures the legacy appointment edit rendering facts for the arrived Slice 94 temporary appointment.",
          expected: {
            formTitle: arrivedTitle,
            formApptStatus: "@",
            eventDate: "2026-10-29",
            startTime: "09:00:00",
            room: "Arrival"
          },
          actual: {
            patient,
            appointmentId,
            arrived,
            surface: {
              application: "legacy-openemr",
              page: "appointment-edit",
              renderedTitle: arrivedTitle,
              renderedStatus: "@"
            }
          },
          context: {
            canonicalId: appointmentAnchorPatientId,
            suite: "workflow-appointment-arrival",
            workflow: "appointment-arrival-legacy-surface"
          }
        });
      } else {
        await expect(page.locator("body")).toContainText("@");
        await expect(page.locator("body")).toContainText("Arrival");
        await expect(page.locator("body")).toContainText("2026-10-29");
        await expect(page.locator("body")).toContainText("09:00");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-94-appointment-arrival-surface",
          description: "Captures the modernized Calendar arrival action and arrived-state rendering facts for the Slice 94 temporary appointment.",
          expected: {
            calendarFilter: {
              patientId: appointmentAnchorPatientId,
              fromDate: "2026-10-29"
            },
            detail: {
              title: arrivedTitle,
              eventDate: "2026-10-29",
              startTime: "09:00",
              status: "@",
              room: "Arrival",
              markArrivedDisabled: true
            }
          },
          actual: {
            patient,
            appointmentId,
            arrived,
            surface: {
              application: "modernized-openemr",
              page: "calendar",
              renderedTitle: arrivedTitle,
              renderedDate: "2026-10-29",
              renderedStartTime: "09:00",
              renderedStatus: "@",
              renderedRoom: "Arrival"
            }
          },
          context: {
            canonicalId: appointmentAnchorPatientId,
            suite: "workflow-appointment-arrival",
            workflow: "appointment-arrival-modernized-surface"
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
      probe: "slice-94-appointment-arrival-cleanup",
      description: "Captures the Slice 94 appointment arrival cleanup state after deleting the temporary appointment.",
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
        suite: "workflow-appointment-arrival",
        workflow: "appointment-arrival-cleanup"
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
