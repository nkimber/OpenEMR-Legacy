import { test, expect } from "../../src/fixtures/parityTest.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";

test.describe("appointment provider reassignment parity @slice99 @workflow-appointment-provider @mutation", () => {
  test("creates, reassigns provider, renders, and removes a future appointment", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Provider ${workflowSuffix()}`;
    const reassignedTitle = `${title} Reassigned`;
    const reassignedProviderId = patient!.providerId === 101 ? 102 : 101;
    let appointmentId: number | string | null = null;

    try {
      appointmentId = await workflow.createAppointment({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-12-03",
        startTime: "11:45:00",
        endTime: "12:15:00",
        durationSeconds: 1800,
        homeText: "Created by the appointment provider reassignment suite.",
        facilityId: 10,
        billingLocationId: 10,
        room: "Provider",
        categoryId: 9
      });

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-12-03",
        startTime: "11:45:00",
        endTime: "12:15:00",
        status: "-",
        room: "Provider",
        categoryId: 9
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);

      if (target.type === "legacy-openemr") {
        await workflow.updateAppointment(appointmentId, {
          providerId: reassignedProviderId,
          title: reassignedTitle,
          eventDate: "2026-12-03",
          startTime: "11:45:00",
          endTime: "12:15:00",
          durationSeconds: 1800,
          homeText: "Updated by the appointment provider reassignment suite.",
          facilityId: 10,
          billingLocationId: 10,
          room: "Provider",
          status: "-",
          categoryId: 9
        });

        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(reassignedTitle);
        await expect(page.locator("#provd")).toHaveValue(String(reassignedProviderId));
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Calendar" }).click();
        await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
        await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-12-03");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        await expect(page.getByLabel("Edit appointment provider ID")).toHaveValue(String(patient!.providerId));

        await page.getByLabel("Edit appointment title").fill(reassignedTitle);
        await page.getByLabel("Edit appointment provider ID").fill(String(reassignedProviderId));
        await page.getByRole("button", { name: "Save schedule" }).click();
        await expect(page.getByRole("heading", { name: reassignedTitle })).toBeVisible();
        await expect(page.getByLabel("Edit appointment provider ID")).toHaveValue(String(reassignedProviderId));
        await expect(page.locator("body")).toContainText(`(${reassignedProviderId})`);
      }

      const reassigned = await workflow.getAppointment(appointmentId);
      expect(reassigned).toMatchObject({
        providerId: reassignedProviderId,
        title: reassignedTitle,
        eventDate: "2026-12-03",
        startTime: "11:45:00",
        endTime: "12:15:00",
        status: "-",
        room: "Provider",
        categoryId: 9,
        categoryName: "Established Patient"
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
