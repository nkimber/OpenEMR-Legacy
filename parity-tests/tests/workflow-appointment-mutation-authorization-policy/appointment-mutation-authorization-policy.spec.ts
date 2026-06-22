import { test, expect } from "../../src/fixtures/parityTest.js";
import { requestText } from "../../src/http/httpClient.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";

type ModernizedLoginResponse = {
  authenticated: boolean;
  username: string;
  displayName: string;
  role: string;
  staffId?: number | null;
  sessionId?: string | null;
};

type ModernizedAuthorizationFailure = {
  authenticated: boolean;
  authorized: boolean;
  sessionId?: string | null;
  username: string;
  role: string;
  requiredSection: string;
  requiredPermission: string;
  requiredReturnValue: string;
  failureReason?: string | null;
  sessionSource: string;
};

type AppointmentSearchResponse = {
  appointments: Array<{
    id: string;
    title: string;
    patientId: string;
    legacyPid: number;
    date: string;
    startTime: string;
  }>;
};

type AppointmentDetailResponse = {
  id: string;
  title: string;
  patientId: string;
  legacyPid: number;
  date: string;
  startTime: string;
  status: string;
};

const appointmentMutationAuthorizationPatientId = "MOD-PAT-0003";
const appointmentMutationAuthorizationFromDate = "2026-06-18";

test.describe("appointment mutation authorization policy parity @workflow-appointment-mutation-authorization-policy @slice189 @appointments @security", () => {
  test("separates Appointment view access from write-level schedule mutations", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentMutationAuthorizationPatientId);
    expect(patient).not.toBeNull();

    const appointment = await targetDb.getFutureAppointmentForPatient(patient!.pid, appointmentMutationAuthorizationFromDate);
    expect(appointment).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
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
        }),
        expect.objectContaining({
          groupValue: "clin",
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
          userValue: "gold-provider-01",
          groupValue: "clin",
          groupName: "Clinicians"
        })
      ])
    );

    const adminLogin = await modernizedLogin(target, target.credentials.username, target.credentials.password);
    const adminHeaders = { "X-OpenEMR-Session": adminLogin.sessionId! };
    const clinicianAppointmentViewDowngrade = {
      groupValue: "clin",
      sectionValue: "patients",
      permissionValue: "appt",
      returnValue: "view"
    };
    const clinicianAppointmentWriteGrant = {
      groupValue: "clin",
      sectionValue: "patients",
      permissionValue: "appt",
      returnValue: "write"
    };

    let downgraded = false;
    try {
      await putJson<unknown>(
        target,
        "/api/administration/access-control/group-permissions",
        adminHeaders,
        clinicianAppointmentViewDowngrade,
        200
      );
      downgraded = true;

      const afterGrant = await targetDb.getAdministrationAccessControl();
      expect(afterGrant.groupPermissions).toEqual(
        expect.arrayContaining([expect.objectContaining(clinicianAppointmentViewDowngrade)])
      );
      expect(afterGrant.groupPermissions).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining(clinicianAppointmentWriteGrant)
        ])
      );

      const clinicianLogin = await modernizedLogin(target, "gold-provider-01", "pass");
      expect(clinicianLogin).toMatchObject({
        authenticated: true,
        username: "gold-provider-01",
        displayName: "Alex Walker",
        role: "provider",
        staffId: 101
      });
      const clinicianHeaders = { "X-OpenEMR-Session": clinicianLogin.sessionId! };

      const clinicianSearch = await requestText(
        `${target.apiBaseUrl}/api/appointments?patientId=${encodeURIComponent(patient!.pubpid)}&from=${appointmentMutationAuthorizationFromDate}&limit=5`,
        { headers: clinicianHeaders }
      );
      expect(clinicianSearch.statusCode).toBe(200);
      const search = JSON.parse(clinicianSearch.body) as AppointmentSearchResponse;
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

      const clinicianDetail = await requestText(
        `${target.apiBaseUrl}/api/appointments/${encodeURIComponent(String(appointment!.id))}`,
        { headers: clinicianHeaders }
      );
      expect(clinicianDetail.statusCode).toBe(200);
      const detail = JSON.parse(clinicianDetail.body) as AppointmentDetailResponse;
      expect(detail).toMatchObject({
        id: String(appointment!.id),
        title: appointment!.title,
        patientId: patient!.pubpid,
        legacyPid: patient!.pid,
        date: appointment!.eventDate
      });

      const create = await postJson<ModernizedAuthorizationFailure>(
        target,
        "/api/appointments",
        clinicianHeaders,
        {
          patientId: patient!.pubpid,
          providerId: patient!.providerId,
          title: "Blocked Appointment Mutation Authorization",
          date: "2026-11-17",
          startTime: "09:00",
          durationMinutes: 30,
          facilityId: 10,
          billingLocationId: 10,
          categoryId: 9,
          room: "Blocked",
          comments: "Blocked by Slice 189 appointment mutation authorization policy."
        },
        403
      );
      expectAppointmentWriteAuthorizationFailure(create);

      const update = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/appointments/${encodeURIComponent(String(appointment!.id))}`,
        clinicianHeaders,
        {
          providerId: patient!.providerId,
          title: `${appointment!.title} Blocked`,
          date: appointment!.eventDate,
          startTime: trimSeconds(appointment!.startTime),
          durationMinutes: 30,
          facilityId: 10,
          billingLocationId: 10,
          categoryId: 9,
          room: "Blocked",
          status: appointment!.status,
          comments: "Blocked by Slice 189 appointment mutation authorization policy."
        },
        403
      );
      expectAppointmentWriteAuthorizationFailure(update);

      const status = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/appointments/${encodeURIComponent(String(appointment!.id))}/status`,
        clinicianHeaders,
        {
          status: "x",
          title: "Blocked Appointment Status"
        },
        403
      );
      expectAppointmentWriteAuthorizationFailure(status);

      const restore = await postJson<ModernizedAuthorizationFailure>(
        target,
        `/api/appointments/${encodeURIComponent(String(appointment!.id))}/recurrence-exceptions/2026-12-16/restore`,
        clinicianHeaders,
        {},
        403
      );
      expectAppointmentWriteAuthorizationFailure(restore);

      const occurrenceReschedule = await postJson<ModernizedAuthorizationFailure>(
        target,
        `/api/appointments/${encodeURIComponent(String(appointment!.id))}/occurrences/2026-12-30/reschedule`,
        clinicianHeaders,
        {
          providerId: patient!.providerId,
          title: appointment!.title,
          date: "2027-01-06",
          startTime: "14:00",
          durationMinutes: 45,
          facilityId: 10,
          billingLocationId: 10,
          categoryId: 9,
          room: "Blocked",
          status: appointment!.status,
          comments: "Blocked by Slice 189 appointment occurrence reschedule authorization policy."
        },
        403
      );
      expectAppointmentWriteAuthorizationFailure(occurrenceReschedule);

      const deleted = await deleteJson<ModernizedAuthorizationFailure>(
        target,
        `/api/appointments/${encodeURIComponent(String(appointment!.id))}`,
        clinicianHeaders,
        403
      );
      expectAppointmentWriteAuthorizationFailure(deleted);
    } finally {
      if (downgraded) {
        await putJson<unknown>(
          target,
          "/api/administration/access-control/group-permissions",
          adminHeaders,
          clinicianAppointmentWriteGrant,
          200
        );
      }
    }

    const afterCleanup = await targetDb.getAdministrationAccessControl();
    expect(afterCleanup.groupPermissions).toEqual(
      expect.arrayContaining([expect.objectContaining(clinicianAppointmentWriteGrant)])
    );

    const afterCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCounts.appointments).toBe(beforeCounts.appointments);
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

async function postJson<T>(
  target: RuntimeTarget,
  path: string,
  headers: Record<string, string>,
  payload: unknown,
  expectedStatusCode: number
): Promise<T> {
  return sendJson<T>(target, "POST", path, headers, payload, expectedStatusCode);
}

async function putJson<T>(
  target: RuntimeTarget,
  path: string,
  headers: Record<string, string>,
  payload: unknown,
  expectedStatusCode: number
): Promise<T> {
  return sendJson<T>(target, "PUT", path, headers, payload, expectedStatusCode);
}

async function deleteJson<T>(
  target: RuntimeTarget,
  path: string,
  headers: Record<string, string>,
  expectedStatusCode: number
): Promise<T> {
  const response = await requestText(`${target.apiBaseUrl}${path}`, {
    method: "DELETE",
    headers
  });

  expect(response.statusCode).toBe(expectedStatusCode);
  return JSON.parse(response.body) as T;
}

async function sendJson<T>(
  target: RuntimeTarget,
  method: "POST" | "PUT",
  path: string,
  headers: Record<string, string>,
  payload: unknown,
  expectedStatusCode: number
): Promise<T> {
  const body = JSON.stringify(payload);
  const response = await requestText(`${target.apiBaseUrl}${path}`, {
    method,
    headers: {
      ...headers,
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(body))
    },
    body
  });

  expect(response.statusCode).toBe(expectedStatusCode);
  return JSON.parse(response.body) as T;
}

function expectAppointmentWriteAuthorizationFailure(response: ModernizedAuthorizationFailure) {
  expect(response).toMatchObject({
    authenticated: true,
    authorized: false,
    username: "gold-provider-01",
    role: "provider",
    requiredSection: "patients",
    requiredPermission: "appt",
    requiredReturnValue: "write",
    sessionSource: "modernized-openemr"
  });
  expect(response.failureReason).toMatch(/not authorized/i);
}

function trimSeconds(time: string) {
  return time.length >= 5 ? time.substring(0, 5) : time;
}
