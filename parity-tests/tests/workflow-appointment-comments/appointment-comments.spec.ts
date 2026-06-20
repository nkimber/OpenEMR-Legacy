import { test, expect } from "../../src/fixtures/parityTest.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";

test.describe("appointment comments parity @slice102 @workflow-appointment-comments @mutation", () => {
  test("creates, updates comments, renders, and removes a future appointment", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Comments ${workflowSuffix()}`;
    const updatedTitle = `${title} Updated`;
    const initialComments = "Initial parity scheduling comments for front desk review.";
    const updatedComments = "Updated parity scheduling comments: bring referral packet and lab printout.";
    let appointmentId: number | string | null = null;

    try {
      appointmentId = await workflow.createAppointment({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-12-24",
        startTime: "08:30:00",
        endTime: "09:00:00",
        durationSeconds: 1800,
        homeText: initialComments,
        facilityId: 10,
        billingLocationId: 10,
        room: "Comments",
        categoryId: 9
      });

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-12-24",
        startTime: "08:30:00",
        endTime: "09:00:00",
        status: "-",
        facilityId: 10,
        billingLocationId: 10,
        room: "Comments",
        categoryId: 9,
        homeText: initialComments
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);

      if (target.type === "legacy-openemr") {
        await workflow.updateAppointment(appointmentId, {
          providerId: patient!.providerId,
          title: updatedTitle,
          eventDate: "2026-12-24",
          startTime: "08:30:00",
          endTime: "09:00:00",
          durationSeconds: 1800,
          homeText: updatedComments,
          facilityId: 10,
          billingLocationId: 10,
          room: "Comments",
          status: "-",
          categoryId: 9
        });

        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(updatedTitle);
        await expect(page.locator('input[name="form_comments"]')).toHaveValue(updatedComments);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Calendar" }).click();
        await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
        await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-12-24");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        await expect(page.getByLabel("Edit appointment comments")).toHaveValue(initialComments);

        await page.getByLabel("Edit appointment title").fill(updatedTitle);
        await page.getByLabel("Edit appointment comments").fill(updatedComments);
        await page.getByRole("button", { name: "Save schedule" }).click();
        await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
        await expect(page.getByLabel("Edit appointment comments")).toHaveValue(updatedComments);
        await expect(page.locator("body")).toContainText(updatedComments);
      }

      const updated = await workflow.getAppointment(appointmentId);
      expect(updated).toMatchObject({
        providerId: patient!.providerId,
        title: updatedTitle,
        eventDate: "2026-12-24",
        startTime: "08:30:00",
        endTime: "09:00:00",
        status: "-",
        facilityId: 10,
        billingLocationId: 10,
        room: "Comments",
        categoryId: 9,
        categoryName: "Established Patient",
        homeText: updatedComments
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
