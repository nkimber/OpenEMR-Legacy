import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";

const appointmentExceptionPatientId = "MOD-PAT-0013";
const occurrenceSearchDate = "2026-11-04";
const seededExceptionDate = "2026-12-16";
const addedExceptionDate = "2026-12-30";
const expectedBeforeDates = ["2026-11-04", "2026-11-18", "2026-12-02", "2026-12-30", "2027-01-13", "2027-01-27"];
const expectedAfterDates = ["2026-11-04", "2026-11-18", "2026-12-02", "2027-01-13", "2027-01-27"];

test.describe("appointment recurrence exception edit parity @slice109 @workflow-appointment-recurrence-exception-edit @mutation", () => {
  test("edits the skipped-date list on a recurring appointment root", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentExceptionPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentExceptionPatientId} was not found.`);
    }

    const beforeOccurrences = await workflow.getAppointmentSeriesOccurrences(patient.pid, occurrenceSearchDate);
    const preventiveCareBefore = beforeOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
    expect(preventiveCareBefore.map((occurrence) => occurrence.date)).toEqual(expectedBeforeDates);
    expect(preventiveCareBefore.map((occurrence) => occurrence.occurrenceNumber)).toEqual([1, 2, 3, 5, 6, 7]);

    const seriesRoot = preventiveCareBefore.find((occurrence) => occurrence.date === occurrenceSearchDate);
    expect(seriesRoot).toBeDefined();
    if (!seriesRoot) {
      throw new Error(`Series root occurrence ${occurrenceSearchDate} was not found.`);
    }
    expect(seriesRoot.isVirtualOccurrence).toBe(false);

    const seriesRootId = seriesRoot.seriesRootId;
    const rootBeforeEdit = await workflow.getAppointment(seriesRootId);
    expect(rootBeforeEdit).not.toBeNull();
    if (!rootBeforeEdit) {
      throw new Error(`Series root appointment ${seriesRootId} was not found.`);
    }
    expect(rootBeforeEdit.recurrenceExdates).toEqual([seededExceptionDate]);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-109-appointment-recurrence-exception-edit-precondition",
      description: "Captures the Slice 109 appointment recurrence exception-list edit anchor patient, recurring root, seeded skipped date, and generated occurrence expansion before editing the root exception list.",
      expected: {
        patient: {
          pubpid: appointmentExceptionPatientId,
          providerId: patient.providerId
        },
        root: {
          title: "Preventive Care",
          occurrenceSearchDate,
          recurrenceExdates: [seededExceptionDate]
        },
        occurrenceDates: expectedBeforeDates,
        occurrenceNumbers: [1, 2, 3, 5, 6, 7],
        editableExceptionDate: addedExceptionDate,
        addedDatePresentBeforeEdit: true
      },
      actual: {
        patient,
        rootBeforeEdit,
        seriesRoot,
        occurrenceSearchDate,
        beforeOccurrenceCount: preventiveCareBefore.length,
        addedDatePresentBeforeEdit: preventiveCareBefore.some((occurrence) => occurrence.date === addedExceptionDate),
        beforeOccurrences: preventiveCareBefore
      },
      context: {
        canonicalId: appointmentExceptionPatientId,
        suite: "workflow-appointment-recurrence-exception-edit",
        workflow: "appointment-recurrence-exception-edit-precondition"
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

      const afterOccurrences = await workflow.getAppointmentSeriesOccurrences(patient.pid, occurrenceSearchDate);
      const preventiveCareAfter = afterOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
      expect(preventiveCareAfter.map((occurrence) => occurrence.date)).toEqual(expectedAfterDates);
      expect(preventiveCareAfter.map((occurrence) => occurrence.occurrenceNumber)).toEqual([1, 2, 3, 6, 7]);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-109-appointment-recurrence-exception-edit-edited",
        description: "Captures the recurring root and generated occurrence expansion after Slice 109 edits the root skipped-date list.",
        expected: {
          root: {
            recurrenceExdates: [seededExceptionDate, addedExceptionDate]
          },
          occurrenceDates: expectedAfterDates,
          omittedDate: addedExceptionDate,
          occurrenceNumbers: [1, 2, 3, 6, 7],
          recurrenceExceptionCount: 2,
          addedDatePresentAfterEdit: false
        },
        actual: {
          patient,
          seriesRoot,
          rootBeforeEdit,
          rootAfterEdit,
          occurrenceSearchDate,
          addedDatePresentAfterEdit: preventiveCareAfter.some((occurrence) => occurrence.date === addedExceptionDate),
          afterOccurrences: preventiveCareAfter,
          surface: target.type === "modernized-openemr"
            ? {
                application: target.type,
                page: "calendar",
                editedSkippedDates: `${seededExceptionDate}, ${addedExceptionDate}`,
                addedDateButtonVisible: false
              }
            : {
                application: target.type,
                page: "workflow-projection"
              }
        },
        context: {
          canonicalId: appointmentExceptionPatientId,
          suite: "workflow-appointment-recurrence-exception-edit",
          workflow: "appointment-recurrence-exception-edit-edited"
        }
      });
    } finally {
      await workflow.setAppointmentRecurrenceExdates(seriesRootId, [seededExceptionDate]);
    }

    const restoredRoot = await workflow.getAppointment(seriesRootId);
    expect(restoredRoot).not.toBeNull();
    expect(restoredRoot!.recurrenceExdates).toEqual([seededExceptionDate]);

    const restoredOccurrences = await workflow.getAppointmentSeriesOccurrences(patient.pid, occurrenceSearchDate);
    const preventiveCareRestored = restoredOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
    expect(preventiveCareRestored.map((occurrence) => occurrence.date)).toEqual(expectedBeforeDates);
    expect(preventiveCareRestored.map((occurrence) => occurrence.occurrenceNumber)).toEqual([1, 2, 3, 5, 6, 7]);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-109-appointment-recurrence-exception-edit-cleanup",
      description: "Captures the Slice 109 cleanup state after restoring the recurring root to the seeded single skipped-date list.",
      expected: {
        root: {
          recurrenceExdates: [seededExceptionDate]
        },
        occurrenceDates: expectedBeforeDates,
        restoredAddedExceptionDate: addedExceptionDate,
        occurrenceNumbers: [1, 2, 3, 5, 6, 7],
        recurrenceExceptionCount: 1
      },
      actual: {
        patient,
        seriesRoot,
        restoredRoot,
        restoredOccurrenceCount: preventiveCareRestored.length,
        addedDatePresentAfterCleanup: preventiveCareRestored.some((occurrence) => occurrence.date === addedExceptionDate),
        restoredOccurrences: preventiveCareRestored
      },
      context: {
        canonicalId: appointmentExceptionPatientId,
        suite: "workflow-appointment-recurrence-exception-edit",
        workflow: "appointment-recurrence-exception-edit-cleanup"
      }
    });
  });
});
