import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";

const appointmentExceptionPatientId = "MOD-PAT-0013";
const occurrenceSearchDate = "2026-12-02";
const seededExceptionDate = "2026-12-16";
const rescheduledOccurrenceDate = "2026-12-30";
const rescheduledStandaloneDate = "2027-01-06";
const rescheduledStandaloneStart = "14:00";
const rescheduledStandaloneEnd = "14:45:00";
const rescheduledDurationMinutes = 45;
const expectedBeforeDates = ["2026-12-02", "2026-12-30", "2027-01-13", "2027-01-27"];
const expectedAfterDates = ["2026-12-02", "2027-01-13", "2027-01-27"];

test.describe("appointment occurrence reschedule parity @slice108 @workflow-appointment-occurrence-reschedule @mutation", () => {
  test("moves a generated occurrence into a standalone appointment and skips the original occurrence", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentExceptionPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentExceptionPatientId} was not found.`);
    }

    const beforeOccurrences = await workflow.getAppointmentSeriesOccurrences(patient.pid, occurrenceSearchDate);
    const preventiveCareBefore = beforeOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
    expect(preventiveCareBefore.map((occurrence) => occurrence.date)).toEqual(expectedBeforeDates);

    const occurrenceToReschedule = preventiveCareBefore.find((occurrence) => occurrence.date === rescheduledOccurrenceDate);
    expect(occurrenceToReschedule).toBeDefined();
    if (!occurrenceToReschedule) {
      throw new Error(`Generated occurrence ${rescheduledOccurrenceDate} was not found.`);
    }
    expect(occurrenceToReschedule.isVirtualOccurrence).toBe(true);
    expect(occurrenceToReschedule.occurrenceNumber).toBe(5);

    const seriesRootId = occurrenceToReschedule.seriesRootId;
    const rootBeforeReschedule = await workflow.getAppointment(seriesRootId);
    expect(rootBeforeReschedule).not.toBeNull();
    if (!rootBeforeReschedule) {
      throw new Error(`Series root appointment ${seriesRootId} was not found.`);
    }

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-108-appointment-occurrence-reschedule-precondition",
      description: "Captures the Slice 108 appointment occurrence-reschedule anchor patient, seeded recurring-series state, and generated occurrence selected for movement into a standalone appointment.",
      expected: {
        patient: {
          pubpid: appointmentExceptionPatientId,
          providerId: patient.providerId
        },
        series: {
          title: "Preventive Care",
          occurrenceSearchDate,
          seededExceptionDate,
          expectedBeforeDates,
          occurrenceToReschedule: {
            date: rescheduledOccurrenceDate,
            occurrenceNumber: 5,
            isVirtualOccurrence: true
          },
          standaloneTarget: {
            eventDate: rescheduledStandaloneDate,
            startTime: rescheduledStandaloneStart,
            endTime: rescheduledStandaloneEnd,
            durationMinutes: rescheduledDurationMinutes,
            recurrenceType: 0
          },
          recurrenceExceptionCountBeforeReschedule: 1
        }
      },
      actual: {
        patient,
        rootBeforeReschedule,
        occurrenceSearchDate,
        beforeOccurrenceCount: preventiveCareBefore.length,
        beforeOccurrences: preventiveCareBefore,
        occurrenceToReschedule
      },
      context: {
        canonicalId: appointmentExceptionPatientId,
        suite: "workflow-appointment-occurrence-reschedule",
        workflow: "appointment-occurrence-reschedule-precondition"
      }
    });

    try {
      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient.pubpid);
        await page.getByLabel("Appointment from date").fill(occurrenceSearchDate);

        const occurrenceButton = page.getByRole("button", { name: /Preventive Care[\s\S]*2026-12-30/i }).first();
        await expect(occurrenceButton).toBeVisible();
        await occurrenceButton.click();
        await expect(page.getByRole("heading", { name: "Preventive Care" })).toBeVisible();
        await expect(page.locator("body")).toContainText("Generated occurrence 5");

        await page.getByLabel("Edit appointment date").fill(rescheduledStandaloneDate);
        await page.getByLabel("Edit appointment start time").fill(rescheduledStandaloneStart);
        await page.getByLabel("Edit appointment duration").fill(String(rescheduledDurationMinutes));
        await page.getByRole("button", { name: "Reschedule occurrence" }).click();

        await expect(page.getByRole("button", { name: /Preventive Care[\s\S]*2027-01-06/i })).toBeVisible();
        await expect(page.locator("body")).toContainText("Does not repeat");
      } else {
        await workflow.addAppointmentRecurrenceException(seriesRootId, rescheduledOccurrenceDate);
        await workflow.createAppointment({
          patientId: patient.pid,
          providerId: rootBeforeReschedule.providerId,
          title: rootBeforeReschedule.title,
          eventDate: rescheduledStandaloneDate,
          startTime: `${rescheduledStandaloneStart}:00`,
          endTime: rescheduledStandaloneEnd,
          durationSeconds: rescheduledDurationMinutes * 60,
          homeText: rootBeforeReschedule.homeText,
          facilityId: rootBeforeReschedule.facilityId,
          billingLocationId: rootBeforeReschedule.billingLocationId,
          room: rootBeforeReschedule.room,
          categoryId: rootBeforeReschedule.categoryId,
          recurrenceType: 0
        });
      }

      const rootAfterReschedule = await workflow.getAppointment(seriesRootId);
      expect(rootAfterReschedule).not.toBeNull();
      expect(rootAfterReschedule!.recurrenceExdates).toEqual([seededExceptionDate, rescheduledOccurrenceDate]);

      const afterOccurrences = await workflow.getAppointmentSeriesOccurrences(patient.pid, occurrenceSearchDate);
      const preventiveCareAfter = afterOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
      expect(preventiveCareAfter.map((occurrence) => occurrence.date)).toEqual(expectedAfterDates);
      expect(preventiveCareAfter.map((occurrence) => occurrence.occurrenceNumber)).toEqual([3, 6, 7]);

      const appointmentRows = await workflow.getAppointmentsForPatient(patient.pid, rescheduledStandaloneDate);
      const standaloneAppointment = appointmentRows.find(isRescheduledStandaloneAppointment);
      expect(standaloneAppointment).toBeDefined();
      expect(standaloneAppointment!.eventDate).toBe(rescheduledStandaloneDate);
      expect(standaloneAppointment!.startTime.startsWith(rescheduledStandaloneStart)).toBe(true);
      expect(standaloneAppointment!.recurrenceType).toBe(0);
      expect(standaloneAppointment!.categoryName).toBe("Preventive Care Services");
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-108-appointment-occurrence-reschedule-moved",
        description: "Captures the recurring root, generated occurrence expansion, and standalone moved appointment after Slice 108 reschedules one generated occurrence.",
        expected: {
          root: {
            recurrenceExdates: [seededExceptionDate, rescheduledOccurrenceDate]
          },
          occurrenceDates: expectedAfterDates,
          omittedOriginalDate: rescheduledOccurrenceDate,
          occurrenceNumbers: [3, 6, 7],
          standaloneAppointment: {
            title: "Preventive Care",
            eventDate: rescheduledStandaloneDate,
            startTime: rescheduledStandaloneStart,
            endTime: rescheduledStandaloneEnd,
            recurrenceType: 0,
            categoryName: "Preventive Care Services"
          },
          originalDatePresentInExpansion: false
        },
        actual: {
          patient,
          occurrenceToReschedule,
          rootBeforeReschedule,
          rootAfterReschedule,
          occurrenceSearchDate,
          originalDatePresentInExpansion: preventiveCareAfter.some((occurrence) => occurrence.date === rescheduledOccurrenceDate),
          afterOccurrences: preventiveCareAfter,
          standaloneAppointment,
          standaloneSearchRows: appointmentRows,
          surface: target.type === "modernized-openemr"
            ? {
                application: target.type,
                page: "calendar",
                rescheduledOccurrenceButtonVisible: true,
                recurrenceLabel: "Does not repeat"
              }
            : {
                application: target.type,
                page: "workflow-projection"
              }
        },
        context: {
          canonicalId: appointmentExceptionPatientId,
          suite: "workflow-appointment-occurrence-reschedule",
          workflow: "appointment-occurrence-reschedule-moved"
        }
      });
    } finally {
      const appointmentRows = await workflow.getAppointmentsForPatient(patient.pid, rescheduledStandaloneDate);
      const appointmentsToDelete = appointmentRows.filter(isRescheduledStandaloneAppointment);
      for (const appointment of appointmentsToDelete) {
        await workflow.deleteAppointment(appointment.id);
      }

      await workflow.setAppointmentRecurrenceExdates(seriesRootId, [seededExceptionDate]);
    }

    const restoredRoot = await workflow.getAppointment(seriesRootId);
    expect(restoredRoot).not.toBeNull();
    expect(restoredRoot!.recurrenceExdates).toEqual([seededExceptionDate]);

    const restoredOccurrences = await workflow.getAppointmentSeriesOccurrences(patient.pid, occurrenceSearchDate);
    const preventiveCareRestored = restoredOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
    expect(preventiveCareRestored.map((occurrence) => occurrence.date)).toEqual(expectedBeforeDates);

    const restoredRows = await workflow.getAppointmentsForPatient(patient.pid, rescheduledStandaloneDate);
    expect(restoredRows.filter(isRescheduledStandaloneAppointment)).toHaveLength(0);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-108-appointment-occurrence-reschedule-cleanup",
      description: "Captures the Slice 108 cleanup state after deleting the standalone moved appointment and restoring the recurring root to the seeded exception-date list.",
      expected: {
        root: {
          recurrenceExdates: [seededExceptionDate]
        },
        occurrenceDates: expectedBeforeDates,
        restoredOriginalDate: rescheduledOccurrenceDate,
        standaloneAppointmentDeleted: true,
        recurrenceExceptionCount: 1
      },
      actual: {
        patient,
        occurrenceToReschedule,
        restoredRoot,
        restoredOccurrenceCount: preventiveCareRestored.length,
        restoredOccurrences: preventiveCareRestored,
        standaloneCleanupRows: restoredRows,
        standaloneAppointmentDeleted: restoredRows.filter(isRescheduledStandaloneAppointment).length === 0
      },
      context: {
        canonicalId: appointmentExceptionPatientId,
        suite: "workflow-appointment-occurrence-reschedule",
        workflow: "appointment-occurrence-reschedule-cleanup"
      }
    });
  });
});

function isRescheduledStandaloneAppointment(appointment: {
  title: string;
  eventDate: string;
  startTime: string;
  recurrenceType: number;
}) {
  return appointment.title === "Preventive Care"
    && appointment.eventDate === rescheduledStandaloneDate
    && appointment.startTime.startsWith(rescheduledStandaloneStart)
    && appointment.recurrenceType === 0;
}
