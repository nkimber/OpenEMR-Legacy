import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";

const appointmentExceptionPatientId = "MOD-PAT-0013";
const occurrenceSearchDate = "2026-12-02";
const seededExceptionDate = "2026-12-16";
const cancelledOccurrenceDate = "2026-12-30";
const expectedBeforeDates = ["2026-12-02", "2026-12-30", "2027-01-13", "2027-01-27"];
const expectedAfterDates = ["2026-12-02", "2027-01-13", "2027-01-27"];

test.describe("appointment occurrence cancel parity @slice106 @workflow-appointment-occurrence-cancel @mutation", () => {
  test("adds a recurrence exception when cancelling a generated occurrence", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentExceptionPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentExceptionPatientId} was not found.`);
    }

    const beforeOccurrences = await workflow.getAppointmentSeriesOccurrences(patient.pid, occurrenceSearchDate);
    const preventiveCareBefore = beforeOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
    expect(preventiveCareBefore.map((occurrence) => occurrence.date)).toEqual(expectedBeforeDates);

    const occurrenceToCancel = preventiveCareBefore.find((occurrence) => occurrence.date === cancelledOccurrenceDate);
    expect(occurrenceToCancel).toBeDefined();
    if (!occurrenceToCancel) {
      throw new Error(`Generated occurrence ${cancelledOccurrenceDate} was not found.`);
    }
    expect(occurrenceToCancel.isVirtualOccurrence).toBe(true);
    expect(occurrenceToCancel.occurrenceNumber).toBe(5);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-106-appointment-occurrence-cancel-precondition",
      description: "Captures the Slice 106 appointment occurrence-cancel anchor patient, seeded recurring-series state, and generated occurrence selected for cancellation.",
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
          occurrenceToCancel: {
            date: cancelledOccurrenceDate,
            occurrenceNumber: 5,
            isVirtualOccurrence: true
          },
          recurrenceExceptionCountBeforeCancel: 1
        }
      },
      actual: {
        patient,
        occurrenceSearchDate,
        beforeOccurrenceCount: preventiveCareBefore.length,
        beforeOccurrences: preventiveCareBefore,
        occurrenceToCancel
      },
      context: {
        canonicalId: appointmentExceptionPatientId,
        suite: "workflow-appointment-occurrence-cancel",
        workflow: "appointment-occurrence-cancel-precondition"
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

        await page.getByRole("button", { name: "Skip occurrence" }).click();
        await expect(page.locator(".appointment-list").getByRole("button", { name: /2026-12-30/ })).toHaveCount(0);
        await expect(page.locator("body")).toContainText("2 skipped");
      } else {
        await workflow.addAppointmentRecurrenceException(occurrenceToCancel.seriesRootId, cancelledOccurrenceDate);
      }

      const rootAppointment = await workflow.getAppointment(occurrenceToCancel.seriesRootId);
      expect(rootAppointment).not.toBeNull();
      expect(rootAppointment!.recurrenceExdates).toEqual([seededExceptionDate, cancelledOccurrenceDate]);

      const afterOccurrences = await workflow.getAppointmentSeriesOccurrences(patient.pid, occurrenceSearchDate);
      const preventiveCareAfter = afterOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
      expect(preventiveCareAfter.map((occurrence) => occurrence.date)).toEqual(expectedAfterDates);
      expect(preventiveCareAfter.map((occurrence) => occurrence.occurrenceNumber)).toEqual([3, 6, 7]);
      expect(preventiveCareAfter.every((occurrence) => occurrence.recurrenceExceptionCount === 2)).toBe(true);
      expect(preventiveCareAfter.every((occurrence) => occurrence.recurrenceExdates.includes(cancelledOccurrenceDate))).toBe(true);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-106-appointment-occurrence-cancel-skipped",
        description: "Captures the recurring root and generated occurrence expansion after Slice 106 adds the cancelled occurrence date to recurrence exceptions.",
        expected: {
          root: {
            recurrenceExdates: [seededExceptionDate, cancelledOccurrenceDate]
          },
          occurrenceDates: expectedAfterDates,
          omittedDate: cancelledOccurrenceDate,
          occurrenceNumbers: [3, 6, 7],
          recurrenceExceptionCount: 2,
          cancelledDatePresentInExpansion: false
        },
        actual: {
          patient,
          occurrenceToCancel,
          rootAppointment,
          occurrenceSearchDate,
          cancelledDatePresentInExpansion: preventiveCareAfter.some((occurrence) => occurrence.date === cancelledOccurrenceDate),
          afterOccurrences: preventiveCareAfter,
          surface: target.type === "modernized-openemr"
            ? {
                application: target.type,
                page: "calendar",
                skippedCountLabel: "2 skipped",
                skippedOccurrenceButtonVisible: false
              }
            : {
                application: target.type,
                page: "workflow-projection"
              }
        },
        context: {
          canonicalId: appointmentExceptionPatientId,
          suite: "workflow-appointment-occurrence-cancel",
          workflow: "appointment-occurrence-cancel-skipped"
        }
      });
    } finally {
      await workflow.setAppointmentRecurrenceExdates(occurrenceToCancel.seriesRootId, [seededExceptionDate]);
    }

    const restoredRoot = await workflow.getAppointment(occurrenceToCancel.seriesRootId);
    expect(restoredRoot).not.toBeNull();
    expect(restoredRoot!.recurrenceExdates).toEqual([seededExceptionDate]);

    const restoredOccurrences = await workflow.getAppointmentSeriesOccurrences(patient.pid, occurrenceSearchDate);
    const preventiveCareRestored = restoredOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
    expect(preventiveCareRestored.map((occurrence) => occurrence.date)).toEqual(expectedBeforeDates);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-106-appointment-occurrence-cancel-cleanup",
      description: "Captures the Slice 106 cleanup state after restoring the recurring root to the seeded exception-date list.",
      expected: {
        root: {
          recurrenceExdates: [seededExceptionDate]
        },
        occurrenceDates: expectedBeforeDates,
        restoredCancelledOccurrenceDate: cancelledOccurrenceDate,
        recurrenceExceptionCount: 1
      },
      actual: {
        patient,
        occurrenceToCancel,
        restoredRoot,
        restoredOccurrenceCount: preventiveCareRestored.length,
        restoredOccurrences: preventiveCareRestored
      },
      context: {
        canonicalId: appointmentExceptionPatientId,
        suite: "workflow-appointment-occurrence-cancel",
        workflow: "appointment-occurrence-cancel-cleanup"
      }
    });
  });
});
