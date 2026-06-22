import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";
const initialEndDate = "2027-04-15";
const updatedEndDate = "2027-08-15";
const anchorDate = "2026-12-15";
const expectedInitialDates = ["2026-12-15", "2027-01-15", "2027-02-15", "2027-03-15", "2027-04-15"];
const expectedUpdatedDates = ["2026-12-15", "2027-02-15", "2027-04-15", "2027-06-15", "2027-08-15"];

test.describe("appointment monthly recurrence parity @slice112 @workflow-appointment-monthly-recurrence @mutation", () => {
  test("creates, updates, renders, expands, and removes a monthly recurring appointment", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Monthly Recurrence ${workflowSuffix()}`;
    const updatedTitle = `${title} Updated`;
    let appointmentId: number | string | null = null;

    try {
      appointmentId = await workflow.createAppointment({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: anchorDate,
        startTime: "11:00:00",
        endTime: "11:30:00",
        durationSeconds: 1800,
        homeText: "Created by the appointment monthly recurrence suite.",
        facilityId: 10,
        billingLocationId: 10,
        room: "Monthly",
        categoryId: 9,
        recurrenceType: 1,
        repeatFrequency: 1,
        repeatUnit: 2,
        recurrenceEndDate: initialEndDate
      });

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: anchorDate,
        startTime: "11:00:00",
        endTime: "11:30:00",
        status: "-",
        facilityId: 10,
        billingLocationId: 10,
        room: "Monthly",
        categoryId: 9,
        recurrenceType: 1,
        repeatFrequency: 1,
        repeatUnit: 2,
        recurrenceEndDate: initialEndDate
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);

      const initialOccurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, anchorDate);
      const initialMonthlyOccurrences = initialOccurrences.filter((occurrence) => occurrence.title === title);
      expect(initialMonthlyOccurrences.map((occurrence) => occurrence.date)).toEqual(expectedInitialDates);
      expect(initialMonthlyOccurrences.map((occurrence) => occurrence.occurrenceNumber)).toEqual([1, 2, 3, 4, 5]);
      expect(initialMonthlyOccurrences.every((occurrence) => occurrence.repeatFrequency === 1)).toBe(true);
      expect(initialMonthlyOccurrences.every((occurrence) => occurrence.repeatUnit === 2)).toBe(true);
      expect(initialMonthlyOccurrences[1].isVirtualOccurrence).toBe(true);

      if (target.type === "legacy-openemr") {
        await workflow.updateAppointment(appointmentId, {
          providerId: patient!.providerId,
          title: updatedTitle,
          eventDate: anchorDate,
          startTime: "11:00:00",
          endTime: "11:30:00",
          durationSeconds: 1800,
          homeText: "Updated by the appointment monthly recurrence suite.",
          facilityId: 10,
          billingLocationId: 10,
          room: "Monthly",
          status: "-",
          categoryId: 9,
          recurrenceType: 1,
          repeatFrequency: 2,
          repeatUnit: 2,
          recurrenceEndDate: updatedEndDate
        });

        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(updatedTitle);
        await expect(page.locator('input[name="form_repeat"]')).toBeChecked();
        await expect(page.locator('select[name="form_repeat_freq"]')).toHaveValue("2");
        await expect(page.locator('select[name="form_repeat_type"]')).toHaveValue("2");
        await expect(page.locator('input[name="form_enddate"]')).toHaveValue(updatedEndDate);
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
        await page.getByLabel("Appointment from date").fill(anchorDate);

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await expect(appointmentButton).toContainText(`Every month until ${initialEndDate}`);
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        await expect(page.getByLabel("Edit appointment repeats")).toBeChecked();
        await expect(page.getByLabel("Edit appointment repeat frequency")).toHaveValue("1");
        await expect(page.getByLabel("Edit appointment repeat unit")).toHaveValue("2");
        await expect(page.getByLabel("Edit appointment recurrence end date")).toHaveValue(initialEndDate);

        await page.getByLabel("Edit appointment title").fill(updatedTitle);
        await page.getByLabel("Edit appointment repeat frequency").fill("2");
        await page.getByLabel("Edit appointment recurrence end date").fill(updatedEndDate);
        await page.getByRole("button", { name: "Save schedule" }).click();
        await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
        await expect(page.getByLabel("Edit appointment repeat frequency")).toHaveValue("2");
        await expect(page.getByLabel("Edit appointment repeat unit")).toHaveValue("2");
        await expect(page.getByLabel("Edit appointment recurrence end date")).toHaveValue(updatedEndDate);
        await expect(page.locator("body")).toContainText(`Every 2 months until ${updatedEndDate}`);

        await page.getByLabel("Appointment from date").fill("2027-02-15");
        const generatedOccurrenceButton = page.getByRole("button", { name: new RegExp(`${escapeRegex(updatedTitle)}[\\s\\S]*2027-02-15`, "i") }).first();
        await expect(generatedOccurrenceButton).toBeVisible();
        await expect(generatedOccurrenceButton).toContainText("Generated occurrence 2");
        await generatedOccurrenceButton.click();
        await expect(page.locator("body")).toContainText("Generated occurrence 2");
        await expect(page.locator("body")).toContainText("2027-02-15");
        await expect(page.locator("body")).toContainText(`Every 2 months until ${updatedEndDate}`);
      }

      const updated = await workflow.getAppointment(appointmentId);
      expect(updated).toMatchObject({
        providerId: patient!.providerId,
        title: updatedTitle,
        eventDate: anchorDate,
        startTime: "11:00:00",
        endTime: "11:30:00",
        status: "-",
        facilityId: 10,
        billingLocationId: 10,
        room: "Monthly",
        categoryId: 9,
        categoryName: "Established Patient",
        recurrenceType: 1,
        repeatFrequency: 2,
        repeatUnit: 2,
        recurrenceEndDate: updatedEndDate
      });

      const updatedOccurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, anchorDate);
      const updatedMonthlyOccurrences = updatedOccurrences.filter((occurrence) => occurrence.title === updatedTitle);
      expect(updatedMonthlyOccurrences.map((occurrence) => occurrence.date)).toEqual(expectedUpdatedDates);
      expect(updatedMonthlyOccurrences.map((occurrence) => occurrence.occurrenceNumber)).toEqual([1, 2, 3, 4, 5]);
      expect(updatedMonthlyOccurrences.every((occurrence) => occurrence.repeatFrequency === 2)).toBe(true);
      expect(updatedMonthlyOccurrences.every((occurrence) => occurrence.repeatUnit === 2)).toBe(true);
    } finally {
      if (appointmentId !== null) {
        await workflow.deleteAppointment(appointmentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.appointments).toBe(beforeCounts.appointments);
    if (appointmentId !== null) {
      await expect(workflow.getAppointment(appointmentId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}