import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";

test.describe("appointment category parity @slice97 @workflow-appointment-category @mutation", () => {
  test("creates, renders, updates, and removes a categorized future appointment", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const title = `Parity Category ${workflowSuffix()}`;
    const appointmentInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      title,
      eventDate: "2026-11-19",
      startTime: "09:15:00",
      endTime: "09:45:00",
      durationSeconds: 1800,
      homeText: "Created by the appointment category suite.",
      facilityId: 10,
      billingLocationId: 10,
      room: "Category",
      categoryId: 13
    };
    const appointmentUpdate = {
      providerId: patient.providerId,
      title,
      eventDate: "2026-11-19",
      startTime: "09:15:00",
      endTime: "09:45:00",
      durationSeconds: 1800,
      homeText: "Updated by the appointment category suite.",
      facilityId: 10,
      billingLocationId: 10,
      room: "Category",
      status: "-",
      categoryId: 10
    };
    let appointmentId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-97-appointment-category-precondition",
      description: "Captures the Slice 97 appointment category anchor patient, baseline appointment count, proposed Preventive Care Services appointment payload, and expected category update.",
      expected: {
        patient: {
          pubpid: appointmentAnchorPatientId
        },
        create: {
          eventDate: "2026-11-19",
          startTime: "09:15:00",
          endTime: "09:45:00",
          durationSeconds: 1800,
          facilityId: 10,
          billingLocationId: 10,
          room: "Category",
          status: "-",
          categoryId: 13,
          categoryName: "Preventive Care Services"
        },
        update: {
          categoryId: 10,
          categoryName: "New Patient"
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
        suite: "workflow-appointment-category",
        workflow: "appointment-category"
      }
    });

    try {
      appointmentId = await workflow.createAppointment(appointmentInput);

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        providerId: patient.providerId,
        title,
        eventDate: "2026-11-19",
        startTime: "09:15:00",
        endTime: "09:45:00",
        status: "-",
        room: "Category",
        categoryId: 13,
        categoryName: "Preventive Care Services"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-97-appointment-category-created",
        description: "Captures the temporary appointment database row immediately after Slice 97 creates it with Preventive Care Services category metadata.",
        expected: {
          appointment: {
            patientId: patient.pid,
            providerId: patient.providerId,
            title,
            eventDate: "2026-11-19",
            startTime: "09:15:00",
            endTime: "09:45:00",
            status: "-",
            room: "Category",
            categoryId: 13,
            categoryName: "Preventive Care Services"
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
          suite: "workflow-appointment-category",
          workflow: "appointment-category-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(title);
        await expect(page.locator("#form_category")).toHaveValue("13");

        await workflow.updateAppointment(appointmentId, appointmentUpdate);

        await openAppointmentDirect(page, target, appointmentId);
        await expect(page.locator("#form_category")).toHaveValue("10");
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-11-19");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        await expect(page.locator("body")).toContainText("Preventive Care Services");
        await expect(page.getByLabel("Edit appointment category")).toHaveValue("13");

        await page.getByLabel("Edit appointment category").selectOption("10");
        await page.getByRole("button", { name: "Save schedule" }).click();
        await expect(page.getByLabel("Edit appointment category")).toHaveValue("10");
        await expect(page.locator("body")).toContainText("New Patient (10)");
      }

      const updated = await workflow.getAppointment(appointmentId);
      expect(updated).toMatchObject({
        title,
        eventDate: "2026-11-19",
        startTime: "09:15:00",
        endTime: "09:45:00",
        status: "-",
        room: "Category",
        categoryId: 10,
        categoryName: "New Patient"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-97-appointment-category-updated",
        description: "Captures the temporary appointment database row after Slice 97 updates its category from Preventive Care Services to New Patient.",
        expected: {
          appointment: {
            title,
            eventDate: "2026-11-19",
            startTime: "09:15:00",
            endTime: "09:45:00",
            status: "-",
            room: "Category",
            categoryId: 10,
            categoryName: "New Patient"
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
          suite: "workflow-appointment-category",
          workflow: "appointment-category-updated"
        }
      });

      if (target.type === "legacy-openemr") {
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-97-appointment-category-surface",
          description: "Captures the legacy appointment edit rendering facts for the Slice 97 temporary categorized appointment after category update.",
          expected: {
            formTitle: title,
            formCategory: "10",
            eventDate: "2026-11-19",
            startTime: "09:15:00",
            categoryName: "New Patient"
          },
          actual: {
            patient,
            appointmentId,
            updated,
            surface: {
              application: "legacy-openemr",
              page: "appointment-edit",
              renderedTitle: title,
              renderedCategoryId: "10"
            }
          },
          context: {
            canonicalId: appointmentAnchorPatientId,
            suite: "workflow-appointment-category",
            workflow: "appointment-category-legacy-surface"
          }
        });
      } else {
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-97-appointment-category-surface",
          description: "Captures the modernized Calendar category rendering facts for the Slice 97 temporary appointment after category update.",
          expected: {
            calendarFilter: {
              patientId: appointmentAnchorPatientId,
              fromDate: "2026-11-19"
            },
            detail: {
              title,
              eventDate: "2026-11-19",
              startTime: "09:15",
              categoryId: 10,
              categoryName: "New Patient",
              categoryLabel: "New Patient (10)"
            }
          },
          actual: {
            patient,
            appointmentId,
            updated,
            surface: {
              application: "modernized-openemr",
              page: "calendar",
              renderedTitle: title,
              renderedDate: "2026-11-19",
              renderedStartTime: "09:15",
              renderedCategoryId: "10",
              renderedCategoryLabel: "New Patient (10)"
            }
          },
          context: {
            canonicalId: appointmentAnchorPatientId,
            suite: "workflow-appointment-category",
            workflow: "appointment-category-modernized-surface"
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
      probe: "slice-97-appointment-category-cleanup",
      description: "Captures the Slice 97 appointment category cleanup state after deleting the temporary appointment.",
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
        suite: "workflow-appointment-category",
        workflow: "appointment-category-cleanup"
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
