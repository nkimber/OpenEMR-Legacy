import { test, expect } from "../../src/fixtures/parityTest.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";

test.describe("appointment arrival parity @slice94 @workflow-appointment-arrival @mutation", () => {
  test("marks a scheduled future appointment as arrived, renders it, and removes it", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Arrival ${workflowSuffix()}`;
    const arrivedTitle = `${title} Arrived`;
    let appointmentId: number | string | null = null;

    try {
      appointmentId = await workflow.createAppointment({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-10-29",
        startTime: "09:00:00",
        endTime: "09:30:00",
        durationSeconds: 1800,
        homeText: "Created by the appointment arrival suite.",
        facilityId: 10,
        billingLocationId: 10,
        room: "Arrival"
      });

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-10-29",
        startTime: "09:00:00",
        endTime: "09:30:00",
        status: "-",
        room: "Arrival"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);

      if (target.type === "legacy-openemr") {
        await workflow.updateAppointmentStatus(appointmentId, "@", arrivedTitle);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Calendar" }).click();
        await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
        await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-10-29");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        await expect(page.locator("body")).toContainText("-");

        await page.getByRole("button", { name: "Mark arrived" }).click();
        await expect(page.getByRole("heading", { name: arrivedTitle })).toBeVisible();
        await expect(page.getByRole("button", { name: "Mark arrived" })).toBeDisabled();
      }

      const arrived = await workflow.getAppointment(appointmentId);
      expect(arrived).toMatchObject({
        title: arrivedTitle,
        eventDate: "2026-10-29",
        startTime: "09:00:00",
        endTime: "09:30:00",
        status: "@",
        room: "Arrival"
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(arrivedTitle);
        await expect(page.locator('select[name="form_apptstatus"]')).toHaveValue("@");
      } else {
        await expect(page.locator("body")).toContainText("@");
        await expect(page.locator("body")).toContainText("Arrival");
        await expect(page.locator("body")).toContainText("2026-10-29");
        await expect(page.locator("body")).toContainText("09:00");
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
