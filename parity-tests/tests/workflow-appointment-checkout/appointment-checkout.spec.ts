import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";

test.describe("appointment check-out parity @slice95 @workflow-appointment-checkout @mutation", () => {
  test("moves a scheduled appointment through arrival to checked out, renders it, and removes it", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const title = `Parity Checkout ${workflowSuffix()}`;
    const arrivedTitle = `${title} Arrived`;
    const checkedOutTitle = `${title} Checked Out`;
    const appointmentInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      title,
      eventDate: "2026-11-05",
      startTime: "11:00:00",
      endTime: "11:30:00",
      durationSeconds: 1800,
      homeText: "Created by the appointment check-out suite.",
      facilityId: 10,
      billingLocationId: 10,
      room: "Checkout"
    };
    let appointmentId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-95-appointment-checkout-precondition",
      description: "Captures the Slice 95 appointment check-out anchor patient, baseline appointment count, proposed scheduled appointment payload, and expected arrival/check-out status transitions.",
      expected: {
        patient: {
          pubpid: appointmentAnchorPatientId
        },
        create: {
          eventDate: "2026-11-05",
          startTime: "11:00:00",
          endTime: "11:30:00",
          durationSeconds: 1800,
          facilityId: 10,
          billingLocationId: 10,
          room: "Checkout",
          status: "-"
        },
        transitions: [
          { title: arrivedTitle, status: "@" },
          { title: checkedOutTitle, status: ">" }
        ],
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
        suite: "workflow-appointment-checkout",
        workflow: "appointment-checkout"
      }
    });

    try {
      appointmentId = await workflow.createAppointment(appointmentInput);

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        providerId: patient.providerId,
        title,
        eventDate: "2026-11-05",
        startTime: "11:00:00",
        endTime: "11:30:00",
        status: "-",
        room: "Checkout"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-95-appointment-checkout-created",
        description: "Captures the temporary scheduled appointment database row immediately after Slice 95 creates it and before arrival/check-out transitions.",
        expected: {
          appointment: {
            patientId: patient.pid,
            providerId: patient.providerId,
            title,
            eventDate: "2026-11-05",
            startTime: "11:00:00",
            endTime: "11:30:00",
            status: "-",
            room: "Checkout"
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
          suite: "workflow-appointment-checkout",
          workflow: "appointment-checkout-created"
        }
      });

      let arrived: Awaited<ReturnType<typeof workflow.getAppointment>> | null = null;

      if (target.type === "legacy-openemr") {
        await workflow.updateAppointmentStatus(appointmentId, "@", arrivedTitle);
        arrived = await workflow.getAppointment(appointmentId);
        expect(arrived).toMatchObject({
          title: arrivedTitle,
          status: "@"
        });

        await workflow.updateAppointmentStatus(appointmentId, ">", checkedOutTitle);
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-11-05");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();

        await page.getByRole("button", { name: "Mark arrived" }).click();
        await expect(page.getByRole("heading", { name: arrivedTitle })).toBeVisible();
        await expect(page.getByRole("button", { name: "Mark arrived" })).toBeDisabled();
        arrived = await workflow.getAppointment(appointmentId);
        expect(arrived).toMatchObject({
          title: arrivedTitle,
          status: "@"
        });

        await page.getByRole("button", { name: "Mark checked out" }).click();
        await expect(page.getByRole("heading", { name: checkedOutTitle })).toBeVisible();
        await expect(page.getByRole("button", { name: "Mark checked out" })).toBeDisabled();
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-95-appointment-checkout-arrived",
        description: "Captures the temporary appointment database row after Slice 95 marks it arrived with OpenEMR status @ and before check-out.",
        expected: {
          appointment: {
            title: arrivedTitle,
            eventDate: "2026-11-05",
            startTime: "11:00:00",
            endTime: "11:30:00",
            status: "@",
            room: "Checkout"
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
          suite: "workflow-appointment-checkout",
          workflow: "appointment-checkout-arrived"
        }
      });

      const checkedOut = await workflow.getAppointment(appointmentId);
      expect(checkedOut).toMatchObject({
        title: checkedOutTitle,
        eventDate: "2026-11-05",
        startTime: "11:00:00",
        endTime: "11:30:00",
        status: ">",
        room: "Checkout"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-95-appointment-checkout-checked-out",
        description: "Captures the temporary appointment database row after Slice 95 checks it out with OpenEMR status >.",
        expected: {
          appointment: {
            title: checkedOutTitle,
            eventDate: "2026-11-05",
            startTime: "11:00:00",
            endTime: "11:30:00",
            status: ">",
            room: "Checkout"
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
          arrived,
          checkedOut
        },
        context: {
          canonicalId: appointmentAnchorPatientId,
          suite: "workflow-appointment-checkout",
          workflow: "appointment-checkout-checked-out"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(checkedOutTitle);
        await expect(page.locator('select[name="form_apptstatus"]')).toHaveValue(">");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-95-appointment-checkout-surface",
          description: "Captures the legacy appointment edit rendering facts for the checked-out Slice 95 temporary appointment.",
          expected: {
            formTitle: checkedOutTitle,
            formApptStatus: ">",
            eventDate: "2026-11-05",
            startTime: "11:00:00",
            room: "Checkout"
          },
          actual: {
            patient,
            appointmentId,
            arrived,
            checkedOut,
            surface: {
              application: "legacy-openemr",
              page: "appointment-edit",
              renderedTitle: checkedOutTitle,
              renderedStatus: ">"
            }
          },
          context: {
            canonicalId: appointmentAnchorPatientId,
            suite: "workflow-appointment-checkout",
            workflow: "appointment-checkout-legacy-surface"
          }
        });
      } else {
        await expect(page.locator("body")).toContainText("Checkout");
        await expect(page.locator("body")).toContainText("2026-11-05");
        await expect(page.locator("body")).toContainText("11:00");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-95-appointment-checkout-surface",
          description: "Captures the modernized Calendar arrival/check-out actions and checked-out rendering facts for the Slice 95 temporary appointment.",
          expected: {
            calendarFilter: {
              patientId: appointmentAnchorPatientId,
              fromDate: "2026-11-05"
            },
            detail: {
              title: checkedOutTitle,
              eventDate: "2026-11-05",
              startTime: "11:00",
              status: ">",
              room: "Checkout",
              markArrivedDisabled: true,
              markCheckedOutDisabled: true
            }
          },
          actual: {
            patient,
            appointmentId,
            arrived,
            checkedOut,
            surface: {
              application: "modernized-openemr",
              page: "calendar",
              renderedTitle: checkedOutTitle,
              renderedDate: "2026-11-05",
              renderedStartTime: "11:00",
              renderedRoom: "Checkout"
            }
          },
          context: {
            canonicalId: appointmentAnchorPatientId,
            suite: "workflow-appointment-checkout",
            workflow: "appointment-checkout-modernized-surface"
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
      probe: "slice-95-appointment-checkout-cleanup",
      description: "Captures the Slice 95 appointment check-out cleanup state after deleting the temporary appointment.",
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
        suite: "workflow-appointment-checkout",
        workflow: "appointment-checkout-cleanup"
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
