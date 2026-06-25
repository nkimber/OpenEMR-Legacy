import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";
const anchorDate = "2026-12-07";
const endDate = "2026-12-18";
const selectedWeekdays = [2, 4, 6];
const expectedDates = [
  "2026-12-07",
  "2026-12-09",
  "2026-12-11",
  "2026-12-14",
  "2026-12-16",
  "2026-12-18"
];
const expectedLabel = "Every week on Mon, Wed, Fri until 2026-12-18";

test.describe("appointment days-of-week recurrence parity @slice114 @workflow-appointment-days-of-week-recurrence @mutation", () => {
  test("creates, renders, expands, and removes a selected-weekday recurring appointment", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const title = `Parity Days-of-Week Recurrence ${workflowSuffix()}`;
    let appointmentId: number | string | null = null;
    let createdAppointment: unknown = null;
    let createdOccurrences: unknown[] = [];
    let afterCreateCounts = beforeCounts;

    try {
      appointmentId = await workflow.createAppointment({
        patientId: patient.pid,
        providerId: patient.providerId,
        title,
        eventDate: anchorDate,
        startTime: "08:45:00",
        endTime: "09:15:00",
        durationSeconds: 1800,
        homeText: "Created by the appointment days-of-week recurrence parity suite.",
        facilityId: 10,
        billingLocationId: 10,
        room: "DaysWeek",
        categoryId: 9,
        recurrenceType: 3,
        repeatUnit: 6,
        recurrenceDays: selectedWeekdays,
        recurrenceEndDate: endDate
      });

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        providerId: patient.providerId,
        title,
        eventDate: anchorDate,
        startTime: "08:45:00",
        endTime: "09:15:00",
        status: "-",
        facilityId: 10,
        billingLocationId: 10,
        room: "DaysWeek",
        categoryId: 9,
        recurrenceType: 3,
        repeatFrequency: null,
        repeatUnit: 6,
        recurrenceDays: selectedWeekdays,
        recurrenceEndDate: endDate
      });
      if (!created) {
        throw new Error(`Created days-of-week recurring appointment ${appointmentId} was not found.`);
      }
      createdAppointment = created;

      const occurrences = await workflow.getAppointmentSeriesOccurrences(patient.pid, anchorDate);
      const scenarioOccurrences = occurrences.filter((occurrence) => occurrence.title === title);
      expect(scenarioOccurrences.map((occurrence) => occurrence.date)).toEqual(expectedDates);
      expect(scenarioOccurrences.map((occurrence) => occurrence.occurrenceNumber)).toEqual(
        expectedDates.map((_, index) => index + 1));
      expect(scenarioOccurrences.every((occurrence) => occurrence.recurrenceType === 3)).toBe(true);
      expect(scenarioOccurrences.every((occurrence) => occurrence.repeatUnit === 6)).toBe(true);
      expect(scenarioOccurrences.every((occurrence) => occurrence.recurrenceDays.join(",") === selectedWeekdays.join(","))).toBe(true);
      expect(scenarioOccurrences[1].isVirtualOccurrence).toBe(true);
      createdOccurrences = scenarioOccurrences;

      afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-114-appointment-days-of-week-recurrence-precondition",
        description: "Captures the Slice 114 temporary selected-weekday recurring appointment after creation and before UI rendering.",
        expected: {
          patient: {
            pubpid: appointmentAnchorPatientId,
            providerId: patient.providerId
          },
          createdRoot: {
            title,
            eventDate: anchorDate,
            startTime: "08:45:00",
            endTime: "09:15:00",
            recurrenceType: 3,
            repeatFrequency: null,
            repeatUnit: 6,
            recurrenceDays: selectedWeekdays,
            recurrenceEndDate: endDate
          },
          occurrenceDates: expectedDates,
          occurrenceNumbers: expectedDates.map((_, index) => index + 1),
          generatedOccurrence: {
            date: "2026-12-09",
            occurrenceNumber: 2,
            isVirtualOccurrence: true
          },
          appointmentCountDelta: 1
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          created,
          occurrenceCount: scenarioOccurrences.length,
          occurrences: scenarioOccurrences
        },
        context: {
          canonicalId: appointmentAnchorPatientId,
          suite: "workflow-appointment-days-of-week-recurrence",
          workflow: "appointment-days-of-week-recurrence-precondition"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(title);
        await expect(page.locator("#days_every_week")).toBeChecked();
        await expect(page.locator("#day_2")).toBeChecked();
        await expect(page.locator("#day_4")).toBeChecked();
        await expect(page.locator("#day_6")).toBeChecked();
        await expect(page.locator("#day_1")).not.toBeChecked();
        await expect(page.locator("#day_3")).not.toBeChecked();
        await expect(page.locator("#day_5")).not.toBeChecked();
        await expect(page.locator("#day_7")).not.toBeChecked();
        await expect(page.locator('input[name="form_enddate"]')).toHaveValue(endDate);
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient.pubpid);
        await page.getByLabel("Appointment from date").fill(anchorDate);

        const rootButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(rootButton).toBeVisible();
        await expect(rootButton).toContainText(expectedLabel);
        await rootButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        await expect(page.getByLabel("Edit appointment repeats")).toBeChecked();
        await expect(page.getByLabel("Edit appointment specific weekdays")).toBeChecked();
        await expect(page.getByLabel("Edit appointment weekday Monday")).toBeChecked();
        await expect(page.getByLabel("Edit appointment weekday Wednesday")).toBeChecked();
        await expect(page.getByLabel("Edit appointment weekday Friday")).toBeChecked();
        await expect(page.getByLabel("Edit appointment weekday Sunday")).not.toBeChecked();
        await expect(page.getByLabel("Edit appointment recurrence end date")).toHaveValue(endDate);
        await expect(page.locator("body")).toContainText(expectedLabel);
        await expect(page.locator("body")).toContainText("Mon, Wed, Fri");

        await page.getByLabel("Appointment from date").fill("2026-12-09");
        const generatedButton = page
          .getByRole("button", { name: new RegExp(`${escapeRegex(title)}[\\s\\S]*2026-12-09`, "i") })
          .first();
        await expect(generatedButton).toBeVisible();
        await expect(generatedButton).toContainText("Generated occurrence 2");
        await expect(generatedButton).toContainText(expectedLabel);
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-114-appointment-days-of-week-recurrence-rendered",
        description: "Captures the Slice 114 selected-weekday recurrence rendering facts after legacy or modernized UI assertions.",
        expected: {
          selectedWeekdays,
          weekdayLabel: "Mon, Wed, Fri",
          expectedLabel,
          generatedOccurrence: {
            date: "2026-12-09",
            occurrenceNumber: 2,
            label: "Generated occurrence 2"
          },
          appointmentCountDelta: 1
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          createdAppointment,
          createdOccurrences,
          surface: target.type === "modernized-openemr"
            ? {
                application: target.type,
                page: "calendar",
                repeatLabel: expectedLabel,
                weekdayLabel: "Mon, Wed, Fri",
                selectedWeekdayControls: ["Monday", "Wednesday", "Friday"],
                generatedOccurrenceVisible: "2026-12-09"
              }
            : {
                application: target.type,
                page: "legacy-appointment-direct",
                daysEveryWeekChecked: true,
                selectedDayControls: ["day_2", "day_4", "day_6"],
                unselectedDayControls: ["day_1", "day_3", "day_5", "day_7"],
                endDateControl: endDate
              }
        },
        context: {
          canonicalId: appointmentAnchorPatientId,
          suite: "workflow-appointment-days-of-week-recurrence",
          workflow: "appointment-days-of-week-recurrence-rendered"
        }
      });
    } finally {
      if (appointmentId !== null) {
        await workflow.deleteAppointment(appointmentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.appointments).toBe(beforeCounts.appointments);
    let cleanupAppointment: unknown = null;
    if (appointmentId !== null) {
      await expect(workflow.getAppointment(appointmentId)).resolves.toBeNull();
      cleanupAppointment = await workflow.getAppointment(appointmentId);
    }
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-114-appointment-days-of-week-recurrence-cleanup",
      description: "Captures the Slice 114 cleanup state after deleting the temporary selected-weekday recurring appointment root.",
      expected: {
        patient: {
          pubpid: appointmentAnchorPatientId,
          providerId: patient.providerId
        },
        appointmentDeleted: appointmentId !== null,
        appointmentCountRestored: true,
        beforeAppointmentCount: beforeCounts.appointments
      },
      actual: {
        patient,
        appointmentId,
        beforeCounts,
        afterCreateCounts,
        afterCleanupCounts,
        cleanupAppointment
      },
      context: {
        canonicalId: appointmentAnchorPatientId,
        suite: "workflow-appointment-days-of-week-recurrence",
        workflow: "appointment-days-of-week-recurrence-cleanup"
      }
    });
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
