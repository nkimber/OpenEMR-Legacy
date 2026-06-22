import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";
const occurrenceSearchDate = "2026-08-14";
const expectedOccurrenceDates = ["2026-08-14", "2026-08-28", "2026-09-11", "2026-09-25", "2026-10-09"];

test.describe("appointment recurring series parity @slice104 @workflow-appointment-series @read", () => {
  test("expands seeded recurring appointment anchors into dated occurrences", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const occurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, occurrenceSearchDate);
    const preventiveCareOccurrences = occurrences.filter((occurrence) => occurrence.title === "Preventive Care");

    expect(preventiveCareOccurrences.map((occurrence) => occurrence.date)).toEqual(expectedOccurrenceDates);
    expect(preventiveCareOccurrences.map((occurrence) => occurrence.occurrenceNumber)).toEqual([3, 4, 5, 6, 7]);
    expect(preventiveCareOccurrences.every((occurrence) => occurrence.recurrenceType === 1)).toBe(true);
    expect(preventiveCareOccurrences.every((occurrence) => occurrence.repeatFrequency === 2)).toBe(true);
    expect(preventiveCareOccurrences.every((occurrence) => occurrence.repeatUnit === 1)).toBe(true);
    expect(preventiveCareOccurrences.every((occurrence) => occurrence.recurrenceEndDate === "2026-10-09")).toBe(true);
    expect(preventiveCareOccurrences[0].isVirtualOccurrence).toBe(true);

    if (target.type === "modernized-openemr") {
      await openAuthenticatedModernizedCalendar(page, target);
      await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
      await page.getByLabel("Appointment from date").fill(occurrenceSearchDate);

      const appointmentButton = page.getByRole("button", { name: /Preventive Care/i }).first();
      await expect(appointmentButton).toBeVisible();
      await expect(appointmentButton).toContainText("Generated occurrence 3");
      await expect(appointmentButton).toContainText("Every 2 weeks until 2026-10-09");
      await appointmentButton.click();

      await expect(page.getByRole("heading", { name: "Preventive Care" })).toBeVisible();
      await expect(page.locator("body")).toContainText("Generated occurrence 3");
      await expect(page.locator("body")).toContainText("2026-08-14");
      await expect(page.locator("body")).toContainText("Every 2 weeks until 2026-10-09");
      await expect(page.getByRole("button", { name: "Reschedule occurrence" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Skip occurrence" })).toBeVisible();
    }
  });
});
