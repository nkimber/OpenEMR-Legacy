import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalAppointmentAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal appointment request parity @slice220 @workflow-patient-portal-appointment-request @patients @portal @appointments @mutation", () => {
  test("creates a pending portal appointment request and provider reminder", async ({
    targetDb,
    workflow
  }) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalAppointmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const requestReason = `Portal appointment request parity ${Date.now()}`;
    let appointmentId: number | string | null = null;
    let reminderId: number | string | null = null;

    try {
      const result = await workflow.requestPatientPortalAppointment(portalLoginUsername, portalPassword, {
        providerId: 105,
        facilityId: 11,
        categoryId: 9,
        date: "2026-09-22",
        startTime: "09:30",
        durationMinutes: 30,
        reason: requestReason
      });

      expect(result).toMatchObject({
        authenticated: true,
        created: true,
        username: portalLoginUsername,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        failureReason: null
      });
      expect(result.appointment).toMatchObject({
        date: "2026-09-22",
        startTime: "09:30",
        title: "Established Patient",
        status: "^",
        categoryId: 9,
        categoryName: "Established Patient",
        comments: requestReason
      });
      expect(result.reminder).toMatchObject({
        title: "Patient Reminders",
        status: "New"
      });
      expect(result.reminder?.body).toContain("A New Appointment request was received from portal patient");
      expect(result.reminder?.body).toContain("2026-09-22 09:30:00");
      expect(result.reminder?.body).toContain(requestReason);

      appointmentId = result.appointment!.id;
      reminderId = result.reminder!.id;

      const appointment = await workflow.getAppointment(appointmentId);
      expect(appointment).toMatchObject({
        patientId: patient!.pid,
        providerId: 105,
        eventDate: "2026-09-22",
        startTime: "09:30:00",
        endTime: "10:00:00",
        status: "^",
        categoryId: 9,
        homeText: requestReason
      });

      const reminder = await workflow.getPatientMessage(reminderId);
      expect(reminder).toMatchObject({
        patientId: patient!.pid,
        title: "Patient Reminders",
        status: "New"
      });
      expect(reminder?.body).toContain(requestReason);

      const appointments = await workflow.getPatientPortalAppointments(portalLoginUsername, portalPassword);
      expect(appointments.upcomingAppointments.some((item) => item.id === String(appointmentId))).toBe(true);
    } finally {
      if (appointmentId !== null) {
        await workflow.deleteAppointment(appointmentId);
      }
      if (reminderId !== null) {
        await workflow.deletePatientMessage(reminderId);
      }
    }
  });

  test("renders a newly requested appointment on the portal surface", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    test.setTimeout(120_000);

    const requestReason = `Portal appointment request UI ${Date.now()}`;

    try {
      if (target.type === "legacy-openemr") {
        await workflow.requestPatientPortalAppointment(portalLoginUsername, portalPassword, {
          providerId: 105,
          facilityId: 11,
          categoryId: 9,
          date: "2026-09-22",
          startTime: "09:30",
          durationMinutes: 30,
          reason: requestReason
        });
        await expectLegacyPatientPortalRequestedAppointment(page, target);
        return;
      }

      await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
      const appointmentsRegion = page.getByRole("region", { name: "Patient portal appointments" });
      await appointmentsRegion.getByLabel("Portal appointment date").fill("2026-09-22");
      await appointmentsRegion.getByLabel("Portal appointment time").fill("09:30");
      await appointmentsRegion.getByLabel("Portal appointment visit").selectOption("9");
      await appointmentsRegion.getByLabel("Portal appointment duration").fill("30");
      await appointmentsRegion.getByLabel("Portal appointment provider ID").fill("105");
      await appointmentsRegion.getByLabel("Portal appointment facility ID").fill("11");
      await appointmentsRegion.getByLabel("Portal appointment reason").fill(requestReason);
      await appointmentsRegion.getByRole("button", { name: "Request appointment" }).click();

      await expect(page.locator("body")).toContainText("Appointment request created");
      await expect(appointmentsRegion).toContainText("Established Patient");
      await expect(appointmentsRegion).toContainText("2026-09-22 09:30");
      await expect(appointmentsRegion).toContainText("^");
    } finally {
      await cleanupRequestedAppointment(targetDb, target, requestReason);
    }
  });
});

async function expectLegacyPatientPortalRequestedAppointment(page: Page, target: RuntimeTarget) {
  await page.context().clearCookies();
  await page.goto(`${target.publicUrl}/portal/index.php?site=default&woops=1`);
  await page.locator("#uname").fill(portalLoginUsername);
  await page.locator("#pass").fill(portalPassword);

  const emailConfirmation = page.locator("#passaddon");
  if ((await emailConfirmation.count()) > 0 && await emailConfirmation.isVisible()) {
    await emailConfirmation.fill(portalLoginUsername);
  }

  await page.getByRole("button", { name: "Log In" }).click();
  await expect.poll(() => page.url()).toContain("/portal/home.php");
  await page.locator("#appointments-go").click();
  await expectRenderedText(page, /Future Appointments/i);
  await expect(page.locator("body")).toContainText("Established Patient");
  await expect(page.locator("body")).toContainText("2026-09-22");
}

async function cleanupRequestedAppointment(
  targetDb: { execute(sql: string): Promise<void> },
  target: RuntimeTarget,
  requestReason: string
) {
  if (target.type === "legacy-openemr") {
    await targetDb.execute(`DELETE FROM pnotes WHERE body LIKE '%${requestReason}%';`);
    await targetDb.execute(`DELETE FROM openemr_postcalendar_events WHERE pc_hometext = '${requestReason}';`);
    return;
  }

  await targetDb.execute(`DELETE FROM messages WHERE body LIKE '%${requestReason}%';`);
  await targetDb.execute(`DELETE FROM appointments WHERE comments = '${requestReason}';`);
}
