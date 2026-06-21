import { test, expect } from "../../src/fixtures/parityTest.js";
import type { AppointmentRecord, AppointmentUpdate } from "../../src/workflows/legacyWorkflowActions.js";

const appointmentSeriesPatientId = "MOD-PAT-0013";
const occurrenceSearchDate = "2026-11-04";
const expectedSeriesDates = ["2026-11-04", "2026-11-18", "2026-12-02", "2026-12-30", "2027-01-13", "2027-01-27"];
const expectedOccurrenceNumbers = [1, 2, 3, 5, 6, 7];
const seededExceptionDate = "2026-12-16";
const originalTitle = "Preventive Care";
const updatedTitle = "Preventive Care Root Update";
const updatedStartTime = "16:15:00";

test.describe("appointment series root update parity @slice110 @workflow-appointment-series-root-update @mutation", () => {
  test("updates a recurring appointment root and propagates title and time to generated occurrences", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentSeriesPatientId);
    expect(patient).not.toBeNull();

    const beforeOccurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, occurrenceSearchDate);
    const preventiveCareBefore = beforeOccurrences.filter((occurrence) => occurrence.title === originalTitle);
    expect(preventiveCareBefore.map((occurrence) => occurrence.date)).toEqual(expectedSeriesDates);
    expect(preventiveCareBefore.map((occurrence) => occurrence.occurrenceNumber)).toEqual(expectedOccurrenceNumbers);

    const seriesRoot = preventiveCareBefore.find((occurrence) => occurrence.date === occurrenceSearchDate);
    expect(seriesRoot).toBeDefined();
    expect(seriesRoot!.isVirtualOccurrence).toBe(false);

    const generatedOccurrenceBefore = preventiveCareBefore.find((occurrence) => occurrence.date === "2026-11-18");
    expect(generatedOccurrenceBefore).toBeDefined();
    expect(generatedOccurrenceBefore!.isVirtualOccurrence).toBe(true);
    expect(generatedOccurrenceBefore!.startTime).toBe(seriesRoot!.startTime);

    const seriesRootId = seriesRoot!.seriesRootId;
    const originalRoot = await workflow.getAppointment(seriesRootId);
    expect(originalRoot).not.toBeNull();

    const originalDurationSeconds = durationSecondsBetween(originalRoot!.startTime, originalRoot!.endTime);
    const updateInput = appointmentUpdateFromRecord(originalRoot!, {
      title: updatedTitle,
      startTime: updatedStartTime,
      endTime: addSecondsToTime(updatedStartTime, originalDurationSeconds),
      durationSeconds: originalDurationSeconds
    });
    const restoreInput = appointmentUpdateFromRecord(originalRoot!, {
      durationSeconds: originalDurationSeconds
    });

    try {
      if (target.type === "modernized-openemr") {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Calendar" }).click();
        await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
        await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
        await page.getByLabel("Appointment from date").fill(occurrenceSearchDate);

        const seriesRootButton = page.getByRole("button", { name: /Preventive Care[\s\S]*2026-11-04/i }).first();
        await expect(seriesRootButton).toBeVisible();
        await seriesRootButton.click();
        await expect(page.getByRole("heading", { name: originalTitle })).toBeVisible();
        await expect(page.locator("body")).toContainText("Series anchor");
        await page.getByLabel("Edit appointment title").fill(updatedTitle);
        await page.getByLabel("Edit appointment start time").fill(updatedStartTime.slice(0, 5));
        await page.getByRole("button", { name: "Save schedule" }).click();

        await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
        await expect(page.getByRole("button", { name: /Preventive Care Root Update[\s\S]*2026-11-18/i })).toBeVisible();
        await expect(page.locator("body")).toContainText("16:15");
      } else {
        await workflow.updateAppointment(seriesRootId, updateInput);
      }

      const rootAfterEdit = await workflow.getAppointment(seriesRootId);
      expect(rootAfterEdit).not.toBeNull();
      expect(rootAfterEdit!.title).toBe(updatedTitle);
      expect(rootAfterEdit!.startTime).toBe(updatedStartTime);
      expect(rootAfterEdit!.recurrenceExdates).toEqual([seededExceptionDate]);

      const afterOccurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, occurrenceSearchDate);
      const preventiveCareAfter = afterOccurrences.filter((occurrence) => occurrence.title === updatedTitle);
      expect(preventiveCareAfter.map((occurrence) => occurrence.date)).toEqual(expectedSeriesDates);
      expect(preventiveCareAfter.map((occurrence) => occurrence.occurrenceNumber)).toEqual(expectedOccurrenceNumbers);
      expect(preventiveCareAfter.map((occurrence) => occurrence.startTime)).toEqual(expectedSeriesDates.map(() => updatedStartTime));
      expect(preventiveCareAfter.map((occurrence) => occurrence.recurrenceExdates)).toEqual(expectedSeriesDates.map(() => [seededExceptionDate]));

      const generatedOccurrenceAfter = preventiveCareAfter.find((occurrence) => occurrence.date === "2026-11-18");
      expect(generatedOccurrenceAfter).toBeDefined();
      expect(generatedOccurrenceAfter!.isVirtualOccurrence).toBe(true);
      expect(generatedOccurrenceAfter!.seriesRootId).toBe(seriesRootId);
    } finally {
      await workflow.updateAppointment(seriesRootId, restoreInput);
    }

    const restoredRoot = await workflow.getAppointment(seriesRootId);
    expect(restoredRoot).not.toBeNull();
    expect(restoredRoot!.title).toBe(originalRoot!.title);
    expect(restoredRoot!.startTime).toBe(originalRoot!.startTime);
    expect(restoredRoot!.recurrenceExdates).toEqual([seededExceptionDate]);

    const restoredOccurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, occurrenceSearchDate);
    const preventiveCareRestored = restoredOccurrences.filter((occurrence) => occurrence.title === originalTitle);
    expect(preventiveCareRestored.map((occurrence) => occurrence.date)).toEqual(expectedSeriesDates);
    expect(preventiveCareRestored.map((occurrence) => occurrence.occurrenceNumber)).toEqual(expectedOccurrenceNumbers);
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

function addSecondsToTime(startTime: string, secondsToAdd: number): string {
  const secondsInDay = 24 * 60 * 60;
  const nextSeconds = (timeToSeconds(startTime) + secondsToAdd) % secondsInDay;
  const hours = Math.floor(nextSeconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((nextSeconds % 3600) / 60).toString().padStart(2, "0");
  const seconds = (nextSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function timeToSeconds(time: string): number {
  const [hours = 0, minutes = 0, seconds = 0] = time.split(":").map(Number);
  return (hours * 3600) + (minutes * 60) + seconds;
}
