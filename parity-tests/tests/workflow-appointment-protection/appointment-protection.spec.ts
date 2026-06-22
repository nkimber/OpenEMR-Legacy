import { test, expect } from "../../src/fixtures/parityTest.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";

const appointmentProtectionPatientId = "MOD-PAT-0003";
const appointmentProtectionFromDate = "2026-06-18";

test.describe("appointment schedule protection parity @slice167 @appointment-protection", () => {
  test("requires an active session before appointment schedules are visible", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentProtectionPatientId);
    expect(patient).not.toBeNull();

    const appointment = await targetDb.getFutureAppointmentForPatient(patient!.pid, appointmentProtectionFromDate);
    expect(appointment).not.toBeNull();

    if (target.type === "legacy-openemr") {
      await page.goto(`${target.publicUrl}/interface/main/calendar/add_edit_event.php?eid=${appointment!.id}`);
      await expect(page.locator("body")).not.toContainText(appointment!.title);

      await loginToLegacyOpenEmr(page, target);
      await openAppointmentDirect(page, target, appointment!.id);
      await expect(page.locator('input[name="form_title"]')).toHaveValue(appointment!.title);
      await expect(page.locator('input[name="form_patient"]')).toHaveValue(`${patient!.lname}, ${patient!.fname}`);
      await expect(page.locator('input[name="form_date"]')).toHaveValue(appointment!.eventDate);
      return;
    }

    const unauthenticatedSearch = await page.request.get(
      `${target.apiBaseUrl}/api/appointments?patientId=${encodeURIComponent(patient!.pubpid)}&from=${appointmentProtectionFromDate}&limit=5`
    );
    expect(unauthenticatedSearch.status()).toBe(401);
    const unauthenticatedSearchBody = await unauthenticatedSearch.json();
    expect(unauthenticatedSearchBody).toMatchObject({
      authenticated: false,
      sessionSource: "modernized-openemr"
    });

    const unauthenticatedCreate = await page.request.post(`${target.apiBaseUrl}/api/appointments`, {
      data: {
        patientId: patient!.pubpid,
        title: "Blocked Protection Appointment",
        date: "2026-11-17",
        startTime: "09:00",
        durationMinutes: 30,
        categoryId: 9,
        room: "Blocked"
      }
    });
    expect(unauthenticatedCreate.status()).toBe(401);

    const loginResponse = await page.request.post(`${target.apiBaseUrl}/api/auth/login`, {
      data: target.credentials
    });
    expect(loginResponse.ok()).toBeTruthy();
    const login = await loginResponse.json();
    expect(login.authenticated).toBe(true);
    expect(login.sessionId).toBeTruthy();

    const authenticatedSearch = await page.request.get(
      `${target.apiBaseUrl}/api/appointments?patientId=${encodeURIComponent(patient!.pubpid)}&from=${appointmentProtectionFromDate}&limit=5`,
      { headers: { "X-OpenEMR-Session": login.sessionId } }
    );
    expect(authenticatedSearch.ok()).toBeTruthy();
    const search = await authenticatedSearch.json();
    expect(search.appointments.some((item: { id: string; title: string }) => item.id === String(appointment!.id) && item.title === appointment!.title)).toBe(true);

    const authenticatedDetail = await page.request.get(
      `${target.apiBaseUrl}/api/appointments/${encodeURIComponent(String(appointment!.id))}`,
      { headers: { "X-OpenEMR-Session": login.sessionId } }
    );
    expect(authenticatedDetail.ok()).toBeTruthy();
    const detail = await authenticatedDetail.json();
    expect(detail).toMatchObject({
      id: String(appointment!.id),
      patientId: patient!.pubpid,
      legacyPid: patient!.pid,
      title: appointment!.title,
      date: appointment!.eventDate
    });

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Calendar" }).click();
    await expect(page.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible();
    await expect(page.locator("body")).toContainText("Sign in to load appointment schedules");
    await expect(page.locator(".appointment-list")).not.toContainText(appointment!.title);
    await expect(page.locator(".appointment-detail-panel")).not.toContainText(appointment!.title);
    await expect(page.getByLabel("Appointment patient ID")).toBeDisabled();
    await expect(page.locator('form[aria-label="Create appointment"]').getByRole("button", { name: "Create" })).toBeDisabled();

    await openAuthenticatedModernizedCalendar(page, target, patient!.pubpid, appointmentProtectionFromDate);
    const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(appointment!.title), "i") }).first();
    await expect(appointmentButton).toBeVisible();
    await appointmentButton.click();

    await expect(page.getByRole("heading", { name: appointment!.title })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(`PID ${patient!.pid}`);
    await expect(page.locator("body")).toContainText(appointment!.eventDate);
  });
});

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
