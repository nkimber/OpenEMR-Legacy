import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";

const appointmentExceptionPatientId = "MOD-PAT-0013";
const occurrenceSearchDate = "2026-11-04";
const seededExceptionDate = "2026-12-16";
const addedExceptionDate = "2026-12-30";
const expectedBeforeDates = ["2026-11-04", "2026-11-18", "2026-12-02", "2026-12-30", "2027-01-13", "2027-01-27"];
const expectedAfterDates = ["2026-11-04", "2026-11-18", "2026-12-02", "2027-01-13", "2027-01-27"];

test.describe("appointment recurrence exception edit parity @slice109 @workflow-appointment-recurrence-exception-edit @mutation", () => {
  test("edits the skipped-date list on a recurring appointment root", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentExceptionPatientId);
    expect(patient).not.toBeNull();

    const beforeOccurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, occurrenceSearchDate);
    const preventiveCareBefore = beforeOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
    expect(preventiveCareBefore.map((occurrence) => occurrence.date)).toEqual(expectedBeforeDates);
    expect(preventiveCareBefore.map((occurrence) => occurrence.occurrenceNumber)).toEqual([1, 2, 3, 5, 6, 7]);

    const seriesRoot = preventiveCareBefore.find((occurrence) => occurrence.date === occurrenceSearchDate);
    expect(seriesRoot).toBeDefined();
    expect(seriesRoot!.isVirtualOccurrence).toBe(false);

    const seriesRootId = seriesRoot!.seriesRootId;

    try {
      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
        await page.getByLabel("Appointment from date").fill(occurrenceSearchDate);

        const seriesRootButton = page.getByRole("button", { name: /Preventive Care[\s\S]*2026-11-04/i }).first();
        await expect(seriesRootButton).toBeVisible();
        await seriesRootButton.click();
        await expect(page.getByRole("heading", { name: "Preventive Care" })).toBeVisible();
        await expect(page.locator("body")).toContainText("Series anchor");
        await page.getByLabel("Edit appointment skipped dates").fill(`${seededExceptionDate}, ${addedExceptionDate}`);
        await page.getByRole("button", { name: "Save schedule" }).click();

        await expect(page.getByRole("button", { name: /Preventive Care[\s\S]*2026-12-30/i })).toHaveCount(0);
        await expect(page.locator("body")).toContainText(`${seededExceptionDate}, ${addedExceptionDate}`);
      } else {
        await workflow.setAppointmentRecurrenceExdates(seriesRootId, [seededExceptionDate, addedExceptionDate]);
      }

      const rootAfterEdit = await workflow.getAppointment(seriesRootId);
      expect(rootAfterEdit).not.toBeNull();
      expect(rootAfterEdit!.recurrenceExdates).toEqual([seededExceptionDate, addedExceptionDate]);

      const afterOccurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, occurrenceSearchDate);
      const preventiveCareAfter = afterOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
      expect(preventiveCareAfter.map((occurrence) => occurrence.date)).toEqual(expectedAfterDates);
      expect(preventiveCareAfter.map((occurrence) => occurrence.occurrenceNumber)).toEqual([1, 2, 3, 6, 7]);
    } finally {
      await workflow.setAppointmentRecurrenceExdates(seriesRootId, [seededExceptionDate]);
    }

    const restoredRoot = await workflow.getAppointment(seriesRootId);
    expect(restoredRoot).not.toBeNull();
    expect(restoredRoot!.recurrenceExdates).toEqual([seededExceptionDate]);

    const restoredOccurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, occurrenceSearchDate);
    const preventiveCareRestored = restoredOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
    expect(preventiveCareRestored.map((occurrence) => occurrence.date)).toEqual(expectedBeforeDates);
    expect(preventiveCareRestored.map((occurrence) => occurrence.occurrenceNumber)).toEqual([1, 2, 3, 5, 6, 7]);
  });
});