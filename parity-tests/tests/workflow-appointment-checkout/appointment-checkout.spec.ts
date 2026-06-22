import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";

test.describe("appointment check-out parity @slice95 @workflow-appointment-checkout @mutation", () => {
  test("moves a scheduled appointment through arrival to checked out, renders it, and removes it", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Checkout ${workflowSuffix()}`;
    const arrivedTitle = `${title} Arrived`;
    const checkedOutTitle = `${title} Checked Out`;
    let appointmentId: number | string | null = null;

    try {
      appointmentId = await workflow.createAppointment({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-11-05",
        startTime: "11:00:00",
        endTime: "11:30:00",
        durationSeconds: 1800,
        homeText: "Created by the appointment check-out suite.",
        facilityId: 10,
        billingLocationId: 10,
        room: "Checkout"
      });

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-11-05",
        startTime: "11:00:00",
        endTime: "11:30:00",
        status: "-",
        room: "Checkout"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);

      if (target.type === "legacy-openemr") {
        await workflow.updateAppointmentStatus(appointmentId, "@", arrivedTitle);
        const arrived = await workflow.getAppointment(appointmentId);
        expect(arrived).toMatchObject({
          title: arrivedTitle,
          status: "@"
        });

        await workflow.updateAppointmentStatus(appointmentId, ">", checkedOutTitle);
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-11-05");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();

        await page.getByRole("button", { name: "Mark arrived" }).click();
        await expect(page.getByRole("heading", { name: arrivedTitle })).toBeVisible();
        await expect(page.getByRole("button", { name: "Mark arrived" })).toBeDisabled();

        await page.getByRole("button", { name: "Mark checked out" }).click();
        await expect(page.getByRole("heading", { name: checkedOutTitle })).toBeVisible();
        await expect(page.getByRole("button", { name: "Mark checked out" })).toBeDisabled();
      }

      const checkedOut = await workflow.getAppointment(appointmentId);
      expect(checkedOut).toMatchObject({
        title: checkedOutTitle,
        eventDate: "2026-11-05",
        startTime: "11:00:00",
        endTime: "11:30:00",
        status: ">",
        room: "Checkout"
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(checkedOutTitle);
        await expect(page.locator('select[name="form_apptstatus"]')).toHaveValue(">");
      } else {
        await expect(page.locator("body")).toContainText("Checkout");
        await expect(page.locator("body")).toContainText("2026-11-05");
        await expect(page.locator("body")).toContainText("11:00");
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