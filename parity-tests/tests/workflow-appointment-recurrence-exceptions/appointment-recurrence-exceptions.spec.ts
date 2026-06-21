import { test, expect } from "../../src/fixtures/parityTest.js";

const appointmentExceptionPatientId = "MOD-PAT-0013";
const occurrenceSearchDate = "2026-12-02";
const skippedOccurrenceDate = "2026-12-16";
const expectedOccurrenceDates = ["2026-12-02", "2026-12-30", "2027-01-13", "2027-01-27"];

test.describe("appointment recurrence exception parity @slice105 @workflow-appointment-recurrence-exceptions @read", () => {
  test("skips seeded recurring appointment exception dates", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentExceptionPatientId);
    expect(patient).not.toBeNull();

    const occurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, occurrenceSearchDate);
    const preventiveCareOccurrences = occurrences.filter((occurrence) => occurrence.title === "Preventive Care");

    expect(preventiveCareOccurrences.map((occurrence) => occurrence.date)).toEqual(expectedOccurrenceDates);
    expect(preventiveCareOccurrences.map((occurrence) => occurrence.occurrenceNumber)).toEqual([3, 5, 6, 7]);
    expect(preventiveCareOccurrences.every((occurrence) => occurrence.recurrenceType === 1)).toBe(true);
    expect(preventiveCareOccurrences.every((occurrence) => occurrence.repeatFrequency === 2)).toBe(true);
    expect(preventiveCareOccurrences.every((occurrence) => occurrence.repeatUnit === 1)).toBe(true);
    expect(preventiveCareOccurrences.every((occurrence) => occurrence.recurrenceEndDate === "2027-01-27")).toBe(true);
    expect(preventiveCareOccurrences.every((occurrence) => occurrence.recurrenceExceptionCount === 1)).toBe(true);
    expect(preventiveCareOccurrences.every((occurrence) => occurrence.recurrenceExdates.includes(skippedOccurrenceDate))).toBe(true);
    expect(preventiveCareOccurrences.some((occurrence) => occurrence.date === skippedOccurrenceDate)).toBe(false);

    if (target.type === "modernized-openemr") {
      await page.goto(target.publicUrl);
      await page.getByRole("button", { name: "Calendar" }).click();
      await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
      await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
      await page.getByLabel("Appointment from date").fill(occurrenceSearchDate);

      await expect(page.getByRole("button", { name: /2026-12-16/ })).toHaveCount(0);
      const appointmentButton = page.getByRole("button", { name: /Preventive Care/i }).first();
      await expect(appointmentButton).toBeVisible();
      await expect(appointmentButton).toContainText("Generated occurrence 3");
      await expect(appointmentButton).toContainText("1 skipped");
      await appointmentButton.click();

      await expect(page.getByRole("heading", { name: "Preventive Care" })).toBeVisible();
      await expect(page.locator("body")).toContainText("Generated occurrence 3");
      await expect(page.locator("body")).toContainText("2026-12-02");
      await expect(page.locator("body")).toContainText("Skipped dates");
      await expect(page.locator("body")).toContainText(skippedOccurrenceDate);
      await expect(page.getByRole("button", { name: "Save schedule" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Skip occurrence" })).toBeEnabled();
    }
  });
});
