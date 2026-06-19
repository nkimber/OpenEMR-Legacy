import { test, expect } from "../../src/fixtures/parityTest.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";

test.describe("appointment mutation parity @slice11 @workflow-appointments @mutation", () => {
  test("creates, cancels, renders, and removes a future appointment", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Appointment ${workflowSuffix()}`;
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
        homeText: "Created by the parity appointment mutation suite.",
        facilityId: 10,
        billingLocationId: 10,
        room: "Parity"
      });

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-10-15",
        startTime: "10:30:00",
        endTime: "11:00:00",
        status: "-"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);

      const cancelledTitle = `${title} Cancelled`;
      await workflow.updateAppointmentStatus(appointmentId, "x", cancelledTitle);
      const cancelled = await workflow.getAppointment(appointmentId);
      expect(cancelled).toMatchObject({
        title: cancelledTitle,
        status: "x"
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(cancelledTitle);
        await expect(page.locator('select[name="form_apptstatus"]')).toHaveValue("x");
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Calendar" }).click();
        await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
        await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-10-15");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(cancelledTitle), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: cancelledTitle })).toBeVisible();
        await expect(page.locator("body")).toContainText("x");
        await expect(page.locator("body")).toContainText("Parity");
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
