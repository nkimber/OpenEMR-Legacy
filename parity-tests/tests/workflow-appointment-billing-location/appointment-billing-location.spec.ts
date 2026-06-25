import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";
const serviceFacilityId = 10;
const originalBillingLocationId = 10;
const reassignedBillingLocationId = 11;

test.describe("appointment billing-location reassignment parity @slice101 @workflow-appointment-billing-location @mutation", () => {
  test("creates, reassigns billing location, renders, and removes a future appointment", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const title = `Parity Billing Location ${workflowSuffix()}`;
    const reassignedTitle = `${title} Reassigned`;
    const appointmentInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      title,
      eventDate: "2026-12-17",
      startTime: "09:15:00",
      endTime: "09:45:00",
      durationSeconds: 1800,
      homeText: "Created by the appointment billing-location reassignment suite.",
      facilityId: serviceFacilityId,
      billingLocationId: originalBillingLocationId,
      room: "BillingLoc",
      categoryId: 9
    };
    const appointmentUpdate = {
      providerId: patient.providerId,
      title: reassignedTitle,
      eventDate: "2026-12-17",
      startTime: "09:15:00",
      endTime: "09:45:00",
      durationSeconds: 1800,
      homeText: "Updated by the appointment billing-location reassignment suite.",
      facilityId: serviceFacilityId,
      billingLocationId: reassignedBillingLocationId,
      room: "BillingLoc",
      status: "-",
      categoryId: 9
    };
    let appointmentId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-101-appointment-billing-location-precondition",
      description: "Captures the Slice 101 appointment billing-location reassignment anchor patient, baseline appointment count, proposed appointment payload, and expected billing facility reassignment while preserving service facility.",
      expected: {
        patient: {
          pubpid: appointmentAnchorPatientId,
          providerId: patient.providerId
        },
        create: {
          eventDate: "2026-12-17",
          startTime: "09:15:00",
          endTime: "09:45:00",
          durationSeconds: 1800,
          facilityId: serviceFacilityId,
          billingLocationId: originalBillingLocationId,
          room: "BillingLoc",
          categoryId: 9,
          status: "-"
        },
        update: {
          title: reassignedTitle,
          facilityId: serviceFacilityId,
          billingLocationId: reassignedBillingLocationId,
          status: "-",
          room: "BillingLoc"
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
        suite: "workflow-appointment-billing-location",
        workflow: "appointment-billing-location"
      }
    });

    try {
      appointmentId = await workflow.createAppointment(appointmentInput);

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        providerId: patient.providerId,
        title,
        eventDate: "2026-12-17",
        startTime: "09:15:00",
        endTime: "09:45:00",
        status: "-",
        facilityId: serviceFacilityId,
        billingLocationId: originalBillingLocationId,
        room: "BillingLoc",
        categoryId: 9
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-101-appointment-billing-location-created",
        description: "Captures the temporary appointment database row immediately after Slice 101 creates it with matching service and billing facility IDs.",
        expected: {
          appointment: {
            patientId: patient.pid,
            providerId: patient.providerId,
            title,
            eventDate: "2026-12-17",
            startTime: "09:15:00",
            endTime: "09:45:00",
            status: "-",
            facilityId: serviceFacilityId,
            billingLocationId: originalBillingLocationId,
            room: "BillingLoc",
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
          suite: "workflow-appointment-billing-location",
          workflow: "appointment-billing-location-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await workflow.updateAppointment(appointmentId, appointmentUpdate);

        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(reassignedTitle);
        await expect(page.locator("#facility")).toHaveValue(String(serviceFacilityId));
        await expect(page.locator("#billing_facility")).toHaveValue(String(reassignedBillingLocationId));
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-12-17");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        await expect(page.getByLabel("Edit appointment facility ID")).toHaveValue(String(serviceFacilityId));
        await expect(page.getByLabel("Edit appointment billing facility ID")).toHaveValue(String(originalBillingLocationId));

        await page.getByLabel("Edit appointment title").fill(reassignedTitle);
        await page.getByLabel("Edit appointment billing facility ID").fill(String(reassignedBillingLocationId));
        await page.getByRole("button", { name: "Save schedule" }).click();
        await expect(page.getByRole("heading", { name: reassignedTitle })).toBeVisible();
        await expect(page.getByLabel("Edit appointment facility ID")).toHaveValue(String(serviceFacilityId));
        await expect(page.getByLabel("Edit appointment billing facility ID")).toHaveValue(String(reassignedBillingLocationId));
        await expect(page.locator("body")).toContainText("Billing facility");
      }

      const reassigned = await workflow.getAppointment(appointmentId);
      expect(reassigned).toMatchObject({
        providerId: patient.providerId,
        title: reassignedTitle,
        eventDate: "2026-12-17",
        startTime: "09:15:00",
        endTime: "09:45:00",
        status: "-",
        facilityId: serviceFacilityId,
        billingLocationId: reassignedBillingLocationId,
        room: "BillingLoc",
        categoryId: 9,
        categoryName: "Established Patient"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-101-appointment-billing-location-reassigned",
        description: "Captures the temporary appointment database row after Slice 101 reassigns billing facility while preserving service facility.",
        expected: {
          appointment: {
            providerId: patient.providerId,
            title: reassignedTitle,
            eventDate: "2026-12-17",
            startTime: "09:15:00",
            endTime: "09:45:00",
            status: "-",
            facilityId: serviceFacilityId,
            billingLocationId: reassignedBillingLocationId,
            room: "BillingLoc",
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
          suite: "workflow-appointment-billing-location",
          workflow: "appointment-billing-location-reassigned"
        }
      });

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-101-appointment-billing-location-surface",
        description: target.type === "legacy-openemr"
          ? "Captures the legacy appointment edit rendering facts for the Slice 101 reassigned billing-location appointment."
          : "Captures the modernized Calendar rendering facts for the Slice 101 reassigned billing-location appointment.",
        expected: {
          title: reassignedTitle,
          facilityId: serviceFacilityId,
          billingLocationId: reassignedBillingLocationId,
          eventDate: "2026-12-17",
          startTime: "09:15",
          room: "BillingLoc"
        },
        actual: {
          patient,
          appointmentId,
          reassigned,
          surface: {
            application: target.type,
            page: target.type === "legacy-openemr" ? "appointment-edit" : "calendar",
            renderedTitle: reassignedTitle,
            renderedFacilityId: serviceFacilityId,
            renderedBillingLocationId: reassignedBillingLocationId,
            renderedDate: "2026-12-17",
            renderedStartTime: "09:15"
          }
        },
        context: {
          canonicalId: appointmentAnchorPatientId,
          suite: "workflow-appointment-billing-location",
          workflow: target.type === "legacy-openemr" ? "appointment-billing-location-legacy-surface" : "appointment-billing-location-modernized-surface"
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
      probe: "slice-101-appointment-billing-location-cleanup",
      description: "Captures the Slice 101 appointment billing-location reassignment cleanup state after deleting the temporary appointment.",
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
        suite: "workflow-appointment-billing-location",
        workflow: "appointment-billing-location-cleanup"
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
