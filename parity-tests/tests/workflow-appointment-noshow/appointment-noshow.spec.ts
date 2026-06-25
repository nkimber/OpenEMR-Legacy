import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";

test.describe("appointment no-show parity @slice96 @workflow-appointment-noshow @mutation", () => {
  test("marks a scheduled future appointment as no-show, renders it, and removes it", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const title = `Parity No Show ${workflowSuffix()}`;
    const noShowTitle = `${title} No Show`;
    const appointmentInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      title,
      eventDate: "2026-11-12",
      startTime: "13:00:00",
      endTime: "13:30:00",
      durationSeconds: 1800,
      homeText: "Created by the appointment no-show suite.",
      facilityId: 10,
      billingLocationId: 10,
      room: "NoShow"
    };
    let appointmentId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-96-appointment-noshow-precondition",
      description: "Captures the Slice 96 appointment no-show anchor patient, baseline appointment count, proposed scheduled appointment payload, and expected no-show status mutation.",
      expected: {
        patient: {
          pubpid: appointmentAnchorPatientId
        },
        create: {
          eventDate: "2026-11-12",
          startTime: "13:00:00",
          endTime: "13:30:00",
          durationSeconds: 1800,
          facilityId: 10,
          billingLocationId: 10,
          room: "NoShow",
          status: "-"
        },
        noShow: {
          title: noShowTitle,
          status: "?",
          room: "NoShow"
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
        suite: "workflow-appointment-noshow",
        workflow: "appointment-noshow"
      }
    });

    try {
      appointmentId = await workflow.createAppointment(appointmentInput);

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        providerId: patient.providerId,
        title,
        eventDate: "2026-11-12",
        startTime: "13:00:00",
        endTime: "13:30:00",
        status: "-",
        room: "NoShow"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-96-appointment-noshow-created",
        description: "Captures the temporary scheduled appointment database row immediately after Slice 96 creates it and before marking it no-show.",
        expected: {
          appointment: {
            patientId: patient.pid,
            providerId: patient.providerId,
            title,
            eventDate: "2026-11-12",
            startTime: "13:00:00",
            endTime: "13:30:00",
            status: "-",
            room: "NoShow"
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
          suite: "workflow-appointment-noshow",
          workflow: "appointment-noshow-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.updateAppointmentStatus(appointmentId, "?", noShowTitle);
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-11-12");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();

        await page.getByRole("button", { name: "Mark no-show" }).click();
        await expect(page.getByRole("heading", { name: noShowTitle })).toBeVisible();
        await expect(page.getByRole("button", { name: "Mark no-show" })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Mark arrived" })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Mark checked out" })).toBeDisabled();
      }

      const noShow = await workflow.getAppointment(appointmentId);
      expect(noShow).toMatchObject({
        title: noShowTitle,
        eventDate: "2026-11-12",
        startTime: "13:00:00",
        endTime: "13:30:00",
        status: "?",
        room: "NoShow"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-96-appointment-noshow-no-show",
        description: "Captures the temporary appointment database row after Slice 96 marks it no-show with OpenEMR status ?.",
        expected: {
          appointment: {
            title: noShowTitle,
            eventDate: "2026-11-12",
            startTime: "13:00:00",
            endTime: "13:30:00",
            status: "?",
            room: "NoShow"
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
          noShow
        },
        context: {
          canonicalId: appointmentAnchorPatientId,
          suite: "workflow-appointment-noshow",
          workflow: "appointment-noshow-no-show"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(noShowTitle);
        await expect(page.locator('select[name="form_apptstatus"]')).toHaveValue("?");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-96-appointment-noshow-surface",
          description: "Captures the legacy appointment edit rendering facts for the no-show Slice 96 temporary appointment.",
          expected: {
            formTitle: noShowTitle,
            formApptStatus: "?",
            eventDate: "2026-11-12",
            startTime: "13:00:00",
            room: "NoShow"
          },
          actual: {
            patient,
            appointmentId,
            noShow,
            surface: {
              application: "legacy-openemr",
              page: "appointment-edit",
              renderedTitle: noShowTitle,
              renderedStatus: "?"
            }
          },
          context: {
            canonicalId: appointmentAnchorPatientId,
            suite: "workflow-appointment-noshow",
            workflow: "appointment-noshow-legacy-surface"
          }
        });
      } else {
        await expect(page.locator("body")).toContainText("?");
        await expect(page.locator("body")).toContainText("NoShow");
        await expect(page.locator("body")).toContainText("2026-11-12");
        await expect(page.locator("body")).toContainText("13:00");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-96-appointment-noshow-surface",
          description: "Captures the modernized Calendar no-show action and no-show rendering facts for the Slice 96 temporary appointment.",
          expected: {
            calendarFilter: {
              patientId: appointmentAnchorPatientId,
              fromDate: "2026-11-12"
            },
            detail: {
              title: noShowTitle,
              eventDate: "2026-11-12",
              startTime: "13:00",
              status: "?",
              room: "NoShow",
              markNoShowDisabled: true,
              markArrivedDisabled: true,
              markCheckedOutDisabled: true
            }
          },
          actual: {
            patient,
            appointmentId,
            noShow,
            surface: {
              application: "modernized-openemr",
              page: "calendar",
              renderedTitle: noShowTitle,
              renderedDate: "2026-11-12",
              renderedStartTime: "13:00",
              renderedStatus: "?",
              renderedRoom: "NoShow"
            }
          },
          context: {
            canonicalId: appointmentAnchorPatientId,
            suite: "workflow-appointment-noshow",
            workflow: "appointment-noshow-modernized-surface"
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
      probe: "slice-96-appointment-noshow-cleanup",
      description: "Captures the Slice 96 appointment no-show cleanup state after deleting the temporary appointment.",
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
        suite: "workflow-appointment-noshow",
        workflow: "appointment-noshow-cleanup"
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
