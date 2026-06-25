import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";

test.describe("appointment pending-status parity @slice98 @workflow-appointment-pending @mutation", () => {
  test("marks a scheduled future appointment as pending, renders it, and removes it", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const title = `Parity Pending ${workflowSuffix()}`;
    const pendingTitle = `${title} Pending`;
    const appointmentInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      title,
      eventDate: "2026-11-26",
      startTime: "10:45:00",
      endTime: "11:15:00",
      durationSeconds: 1800,
      homeText: "Created by the appointment pending-status suite.",
      facilityId: 10,
      billingLocationId: 10,
      room: "Pending"
    };
    const appointmentUpdate = {
      providerId: patient.providerId,
      title: pendingTitle,
      eventDate: "2026-11-26",
      startTime: "10:45:00",
      endTime: "11:15:00",
      durationSeconds: 1800,
      homeText: "Updated by the appointment pending-status suite.",
      facilityId: 10,
      billingLocationId: 10,
      room: "Pending",
      status: "~"
    };
    let appointmentId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-98-appointment-pending-precondition",
      description: "Captures the Slice 98 appointment pending-status anchor patient, baseline appointment count, proposed scheduled appointment payload, and expected OpenEMR pending status update.",
      expected: {
        patient: {
          pubpid: appointmentAnchorPatientId
        },
        create: {
          eventDate: "2026-11-26",
          startTime: "10:45:00",
          endTime: "11:15:00",
          durationSeconds: 1800,
          facilityId: 10,
          billingLocationId: 10,
          room: "Pending",
          status: "-"
        },
        update: {
          title: pendingTitle,
          status: "~",
          room: "Pending"
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
        suite: "workflow-appointment-pending",
        workflow: "appointment-pending"
      }
    });

    try {
      appointmentId = await workflow.createAppointment(appointmentInput);

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        providerId: patient.providerId,
        title,
        eventDate: "2026-11-26",
        startTime: "10:45:00",
        endTime: "11:15:00",
        status: "-",
        room: "Pending"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-98-appointment-pending-created",
        description: "Captures the temporary scheduled appointment database row immediately after Slice 98 creates it and before updating it to pending status.",
        expected: {
          appointment: {
            patientId: patient.pid,
            providerId: patient.providerId,
            title,
            eventDate: "2026-11-26",
            startTime: "10:45:00",
            endTime: "11:15:00",
            status: "-",
            room: "Pending"
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
          suite: "workflow-appointment-pending",
          workflow: "appointment-pending-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.updateAppointment(appointmentId, appointmentUpdate);
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-11-26");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        await expect(page.getByLabel("Edit appointment status")).toHaveValue("-");

        await page.getByLabel("Edit appointment title").fill(pendingTitle);
        await page.getByLabel("Edit appointment status").selectOption("~");
        await page.getByRole("button", { name: "Save schedule" }).click();
        await expect(page.getByRole("heading", { name: pendingTitle })).toBeVisible();
        await expect(page.getByLabel("Edit appointment status")).toHaveValue("~");
      }

      const pending = await workflow.getAppointment(appointmentId);
      expect(pending).toMatchObject({
        title: pendingTitle,
        eventDate: "2026-11-26",
        startTime: "10:45:00",
        endTime: "11:15:00",
        status: "~",
        room: "Pending"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-98-appointment-pending-updated",
        description: "Captures the temporary appointment database row after Slice 98 updates it to OpenEMR pending status ~.",
        expected: {
          appointment: {
            title: pendingTitle,
            eventDate: "2026-11-26",
            startTime: "10:45:00",
            endTime: "11:15:00",
            status: "~",
            room: "Pending"
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
          pending
        },
        context: {
          canonicalId: appointmentAnchorPatientId,
          suite: "workflow-appointment-pending",
          workflow: "appointment-pending-updated"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(pendingTitle);
        await expect(page.locator('select[name="form_apptstatus"]')).toHaveValue("~");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-98-appointment-pending-surface",
          description: "Captures the legacy appointment edit rendering facts for the pending-status Slice 98 temporary appointment.",
          expected: {
            formTitle: pendingTitle,
            formApptStatus: "~",
            eventDate: "2026-11-26",
            startTime: "10:45:00",
            room: "Pending"
          },
          actual: {
            patient,
            appointmentId,
            pending,
            surface: {
              application: "legacy-openemr",
              page: "appointment-edit",
              renderedTitle: pendingTitle,
              renderedStatus: "~"
            }
          },
          context: {
            canonicalId: appointmentAnchorPatientId,
            suite: "workflow-appointment-pending",
            workflow: "appointment-pending-legacy-surface"
          }
        });
      } else {
        await expect(page.locator("body")).toContainText("~");
        await expect(page.locator("body")).toContainText("Pending");
        await expect(page.locator("body")).toContainText("2026-11-26");
        await expect(page.locator("body")).toContainText("10:45");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-98-appointment-pending-surface",
          description: "Captures the modernized Calendar pending-status edit and rendering facts for the Slice 98 temporary appointment.",
          expected: {
            calendarFilter: {
              patientId: appointmentAnchorPatientId,
              fromDate: "2026-11-26"
            },
            detail: {
              title: pendingTitle,
              eventDate: "2026-11-26",
              startTime: "10:45",
              status: "~",
              room: "Pending"
            }
          },
          actual: {
            patient,
            appointmentId,
            pending,
            surface: {
              application: "modernized-openemr",
              page: "calendar",
              renderedTitle: pendingTitle,
              renderedDate: "2026-11-26",
              renderedStartTime: "10:45",
              renderedStatus: "~",
              renderedRoom: "Pending"
            }
          },
          context: {
            canonicalId: appointmentAnchorPatientId,
            suite: "workflow-appointment-pending",
            workflow: "appointment-pending-modernized-surface"
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
      probe: "slice-98-appointment-pending-cleanup",
      description: "Captures the Slice 98 appointment pending-status cleanup state after deleting the temporary appointment.",
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
        suite: "workflow-appointment-pending",
        workflow: "appointment-pending-cleanup"
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
