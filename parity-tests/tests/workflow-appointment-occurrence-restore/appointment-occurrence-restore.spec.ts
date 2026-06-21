import { test, expect } from "../../src/fixtures/parityTest.js";

const appointmentExceptionPatientId = "MOD-PAT-0013";
const occurrenceSearchDate = "2026-12-02";
const seededExceptionDate = "2026-12-16";
const restoredOccurrenceDate = "2026-12-30";
const expectedSkippedDates = ["2026-12-02", "2027-01-13", "2027-01-27"];
const expectedRestoredDates = ["2026-12-02", "2026-12-30", "2027-01-13", "2027-01-27"];

test.describe("appointment occurrence restore parity @slice107 @workflow-appointment-occurrence-restore @mutation", () => {
  test("restores a skipped generated occurrence by removing its recurrence exception", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentExceptionPatientId);
    expect(patient).not.toBeNull();

    const beforeOccurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, occurrenceSearchDate);
    const preventiveCareBefore = beforeOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
    expect(preventiveCareBefore.map((occurrence) => occurrence.date)).toEqual(expectedRestoredDates);

    const occurrenceToRestore = preventiveCareBefore.find((occurrence) => occurrence.date === restoredOccurrenceDate);
    expect(occurrenceToRestore).toBeDefined();
    expect(occurrenceToRestore!.isVirtualOccurrence).toBe(true);
    expect(occurrenceToRestore!.occurrenceNumber).toBe(5);

    try {
      await workflow.addAppointmentRecurrenceException(occurrenceToRestore!.seriesRootId, restoredOccurrenceDate);

      const skippedRoot = await workflow.getAppointment(occurrenceToRestore!.seriesRootId);
      expect(skippedRoot).not.toBeNull();
      expect(skippedRoot!.recurrenceExdates).toEqual([seededExceptionDate, restoredOccurrenceDate]);

      const skippedOccurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, occurrenceSearchDate);
      const preventiveCareSkipped = skippedOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
      expect(preventiveCareSkipped.map((occurrence) => occurrence.date)).toEqual(expectedSkippedDates);
      expect(preventiveCareSkipped.map((occurrence) => occurrence.occurrenceNumber)).toEqual([3, 6, 7]);

      if (target.type === "modernized-openemr") {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Calendar" }).click();
        await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
        await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
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
        await workflow.restoreAppointmentRecurrenceException(occurrenceToRestore!.seriesRootId, restoredOccurrenceDate);
      }

      const restoredRoot = await workflow.getAppointment(occurrenceToRestore!.seriesRootId);
      expect(restoredRoot).not.toBeNull();
      expect(restoredRoot!.recurrenceExdates).toEqual([seededExceptionDate]);

      const restoredOccurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, occurrenceSearchDate);
      const preventiveCareRestored = restoredOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
      expect(preventiveCareRestored.map((occurrence) => occurrence.date)).toEqual(expectedRestoredDates);
      expect(preventiveCareRestored.map((occurrence) => occurrence.occurrenceNumber)).toEqual([3, 5, 6, 7]);
      expect(preventiveCareRestored.every((occurrence) => occurrence.recurrenceExceptionCount === 1)).toBe(true);
      expect(preventiveCareRestored.every((occurrence) => occurrence.recurrenceExdates.includes(seededExceptionDate))).toBe(true);
      expect(preventiveCareRestored.every((occurrence) => !occurrence.recurrenceExdates.includes(restoredOccurrenceDate))).toBe(true);
    } finally {
      await workflow.setAppointmentRecurrenceExdates(occurrenceToRestore!.seriesRootId, [seededExceptionDate]);
    }
  });
});
