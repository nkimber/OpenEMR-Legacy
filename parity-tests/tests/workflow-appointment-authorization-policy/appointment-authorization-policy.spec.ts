import { test, expect } from "../../src/fixtures/parityTest.js";
import { requestText } from "../../src/http/httpClient.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";

const appointmentAuthorizationPatientId = "MOD-PAT-0003";
const appointmentAuthorizationFromDate = "2026-06-18";

type ModernizedLoginResponse = {
  authenticated: boolean;
  username: string;
  displayName: string;
  role: string;
  staffId?: number | null;
  sessionId?: string | null;
};

type AppointmentSearchResponse = {
  appointments: Array<{
    id: string;
    title: string;
    patientId: string;
    legacyPid: number;
    date: string;
  }>;
};

type AppointmentDetailResponse = {
  id: string;
  title: string;
  patientId: string;
  legacyPid: number;
  date: string;
};

test.describe("appointment authorization policy parity @workflow-appointment-authorization-policy @slice176 @appointments @security", () => {
  test("honors Appointment ACL access for appointment APIs and UI", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAuthorizationPatientId);
    expect(patient).not.toBeNull();

    const appointment = await targetDb.getFutureAppointmentForPatient(patient!.pid, appointmentAuthorizationFromDate);
    expect(appointment).not.toBeNull();

    const accessControl = await targetDb.getAdministrationAccessControl();
    expect(accessControl.groupPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "admin",
          sectionValue: "patients",
          permissionValue: "appt",
          returnValue: "write"
        }),
        expect.objectContaining({
          groupValue: "front",
          sectionValue: "patients",
          permissionValue: "appt",
          returnValue: "write"
        })
      ])
    );

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openAppointmentDirect(page, target, appointment!.id);
      await expect(page.locator('input[name="form_title"]')).toHaveValue(appointment!.title);
      await expect(page.locator('input[name="form_patient"]')).toHaveValue(`${patient!.lname}, ${patient!.fname}`);
      await expect(page.locator('input[name="form_date"]')).toHaveValue(appointment!.eventDate);
      return;
    }

    expect(accessControl.userMemberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userValue: "gold-frontdesk-01",
          groupValue: "front",
          groupName: "Front Office"
        })
      ])
    );

    const frontDeskLogin = await modernizedLogin(target, "gold-frontdesk-01", "pass");
    expect(frontDeskLogin).toMatchObject({
      authenticated: true,
      username: "gold-frontdesk-01",
      displayName: "Parker Fleming",
      role: "frontdesk",
      staffId: 117
    });
    expect(frontDeskLogin.sessionId).toMatch(/^[0-9a-f-]{36}$/i);

    const frontDeskSearch = await requestText(
      `${target.apiBaseUrl}/api/appointments?patientId=${encodeURIComponent(patient!.pubpid)}&from=${appointmentAuthorizationFromDate}&limit=5`,
      {
        headers: {
          "X-OpenEMR-Session": frontDeskLogin.sessionId!
        }
      }
    );
    expect(frontDeskSearch.statusCode).toBe(200);
    const search = JSON.parse(frontDeskSearch.body) as AppointmentSearchResponse;
    expect(search.appointments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: String(appointment!.id),
          title: appointment!.title,
          patientId: patient!.pubpid,
          legacyPid: patient!.pid,
          date: appointment!.eventDate
        })
      ])
    );

    const frontDeskDetail = await requestText(`${target.apiBaseUrl}/api/appointments/${encodeURIComponent(String(appointment!.id))}`, {
      headers: {
        "X-OpenEMR-Session": frontDeskLogin.sessionId!
      }
    });
    expect(frontDeskDetail.statusCode).toBe(200);
    const detail = JSON.parse(frontDeskDetail.body) as AppointmentDetailResponse;
    expect(detail).toMatchObject({
      id: String(appointment!.id),
      title: appointment!.title,
      patientId: patient!.pubpid,
      legacyPid: patient!.pid,
      date: appointment!.eventDate
    });

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Calendar" }).click();
    await expect(page.getByRole("heading", { name: "Calendar", exact: true })).toBeVisible();

    const accessPanel = page.locator('form[aria-label="Calendar access"]');
    await accessPanel.getByLabel("Username").fill("gold-frontdesk-01");
    await accessPanel.getByLabel("Password").fill("pass");
    await accessPanel.getByRole("button", { name: "Verify Calendar Access" }).click();

    await expect(page.locator("body")).toContainText("Signed in as Parker Fleming");
    await expect(page.locator("body")).not.toContainText("Sign in to load appointment schedules");

    await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
    await page.getByLabel("Appointment from date").fill(appointmentAuthorizationFromDate);

    const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(appointment!.title), "i") }).first();
    await expect(appointmentButton).toBeVisible();
    await appointmentButton.click();

    await expect(page.getByRole("heading", { name: appointment!.title })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(`PID ${patient!.pid}`);
    await expect(page.locator("body")).toContainText(appointment!.eventDate);
  });
});

async function modernizedLogin(target: RuntimeTarget, username: string, password: string): Promise<ModernizedLoginResponse> {
  const body = JSON.stringify({ username, password });
  const response = await requestText(`${target.apiBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(body))
    },
    body
  });

  expect(response.statusCode).toBe(200);
  return JSON.parse(response.body) as ModernizedLoginResponse;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
