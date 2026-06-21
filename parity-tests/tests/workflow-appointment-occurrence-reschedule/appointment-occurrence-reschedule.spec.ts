import { test, expect } from "../../src/fixtures/parityTest.js";

const appointmentExceptionPatientId = "MOD-PAT-0013";
const occurrenceSearchDate = "2026-12-02";
const seededExceptionDate = "2026-12-16";
const rescheduledOccurrenceDate = "2026-12-30";
const rescheduledStandaloneDate = "2027-01-06";
const rescheduledStandaloneStart = "14:00";
const rescheduledStandaloneEnd = "14:45:00";
const rescheduledDurationMinutes = 45;
const expectedBeforeDates = ["2026-12-02", "2026-12-30", "2027-01-13", "2027-01-27"];
const expectedAfterDates = ["2026-12-02", "2027-01-13", "2027-01-27"];

test.describe("appointment occurrence reschedule parity @slice108 @workflow-appointment-occurrence-reschedule @mutation", () => {
  test("moves a generated occurrence into a standalone appointment and skips the original occurrence", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentExceptionPatientId);
    expect(patient).not.toBeNull();

    const beforeOccurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, occurrenceSearchDate);
    const preventiveCareBefore = beforeOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
    expect(preventiveCareBefore.map((occurrence) => occurrence.date)).toEqual(expectedBeforeDates);

    const occurrenceToReschedule = preventiveCareBefore.find((occurrence) => occurrence.date === rescheduledOccurrenceDate);
    expect(occurrenceToReschedule).toBeDefined();
    expect(occurrenceToReschedule!.isVirtualOccurrence).toBe(true);
    expect(occurrenceToReschedule!.occurrenceNumber).toBe(5);

    const seriesRootId = occurrenceToReschedule!.seriesRootId;

    try {
      const rootAppointment = await workflow.getAppointment(seriesRootId);
      expect(rootAppointment).not.toBeNull();

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

        await page.getByLabel("Edit appointment date").fill(rescheduledStandaloneDate);
        await page.getByLabel("Edit appointment start time").fill(rescheduledStandaloneStart);
        await page.getByLabel("Edit appointment duration").fill(String(rescheduledDurationMinutes));
        await page.getByRole("button", { name: "Reschedule occurrence" }).click();

        await expect(page.getByRole("button", { name: /Preventive Care[\s\S]*2027-01-06/i })).toBeVisible();
        await expect(page.locator("body")).toContainText("Does not repeat");
      } else {
        await workflow.addAppointmentRecurrenceException(seriesRootId, rescheduledOccurrenceDate);
        await workflow.createAppointment({
          patientId: patient!.pid,
          providerId: rootAppointment!.providerId,
          title: rootAppointment!.title,
          eventDate: rescheduledStandaloneDate,
          startTime: `${rescheduledStandaloneStart}:00`,
          endTime: rescheduledStandaloneEnd,
          durationSeconds: rescheduledDurationMinutes * 60,
          homeText: rootAppointment!.homeText,
          facilityId: rootAppointment!.facilityId,
          billingLocationId: rootAppointment!.billingLocationId,
          room: rootAppointment!.room,
          categoryId: rootAppointment!.categoryId,
          recurrenceType: 0
        });
      }

      const rootAfterReschedule = await workflow.getAppointment(seriesRootId);
      expect(rootAfterReschedule).not.toBeNull();
      expect(rootAfterReschedule!.recurrenceExdates).toEqual([seededExceptionDate, rescheduledOccurrenceDate]);

      const afterOccurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, occurrenceSearchDate);
      const preventiveCareAfter = afterOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
      expect(preventiveCareAfter.map((occurrence) => occurrence.date)).toEqual(expectedAfterDates);
      expect(preventiveCareAfter.map((occurrence) => occurrence.occurrenceNumber)).toEqual([3, 6, 7]);

      const appointmentRows = await workflow.getAppointmentsForPatient(patient!.pid, rescheduledStandaloneDate);
      const standaloneAppointment = appointmentRows.find(isRescheduledStandaloneAppointment);
      expect(standaloneAppointment).toBeDefined();
      expect(standaloneAppointment!.eventDate).toBe(rescheduledStandaloneDate);
      expect(standaloneAppointment!.startTime.startsWith(rescheduledStandaloneStart)).toBe(true);
      expect(standaloneAppointment!.recurrenceType).toBe(0);
      expect(standaloneAppointment!.categoryName).toBe("Preventive Care Services");
    } finally {
      const appointmentRows = patient
        ? await workflow.getAppointmentsForPatient(patient.pid, rescheduledStandaloneDate)
        : [];
      const appointmentsToDelete = appointmentRows.filter(isRescheduledStandaloneAppointment);
      for (const appointment of appointmentsToDelete) {
        await workflow.deleteAppointment(appointment.id);
      }

      await workflow.setAppointmentRecurrenceExdates(seriesRootId, [seededExceptionDate]);
    }

    const restoredRoot = await workflow.getAppointment(seriesRootId);
    expect(restoredRoot).not.toBeNull();
    expect(restoredRoot!.recurrenceExdates).toEqual([seededExceptionDate]);

    const restoredOccurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, occurrenceSearchDate);
    const preventiveCareRestored = restoredOccurrences.filter((occurrence) => occurrence.title === "Preventive Care");
    expect(preventiveCareRestored.map((occurrence) => occurrence.date)).toEqual(expectedBeforeDates);

    const restoredRows = await workflow.getAppointmentsForPatient(patient!.pid, rescheduledStandaloneDate);
    expect(restoredRows.filter(isRescheduledStandaloneAppointment)).toHaveLength(0);
  });
});

function isRescheduledStandaloneAppointment(appointment: {
  title: string;
  eventDate: string;
  startTime: string;
  recurrenceType: number;
}) {
  return appointment.title === "Preventive Care"
    && appointment.eventDate === rescheduledStandaloneDate
    && appointment.startTime.startsWith(rescheduledStandaloneStart)
    && appointment.recurrenceType === 0;
}
