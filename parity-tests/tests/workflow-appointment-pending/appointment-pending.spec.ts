import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";

test.describe("appointment pending-status parity @slice98 @workflow-appointment-pending @mutation", () => {
  test("marks a scheduled future appointment as pending, renders it, and removes it", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Pending ${workflowSuffix()}`;
    const pendingTitle = `${title} Pending`;
    let appointmentId: number | string | null = null;

    try {
      appointmentId = await workflow.createAppointment({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-11-26",
        startTime: "10:45:00",
        endTime: "11:15:00",
        durationSeconds: 1800,
        homeText: "Created by the appointment pending-status suite.",
        facilityId: 10,
        billingLocationId: 10,
        room: "Pending"
      });

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-11-26",
        startTime: "10:45:00",
        endTime: "11:15:00",
        status: "-",
        room: "Pending"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);

      if (target.type === "legacy-openemr") {
        await workflow.updateAppointment(appointmentId, {
          providerId: patient!.providerId,
          title: pendingTitle,
          eventDate: "2026-11-26",
          startTime: "10:45:00",
          endTime: "11:15:00",
          durationSeconds: 1800,
          homeText: "Updated by the appointment pending-status suite.",
          facilityId: 10,
          billingLocationId: 10,
          room: "Pending",
          status: "~"
        });
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-11-26");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        await expect(page.getByLabel("Edit appointment status")).toHaveValue("-");

        await page.getByLabel("Edit appointment title").fill(pendingTitle);
        await page.getByLabel("Edit appointment status").selectOption("~");
        await page.getByRole("button", { name: "Save schedule" }).click();
        await expect(page.getByRole("heading", { name: pendingTitle })).toBeVisible();
        await expect(page.getByLabel("Edit appointment status")).toHaveValue("~");
      }

      const pending = await workflow.getAppointment(appointmentId);
      expect(pending).toMatchObject({
        title: pendingTitle,
        eventDate: "2026-11-26",
        startTime: "10:45:00",
        endTime: "11:15:00",
        status: "~",
        room: "Pending"
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(pendingTitle);
        await expect(page.locator('select[name="form_apptstatus"]')).toHaveValue("~");
      } else {
        await expect(page.locator("body")).toContainText("~");
        await expect(page.locator("body")).toContainText("Pending");
        await expect(page.locator("body")).toContainText("2026-11-26");
        await expect(page.locator("body")).toContainText("10:45");
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