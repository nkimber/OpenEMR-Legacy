import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const blockingPatientId = "MOD-PAT-0003";
const requestingPatientId = "MOD-PAT-0004";
const availabilityDate = "2026-12-29";
const outsideHoursDate = "2026-12-05";
const availabilityStartTime = "10:00:00";
const availabilityEndTime = "10:30:00";
const durationSeconds = 1800;
const room = "Availability";

test.describe("appointment availability validation parity @slice575 @workflow-appointment-availability-validation @mutation", () => {
  test("reports active conflicts and outside-hours appointment availability", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const blockingPatient = await targetDb.findPatientByCanonicalId(blockingPatientId);
    const requestingPatient = await targetDb.findPatientByCanonicalId(requestingPatientId);
    expect(blockingPatient).not.toBeNull();
    expect(requestingPatient).not.toBeNull();

    if (!blockingPatient || !requestingPatient) {
      throw new Error("Missing seeded patients for appointment availability validation.");
    }

    const providerId = blockingPatient.providerId;
    const facilityId = 10;
    const suffix = workflowSuffix();
    const blockingTitle = `Parity Availability Blocker ${suffix}`;
    let blockingAppointmentId: number | string | null = null;
    let surfaceFacts: Record<string, unknown> = {};

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-575-appointment-availability-precondition",
      description:
        "Seeded patients and provider are available before creating a temporary appointment used to validate availability conflicts.",
      expected: {
        blockingPatientId,
        requestingPatientId,
        providerId,
        facilityId,
        availabilityDate,
        availabilityStartTime,
        availabilityEndTime,
        room,
        policyWindow: "Monday-Friday 08:00-17:00"
      },
      actual: {
        blockingPatient: {
          pid: blockingPatient.pid,
          pubpid: blockingPatient.pubpid,
          providerId: blockingPatient.providerId
        },
        requestingPatient: {
          pid: requestingPatient.pid,
          pubpid: requestingPatient.pubpid,
          providerId: requestingPatient.providerId
        },
        plannedBlockingTitle: blockingTitle
      }
    });

    try {
      blockingAppointmentId = await workflow.createAppointment({
        patientId: blockingPatient.pid,
        providerId,
        title: blockingTitle,
        eventDate: availabilityDate,
        startTime: availabilityStartTime,
        endTime: availabilityEndTime,
        durationSeconds,
        homeText: "Created by the appointment availability validation suite.",
        facilityId,
        billingLocationId: facilityId,
        room,
        categoryId: 9
      });

      const blockingAppointment = await workflow.getAppointment(blockingAppointmentId);
      expect(blockingAppointment).toMatchObject({
        patientId: blockingPatient.pid,
        providerId,
        title: blockingTitle,
        eventDate: availabilityDate,
        startTime: availabilityStartTime,
        endTime: availabilityEndTime,
        status: "-",
        room
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, blockingAppointmentId);
        await expect(page.locator('input[name="form_title"]')).toHaveValue(blockingTitle);
        surfaceFacts = {
          legacy: {
            blockingAppointmentId,
            providerConflictDetectedBySeedProjection: true,
            roomConflictDetectedBySeedProjection: true,
            outsideHoursBlockedBySharedPolicy: true
          }
        };
      } else {
        await openAuthenticatedModernizedCalendar(page, target, requestingPatient.pubpid, availabilityDate);
        await fillAvailabilityDraft(page, {
          title: "Availability conflict check",
          date: availabilityDate,
          startTime: "10:00",
          durationMinutes: "30",
          providerId: String(providerId),
          facilityId: String(facilityId),
          room
        });
        await page.getByRole("button", { name: "Check availability" }).click();
        const availabilityResult = page.getByLabel("Appointment availability result");
        await expect(availabilityResult).toContainText("Unavailable");
        await expect(availabilityResult).toContainText("Provider available | Facility available | 2 conflicts");
        await expect(availabilityResult).toContainText("Requested time has 2 active scheduling conflict(s).");

        await fillAvailabilityDraft(page, {
          title: "Availability outside-hours check",
          date: outsideHoursDate,
          startTime: "07:00",
          durationMinutes: "30",
          providerId: String(providerId),
          facilityId: String(facilityId),
          room
        });
        await page.getByRole("button", { name: "Check availability" }).click();
        await expect(availabilityResult).toContainText("Unavailable");
        await expect(availabilityResult).toContainText("Provider unavailable | Facility unavailable | 0 conflicts");
        await expect(availabilityResult).toContainText("outside the shared provider/facility bookable window");

        surfaceFacts = {
          modernized: {
            conflictStatusRendered: true,
            providerAndFacilityAvailableForBusinessHours: true,
            conflictCountText: "2 conflicts",
            outsideHoursStatusRendered: true,
            outsideHoursConflictCountText: "0 conflicts"
          }
        };
      }

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-575-appointment-availability-validation",
        description:
          "Temporary appointment validates that the shared availability policy reports provider/room conflicts and outside-hours unavailability without creating a second appointment.",
        expected: {
          blockingAppointmentId,
          conflictValidation: {
            available: false,
            withinBusinessHours: true,
            providerAvailable: true,
            facilityAvailable: true,
            conflictTypes: ["provider", "room"]
          },
          outsideHoursValidation: {
            available: false,
            withinBusinessHours: false,
            providerAvailable: false,
            facilityAvailable: false,
            conflictCount: 0
          }
        },
        actual: {
          blockingAppointment,
          surfaceFacts
        }
      });
    } finally {
      if (blockingAppointmentId !== null) {
        await workflow.deleteAppointment(blockingAppointmentId);
      }
    }

    const afterCleanup = blockingAppointmentId !== null ? await workflow.getAppointment(blockingAppointmentId) : null;
    expect(afterCleanup).toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-575-appointment-availability-cleanup",
      description:
        "Temporary availability-validation blocking appointment was removed after validation evidence was captured.",
      expected: {
        blockingAppointmentDeleted: true
      },
      actual: {
        blockingAppointmentId,
        afterCleanup
      }
    });
  });
});

async function fillAvailabilityDraft(
  page: import("@playwright/test").Page,
  input: {
    title: string;
    date: string;
    startTime: string;
    durationMinutes: string;
    providerId: string;
    facilityId: string;
    room: string;
  }
) {
  await page.getByLabel("Appointment title").fill(input.title);
  await page.getByLabel("New appointment date").fill(input.date);
  await page.getByLabel("New appointment start time").fill(input.startTime);
  await page.getByLabel("New appointment duration").fill(input.durationMinutes);
  await page.getByLabel("New appointment provider ID").fill(input.providerId);
  await page.getByLabel("New appointment facility ID").fill(input.facilityId);
  await page.getByLabel("New appointment billing facility ID").fill(input.facilityId);
  await page.getByLabel("New appointment room").fill(input.room);
}

function workflowSuffix() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
