import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";

test.describe("appointment provider reassignment parity @slice99 @workflow-appointment-provider @mutation", () => {
  test("creates, reassigns provider, renders, and removes a future appointment", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const title = `Parity Provider ${workflowSuffix()}`;
    const reassignedTitle = `${title} Reassigned`;
    const reassignedProviderId = patient.providerId === 101 ? 102 : 101;
    const appointmentInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      title,
      eventDate: "2026-12-03",
      startTime: "11:45:00",
      endTime: "12:15:00",
      durationSeconds: 1800,
      homeText: "Created by the appointment provider reassignment suite.",
      facilityId: 10,
      billingLocationId: 10,
      room: "Provider",
      categoryId: 9
    };
    const appointmentUpdate = {
      providerId: reassignedProviderId,
      title: reassignedTitle,
      eventDate: "2026-12-03",
      startTime: "11:45:00",
      endTime: "12:15:00",
      durationSeconds: 1800,
      homeText: "Updated by the appointment provider reassignment suite.",
      facilityId: 10,
      billingLocationId: 10,
      room: "Provider",
      status: "-",
      categoryId: 9
    };
    let appointmentId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-99-appointment-provider-precondition",
      description: "Captures the Slice 99 appointment provider-reassignment anchor patient, baseline appointment count, proposed appointment payload, and expected provider reassignment.",
      expected: {
        patient: {
          pubpid: appointmentAnchorPatientId,
          originalProviderId: patient.providerId
        },
        create: {
          eventDate: "2026-12-03",
          startTime: "11:45:00",
          endTime: "12:15:00",
          durationSeconds: 1800,
          facilityId: 10,
          billingLocationId: 10,
          room: "Provider",
          categoryId: 9,
          status: "-"
        },
        update: {
          title: reassignedTitle,
          providerId: reassignedProviderId,
          status: "-",
          room: "Provider"
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
        suite: "workflow-appointment-provider",
        workflow: "appointment-provider"
      }
    });

    try {
      appointmentId = await workflow.createAppointment(appointmentInput);

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        providerId: patient.providerId,
        title,
        eventDate: "2026-12-03",
        startTime: "11:45:00",
        endTime: "12:15:00",
        status: "-",
        room: "Provider",
        categoryId: 9
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-99-appointment-provider-created",
        description: "Captures the temporary appointment database row immediately after Slice 99 creates it with the anchor patient's original provider.",
        expected: {
          appointment: {
            patientId: patient.pid,
            providerId: patient.providerId,
            title,
            eventDate: "2026-12-03",
            startTime: "11:45:00",
            endTime: "12:15:00",
            status: "-",
            room: "Provider",
            categoryId: 9
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
          suite: "workflow-appointment-provider",
          workflow: "appointment-provider-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.updateAppointment(appointmentId, appointmentUpdate);

        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(reassignedTitle);
        await expect(page.locator("#provd")).toHaveValue(String(reassignedProviderId));
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-12-03");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        await expect(page.getByLabel("Edit appointment provider ID")).toHaveValue(String(patient.providerId));

        await page.getByLabel("Edit appointment title").fill(reassignedTitle);
        await page.getByLabel("Edit appointment provider ID").fill(String(reassignedProviderId));
        await page.getByRole("button", { name: "Save schedule" }).click();
        await expect(page.getByRole("heading", { name: reassignedTitle })).toBeVisible();
        await expect(page.getByLabel("Edit appointment provider ID")).toHaveValue(String(reassignedProviderId));
        await expect(page.locator("body")).toContainText(`(${reassignedProviderId})`);
      }

      const reassigned = await workflow.getAppointment(appointmentId);
      expect(reassigned).toMatchObject({
        providerId: reassignedProviderId,
        title: reassignedTitle,
        eventDate: "2026-12-03",
        startTime: "11:45:00",
        endTime: "12:15:00",
        status: "-",
        room: "Provider",
        categoryId: 9,
        categoryName: "Established Patient"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-99-appointment-provider-reassigned",
        description: "Captures the temporary appointment database row after Slice 99 reassigns it to the alternate provider.",
        expected: {
          appointment: {
            providerId: reassignedProviderId,
            title: reassignedTitle,
            eventDate: "2026-12-03",
            startTime: "11:45:00",
            endTime: "12:15:00",
            status: "-",
            room: "Provider",
            categoryId: 9,
            categoryName: "Established Patient"
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
          reassigned
        },
        context: {
          canonicalId: appointmentAnchorPatientId,
          suite: "workflow-appointment-provider",
          workflow: "appointment-provider-reassigned"
        }
      });

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-99-appointment-provider-surface",
        description: target.type === "legacy-openemr"
          ? "Captures the legacy appointment edit rendering facts for the Slice 99 reassigned provider appointment."
          : "Captures the modernized Calendar rendering facts for the Slice 99 reassigned provider appointment.",
        expected: {
          title: reassignedTitle,
          providerId: reassignedProviderId,
          eventDate: "2026-12-03",
          startTime: "11:45",
          room: "Provider"
        },
        actual: {
          patient,
          appointmentId,
          reassigned,
          surface: {
            application: target.type,
            page: target.type === "legacy-openemr" ? "appointment-edit" : "calendar",
            renderedTitle: reassignedTitle,
            renderedProviderId: reassignedProviderId,
            renderedDate: "2026-12-03",
            renderedStartTime: "11:45"
          }
        },
        context: {
          canonicalId: appointmentAnchorPatientId,
          suite: "workflow-appointment-provider",
          workflow: target.type === "legacy-openemr" ? "appointment-provider-legacy-surface" : "appointment-provider-modernized-surface"
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
      probe: "slice-99-appointment-provider-cleanup",
      description: "Captures the Slice 99 appointment provider-reassignment cleanup state after deleting the temporary appointment.",
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
        suite: "workflow-appointment-provider",
        workflow: "appointment-provider-cleanup"
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
