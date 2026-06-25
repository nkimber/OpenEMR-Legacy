import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";
const occurrenceSearchDate = "2026-08-14";
const expectedOccurrenceDates = ["2026-08-14", "2026-08-28", "2026-09-11", "2026-09-25", "2026-10-09"];

test.describe("appointment recurring series parity @slice104 @workflow-appointment-series @read", () => {
  test("expands seeded recurring appointment anchors into dated occurrences", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentAnchorPatientId} was not found.`);
    }

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-104-appointment-series-precondition",
      description: "Captures the Slice 104 appointment recurring-series anchor patient and expected expansion window before reading generated occurrences.",
      expected: {
        patient: {
          pubpid: appointmentAnchorPatientId,
          providerId: patient.providerId
        },
        series: {
          title: "Preventive Care",
          occurrenceSearchDate,
          expectedOccurrenceDates,
          expectedOccurrenceNumbers: [3, 4, 5, 6, 7],
          recurrenceType: 1,
          repeatFrequency: 2,
          repeatUnit: 1,
          recurrenceEndDate: "2026-10-09",
          recurrenceLabel: "Every 2 weeks until 2026-10-09"
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
        canonicalId: appointmentAnchorPatientId,
        suite: "workflow-appointment-series",
        workflow: "appointment-series-precondition"
      }
    });

    const occurrences = await workflow.getAppointmentSeriesOccurrences(patient.pid, occurrenceSearchDate);
    const preventiveCareOccurrences = occurrences.filter((occurrence) => occurrence.title === "Preventive Care");

    expect(preventiveCareOccurrences.map((occurrence) => occurrence.date)).toEqual(expectedOccurrenceDates);
    expect(preventiveCareOccurrences.map((occurrence) => occurrence.occurrenceNumber)).toEqual([3, 4, 5, 6, 7]);
    expect(preventiveCareOccurrences.every((occurrence) => occurrence.recurrenceType === 1)).toBe(true);
    expect(preventiveCareOccurrences.every((occurrence) => occurrence.repeatFrequency === 2)).toBe(true);
    expect(preventiveCareOccurrences.every((occurrence) => occurrence.repeatUnit === 1)).toBe(true);
    expect(preventiveCareOccurrences.every((occurrence) => occurrence.recurrenceEndDate === "2026-10-09")).toBe(true);
    expect(preventiveCareOccurrences[0].isVirtualOccurrence).toBe(true);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-104-appointment-series-expanded",
      description: "Captures the normalized generated occurrence rows returned by the Slice 104 recurring-series workflow projection.",
      expected: {
        occurrenceDates: expectedOccurrenceDates,
        occurrenceNumbers: [3, 4, 5, 6, 7],
        recurrenceType: 1,
        repeatFrequency: 2,
        repeatUnit: 1,
        recurrenceEndDate: "2026-10-09",
        firstOccurrenceIsVirtual: true,
        recurrenceExceptionCount: 0
      },
      actual: {
        patient,
        occurrenceSearchDate,
        occurrenceCount: preventiveCareOccurrences.length,
        occurrences: preventiveCareOccurrences
      },
      context: {
        canonicalId: appointmentAnchorPatientId,
        suite: "workflow-appointment-series",
        workflow: "appointment-series-expanded"
      }
    });

    if (target.type === "modernized-openemr") {
      await openAuthenticatedModernizedCalendar(page, target);
      await page.getByLabel("Appointment patient ID").fill(patient.pubpid);
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

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-104-appointment-series-surface",
      description: target.type === "modernized-openemr"
        ? "Captures the modernized Calendar generated-occurrence rendering facts for the Slice 104 recurring-series anchor."
        : "Captures the legacy recurring-series projection facts for the Slice 104 recurring-series anchor.",
      expected: {
        title: "Preventive Care",
        firstOccurrenceDate: occurrenceSearchDate,
        firstOccurrenceNumber: 3,
        recurrenceLabel: "Every 2 weeks until 2026-10-09",
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
          renderedRecurrenceLabel: "Every 2 weeks until 2026-10-09"
        }
      },
      context: {
        canonicalId: appointmentAnchorPatientId,
        suite: "workflow-appointment-series",
        workflow: target.type === "modernized-openemr" ? "appointment-series-modernized-surface" : "appointment-series-legacy-projection"
      }
    });
  });
});
