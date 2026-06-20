import { test, expect } from "../../src/fixtures/parityTest.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";

test.describe("appointment no-show parity @slice96 @workflow-appointment-noshow @mutation", () => {
  test("marks a scheduled future appointment as no-show, renders it, and removes it", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity No Show ${workflowSuffix()}`;
    const noShowTitle = `${title} No Show`;
    let appointmentId: number | string | null = null;

    try {
      appointmentId = await workflow.createAppointment({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-11-12",
        startTime: "13:00:00",
        endTime: "13:30:00",
        durationSeconds: 1800,
        homeText: "Created by the appointment no-show suite.",
        facilityId: 10,
        billingLocationId: 10,
        room: "NoShow"
      });

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-11-12",
        startTime: "13:00:00",
        endTime: "13:30:00",
        status: "-",
        room: "NoShow"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);

      if (target.type === "legacy-openemr") {
        await workflow.updateAppointmentStatus(appointmentId, "?", noShowTitle);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Calendar" }).click();
        await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
        await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-11-12");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();

        await page.getByRole("button", { name: "Mark no-show" }).click();
        await expect(page.getByRole("heading", { name: noShowTitle })).toBeVisible();
        await expect(page.getByRole("button", { name: "Mark no-show" })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Mark arrived" })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Mark checked out" })).toBeDisabled();
      }

      const noShow = await workflow.getAppointment(appointmentId);
      expect(noShow).toMatchObject({
        title: noShowTitle,
        eventDate: "2026-11-12",
        startTime: "13:00:00",
        endTime: "13:30:00",
        status: "?",
        room: "NoShow"
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(noShowTitle);
        await expect(page.locator('select[name="form_apptstatus"]')).toHaveValue("?");
      } else {
        await expect(page.locator("body")).toContainText("?");
        await expect(page.locator("body")).toContainText("NoShow");
        await expect(page.locator("body")).toContainText("2026-11-12");
        await expect(page.locator("body")).toContainText("13:00");
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
