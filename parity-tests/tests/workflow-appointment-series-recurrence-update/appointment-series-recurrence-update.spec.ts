import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";
import type { AppointmentRecord, AppointmentUpdate } from "../../src/workflows/legacyWorkflowActions.js";

const appointmentSeriesPatientId = "MOD-PAT-0013";
const occurrenceSearchDate = "2026-11-04";
const originalTitle = "Preventive Care";
const seededExceptionDate = "2026-12-16";
const originalExpectedDates = ["2026-11-04", "2026-11-18", "2026-12-02", "2026-12-30", "2027-01-13", "2027-01-27"];
const originalExpectedOccurrenceNumbers = [1, 2, 3, 5, 6, 7];
const updatedRecurrenceEndDate = "2027-02-10";
const updatedExpectedDates = ["2026-11-04", "2026-11-25", "2027-01-06", "2027-01-27"];
const updatedExpectedOccurrenceNumbers = [1, 2, 4, 5];

test.describe("appointment series recurrence update parity @slice116 @workflow-appointment-series-recurrence-update @mutation", () => {
  test("updates recurring appointment cadence and end date while preserving skipped dates", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentSeriesPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentSeriesPatientId} was not found.`);
    }

    const beforeOccurrences = await workflow.getAppointmentSeriesOccurrences(patient.pid, occurrenceSearchDate);
    const preventiveCareBefore = beforeOccurrences.filter((occurrence) => occurrence.title === originalTitle);
    expect(preventiveCareBefore.map((occurrence) => occurrence.date)).toEqual(originalExpectedDates);
    expect(preventiveCareBefore.map((occurrence) => occurrence.occurrenceNumber)).toEqual(originalExpectedOccurrenceNumbers);

    const seriesRoot = preventiveCareBefore.find((occurrence) => occurrence.date === occurrenceSearchDate);
    expect(seriesRoot).toBeDefined();
    if (!seriesRoot) {
      throw new Error(`Seeded series root occurrence ${occurrenceSearchDate} for ${appointmentSeriesPatientId} was not found.`);
    }
    expect(seriesRoot.isVirtualOccurrence).toBe(false);

    const seriesRootId = seriesRoot.seriesRootId;
    const originalRoot = await workflow.getAppointment(seriesRootId);
    expect(originalRoot).not.toBeNull();
    if (!originalRoot) {
      throw new Error(`Seeded series root appointment ${seriesRootId} was not found.`);
    }
    expect(originalRoot).toMatchObject({
      title: originalTitle,
      recurrenceType: 1,
      repeatFrequency: 2,
      repeatUnit: 1,
      recurrenceEndDate: "2027-01-27"
    });
    expect(originalRoot.recurrenceExdates).toEqual([seededExceptionDate]);

    const originalDurationSeconds = durationSecondsBetween(originalRoot.startTime, originalRoot.endTime);
    const updateInput = appointmentUpdateFromRecord(originalRoot, {
      repeatFrequency: 3,
      recurrenceEndDate: updatedRecurrenceEndDate,
      durationSeconds: originalDurationSeconds
    });
    const restoreInput = appointmentUpdateFromRecord(originalRoot, {
      durationSeconds: originalDurationSeconds
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-116-appointment-series-recurrence-update-precondition",
      description: "Captures the Slice 116 seeded recurring root before temporarily changing cadence and end date.",
      expected: {
        patient: {
          pubpid: appointmentSeriesPatientId,
          providerId: patient.providerId
        },
        root: {
          title: originalTitle,
          eventDate: occurrenceSearchDate,
          recurrenceType: 1,
          repeatFrequency: 2,
          repeatUnit: 1,
          recurrenceEndDate: "2027-01-27",
          recurrenceExdates: [seededExceptionDate]
        },
        occurrenceDates: originalExpectedDates,
        occurrenceNumbers: originalExpectedOccurrenceNumbers,
        skippedDatePreserved: seededExceptionDate,
        proposedUpdate: {
          repeatFrequency: 3,
          recurrenceEndDate: updatedRecurrenceEndDate
        }
      },
      actual: {
        patient,
        seriesRootId,
        seriesRoot,
        originalRoot,
        originalDurationSeconds,
        beforeOccurrenceCount: preventiveCareBefore.length,
        beforeOccurrences: preventiveCareBefore
      },
      context: {
        canonicalId: appointmentSeriesPatientId,
        suite: "workflow-appointment-series-recurrence-update",
        workflow: "appointment-series-recurrence-update-precondition"
      }
    });

    try {
      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient.pubpid);
        await page.getByLabel("Appointment from date").fill(occurrenceSearchDate);

        const seriesRootButton = page.getByRole("button", { name: /Preventive Care[\s\S]*2026-11-04/i }).first();
        await expect(seriesRootButton).toBeVisible();
        await seriesRootButton.click();
        await expect(page.getByRole("heading", { name: originalTitle })).toBeVisible();
        await expect(page.locator("body")).toContainText("Series anchor");
        await expect(page.getByLabel("Edit appointment repeats")).toBeChecked();
        await expect(page.getByLabel("Edit appointment repeat frequency")).toHaveValue("2");
        await expect(page.getByLabel("Edit appointment repeat unit")).toHaveValue("1");
        await expect(page.getByLabel("Edit appointment recurrence end date")).toHaveValue("2027-01-27");
        await expect(page.locator("body")).toContainText("Every 2 weeks until 2027-01-27");

        await page.getByLabel("Edit appointment repeat frequency").fill("3");
        await page.getByLabel("Edit appointment recurrence end date").fill(updatedRecurrenceEndDate);
        await page.getByRole("button", { name: "Save schedule" }).click();

        await expect(page.getByLabel("Edit appointment repeat frequency")).toHaveValue("3");
        await expect(page.getByLabel("Edit appointment recurrence end date")).toHaveValue(updatedRecurrenceEndDate);
        await expect(page.locator("body")).toContainText(`Every 3 weeks until ${updatedRecurrenceEndDate}`);
        await expect(page.getByRole("button", { name: /Preventive Care[\s\S]*2026-11-18/i })).toHaveCount(0);
        await expect(page.getByRole("button", { name: /Preventive Care[\s\S]*2026-12-16/i })).toHaveCount(0);
        await expect(page.getByRole("button", { name: /Preventive Care[\s\S]*2026-11-25/i })).toBeVisible();

        const generatedOccurrenceButton = page.getByRole("button", { name: /Preventive Care[\s\S]*2026-11-25/i }).first();
        await generatedOccurrenceButton.click();
        await expect(page.locator("body")).toContainText("Generated occurrence 2");
        await expect(page.locator("body")).toContainText(`Every 3 weeks until ${updatedRecurrenceEndDate}`);
      } else {
        await workflow.updateAppointment(seriesRootId, updateInput);

        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, seriesRootId);
        await expect(page.locator('input[name="form_title"]')).toHaveValue(originalTitle);
        await expect(page.locator('input[name="form_repeat"]')).toBeChecked();
        await expect(page.locator('select[name="form_repeat_freq"]')).toHaveValue("3");
        await expect(page.locator('select[name="form_repeat_type"]')).toHaveValue("1");
        await expect(page.locator('input[name="form_enddate"]')).toHaveValue(updatedRecurrenceEndDate);
      }

      const rootAfterEdit = await workflow.getAppointment(seriesRootId);
      expect(rootAfterEdit).not.toBeNull();
      if (!rootAfterEdit) {
        throw new Error(`Updated series root appointment ${seriesRootId} was not found.`);
      }
      expect(rootAfterEdit).toMatchObject({
        title: originalTitle,
        recurrenceType: 1,
        repeatFrequency: 3,
        repeatUnit: 1,
        recurrenceEndDate: updatedRecurrenceEndDate
      });
      expect(rootAfterEdit.recurrenceExdates).toEqual([seededExceptionDate]);

      const afterOccurrences = await workflow.getAppointmentSeriesOccurrences(patient.pid, occurrenceSearchDate);
      const preventiveCareAfter = afterOccurrences.filter((occurrence) => occurrence.title === originalTitle);
      expect(preventiveCareAfter.map((occurrence) => occurrence.date)).toEqual(updatedExpectedDates);
      expect(preventiveCareAfter.map((occurrence) => occurrence.occurrenceNumber)).toEqual(updatedExpectedOccurrenceNumbers);
      expect(preventiveCareAfter.map((occurrence) => occurrence.repeatFrequency)).toEqual(updatedExpectedDates.map(() => 3));
      expect(preventiveCareAfter.map((occurrence) => occurrence.recurrenceEndDate)).toEqual(updatedExpectedDates.map(() => updatedRecurrenceEndDate));
      expect(preventiveCareAfter.map((occurrence) => occurrence.recurrenceExdates)).toEqual(updatedExpectedDates.map(() => [seededExceptionDate]));

      const generatedOccurrenceAfter = preventiveCareAfter.find((occurrence) => occurrence.date === "2026-11-25");
      expect(generatedOccurrenceAfter).toBeDefined();
      if (!generatedOccurrenceAfter) {
        throw new Error("Updated generated occurrence 2026-11-25 was not found.");
      }
      expect(generatedOccurrenceAfter.isVirtualOccurrence).toBe(true);
      expect(generatedOccurrenceAfter.seriesRootId).toBe(seriesRootId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-116-appointment-series-recurrence-update-edited",
        description: "Captures the Slice 116 recurring root after changing cadence/end date and preserving the seeded skipped date.",
        expected: {
          root: {
            title: originalTitle,
            recurrenceType: 1,
            repeatFrequency: 3,
            repeatUnit: 1,
            recurrenceEndDate: updatedRecurrenceEndDate,
            recurrenceExdates: [seededExceptionDate]
          },
          occurrenceDates: updatedExpectedDates,
          occurrenceNumbers: updatedExpectedOccurrenceNumbers,
          generatedOccurrence: {
            date: "2026-11-25",
            occurrenceNumber: 2,
            isVirtualOccurrence: true,
            repeatFrequency: 3
          }
        },
        actual: {
          patient,
          seriesRootId,
          rootAfterEdit,
          afterOccurrenceCount: preventiveCareAfter.length,
          afterOccurrences: preventiveCareAfter,
          generatedOccurrenceAfter,
          surface: target.type === "modernized-openemr"
            ? {
                application: target.type,
                page: "calendar",
                originalRepeatLabel: "Every 2 weeks until 2027-01-27",
                updatedRepeatLabel: `Every 3 weeks until ${updatedRecurrenceEndDate}`,
                hiddenOriginalGeneratedDate: "2026-11-18",
                hiddenSeededSkippedDate: seededExceptionDate,
                generatedOccurrenceVisible: "2026-11-25"
              }
            : {
                application: target.type,
                page: "legacy-appointment-direct",
                repeatFrequencyControl: "3",
                repeatUnitControl: "1",
                endDateControl: updatedRecurrenceEndDate
              }
        },
        context: {
          canonicalId: appointmentSeriesPatientId,
          suite: "workflow-appointment-series-recurrence-update",
          workflow: "appointment-series-recurrence-update-edited"
        }
      });
    } finally {
      await workflow.updateAppointment(seriesRootId, restoreInput);
    }

    const restoredRoot = await workflow.getAppointment(seriesRootId);
    expect(restoredRoot).not.toBeNull();
    if (!restoredRoot) {
      throw new Error(`Restored series root appointment ${seriesRootId} was not found.`);
    }
    expect(restoredRoot).toMatchObject({
      title: originalRoot.title,
      recurrenceType: originalRoot.recurrenceType,
      repeatFrequency: originalRoot.repeatFrequency,
      repeatUnit: originalRoot.repeatUnit,
      recurrenceEndDate: originalRoot.recurrenceEndDate
    });
    expect(restoredRoot.recurrenceExdates).toEqual([seededExceptionDate]);

    const restoredOccurrences = await workflow.getAppointmentSeriesOccurrences(patient.pid, occurrenceSearchDate);
    const preventiveCareRestored = restoredOccurrences.filter((occurrence) => occurrence.title === originalTitle);
    expect(preventiveCareRestored.map((occurrence) => occurrence.date)).toEqual(originalExpectedDates);
    expect(preventiveCareRestored.map((occurrence) => occurrence.occurrenceNumber)).toEqual(originalExpectedOccurrenceNumbers);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-116-appointment-series-recurrence-update-cleanup",
      description: "Captures the Slice 116 cleanup state after restoring the seeded recurring root cadence/end date.",
      expected: {
        rootRestored: true,
        recurrenceExdates: [seededExceptionDate],
        occurrenceDates: originalExpectedDates,
        occurrenceNumbers: originalExpectedOccurrenceNumbers
      },
      actual: {
        patient,
        seriesRootId,
        originalRoot,
        restoredRoot,
        restoredOccurrenceCount: preventiveCareRestored.length,
        restoredOccurrences: preventiveCareRestored
      },
      context: {
        canonicalId: appointmentSeriesPatientId,
        suite: "workflow-appointment-series-recurrence-update",
        workflow: "appointment-series-recurrence-update-cleanup"
      }
    });
  });
});

function appointmentUpdateFromRecord(appointment: AppointmentRecord, overrides: Partial<AppointmentUpdate> = {}): AppointmentUpdate {
  return {
    providerId: appointment.providerId,
    title: appointment.title,
    eventDate: appointment.eventDate,
    startTime: appointment.startTime,
    endTime: appointment.endTime,
    durationSeconds: durationSecondsBetween(appointment.startTime, appointment.endTime),
    homeText: appointment.homeText,
    facilityId: appointment.facilityId,
    billingLocationId: appointment.billingLocationId,
    room: appointment.room,
    status: appointment.status,
    categoryId: appointment.categoryId,
    recurrenceType: appointment.recurrenceType,
    repeatFrequency: appointment.repeatFrequency ?? undefined,
    repeatUnit: appointment.repeatUnit ?? undefined,
    recurrenceEndDate: appointment.recurrenceEndDate ?? undefined,
    recurrenceExdates: appointment.recurrenceExdates,
    ...overrides
  };
}

function durationSecondsBetween(startTime: string, endTime: string): number {
  const startSeconds = timeToSeconds(startTime);
  let endSeconds = timeToSeconds(endTime);
  if (endSeconds <= startSeconds) {
    endSeconds += 24 * 60 * 60;
  }
  return endSeconds - startSeconds;
}

function timeToSeconds(time: string): number {
  const [hours = 0, minutes = 0, seconds = 0] = time.split(":").map(Number);
  return (hours * 3600) + (minutes * 60) + seconds;
}
