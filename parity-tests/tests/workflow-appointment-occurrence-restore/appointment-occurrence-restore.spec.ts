import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";

const appointmentExceptionPatientId = "MOD-PAT-0013";
const occurrenceSearchDate = "2026-12-02";
const seededExceptionDate = "2026-12-16";
const restoredOccurrenceDate = "2026-12-30";
const expectedSkippedDates = ["2026-12-02", "2027-01-13", "2027-01-27"];
const expectedRestoredDates = ["2026-12-02", "2026-12-30", "2027-01-13", "2027-01-27"];

test.describe("appointment occurrence restore parity @slice107 @workflow-appointment-occurrence-restore @mutation", () => {
  test("restores a skipped generated occurrence by removing its recurrence exception", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentExceptionPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentExceptionPatientId} was not found.`);
    }

    const beforeOccurrences = await workflow.getAppointmentSeriesOccurrences(patient.pid, occurrenceSearchDate);
    const preventiveCareBefore = beforeOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
    expect(preventiveCareBefore.map((occurrence) => occurrence.date)).toEqual(expectedRestoredDates);

    const occurrenceToRestore = preventiveCareBefore.find((occurrence) => occurrence.date === restoredOccurrenceDate);
    expect(occurrenceToRestore).toBeDefined();
    if (!occurrenceToRestore) {
      throw new Error(`Generated occurrence ${restoredOccurrenceDate} was not found.`);
    }
    expect(occurrenceToRestore.isVirtualOccurrence).toBe(true);
    expect(occurrenceToRestore.occurrenceNumber).toBe(5);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-107-appointment-occurrence-restore-precondition",
      description: "Captures the Slice 107 appointment occurrence-restore anchor patient, seeded recurring-series state, and generated occurrence that will be skipped then restored.",
      expected: {
        patient: {
          pubpid: appointmentExceptionPatientId,
          providerId: patient.providerId
        },
        series: {
          title: "Preventive Care",
          occurrenceSearchDate,
          seededExceptionDate,
          expectedRestoredDates,
          occurrenceToRestore: {
            date: restoredOccurrenceDate,
            occurrenceNumber: 5,
            isVirtualOccurrence: true
          },
          recurrenceExceptionCountBeforeRestoreSetup: 1
        }
      },
      actual: {
        patient,
        occurrenceSearchDate,
        beforeOccurrenceCount: preventiveCareBefore.length,
        beforeOccurrences: preventiveCareBefore,
        occurrenceToRestore
      },
      context: {
        canonicalId: appointmentExceptionPatientId,
        suite: "workflow-appointment-occurrence-restore",
        workflow: "appointment-occurrence-restore-precondition"
      }
    });

    try {
      await workflow.addAppointmentRecurrenceException(occurrenceToRestore.seriesRootId, restoredOccurrenceDate);

      const skippedRoot = await workflow.getAppointment(occurrenceToRestore.seriesRootId);
      expect(skippedRoot).not.toBeNull();
      expect(skippedRoot!.recurrenceExdates).toEqual([seededExceptionDate, restoredOccurrenceDate]);

      const skippedOccurrences = await workflow.getAppointmentSeriesOccurrences(patient.pid, occurrenceSearchDate);
      const preventiveCareSkipped = skippedOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
      expect(preventiveCareSkipped.map((occurrence) => occurrence.date)).toEqual(expectedSkippedDates);
      expect(preventiveCareSkipped.map((occurrence) => occurrence.occurrenceNumber)).toEqual([3, 6, 7]);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-107-appointment-occurrence-restore-skipped",
        description: "Captures the temporary skipped occurrence state that Slice 107 restores by removing the extra recurrence exception date.",
        expected: {
          root: {
            recurrenceExdates: [seededExceptionDate, restoredOccurrenceDate]
          },
          occurrenceDates: expectedSkippedDates,
          omittedDate: restoredOccurrenceDate,
          occurrenceNumbers: [3, 6, 7],
          recurrenceExceptionCount: 2,
          restoredDatePresentBeforeRestore: false
        },
        actual: {
          patient,
          occurrenceToRestore,
          skippedRoot,
          occurrenceSearchDate,
          restoredDatePresentBeforeRestore: preventiveCareSkipped.some((occurrence) => occurrence.date === restoredOccurrenceDate),
          skippedOccurrences: preventiveCareSkipped
        },
        context: {
          canonicalId: appointmentExceptionPatientId,
          suite: "workflow-appointment-occurrence-restore",
          workflow: "appointment-occurrence-restore-skipped"
        }
      });

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient.pubpid);
        await page.getByLabel("Appointment from date").fill(occurrenceSearchDate);

        await expect(page.getByRole("button", { name: /2026-12-30/ })).toHaveCount(0);
        const remainingOccurrenceButton = page.getByRole("button", { name: /Preventive Care[\s\S]*2026-12-02/i }).first();
        await expect(remainingOccurrenceButton).toBeVisible();
        await remainingOccurrenceButton.click();
        await expect(page.getByRole("heading", { name: "Preventive Care" })).toBeVisible();
        await expect(page.locator("body")).toContainText("2026-12-16, 2026-12-30");

        await page.getByRole("button", { name: `Restore occurrence ${restoredOccurrenceDate}` }).click();
        await expect(page.getByRole("button", { name: /Preventive Care[\s\S]*2026-12-30/i })).toBeVisible();
        await expect(page.locator("body")).toContainText("2026-12-16");
        await expect(page.getByRole("button", { name: `Restore occurrence ${restoredOccurrenceDate}` })).toHaveCount(0);
      } else {
        await workflow.restoreAppointmentRecurrenceException(occurrenceToRestore.seriesRootId, restoredOccurrenceDate);
      }

      const restoredRoot = await workflow.getAppointment(occurrenceToRestore.seriesRootId);
      expect(restoredRoot).not.toBeNull();
      expect(restoredRoot!.recurrenceExdates).toEqual([seededExceptionDate]);

      const restoredOccurrences = await workflow.getAppointmentSeriesOccurrences(patient.pid, occurrenceSearchDate);
      const preventiveCareRestored = restoredOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
      expect(preventiveCareRestored.map((occurrence) => occurrence.date)).toEqual(expectedRestoredDates);
      expect(preventiveCareRestored.map((occurrence) => occurrence.occurrenceNumber)).toEqual([3, 5, 6, 7]);
      expect(preventiveCareRestored.every((occurrence) => occurrence.recurrenceExceptionCount === 1)).toBe(true);
      expect(preventiveCareRestored.every((occurrence) => occurrence.recurrenceExdates.includes(seededExceptionDate))).toBe(true);
      expect(preventiveCareRestored.every((occurrence) => !occurrence.recurrenceExdates.includes(restoredOccurrenceDate))).toBe(true);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-107-appointment-occurrence-restore-restored",
        description: "Captures the recurring root and generated occurrence expansion after Slice 107 restores the skipped occurrence by removing its recurrence exception date.",
        expected: {
          root: {
            recurrenceExdates: [seededExceptionDate]
          },
          occurrenceDates: expectedRestoredDates,
          restoredOccurrenceDate,
          occurrenceNumbers: [3, 5, 6, 7],
          recurrenceExceptionCount: 1,
          restoredDatePresentInExpansion: true
        },
        actual: {
          patient,
          occurrenceToRestore,
          restoredRoot,
          occurrenceSearchDate,
          restoredDatePresentInExpansion: preventiveCareRestored.some((occurrence) => occurrence.date === restoredOccurrenceDate),
          restoredOccurrences: preventiveCareRestored,
          surface: target.type === "modernized-openemr"
            ? {
                application: target.type,
                page: "calendar",
                restoreButtonRemoved: true,
                restoredOccurrenceButtonVisible: true
              }
            : {
                application: target.type,
                page: "workflow-projection"
              }
        },
        context: {
          canonicalId: appointmentExceptionPatientId,
          suite: "workflow-appointment-occurrence-restore",
          workflow: "appointment-occurrence-restore-restored"
        }
      });
    } finally {
      await workflow.setAppointmentRecurrenceExdates(occurrenceToRestore.seriesRootId, [seededExceptionDate]);
    }

    const cleanupRoot = await workflow.getAppointment(occurrenceToRestore.seriesRootId);
    expect(cleanupRoot).not.toBeNull();
    expect(cleanupRoot!.recurrenceExdates).toEqual([seededExceptionDate]);

    const cleanupOccurrences = await workflow.getAppointmentSeriesOccurrences(patient.pid, occurrenceSearchDate);
    const preventiveCareCleanup = cleanupOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
    expect(preventiveCareCleanup.map((occurrence) => occurrence.date)).toEqual(expectedRestoredDates);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-107-appointment-occurrence-restore-cleanup",
      description: "Captures the Slice 107 cleanup state after restoring the recurring root to the seeded exception-date list.",
      expected: {
        root: {
          recurrenceExdates: [seededExceptionDate]
        },
        occurrenceDates: expectedRestoredDates,
        restoredOccurrenceDate,
        recurrenceExceptionCount: 1
      },
      actual: {
        patient,
        occurrenceToRestore,
        cleanupRoot,
        cleanupOccurrenceCount: preventiveCareCleanup.length,
        cleanupOccurrences: preventiveCareCleanup
      },
      context: {
        canonicalId: appointmentExceptionPatientId,
        suite: "workflow-appointment-occurrence-restore",
        workflow: "appointment-occurrence-restore-cleanup"
      }
    });
  });
});
