import { test, expect } from "../../src/fixtures/parityTest.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";
const serviceFacilityId = 10;
const originalBillingLocationId = 10;
const reassignedBillingLocationId = 11;

test.describe("appointment billing-location reassignment parity @slice101 @workflow-appointment-billing-location @mutation", () => {
  test("creates, reassigns billing location, renders, and removes a future appointment", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Billing Location ${workflowSuffix()}`;
    const reassignedTitle = `${title} Reassigned`;
    let appointmentId: number | string | null = null;

    try {
      appointmentId = await workflow.createAppointment({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-12-17",
        startTime: "09:15:00",
        endTime: "09:45:00",
        durationSeconds: 1800,
        homeText: "Created by the appointment billing-location reassignment suite.",
        facilityId: serviceFacilityId,
        billingLocationId: originalBillingLocationId,
        room: "BillingLoc",
        categoryId: 9
      });

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-12-17",
        startTime: "09:15:00",
        endTime: "09:45:00",
        status: "-",
        facilityId: serviceFacilityId,
        billingLocationId: originalBillingLocationId,
        room: "BillingLoc",
        categoryId: 9
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);

      if (target.type === "legacy-openemr") {
        await workflow.updateAppointment(appointmentId, {
          providerId: patient!.providerId,
          title: reassignedTitle,
          eventDate: "2026-12-17",
          startTime: "09:15:00",
          endTime: "09:45:00",
          durationSeconds: 1800,
          homeText: "Updated by the appointment billing-location reassignment suite.",
          facilityId: serviceFacilityId,
          billingLocationId: reassignedBillingLocationId,
          room: "BillingLoc",
          status: "-",
          categoryId: 9
        });

        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(reassignedTitle);
        await expect(page.locator("#facility")).toHaveValue(String(serviceFacilityId));
        await expect(page.locator("#billing_facility")).toHaveValue(String(reassignedBillingLocationId));
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Calendar" }).click();
        await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
        await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-12-17");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        await expect(page.getByLabel("Edit appointment facility ID")).toHaveValue(String(serviceFacilityId));
        await expect(page.getByLabel("Edit appointment billing facility ID")).toHaveValue(String(originalBillingLocationId));

        await page.getByLabel("Edit appointment title").fill(reassignedTitle);
        await page.getByLabel("Edit appointment billing facility ID").fill(String(reassignedBillingLocationId));
        await page.getByRole("button", { name: "Save schedule" }).click();
        await expect(page.getByRole("heading", { name: reassignedTitle })).toBeVisible();
        await expect(page.getByLabel("Edit appointment facility ID")).toHaveValue(String(serviceFacilityId));
        await expect(page.getByLabel("Edit appointment billing facility ID")).toHaveValue(String(reassignedBillingLocationId));
        await expect(page.locator("body")).toContainText("Billing facility");
      }

      const reassigned = await workflow.getAppointment(appointmentId);
      expect(reassigned).toMatchObject({
        providerId: patient!.providerId,
        title: reassignedTitle,
        eventDate: "2026-12-17",
        startTime: "09:15:00",
        endTime: "09:45:00",
        status: "-",
        facilityId: serviceFacilityId,
        billingLocationId: reassignedBillingLocationId,
        room: "BillingLoc",
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
