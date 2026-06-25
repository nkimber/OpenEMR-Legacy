import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";

const appointmentExceptionPatientId = "MOD-PAT-0013";
const occurrenceSearchDate = "2026-12-02";
const skippedOccurrenceDate = "2026-12-16";
const expectedOccurrenceDates = ["2026-12-02", "2026-12-30", "2027-01-13", "2027-01-27"];

test.describe("appointment recurrence exception parity @slice105 @workflow-appointment-recurrence-exceptions @read", () => {
  test("skips seeded recurring appointment exception dates", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentExceptionPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentExceptionPatientId} was not found.`);
    }

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-105-appointment-recurrence-exceptions-precondition",
      description: "Captures the Slice 105 appointment recurrence-exceptions anchor patient, expected expansion window, and seeded skipped occurrence date before reading generated occurrences.",
      expected: {
        patient: {
          pubpid: appointmentExceptionPatientId,
          providerId: patient.providerId
        },
        series: {
          title: "Preventive Care",
          occurrenceSearchDate,
          expectedOccurrenceDates,
          expectedOccurrenceNumbers: [3, 5, 6, 7],
          skippedOccurrenceDate,
          recurrenceType: 1,
          repeatFrequency: 2,
          repeatUnit: 1,
          recurrenceEndDate: "2027-01-27",
          recurrenceExceptionCount: 1
        }
      },
      actual: {
        patient,
        search: {
          patientId: patient.pid,
          occurrenceSearchDate
        }
      },
      context: {
        canonicalId: appointmentExceptionPatientId,
        suite: "workflow-appointment-recurrence-exceptions",
        workflow: "appointment-recurrence-exceptions-precondition"
      }
    });

    const occurrences = await workflow.getAppointmentSeriesOccurrences(patient.pid, occurrenceSearchDate);
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-105-appointment-recurrence-exceptions-expanded",
      description: "Captures the normalized generated occurrence rows returned by Slice 105 after applying the seeded recurrence exception date.",
      expected: {
        occurrenceDates: expectedOccurrenceDates,
        omittedDate: skippedOccurrenceDate,
        occurrenceNumbers: [3, 5, 6, 7],
        recurrenceType: 1,
        repeatFrequency: 2,
        repeatUnit: 1,
        recurrenceEndDate: "2027-01-27",
        recurrenceExceptionCount: 1,
        recurrenceExdates: [skippedOccurrenceDate],
        skippedDatePresentInExpansion: false
      },
      actual: {
        patient,
        occurrenceSearchDate,
        occurrenceCount: preventiveCareOccurrences.length,
        skippedDatePresentInExpansion: preventiveCareOccurrences.some((occurrence) => occurrence.date === skippedOccurrenceDate),
        occurrences: preventiveCareOccurrences
      },
      context: {
        canonicalId: appointmentExceptionPatientId,
        suite: "workflow-appointment-recurrence-exceptions",
        workflow: "appointment-recurrence-exceptions-expanded"
      }
    });

    if (target.type === "modernized-openemr") {
      await openAuthenticatedModernizedCalendar(page, target);
      await page.getByLabel("Appointment patient ID").fill(patient.pubpid);
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
      await expect(page.getByRole("button", { name: "Save schedule" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Reschedule occurrence" })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Skip occurrence" })).toBeEnabled();
    }

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-105-appointment-recurrence-exceptions-surface",
      description: target.type === "modernized-openemr"
        ? "Captures the modernized Calendar skipped-date rendering facts for the Slice 105 recurrence-exceptions anchor."
        : "Captures the legacy recurrence-exceptions projection facts for the Slice 105 anchor.",
      expected: {
        title: "Preventive Care",
        firstOccurrenceDate: occurrenceSearchDate,
        firstOccurrenceNumber: 3,
        skippedOccurrenceDate,
        recurrenceExceptionCount: 1,
        generatedOccurrenceActions: target.type === "modernized-openemr" ? ["Reschedule occurrence", "Skip occurrence"] : []
      },
      actual: {
        patient,
        firstOccurrence: preventiveCareOccurrences[0],
        surface: {
          application: target.type,
          page: target.type === "modernized-openemr" ? "calendar" : "workflow-projection",
          renderedTitle: "Preventive Care",
          renderedDate: occurrenceSearchDate,
          renderedOccurrenceNumber: 3,
          renderedSkippedDate: skippedOccurrenceDate,
          renderedSkippedCount: 1,
          skippedDateRenderedAsAppointmentButton: false
        }
      },
      context: {
        canonicalId: appointmentExceptionPatientId,
        suite: "workflow-appointment-recurrence-exceptions",
        workflow: target.type === "modernized-openemr" ? "appointment-recurrence-exceptions-modernized-surface" : "appointment-recurrence-exceptions-legacy-projection"
      }
    });
  });
});
