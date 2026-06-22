import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";
const initialEndDate = "2026-12-31";
const updatedEndDate = "2027-01-28";

test.describe("appointment recurrence parity @slice103 @workflow-appointment-recurrence @mutation", () => {
  test("creates, updates recurrence metadata, renders, and removes a future appointment", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Recurrence ${workflowSuffix()}`;
    const updatedTitle = `${title} Updated`;
    let appointmentId: number | string | null = null;

    try {
      appointmentId = await workflow.createAppointment({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-12-29",
        startTime: "10:00:00",
        endTime: "10:30:00",
        durationSeconds: 1800,
        homeText: "Created by the appointment recurrence suite.",
        facilityId: 10,
        billingLocationId: 10,
        room: "Repeat",
        categoryId: 9,
        recurrenceType: 1,
        repeatFrequency: 1,
        repeatUnit: 1,
        recurrenceEndDate: initialEndDate
      });

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-12-29",
        startTime: "10:00:00",
        endTime: "10:30:00",
        status: "-",
        facilityId: 10,
        billingLocationId: 10,
        room: "Repeat",
        categoryId: 9,
        recurrenceType: 1,
        repeatFrequency: 1,
        repeatUnit: 1,
        recurrenceEndDate: initialEndDate
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);

      if (target.type === "legacy-openemr") {
        await workflow.updateAppointment(appointmentId, {
          providerId: patient!.providerId,
          title: updatedTitle,
          eventDate: "2026-12-29",
          startTime: "10:00:00",
          endTime: "10:30:00",
          durationSeconds: 1800,
          homeText: "Updated by the appointment recurrence suite.",
          facilityId: 10,
          billingLocationId: 10,
          room: "Repeat",
          status: "-",
          categoryId: 9,
          recurrenceType: 1,
          repeatFrequency: 2,
          repeatUnit: 1,
          recurrenceEndDate: updatedEndDate
        });

        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(updatedTitle);
        await expect(page.locator('input[name="form_repeat"]')).toBeChecked();
        await expect(page.locator('select[name="form_repeat_freq"]')).toHaveValue("2");
        await expect(page.locator('select[name="form_repeat_type"]')).toHaveValue("1");
        await expect(page.locator('input[name="form_enddate"]')).toHaveValue(updatedEndDate);
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-12-29");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        await expect(page.getByLabel("Edit appointment repeats")).toBeChecked();
        await expect(page.getByLabel("Edit appointment repeat frequency")).toHaveValue("1");
        await expect(page.getByLabel("Edit appointment repeat unit")).toHaveValue("1");
        await expect(page.getByLabel("Edit appointment recurrence end date")).toHaveValue(initialEndDate);

        await page.getByLabel("Edit appointment title").fill(updatedTitle);
        await page.getByLabel("Edit appointment repeat frequency").fill("2");
        await page.getByLabel("Edit appointment recurrence end date").fill(updatedEndDate);
        await page.getByRole("button", { name: "Save schedule" }).click();
        await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
        await expect(page.getByLabel("Edit appointment repeat frequency")).toHaveValue("2");
        await expect(page.getByLabel("Edit appointment recurrence end date")).toHaveValue(updatedEndDate);
        await expect(page.locator("body")).toContainText(`Every 2 weeks until ${updatedEndDate}`);
      }

      const updated = await workflow.getAppointment(appointmentId);
      expect(updated).toMatchObject({
        providerId: patient!.providerId,
        title: updatedTitle,
        eventDate: "2026-12-29",
        startTime: "10:00:00",
        endTime: "10:30:00",
        status: "-",
        facilityId: 10,
        billingLocationId: 10,
        room: "Repeat",
        categoryId: 9,
        categoryName: "Established Patient",
        recurrenceType: 1,
        repeatFrequency: 2,
        repeatUnit: 1,
        recurrenceEndDate: updatedEndDate
      });
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