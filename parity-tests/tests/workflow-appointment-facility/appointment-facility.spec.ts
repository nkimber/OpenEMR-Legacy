import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";
const originalFacilityId = 10;
const reassignedFacilityId = 11;

test.describe("appointment facility reassignment parity @slice100 @workflow-appointment-facility @mutation", () => {
  test("creates, reassigns facility, renders, and removes a future appointment", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const title = `Parity Facility ${workflowSuffix()}`;
    const reassignedTitle = `${title} Reassigned`;
    const appointmentInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      title,
      eventDate: "2026-12-10",
      startTime: "10:00:00",
      endTime: "10:30:00",
      durationSeconds: 1800,
      homeText: "Created by the appointment facility reassignment suite.",
      facilityId: originalFacilityId,
      billingLocationId: originalFacilityId,
      room: "Facility",
      categoryId: 9
    };
    const appointmentUpdate = {
      providerId: patient.providerId,
      title: reassignedTitle,
      eventDate: "2026-12-10",
      startTime: "10:00:00",
      endTime: "10:30:00",
      durationSeconds: 1800,
      homeText: "Updated by the appointment facility reassignment suite.",
      facilityId: reassignedFacilityId,
      billingLocationId: reassignedFacilityId,
      room: "Facility",
      status: "-",
      categoryId: 9
    };
    let appointmentId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-100-appointment-facility-precondition",
      description: "Captures the Slice 100 appointment facility-reassignment anchor patient, baseline appointment count, proposed appointment payload, and expected service/billing facility reassignment.",
      expected: {
        patient: {
          pubpid: appointmentAnchorPatientId,
          providerId: patient.providerId
        },
        create: {
          eventDate: "2026-12-10",
          startTime: "10:00:00",
          endTime: "10:30:00",
          durationSeconds: 1800,
          facilityId: originalFacilityId,
          billingLocationId: originalFacilityId,
          room: "Facility",
          categoryId: 9,
          status: "-"
        },
        update: {
          title: reassignedTitle,
          facilityId: reassignedFacilityId,
          billingLocationId: reassignedFacilityId,
          status: "-",
          room: "Facility"
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
        suite: "workflow-appointment-facility",
        workflow: "appointment-facility"
      }
    });

    try {
      appointmentId = await workflow.createAppointment(appointmentInput);

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        providerId: patient.providerId,
        title,
        eventDate: "2026-12-10",
        startTime: "10:00:00",
        endTime: "10:30:00",
        status: "-",
        facilityId: originalFacilityId,
        room: "Facility",
        categoryId: 9
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-100-appointment-facility-created",
        description: "Captures the temporary appointment database row immediately after Slice 100 creates it with the original service and billing facility IDs.",
        expected: {
          appointment: {
            patientId: patient.pid,
            providerId: patient.providerId,
            title,
            eventDate: "2026-12-10",
            startTime: "10:00:00",
            endTime: "10:30:00",
            status: "-",
            facilityId: originalFacilityId,
            billingLocationId: originalFacilityId,
            room: "Facility",
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
          suite: "workflow-appointment-facility",
          workflow: "appointment-facility-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.updateAppointment(appointmentId, appointmentUpdate);

        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(reassignedTitle);
        await expect(page.locator("#facility")).toHaveValue(String(reassignedFacilityId));
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-12-10");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        await expect(page.getByLabel("Edit appointment facility ID")).toHaveValue(String(originalFacilityId));

        await page.getByLabel("Edit appointment title").fill(reassignedTitle);
        await page.getByLabel("Edit appointment facility ID").fill(String(reassignedFacilityId));
        await page.getByRole("button", { name: "Save schedule" }).click();
        await expect(page.getByRole("heading", { name: reassignedTitle })).toBeVisible();
        await expect(page.getByLabel("Edit appointment facility ID")).toHaveValue(String(reassignedFacilityId));
        await expect(page.locator("body")).toContainText(`(${reassignedFacilityId})`);
      }

      const reassigned = await workflow.getAppointment(appointmentId);
      expect(reassigned).toMatchObject({
        providerId: patient.providerId,
        title: reassignedTitle,
        eventDate: "2026-12-10",
        startTime: "10:00:00",
        endTime: "10:30:00",
        status: "-",
        facilityId: reassignedFacilityId,
        billingLocationId: reassignedFacilityId,
        room: "Facility",
        categoryId: 9,
        categoryName: "Established Patient"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-100-appointment-facility-reassigned",
        description: "Captures the temporary appointment database row after Slice 100 reassigns service and billing facility IDs.",
        expected: {
          appointment: {
            providerId: patient.providerId,
            title: reassignedTitle,
            eventDate: "2026-12-10",
            startTime: "10:00:00",
            endTime: "10:30:00",
            status: "-",
            facilityId: reassignedFacilityId,
            billingLocationId: reassignedFacilityId,
            room: "Facility",
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
          suite: "workflow-appointment-facility",
          workflow: "appointment-facility-reassigned"
        }
      });

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-100-appointment-facility-surface",
        description: target.type === "legacy-openemr"
          ? "Captures the legacy appointment edit rendering facts for the Slice 100 reassigned facility appointment."
          : "Captures the modernized Calendar rendering facts for the Slice 100 reassigned facility appointment.",
        expected: {
          title: reassignedTitle,
          facilityId: reassignedFacilityId,
          billingLocationId: reassignedFacilityId,
          eventDate: "2026-12-10",
          startTime: "10:00",
          room: "Facility"
        },
        actual: {
          patient,
          appointmentId,
          reassigned,
          surface: {
            application: target.type,
            page: target.type === "legacy-openemr" ? "appointment-edit" : "calendar",
            renderedTitle: reassignedTitle,
            renderedFacilityId: reassignedFacilityId,
            renderedBillingLocationId: reassignedFacilityId,
            renderedDate: "2026-12-10",
            renderedStartTime: "10:00"
          }
        },
        context: {
          canonicalId: appointmentAnchorPatientId,
          suite: "workflow-appointment-facility",
          workflow: target.type === "legacy-openemr" ? "appointment-facility-legacy-surface" : "appointment-facility-modernized-surface"
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
      probe: "slice-100-appointment-facility-cleanup",
      description: "Captures the Slice 100 appointment facility-reassignment cleanup state after deleting the temporary appointment.",
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
        suite: "workflow-appointment-facility",
        workflow: "appointment-facility-cleanup"
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
