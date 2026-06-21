import { test, expect } from "../../src/fixtures/parityTest.js";
import type { AppointmentRecord, AppointmentUpdate } from "../../src/workflows/legacyWorkflowActions.js";

const appointmentSeriesPatientId = "MOD-PAT-0013";
const occurrenceSearchDate = "2026-11-04";
const generatedOccurrenceDate = "2026-11-18";
const expectedSeriesDates = ["2026-11-04", "2026-11-18", "2026-12-02", "2026-12-30", "2027-01-13", "2027-01-27"];
const expectedOccurrenceNumbers = [1, 2, 3, 5, 6, 7];
const seededExceptionDate = "2026-12-16";
const originalTitle = "Preventive Care";
const updatedProviderId = 101;
const updatedFacilityId = 10;
const updatedBillingLocationId = 10;
const updatedCategoryId = 10;
const updatedCategoryName = "New Patient";
const updatedStatus = "~";
const updatedRoom = "Series Meta";
const updatedComments = "Slice 111 recurring root metadata propagation check.";

test.describe("appointment series root metadata parity @slice111 @workflow-appointment-series-root-metadata @mutation", () => {
  test("updates recurring appointment root metadata and propagates it to generated occurrences", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentSeriesPatientId);
    expect(patient).not.toBeNull();

    const beforeOccurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, occurrenceSearchDate);
    const preventiveCareBefore = beforeOccurrences.filter((occurrence) => occurrence.title === originalTitle);
    expect(preventiveCareBefore.map((occurrence) => occurrence.date)).toEqual(expectedSeriesDates);
    expect(preventiveCareBefore.map((occurrence) => occurrence.occurrenceNumber)).toEqual(expectedOccurrenceNumbers);

    const seriesRoot = preventiveCareBefore.find((occurrence) => occurrence.date === occurrenceSearchDate);
    expect(seriesRoot).toBeDefined();
    expect(seriesRoot!.isVirtualOccurrence).toBe(false);

    const seriesRootId = seriesRoot!.seriesRootId;
    const originalRoot = await workflow.getAppointment(seriesRootId);
    expect(originalRoot).not.toBeNull();

    const originalDurationSeconds = durationSecondsBetween(originalRoot!.startTime, originalRoot!.endTime);
    const updateInput = appointmentUpdateFromRecord(originalRoot!, {
      providerId: updatedProviderId,
      facilityId: updatedFacilityId,
      billingLocationId: updatedBillingLocationId,
      categoryId: updatedCategoryId,
      status: updatedStatus,
      room: updatedRoom,
      homeText: updatedComments,
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

        await page.getByLabel("Edit appointment provider ID").fill(String(updatedProviderId));
        await page.getByLabel("Edit appointment facility ID").fill(String(updatedFacilityId));
        await page.getByLabel("Edit appointment billing facility ID").fill(String(updatedBillingLocationId));
        await page.getByLabel("Edit appointment category").selectOption(String(updatedCategoryId));
        await page.getByLabel("Edit appointment status").selectOption(updatedStatus);
        await page.getByLabel("Edit appointment room").fill(updatedRoom);
        await page.getByLabel("Edit appointment comments").fill(updatedComments);
        await page.getByRole("button", { name: "Save schedule" }).click();

        await expect(page.getByLabel("Edit appointment provider ID")).toHaveValue(String(updatedProviderId));
        await expect(page.getByLabel("Edit appointment category")).toHaveValue(String(updatedCategoryId));
        await expect(page.locator("body")).toContainText(`${updatedCategoryName} (${updatedCategoryId})`);

        const generatedOccurrenceButton = page.getByRole("button", { name: /Preventive Care[\s\S]*2026-11-18/i }).first();
        await expect(generatedOccurrenceButton).toBeVisible();
        await generatedOccurrenceButton.click();
        await expect(page.locator("body")).toContainText("Generated occurrence 2");
        await expect(page.locator("body")).toContainText(`${updatedCategoryName} (${updatedCategoryId})`);
        await expect(page.locator("body")).toContainText(`(${updatedProviderId})`);
        await expect(page.locator("body")).toContainText(`(${updatedFacilityId})`);
        await expect(page.locator("body")).toContainText(updatedRoom);
        await expect(page.locator("body")).toContainText(updatedComments);
      } else {
        await workflow.updateAppointment(seriesRootId, updateInput);
      }

      const rootAfterEdit = await workflow.getAppointment(seriesRootId);
      expect(rootAfterEdit).not.toBeNull();
      expect(rootAfterEdit!).toMatchObject({
        providerId: updatedProviderId,
        facilityId: updatedFacilityId,
        billingLocationId: updatedBillingLocationId,
        categoryId: updatedCategoryId,
        categoryName: updatedCategoryName,
        status: updatedStatus,
        room: updatedRoom,
        homeText: updatedComments
      });
      expect(rootAfterEdit!.recurrenceExdates).toEqual([seededExceptionDate]);

      const afterOccurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, occurrenceSearchDate);
      const preventiveCareAfter = afterOccurrences.filter((occurrence) => occurrence.title === originalTitle);
      expect(preventiveCareAfter.map((occurrence) => occurrence.date)).toEqual(expectedSeriesDates);
      expect(preventiveCareAfter.map((occurrence) => occurrence.occurrenceNumber)).toEqual(expectedOccurrenceNumbers);
      expect(preventiveCareAfter.map((occurrence) => occurrence.providerId)).toEqual(expectedSeriesDates.map(() => updatedProviderId));
      expect(preventiveCareAfter.map((occurrence) => occurrence.facilityId)).toEqual(expectedSeriesDates.map(() => updatedFacilityId));
      expect(preventiveCareAfter.map((occurrence) => occurrence.billingLocationId)).toEqual(expectedSeriesDates.map(() => updatedBillingLocationId));
      expect(preventiveCareAfter.map((occurrence) => occurrence.categoryId)).toEqual(expectedSeriesDates.map(() => updatedCategoryId));
      expect(preventiveCareAfter.map((occurrence) => occurrence.categoryName)).toEqual(expectedSeriesDates.map(() => updatedCategoryName));
      expect(preventiveCareAfter.map((occurrence) => occurrence.status)).toEqual(expectedSeriesDates.map(() => updatedStatus));
      expect(preventiveCareAfter.map((occurrence) => occurrence.room)).toEqual(expectedSeriesDates.map(() => updatedRoom));
      expect(preventiveCareAfter.map((occurrence) => occurrence.comments)).toEqual(expectedSeriesDates.map(() => updatedComments));
      expect(preventiveCareAfter.map((occurrence) => occurrence.recurrenceExdates)).toEqual(expectedSeriesDates.map(() => [seededExceptionDate]));

      const generatedOccurrenceAfter = preventiveCareAfter.find((occurrence) => occurrence.date === generatedOccurrenceDate);
      expect(generatedOccurrenceAfter).toBeDefined();
      expect(generatedOccurrenceAfter!.isVirtualOccurrence).toBe(true);
      expect(generatedOccurrenceAfter!.seriesRootId).toBe(seriesRootId);
    } finally {
      await workflow.updateAppointment(seriesRootId, restoreInput);
    }

    const restoredRoot = await workflow.getAppointment(seriesRootId);
    expect(restoredRoot).not.toBeNull();
    expect(restoredRoot!).toMatchObject({
      providerId: originalRoot!.providerId,
      facilityId: originalRoot!.facilityId,
      billingLocationId: originalRoot!.billingLocationId,
      categoryId: originalRoot!.categoryId,
      categoryName: originalRoot!.categoryName,
      status: originalRoot!.status,
      room: originalRoot!.room,
      homeText: originalRoot!.homeText
    });
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

function timeToSeconds(time: string): number {
  const [hours = 0, minutes = 0, seconds = 0] = time.split(":").map(Number);
  return (hours * 3600) + (minutes * 60) + seconds;
}
