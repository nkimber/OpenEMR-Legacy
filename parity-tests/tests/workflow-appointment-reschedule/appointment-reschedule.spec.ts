import { test, expect } from "../../src/fixtures/parityTest.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";

test.describe("appointment reschedule parity @slice93 @workflow-appointment-reschedule @mutation", () => {
  test("reschedules, renders, and removes a future appointment", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Reschedule ${workflowSuffix()}`;
    const rescheduledTitle = `${title} Updated`;
    let appointmentId: number | string | null = null;

    try {
      appointmentId = await workflow.createAppointment({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-10-15",
        startTime: "10:30:00",
        endTime: "11:00:00",
        durationSeconds: 1800,
        homeText: "Created by the appointment reschedule suite.",
        facilityId: 10,
        billingLocationId: 10,
        room: "Parity"
      });

      await workflow.updateAppointment(appointmentId, {
        providerId: patient!.providerId,
        title: rescheduledTitle,
        eventDate: "2026-10-22",
        startTime: "14:15:00",
        endTime: "15:00:00",
        durationSeconds: 2700,
        homeText: "Rescheduled by the appointment reschedule suite.",
        facilityId: 10,
        billingLocationId: 10,
        room: "Resched",
        status: "@"
      });

      const updated = await workflow.getAppointment(appointmentId);
      expect(updated).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title: rescheduledTitle,
        eventDate: "2026-10-22",
        startTime: "14:15:00",
        endTime: "15:00:00",
        status: "@",
        room: "Resched"
      });

      const afterUpdateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterUpdateCounts.appointments).toBe(beforeCounts.appointments + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(rescheduledTitle);
        await expect(page.locator('select[name="form_apptstatus"]')).toHaveValue("@");
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Calendar" }).click();
        await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
        await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-10-22");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(rescheduledTitle), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: rescheduledTitle })).toBeVisible();
        await expect(page.locator("body")).toContainText("2026-10-22");
        await expect(page.locator("body")).toContainText("14:15");
        await expect(page.locator("body")).toContainText("45 minutes");
        await expect(page.locator("body")).toContainText("Resched");
        await expect(page.locator("body")).toContainText("@");
      }
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
