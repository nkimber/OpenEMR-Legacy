import { test, expect } from "../../src/fixtures/parityTest.js";

const appointmentExceptionPatientId = "MOD-PAT-0013";
const occurrenceSearchDate = "2026-12-02";
const seededExceptionDate = "2026-12-16";
const cancelledOccurrenceDate = "2026-12-30";
const expectedBeforeDates = ["2026-12-02", "2026-12-30", "2027-01-13", "2027-01-27"];
const expectedAfterDates = ["2026-12-02", "2027-01-13", "2027-01-27"];

test.describe("appointment occurrence cancel parity @slice106 @workflow-appointment-occurrence-cancel @mutation", () => {
  test("adds a recurrence exception when cancelling a generated occurrence", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentExceptionPatientId);
    expect(patient).not.toBeNull();

    const beforeOccurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, occurrenceSearchDate);
    const preventiveCareBefore = beforeOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
    expect(preventiveCareBefore.map((occurrence) => occurrence.date)).toEqual(expectedBeforeDates);

    const occurrenceToCancel = preventiveCareBefore.find((occurrence) => occurrence.date === cancelledOccurrenceDate);
    expect(occurrenceToCancel).toBeDefined();
    expect(occurrenceToCancel!.isVirtualOccurrence).toBe(true);
    expect(occurrenceToCancel!.occurrenceNumber).toBe(5);

    try {
      if (target.type === "modernized-openemr") {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Calendar" }).click();
        await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
        await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
        await page.getByLabel("Appointment from date").fill(occurrenceSearchDate);

        const occurrenceButton = page.getByRole("button", { name: /Preventive Care[\s\S]*2026-12-30/i }).first();
        await expect(occurrenceButton).toBeVisible();
        await occurrenceButton.click();
        await expect(page.getByRole("heading", { name: "Preventive Care" })).toBeVisible();
        await expect(page.locator("body")).toContainText("Generated occurrence 5");

        await page.getByRole("button", { name: "Skip occurrence" }).click();
        await expect(page.getByRole("button", { name: /2026-12-30/ })).toHaveCount(0);
        await expect(page.locator("body")).toContainText("2 skipped");
      } else {
        await workflow.addAppointmentRecurrenceException(occurrenceToCancel!.seriesRootId, cancelledOccurrenceDate);
      }

      const rootAppointment = await workflow.getAppointment(occurrenceToCancel!.seriesRootId);
      expect(rootAppointment).not.toBeNull();
      expect(rootAppointment!.recurrenceExdates).toEqual([seededExceptionDate, cancelledOccurrenceDate]);

      const afterOccurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, occurrenceSearchDate);
      const preventiveCareAfter = afterOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
      expect(preventiveCareAfter.map((occurrence) => occurrence.date)).toEqual(expectedAfterDates);
      expect(preventiveCareAfter.map((occurrence) => occurrence.occurrenceNumber)).toEqual([3, 6, 7]);
      expect(preventiveCareAfter.every((occurrence) => occurrence.recurrenceExceptionCount === 2)).toBe(true);
      expect(preventiveCareAfter.every((occurrence) => occurrence.recurrenceExdates.includes(cancelledOccurrenceDate))).toBe(true);
    } finally {
      await workflow.setAppointmentRecurrenceExdates(occurrenceToCancel!.seriesRootId, [seededExceptionDate]);
    }

    const restoredRoot = await workflow.getAppointment(occurrenceToCancel!.seriesRootId);
    expect(restoredRoot).not.toBeNull();
    expect(restoredRoot!.recurrenceExdates).toEqual([seededExceptionDate]);

    const restoredOccurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, occurrenceSearchDate);
    const preventiveCareRestored = restoredOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
    expect(preventiveCareRestored.map((occurrence) => occurrence.date)).toEqual(expectedBeforeDates);
  });
});
