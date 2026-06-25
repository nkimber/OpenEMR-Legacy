import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";

test.describe("appointment comments parity @slice102 @workflow-appointment-comments @mutation", () => {
  test("creates, updates comments, renders, and removes a future appointment", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const title = `Parity Comments ${workflowSuffix()}`;
    const updatedTitle = `${title} Updated`;
    const initialComments = "Initial parity scheduling comments for front desk review.";
    const updatedComments = "Updated parity scheduling comments: bring referral packet and lab printout.";
    const appointmentInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      title,
      eventDate: "2026-12-24",
      startTime: "08:30:00",
      endTime: "09:00:00",
      durationSeconds: 1800,
      homeText: initialComments,
      facilityId: 10,
      billingLocationId: 10,
      room: "Comments",
      categoryId: 9
    };
    const appointmentUpdate = {
      providerId: patient.providerId,
      title: updatedTitle,
      eventDate: "2026-12-24",
      startTime: "08:30:00",
      endTime: "09:00:00",
      durationSeconds: 1800,
      homeText: updatedComments,
      facilityId: 10,
      billingLocationId: 10,
      room: "Comments",
      status: "-",
      categoryId: 9
    };
    let appointmentId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-102-appointment-comments-precondition",
      description: "Captures the Slice 102 appointment comments anchor patient, baseline appointment count, proposed appointment payload, and expected comment update while preserving schedule and location facts.",
      expected: {
        patient: {
          pubpid: appointmentAnchorPatientId,
          providerId: patient.providerId
        },
        create: {
          eventDate: "2026-12-24",
          startTime: "08:30:00",
          endTime: "09:00:00",
          durationSeconds: 1800,
          facilityId: 10,
          billingLocationId: 10,
          room: "Comments",
          categoryId: 9,
          status: "-",
          homeText: initialComments
        },
        update: {
          title: updatedTitle,
          homeText: updatedComments,
          facilityId: 10,
          billingLocationId: 10,
          status: "-",
          room: "Comments"
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
        suite: "workflow-appointment-comments",
        workflow: "appointment-comments"
      }
    });

    try {
      appointmentId = await workflow.createAppointment(appointmentInput);

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        providerId: patient.providerId,
        title,
        eventDate: "2026-12-24",
        startTime: "08:30:00",
        endTime: "09:00:00",
        status: "-",
        facilityId: 10,
        billingLocationId: 10,
        room: "Comments",
        categoryId: 9,
        homeText: initialComments
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-102-appointment-comments-created",
        description: "Captures the temporary appointment database row immediately after Slice 102 creates it with initial comments.",
        expected: {
          appointment: {
            patientId: patient.pid,
            providerId: patient.providerId,
            title,
            eventDate: "2026-12-24",
            startTime: "08:30:00",
            endTime: "09:00:00",
            status: "-",
            facilityId: 10,
            billingLocationId: 10,
            room: "Comments",
            categoryId: 9,
            homeText: initialComments
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
          suite: "workflow-appointment-comments",
          workflow: "appointment-comments-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.updateAppointment(appointmentId, appointmentUpdate);

        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(updatedTitle);
        await expect(page.locator('input[name="form_comments"]')).toHaveValue(updatedComments);
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-12-24");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        await expect(page.getByLabel("Edit appointment comments")).toHaveValue(initialComments);

        await page.getByLabel("Edit appointment title").fill(updatedTitle);
        await page.getByLabel("Edit appointment comments").fill(updatedComments);
        await page.getByRole("button", { name: "Save schedule" }).click();
        await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
        await expect(page.getByLabel("Edit appointment comments")).toHaveValue(updatedComments);
        await expect(page.locator("body")).toContainText(updatedComments);
      }

      const updated = await workflow.getAppointment(appointmentId);
      expect(updated).toMatchObject({
        providerId: patient.providerId,
        title: updatedTitle,
        eventDate: "2026-12-24",
        startTime: "08:30:00",
        endTime: "09:00:00",
        status: "-",
        facilityId: 10,
        billingLocationId: 10,
        room: "Comments",
        categoryId: 9,
        categoryName: "Established Patient",
        homeText: updatedComments
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-102-appointment-comments-updated",
        description: "Captures the temporary appointment database row after Slice 102 updates comments while preserving schedule, location, category, room, and status facts.",
        expected: {
          appointment: {
            providerId: patient.providerId,
            title: updatedTitle,
            eventDate: "2026-12-24",
            startTime: "08:30:00",
            endTime: "09:00:00",
            status: "-",
            facilityId: 10,
            billingLocationId: 10,
            room: "Comments",
            categoryId: 9,
            categoryName: "Established Patient",
            homeText: updatedComments
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
          suite: "workflow-appointment-comments",
          workflow: "appointment-comments-updated"
        }
      });

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-102-appointment-comments-surface",
        description: target.type === "legacy-openemr"
          ? "Captures the legacy appointment edit rendering facts for the Slice 102 updated comments appointment."
          : "Captures the modernized Calendar rendering facts for the Slice 102 updated comments appointment.",
        expected: {
          title: updatedTitle,
          comments: updatedComments,
          eventDate: "2026-12-24",
          startTime: "08:30",
          room: "Comments"
        },
        actual: {
          patient,
          appointmentId,
          updated,
          surface: {
            application: target.type,
            page: target.type === "legacy-openemr" ? "appointment-edit" : "calendar",
            renderedTitle: updatedTitle,
            renderedComments: updatedComments,
            renderedDate: "2026-12-24",
            renderedStartTime: "08:30"
          }
        },
        context: {
          canonicalId: appointmentAnchorPatientId,
          suite: "workflow-appointment-comments",
          workflow: target.type === "legacy-openemr" ? "appointment-comments-legacy-surface" : "appointment-comments-modernized-surface"
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
      probe: "slice-102-appointment-comments-cleanup",
      description: "Captures the Slice 102 appointment comments cleanup state after deleting the temporary appointment.",
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
        suite: "workflow-appointment-comments",
        workflow: "appointment-comments-cleanup"
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
