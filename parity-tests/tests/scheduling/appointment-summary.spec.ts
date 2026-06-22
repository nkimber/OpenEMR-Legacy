import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const schedulingAnchorPatientId = "MOD-PAT-0003";
const schedulingAnchorDate = "2026-06-18";

test.describe("scheduling appointment parity @slice2 @scheduling", () => {
  test("stable scheduling anchor has a future appointment fact", async ({ targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(schedulingAnchorPatientId);
    expect(patient).not.toBeNull();

    const appointment = await targetDb.getFutureAppointmentForPatient(patient!.pid, schedulingAnchorDate);
    expect(appointment).not.toBeNull();
    expect(appointment!.patientId).toBe(patient!.pid);
    expect(appointment!.eventDate > schedulingAnchorDate).toBe(true);
    expect(appointment!.title).toBeTruthy();
    expect(appointment!.startTime).toMatch(/^\d{2}:\d{2}/);
  });

  test("future appointment detail is visible in the application UI", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(schedulingAnchorPatientId);
    expect(patient).not.toBeNull();
    const appointment = await targetDb.getFutureAppointmentForPatient(patient!.pid, schedulingAnchorDate);
    expect(appointment).not.toBeNull();

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openAppointmentDirect(page, target, appointment!.id);

      await expect(page.locator('input[name="form_title"]')).toHaveValue(appointment!.title);
      await expect(page.locator('input[name="form_patient"]')).toHaveValue(`${patient!.lname}, ${patient!.fname}`);
      await expect(page.locator('input[name="form_date"]')).toHaveValue(appointment!.eventDate);
      await expect(page.locator('input[name="form_hour"]')).toHaveValue(appointment!.startTime.slice(0, 2));
      await expect(page.locator('input[name="form_minute"]')).toHaveValue(appointment!.startTime.slice(3, 5));
      await expect(page.locator('select[name="form_apptstatus"]')).toHaveValue(appointment!.status);
      return;
    }

    await openAuthenticatedModernizedCalendar(page, target);

    await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
    await page.getByLabel("Appointment from date").fill(schedulingAnchorDate);

    const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(appointment!.title), "i") }).first();
    await expect(appointmentButton).toBeVisible();
    await appointmentButton.click();

    await expect(page.getByRole("heading", { name: appointment!.title })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(`PID ${patient!.pid}`);
    await expect(page.locator("body")).toContainText(appointment!.eventDate);
    await expect(page.locator("body")).toContainText(appointment!.startTime.slice(0, 5));
    await expect(page.locator("body")).toContainText(appointment!.status);
  });
});

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}