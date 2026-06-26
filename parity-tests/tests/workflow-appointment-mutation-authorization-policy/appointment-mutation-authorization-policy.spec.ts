import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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

type PatientSummaryInput = {
  pid: number;
  pubpid: string;
  fname: string;
  lname: string;
  dob?: string | null;
  providerId?: number | null;
};

type AppointmentSummaryInput = {
  id: string | number;
  title: string;
  patientId?: number | string | null;
  eventDate?: string | null;
  date?: string | null;
  startTime: string;
  status?: string | null;
};

const appointmentMutationAuthorizationPatientId = "MOD-PAT-0003";
const appointmentMutationAuthorizationFromDate = "2026-06-18";

test.describe("appointment mutation authorization policy parity @workflow-appointment-mutation-authorization-policy @slice189 @appointments @security", () => {
  test("separates Appointment view access from write-level schedule mutations", async ({ page, target, targetDb }, testInfo) => {
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-189-appointment-mutation-authorization-policy-precondition",
      description:
        "Captures the Slice 189 appointment mutation authorization-policy precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: appointmentMutationAuthorizationPatientId,
        fromDate: appointmentMutationAuthorizationFromDate,
        adminAppointmentWrite: true,
        frontOfficeAppointmentWrite: true,
        clinicianAppointmentWriteBeforeDowngrade: true,
        modernizedAppointmentSearchPath: "/api/appointments",
        modernizedAppointmentDetailPath: "/api/appointments/{appointmentId}",
        modernizedAppointmentMutationPath: "/api/appointments/{appointmentId}",
        modernizedRecurrenceRestorePath: "/api/appointments/{appointmentId}/recurrence-exceptions/{date}/restore",
        modernizedOccurrenceReschedulePath: "/api/appointments/{appointmentId}/occurrences/{date}/reschedule",
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
        beforeCounts,
        accessControl: summarizeAccessControl(accessControl)
      },
      context: {
        suite: "workflow-appointment-mutation-authorization-policy",
        workflow: "appointment-mutation-authorization-policy-precondition"
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
        probe: "slice-189-appointment-mutation-authorization-policy-legacy-rendered",
        description:
          "Captures legacy OpenEMR appointment edit rendering markers after admin login, with credentials redacted.",
        expected: {
          appointmentId: String(appointment!.id),
          title: appointment!.title,
          patientDisplay: `${patient!.lname}, ${patient!.fname}`,
          date: appointment!.eventDate,
          passwordMaterialRedacted: true
        },
        actual: {
          appointmentId: String(appointment!.id),
          renderedTitle: await page.locator('input[name="form_title"]').inputValue(),
          renderedPatient: await page.locator('input[name="form_patient"]').inputValue(),
          renderedDate: await page.locator('input[name="form_date"]').inputValue(),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-appointment-mutation-authorization-policy",
          workflow: "appointment-mutation-authorization-policy-legacy-rendered"
        }
      });
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-189-appointment-mutation-authorization-policy-admin-login",
      description:
        "Captures modernized admin session setup for temporary Appointment ACL downgrade management with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: target.credentials.username,
        role: "admin",
        sessionIdentifierRedacted: true
      },
      actual: summarizeLogin(adminLogin),
      context: {
        suite: "workflow-appointment-mutation-authorization-policy",
        workflow: "appointment-mutation-authorization-policy-admin-login"
      }
    });
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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-189-appointment-mutation-authorization-policy-view-downgrade",
        description:
          "Captures the temporary Clinicians Appointment view downgrade and proves Appointment write is absent during the denial checks.",
        expected: {
          clinicianAppointmentView: true,
          clinicianAppointmentWrite: false,
          writeGrantWillBeRestored: true,
          sessionIdentifierRedacted: true
        },
        actual: {
          accessControl: summarizeAccessControl(afterGrant),
          downgradedPermission: clinicianAppointmentViewDowngrade,
          adminSessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-appointment-mutation-authorization-policy",
          workflow: "appointment-mutation-authorization-policy-view-downgrade"
        }
      });

      const clinicianLogin = await modernizedLogin(target, "gold-provider-01", "pass");
      expect(clinicianLogin).toMatchObject({
        authenticated: true,
        username: "gold-provider-01",
        displayName: "Alex Walker",
        role: "provider",
        staffId: 101
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-189-appointment-mutation-authorization-policy-clinician-login",
        description:
          "Captures modernized clinician session setup for Appointment view/read and write-denial checks with the session identifier redacted.",
        expected: {
          authenticated: true,
          username: "gold-provider-01",
          role: "provider",
          staffId: 101,
          sessionIdentifierRedacted: true
        },
        actual: summarizeLogin(clinicianLogin),
        context: {
          suite: "workflow-appointment-mutation-authorization-policy",
          workflow: "appointment-mutation-authorization-policy-clinician-login"
        }
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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-189-appointment-mutation-authorization-policy-clinician-read",
        description:
          "Captures modernized clinician Appointment view access across search and detail endpoints before write denials.",
        expected: {
          searchStatusCode: 200,
          detailStatusCode: 200,
          appointmentId: String(appointment!.id),
          requiredSection: "patients",
          requiredPermission: "appt",
          requiredReturnValue: "view",
          sessionIdentifierRedacted: true
        },
        actual: {
          searchStatusCode: clinicianSearch.statusCode,
          detailStatusCode: clinicianDetail.statusCode,
          search: summarizeAppointmentSearch(search),
          detail: summarizeAppointmentDetail(detail),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-appointment-mutation-authorization-policy",
          workflow: "appointment-mutation-authorization-policy-clinician-read"
        }
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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-189-appointment-mutation-authorization-policy-clinician-create-forbidden",
        description:
          "Captures modernized clinician appointment create denial facts with session material redacted.",
        expected: authorizationDenialExpectation("create", null),
        actual: { denial: summarizeAuthorizationFailure(create), sessionHeaderRedacted: true },
        context: {
          suite: "workflow-appointment-mutation-authorization-policy",
          workflow: "appointment-mutation-authorization-policy-clinician-create-forbidden"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-189-appointment-mutation-authorization-policy-clinician-update-forbidden",
        description:
          "Captures modernized clinician appointment update denial facts with session material redacted.",
        expected: authorizationDenialExpectation("update", appointment!.id),
        actual: { denial: summarizeAuthorizationFailure(update), sessionHeaderRedacted: true },
        context: {
          suite: "workflow-appointment-mutation-authorization-policy",
          workflow: "appointment-mutation-authorization-policy-clinician-update-forbidden"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-189-appointment-mutation-authorization-policy-clinician-status-forbidden",
        description:
          "Captures modernized clinician appointment status denial facts with session material redacted.",
        expected: authorizationDenialExpectation("status", appointment!.id),
        actual: { denial: summarizeAuthorizationFailure(status), sessionHeaderRedacted: true },
        context: {
          suite: "workflow-appointment-mutation-authorization-policy",
          workflow: "appointment-mutation-authorization-policy-clinician-status-forbidden"
        }
      });

      const restore = await postJson<ModernizedAuthorizationFailure>(
        target,
        `/api/appointments/${encodeURIComponent(String(appointment!.id))}/recurrence-exceptions/2026-12-16/restore`,
        clinicianHeaders,
        {},
        403
      );
      expectAppointmentWriteAuthorizationFailure(restore);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-189-appointment-mutation-authorization-policy-clinician-restore-forbidden",
        description:
          "Captures modernized clinician appointment recurrence-exception restore denial facts with session material redacted.",
        expected: authorizationDenialExpectation("recurrence-restore", appointment!.id),
        actual: { denial: summarizeAuthorizationFailure(restore), sessionHeaderRedacted: true },
        context: {
          suite: "workflow-appointment-mutation-authorization-policy",
          workflow: "appointment-mutation-authorization-policy-clinician-restore-forbidden"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-189-appointment-mutation-authorization-policy-clinician-occurrence-reschedule-forbidden",
        description:
          "Captures modernized clinician appointment occurrence-reschedule denial facts with session material redacted.",
        expected: authorizationDenialExpectation("occurrence-reschedule", appointment!.id),
        actual: { denial: summarizeAuthorizationFailure(occurrenceReschedule), sessionHeaderRedacted: true },
        context: {
          suite: "workflow-appointment-mutation-authorization-policy",
          workflow: "appointment-mutation-authorization-policy-clinician-occurrence-reschedule-forbidden"
        }
      });

      const deleted = await deleteJson<ModernizedAuthorizationFailure>(
        target,
        `/api/appointments/${encodeURIComponent(String(appointment!.id))}`,
        clinicianHeaders,
        403
      );
      expectAppointmentWriteAuthorizationFailure(deleted);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-189-appointment-mutation-authorization-policy-clinician-delete-forbidden",
        description:
          "Captures modernized clinician appointment delete denial facts with session material redacted.",
        expected: authorizationDenialExpectation("delete", appointment!.id),
        actual: { denial: summarizeAuthorizationFailure(deleted), sessionHeaderRedacted: true },
        context: {
          suite: "workflow-appointment-mutation-authorization-policy",
          workflow: "appointment-mutation-authorization-policy-clinician-delete-forbidden"
        }
      });
    } finally {
      if (downgraded) {
        await putJson<unknown>(
          target,
          "/api/administration/access-control/group-permissions",
          adminHeaders,
          clinicianAppointmentWriteGrant,
          200
        );
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-189-appointment-mutation-authorization-policy-write-grant-restore",
          description:
            "Captures modernized admin restoration of the permanent Clinicians Appointment write grant with session material redacted.",
          expected: {
            statusCode: 200,
            clinicianAppointmentWriteRestored: true,
            requiredSection: "patients",
            requiredPermission: "appt",
            requiredReturnValue: "write",
            sessionIdentifierRedacted: true
          },
          actual: {
            restoredPermission: clinicianAppointmentWriteGrant,
            sessionHeaderRedacted: true
          },
          context: {
            suite: "workflow-appointment-mutation-authorization-policy",
            workflow: "appointment-mutation-authorization-policy-write-grant-restore"
          }
        });
      }
    }

    const afterCleanup = await targetDb.getAdministrationAccessControl();
    expect(afterCleanup.groupPermissions).toEqual(
      expect.arrayContaining([expect.objectContaining(clinicianAppointmentWriteGrant)])
    );

    const afterCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCounts.appointments).toBe(beforeCounts.appointments);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-189-appointment-mutation-authorization-policy-cleanup",
      description:
        "Captures final cleanup proving the Clinicians Appointment write grant is restored and appointment counts returned to the Slice 189 baseline.",
      expected: {
        clinicianAppointmentWriteRestored: true,
        beforeAppointmentCount: beforeCounts.appointments,
        afterAppointmentCount: beforeCounts.appointments,
        secretMaterialRedacted: true
      },
      actual: {
        accessControl: summarizeAccessControl(afterCleanup),
        beforeCounts,
        afterCounts
      },
      context: {
        suite: "workflow-appointment-mutation-authorization-policy",
        workflow: "appointment-mutation-authorization-policy-cleanup"
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

function authorizationDenialExpectation(operation: string, appointmentId: string | number | null) {
  return {
    statusCode: 403,
    operation,
    appointmentId: appointmentId === null ? null : String(appointmentId),
    requiredSection: "patients",
    requiredPermission: "appt",
    requiredReturnValue: "write",
    sessionIdentifierRedacted: true
  };
}

function summarizePatient(patient: PatientSummaryInput) {
  return {
    pid: patient.pid,
    pubpid: patient.pubpid,
    firstName: patient.fname,
    lastName: patient.lname,
    dateOfBirth: patient.dob ?? null,
    providerId: patient.providerId ?? null
  };
}

function summarizeAppointment(appointment: AppointmentSummaryInput) {
  return {
    id: String(appointment.id),
    title: appointment.title,
    patientId: appointment.patientId ?? null,
    date: appointment.eventDate ?? appointment.date ?? null,
    startTime: appointment.startTime,
    status: appointment.status ?? null
  };
}

function summarizeAccessControl(accessControl: AccessControlSnapshot) {
  const hasPermission = (groupValue: string, returnValue?: string) =>
    accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === groupValue &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "appt" &&
        (returnValue === undefined || permission.returnValue === returnValue)
    );

  return {
    adminAppointmentWrite: hasPermission("admin", "write"),
    frontOfficeAppointmentWrite: hasPermission("front", "write"),
    clinicianAppointmentAny: hasPermission("clin"),
    clinicianAppointmentView: hasPermission("clin", "view"),
    clinicianAppointmentWrite: hasPermission("clin", "write"),
    clinicianMembership: accessControl.userMemberships.some(
      (membership) =>
        membership.userValue === "gold-provider-01" &&
        membership.groupValue === "clin" &&
        membership.groupName === "Clinicians"
    )
  };
}

function summarizeLogin(login: ModernizedLoginResponse) {
  return {
    authenticated: login.authenticated,
    username: login.username,
    displayName: login.displayName,
    role: login.role,
    staffId: login.staffId ?? null,
    sessionIdentifierPresent: Boolean(login.sessionId),
    sessionIdentifierRedacted: true
  };
}

function summarizeAppointmentSearch(search: AppointmentSearchResponse) {
  return {
    appointmentCount: search.appointments.length,
    sampleAppointments: search.appointments.slice(0, 5).map((appointment) => ({
      id: appointment.id,
      title: appointment.title,
      patientId: appointment.patientId,
      legacyPid: appointment.legacyPid,
      date: appointment.date,
      startTime: appointment.startTime
    }))
  };
}

function summarizeAppointmentDetail(detail: AppointmentDetailResponse) {
  return {
    id: detail.id,
    title: detail.title,
    patientId: detail.patientId,
    legacyPid: detail.legacyPid,
    date: detail.date,
    startTime: detail.startTime,
    status: detail.status
  };
}

function summarizeAuthorizationFailure(response: ModernizedAuthorizationFailure) {
  return {
    authenticated: response.authenticated,
    authorized: response.authorized,
    username: response.username,
    role: response.role,
    requiredSection: response.requiredSection,
    requiredPermission: response.requiredPermission,
    requiredReturnValue: response.requiredReturnValue,
    failureReason: response.failureReason ?? null,
    sessionSource: response.sessionSource,
    sessionIdentifierPresent: Boolean(response.sessionId),
    sessionIdentifierRedacted: true
  };
}

function trimSeconds(time: string) {
  return time.length >= 5 ? time.substring(0, 5) : time;
}
