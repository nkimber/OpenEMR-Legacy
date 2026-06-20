import { test, expect } from "../../src/fixtures/parityTest.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";

test.describe("appointment category parity @slice97 @workflow-appointment-category @mutation", () => {
  test("creates, renders, updates, and removes a categorized future appointment", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Category ${workflowSuffix()}`;
    let appointmentId: number | string | null = null;

    try {
      appointmentId = await workflow.createAppointment({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-11-19",
        startTime: "09:15:00",
        endTime: "09:45:00",
        durationSeconds: 1800,
        homeText: "Created by the appointment category suite.",
        facilityId: 10,
        billingLocationId: 10,
        room: "Category",
        categoryId: 13
      });

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-11-19",
        startTime: "09:15:00",
        endTime: "09:45:00",
        status: "-",
        room: "Category",
        categoryId: 13,
        categoryName: "Preventive Care Services"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(title);
        await expect(page.locator("#form_category")).toHaveValue("13");

        await workflow.updateAppointment(appointmentId, {
          providerId: patient!.providerId,
          title,
          eventDate: "2026-11-19",
          startTime: "09:15:00",
          endTime: "09:45:00",
          durationSeconds: 1800,
          homeText: "Updated by the appointment category suite.",
          facilityId: 10,
          billingLocationId: 10,
          room: "Category",
          status: "-",
          categoryId: 10
        });

        await openAppointmentDirect(page, target, appointmentId);
        await expect(page.locator("#form_category")).toHaveValue("10");
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Calendar" }).click();
        await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
        await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-11-19");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        await expect(page.locator("body")).toContainText("Preventive Care Services");
        await expect(page.getByLabel("Edit appointment category")).toHaveValue("13");

        await page.getByLabel("Edit appointment category").selectOption("10");
        await page.getByRole("button", { name: "Save schedule" }).click();
        await expect(page.getByLabel("Edit appointment category")).toHaveValue("10");
        await expect(page.locator("body")).toContainText("New Patient (10)");
      }

      const updated = await workflow.getAppointment(appointmentId);
      expect(updated).toMatchObject({
        title,
        eventDate: "2026-11-19",
        startTime: "09:15:00",
        endTime: "09:45:00",
        status: "-",
        room: "Category",
        categoryId: 10,
        categoryName: "New Patient"
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
