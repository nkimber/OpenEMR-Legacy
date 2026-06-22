import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";
const originalFacilityId = 10;
const reassignedFacilityId = 11;

test.describe("appointment facility reassignment parity @slice100 @workflow-appointment-facility @mutation", () => {
  test("creates, reassigns facility, renders, and removes a future appointment", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Facility ${workflowSuffix()}`;
    const reassignedTitle = `${title} Reassigned`;
    let appointmentId: number | string | null = null;

    try {
      appointmentId = await workflow.createAppointment({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-12-10",
        startTime: "10:00:00",
        endTime: "10:30:00",
        durationSeconds: 1800,
        homeText: "Created by the appointment facility reassignment suite.",
        facilityId: originalFacilityId,
        billingLocationId: originalFacilityId,
        room: "Facility",
        categoryId: 9
      });

      const created = await workflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-12-10",
        startTime: "10:00:00",
        endTime: "10:30:00",
        status: "-",
        facilityId: originalFacilityId,
        room: "Facility",
        categoryId: 9
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);

      if (target.type === "legacy-openemr") {
        await workflow.updateAppointment(appointmentId, {
          providerId: patient!.providerId,
          title: reassignedTitle,
          eventDate: "2026-12-10",
          startTime: "10:00:00",
          endTime: "10:30:00",
          durationSeconds: 1800,
          homeText: "Updated by the appointment facility reassignment suite.",
          facilityId: reassignedFacilityId,
          billingLocationId: reassignedFacilityId,
          room: "Facility",
          status: "-",
          categoryId: 9
        });

        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);

        await expect(page.locator('input[name="form_title"]')).toHaveValue(reassignedTitle);
        await expect(page.locator("#facility")).toHaveValue(String(reassignedFacilityId));
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
        await page.getByLabel("Appointment from date").fill("2026-12-10");

        const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
        await expect(appointmentButton).toBeVisible();
        await appointmentButton.click();
        await expect(page.getByRole("heading", { name: title })).toBeVisible();
        await expect(page.getByLabel("Edit appointment facility ID")).toHaveValue(String(originalFacilityId));

        await page.getByLabel("Edit appointment title").fill(reassignedTitle);
        await page.getByLabel("Edit appointment facility ID").fill(String(reassignedFacilityId));
        await page.getByRole("button", { name: "Save schedule" }).click();
        await expect(page.getByRole("heading", { name: reassignedTitle })).toBeVisible();
        await expect(page.getByLabel("Edit appointment facility ID")).toHaveValue(String(reassignedFacilityId));
        await expect(page.locator("body")).toContainText(`(${reassignedFacilityId})`);
      }

      const reassigned = await workflow.getAppointment(appointmentId);
      expect(reassigned).toMatchObject({
        providerId: patient!.providerId,
        title: reassignedTitle,
        eventDate: "2026-12-10",
        startTime: "10:00:00",
        endTime: "10:30:00",
        status: "-",
        facilityId: reassignedFacilityId,
        billingLocationId: reassignedFacilityId,
        room: "Facility",
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