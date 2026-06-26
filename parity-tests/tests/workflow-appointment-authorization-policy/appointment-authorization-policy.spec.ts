import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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

type AccessControlSnapshot = {
  groupPermissions: Array<{
    groupValue: string;
    sectionValue: string;
    permissionValue: string;
    returnValue: string;
  }>;
  userMemberships: Array<{
    userValue: string;
    groupValue: string;
    groupName: string;
  }>;
};

test.describe("appointment authorization policy parity @workflow-appointment-authorization-policy @slice176 @appointments @security", () => {
  test("honors Appointment ACL access for appointment APIs and UI", async ({ page, target, targetDb }, testInfo) => {
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-176-appointment-authorization-policy-precondition",
      description:
        "Captures the Slice 176 appointment authorization-policy precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: appointmentAuthorizationPatientId,
        fromDate: appointmentAuthorizationFromDate,
        requiredSection: "patients",
        requiredPermission: "appt",
        requiredReturnValue: "view",
        adminWriteSatisfiesView: true,
        frontOfficeWriteSatisfiesView: true,
        modernizedAppointmentSearchPath: "/api/appointments",
        modernizedAppointmentDetailPath: "/api/appointments/{appointmentId}",
        secretMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true,
        patient: summarizePatient(patient!),
        appointment: summarizeAppointment(appointment!),
        accessControl: summarizeAccessControl(accessControl)
      },
      context: {
        suite: "workflow-appointment-authorization-policy",
        workflow: "appointment-authorization-policy-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openAppointmentDirect(page, target, appointment!.id);
      await expect(page.locator('input[name="form_title"]')).toHaveValue(appointment!.title);
      await expect(page.locator('input[name="form_patient"]')).toHaveValue(`${patient!.lname}, ${patient!.fname}`);
      await expect(page.locator('input[name="form_date"]')).toHaveValue(appointment!.eventDate);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-176-appointment-authorization-policy-legacy-rendered",
        description:
          "Captures legacy OpenEMR appointment edit rendering markers after admin login, with credentials redacted.",
        expected: {
          titleValue: appointment!.title,
          patientValue: `${patient!.lname}, ${patient!.fname}`,
          dateValue: appointment!.eventDate,
          passwordMaterialRedacted: true
        },
        actual: {
          titleValue: await page.locator('input[name="form_title"]').inputValue(),
          patientValue: await page.locator('input[name="form_patient"]').inputValue(),
          dateValue: await page.locator('input[name="form_date"]').inputValue(),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-appointment-authorization-policy",
          workflow: "appointment-authorization-policy-legacy-rendered"
        }
      });
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-176-appointment-authorization-policy-frontdesk-login",
      description:
        "Captures modernized front-desk session setup for appointment policy checks with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: "gold-frontdesk-01",
        role: "frontdesk",
        staffId: 117,
        frontOfficeMembership: true,
        sessionIdentifierRedacted: true
      },
      actual: summarizeLogin(frontDeskLogin),
      context: {
        suite: "workflow-appointment-authorization-policy",
        workflow: "appointment-authorization-policy-frontdesk-login"
      }
    });

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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-176-appointment-authorization-policy-frontdesk-search",
      description:
        "Captures modernized front-desk appointment search allow facts with session material redacted.",
      expected: {
        statusCode: 200,
        includesAppointmentId: String(appointment!.id),
        includesAppointmentTitle: appointment!.title,
        patientId: patient!.pubpid,
        legacyPid: patient!.pid,
        date: appointment!.eventDate,
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskSearch.statusCode,
        appointmentCount: search.appointments.length,
        includesAppointment: search.appointments.some(
          (item) => item.id === String(appointment!.id) && item.title === appointment!.title
        ),
        sampleAppointments: search.appointments.slice(0, 5),
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-appointment-authorization-policy",
        workflow: "appointment-authorization-policy-frontdesk-search"
      }
    });

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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-176-appointment-authorization-policy-frontdesk-detail",
      description:
        "Captures modernized front-desk appointment detail allow facts with session material redacted.",
      expected: {
        statusCode: 200,
        id: String(appointment!.id),
        title: appointment!.title,
        patientId: patient!.pubpid,
        legacyPid: patient!.pid,
        date: appointment!.eventDate,
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskDetail.statusCode,
        detail,
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-appointment-authorization-policy",
        workflow: "appointment-authorization-policy-frontdesk-detail"
      }
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-176-appointment-authorization-policy-rendered",
      description:
        "Captures modernized Calendar-page Appointment ACL rendering facts for front-desk allowed access.",
      expected: {
        frontDeskSignedIn: "Signed in as Parker Fleming",
        hidesSignedOutPromptAfterAccess: true,
        rendersAppointmentTitle: appointment!.title,
        rendersCanonicalId: patient!.pubpid,
        rendersLegacyPid: `PID ${patient!.pid}`,
        rendersAppointmentDate: appointment!.eventDate
      },
      actual: {
        surfaceFacts: {
          modernizedCalendarPage: {
            renderedFrontDeskSignedIn: "Signed in as Parker Fleming",
            didNotRenderSignedOutPromptAfterAccess: true,
            renderedAppointmentTitle: appointment!.title,
            renderedCanonicalId: patient!.pubpid,
            renderedLegacyPid: `PID ${patient!.pid}`,
            renderedAppointmentDate: appointment!.eventDate,
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-appointment-authorization-policy",
        workflow: "appointment-authorization-policy-rendered"
      }
    });
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

function summarizePatient(patient: { pubpid: string; pid: number; lname: string; fname: string }) {
  return {
    canonicalId: patient.pubpid,
    legacyPid: patient.pid,
    displayName: `${patient.lname}, ${patient.fname}`
  };
}

function summarizeAppointment(appointment: { id: number | string; title: string; eventDate: string }) {
  return {
    id: appointment.id,
    title: appointment.title,
    eventDate: appointment.eventDate
  };
}

function summarizeAccessControl(accessControl: AccessControlSnapshot) {
  return {
    groupPermissionCount: accessControl.groupPermissions.length,
    userMembershipCount: accessControl.userMemberships.length,
    adminAppointmentWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "admin" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "appt" &&
        permission.returnValue === "write"
    ),
    frontOfficeAppointmentWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "front" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "appt" &&
        permission.returnValue === "write"
    ),
    frontDeskFrontOfficeMembership: accessControl.userMemberships.some(
      (membership) => membership.userValue === "gold-frontdesk-01" && membership.groupValue === "front"
    ),
    sampleGroupPermissions: accessControl.groupPermissions.slice(0, 8),
    sampleUserMemberships: accessControl.userMemberships.slice(0, 8)
  };
}

function summarizeLogin(login: ModernizedLoginResponse) {
  return {
    authenticated: login.authenticated,
    username: login.username,
    displayName: login.displayName,
    role: login.role,
    staffId: login.staffId ?? null,
    hasSessionId: Boolean(login.sessionId),
    sessionIdRedacted: true
  };
}
