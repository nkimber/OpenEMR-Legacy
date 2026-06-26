import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { requestText } from "../../src/http/httpClient.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDemographicsEditDirect,
  openPatientSummaryDirect
} from "../../src/ui/legacyOpenEmr.js";
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

type PatientChartResponse = {
  canonicalId: string;
  legacyPid: number;
  pubpid: string;
  displayName: string;
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

const patientMutationAuthorizationPatientId = "MOD-PAT-0010";

test.describe("patient chart mutation authorization policy parity @workflow-patient-mutation-authorization-policy @slice184 @patients @security", () => {
  test("enforces Demographics add-only and write ACL boundaries", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(patientMutationAuthorizationPatientId);
    expect(patient).not.toBeNull();

    const accessControl = await targetDb.getAdministrationAccessControl();
    expect(accessControl.groupPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "admin",
          sectionValue: "patients",
          permissionValue: "demo",
          returnValue: "write"
        }),
        expect.objectContaining({
          groupValue: "front",
          sectionValue: "patients",
          permissionValue: "demo",
          returnValue: "write"
        }),
        expect.objectContaining({
          groupValue: "clin",
          sectionValue: "patients",
          permissionValue: "demo",
          returnValue: "addonly"
        })
      ])
    );
    expect(accessControl.groupPermissions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "clin",
          sectionValue: "patients",
          permissionValue: "demo",
          returnValue: "write"
        })
      ])
    );
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-184-patient-mutation-authorization-policy-precondition",
      description:
        "Captures the Slice 184 patient mutation authorization-policy precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: patientMutationAuthorizationPatientId,
        clinicianCanAddDemographicsOnly: true,
        clinicianCannotUpdateExistingDemographics: true,
        clinicianCannotUpdateExistingContact: true,
        clinicianCannotDeletePatients: true,
        frontDeskCanWriteDemographics: true,
        adminCanWriteDemographics: true,
        modernizedPatientCreatePath: "/api/patients",
        modernizedPatientDemographicsPath: "/api/patients/{canonicalId}/demographics",
        modernizedPatientContactPath: "/api/patients/{canonicalId}/contact",
        modernizedPatientDeletePath: "/api/patients/{canonicalId}",
        secretMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true,
        patient: summarizePatient(patient!),
        accessControl: summarizeAccessControl(accessControl)
      },
      context: {
        suite: "workflow-patient-mutation-authorization-policy",
        workflow: "patient-mutation-authorization-policy-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientSummaryDirect(page, target, patient!.pid);
      await expectRenderedText(page, patient!.fname);
      await expectRenderedText(page, patient!.lname);
      await openPatientDemographicsEditDirect(page, target, patient!.pid);
      await expectRenderedText(page, patient!.pubpid);
      const demographicsText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-184-patient-mutation-authorization-policy-legacy-rendered",
        description:
          "Captures legacy OpenEMR Demographics edit rendering markers after admin login, with credentials redacted.",
        expected: {
          canonicalPatientId: patient!.pubpid,
          containsFirstName: patient!.fname,
          containsLastName: patient!.lname,
          containsPubpid: patient!.pubpid,
          passwordMaterialRedacted: true
        },
        actual: {
          demographicsEdit: summarizeRenderedText(demographicsText, [patient!.fname, patient!.lname, patient!.pubpid]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-patient-mutation-authorization-policy",
          workflow: "patient-mutation-authorization-policy-legacy-rendered"
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
      probe: "slice-184-patient-mutation-authorization-policy-clinician-login",
      description:
        "Captures modernized clinician session setup for patient mutation policy checks with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: "gold-provider-01",
        role: "provider",
        staffId: 101,
        sessionIdentifierRedacted: true
      },
      actual: summarizeLogin(clinicianLogin),
      context: {
        suite: "workflow-patient-mutation-authorization-policy",
        workflow: "patient-mutation-authorization-policy-clinician-login"
      }
    });

    const clinicianHeaders = { "X-OpenEMR-Session": clinicianLogin.sessionId! };
    const clinicianSearch = await requestText(
      `${target.apiBaseUrl}/api/patients?search=${encodeURIComponent(patient!.pubpid)}&limit=5`,
      { headers: clinicianHeaders }
    );
    expect(clinicianSearch.statusCode).toBe(200);

    const clinicianRead = await requestText(
      `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
      { headers: clinicianHeaders }
    );
    expect(clinicianRead.statusCode).toBe(200);
    expect(clinicianRead.body).toContain(patient!.pubpid);
    const clinicianReadBody = JSON.parse(clinicianRead.body) as PatientChartResponse;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-184-patient-mutation-authorization-policy-clinician-read",
      description:
        "Captures modernized clinician add-only patient-chart read visibility before mutation denials.",
      expected: {
        searchStatusCode: 200,
        readStatusCode: 200,
        canonicalId: patient!.pubpid,
        sessionIdentifierRedacted: true
      },
      actual: {
        searchStatusCode: clinicianSearch.statusCode,
        readStatusCode: clinicianRead.statusCode,
        chart: summarizePatientChart(clinicianReadBody),
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-patient-mutation-authorization-policy",
        workflow: "patient-mutation-authorization-policy-clinician-read"
      }
    });

    const suffix = workflowSuffix();
    const createdPubpid = `TMP-PAT-REG-AUTH-${suffix}`;
    let createdLegacyPid: number | null = null;

    try {
      const created = await postJson<PatientChartResponse>(
        target,
        "/api/patients",
        clinicianHeaders,
        {
          pubpid: createdPubpid,
          firstName: "Addonly",
          lastName: "Boundary",
          preferredName: "Slice184",
          sex: "Female",
          dateOfBirth: "1994-02-18",
          street: "184 Authorization Way",
          city: "New Haven",
          state: "CT",
          postalCode: "06510",
          maritalStatus: "single",
          occupation: "Authorization Test Patient",
          phoneHome: "(203) 555-1840",
          phoneCell: "(203) 555-1841",
          email: `slice184-${suffix}@example.test`,
          hipaaAllowSms: "YES",
          hipaaAllowEmail: "YES"
        },
        201
      );
      createdLegacyPid = created.legacyPid;
      expect(created).toMatchObject({
        canonicalId: createdPubpid,
        pubpid: createdPubpid
      });
      expect(created.displayName).toContain("Boundary, Addonly");
      expect(createdLegacyPid).toBeGreaterThan(0);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-184-patient-mutation-authorization-policy-clinician-create",
        description:
          "Captures modernized clinician Demographics add-only patient registration facts with session material redacted.",
        expected: {
          statusCode: 201,
          createdPubpid,
          requiredSection: "patients",
          requiredPermission: "demo",
          requiredReturnValue: "addonly",
          sessionIdentifierRedacted: true
        },
        actual: {
          createdPatient: summarizePatientChart(created),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-patient-mutation-authorization-policy",
          workflow: "patient-mutation-authorization-policy-clinician-create"
        }
      });

      const clinicianDemographicsUpdate = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/patients/${encodeURIComponent(patient!.pubpid)}/demographics`,
        clinicianHeaders,
        {
          firstName: "Morgan",
          lastName: "Denied",
          preferredName: "Slice184Denied",
          sex: patient!.sex,
          dateOfBirth: patient!.dob,
          street: "184 Denied Way",
          city: "Bridgeport",
          state: "CT",
          postalCode: "06460",
          maritalStatus: "single",
          occupation: "Denied Mutation"
        },
        403
      );
      expect(clinicianDemographicsUpdate).toMatchObject({
        authenticated: true,
        authorized: false,
        username: "gold-provider-01",
        role: "provider",
        requiredSection: "patients",
        requiredPermission: "demo",
        requiredReturnValue: "write",
        sessionSource: "modernized-openemr"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-184-patient-mutation-authorization-policy-clinician-demographics-forbidden",
        description:
          "Captures modernized clinician Demographics write denial facts with session material redacted.",
        expected: {
          statusCode: 403,
          canonicalId: patient!.pubpid,
          requiredSection: "patients",
          requiredPermission: "demo",
          requiredReturnValue: "write",
          sessionIdentifierRedacted: true
        },
        actual: {
          denial: summarizeAuthorizationFailure(clinicianDemographicsUpdate),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-patient-mutation-authorization-policy",
          workflow: "patient-mutation-authorization-policy-clinician-demographics-forbidden"
        }
      });

      const clinicianContactUpdate = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/patients/${encodeURIComponent(patient!.pubpid)}/contact`,
        clinicianHeaders,
        {
          phoneHome: "(203) 555-1842",
          phoneCell: "(203) 555-1843",
          email: `slice184-denied-${suffix}@example.test`,
          hipaaAllowSms: "YES",
          hipaaAllowEmail: "YES"
        },
        403
      );
      expect(clinicianContactUpdate).toMatchObject({
        authenticated: true,
        authorized: false,
        username: "gold-provider-01",
        role: "provider",
        requiredSection: "patients",
        requiredPermission: "demo",
        requiredReturnValue: "write",
        sessionSource: "modernized-openemr"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-184-patient-mutation-authorization-policy-clinician-contact-forbidden",
        description:
          "Captures modernized clinician patient-contact write denial facts with session material redacted.",
        expected: {
          statusCode: 403,
          canonicalId: patient!.pubpid,
          requiredSection: "patients",
          requiredPermission: "demo",
          requiredReturnValue: "write",
          sessionIdentifierRedacted: true
        },
        actual: {
          denial: summarizeAuthorizationFailure(clinicianContactUpdate),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-patient-mutation-authorization-policy",
          workflow: "patient-mutation-authorization-policy-clinician-contact-forbidden"
        }
      });

      const clinicianDelete = await deleteJson<ModernizedAuthorizationFailure>(
        target,
        `/api/patients/${encodeURIComponent(createdPubpid)}`,
        clinicianHeaders,
        403
      );
      expect(clinicianDelete).toMatchObject({
        authenticated: true,
        authorized: false,
        username: "gold-provider-01",
        role: "provider",
        requiredSection: "patients",
        requiredPermission: "demo",
        requiredReturnValue: "write",
        sessionSource: "modernized-openemr"
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-184-patient-mutation-authorization-policy-clinician-delete-forbidden",
        description:
          "Captures modernized clinician patient-delete denial facts for an add-only-created patient.",
        expected: {
          statusCode: 403,
          createdPubpid,
          requiredSection: "patients",
          requiredPermission: "demo",
          requiredReturnValue: "write",
          sessionIdentifierRedacted: true
        },
        actual: {
          denial: summarizeAuthorizationFailure(clinicianDelete),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-patient-mutation-authorization-policy",
          workflow: "patient-mutation-authorization-policy-clinician-delete-forbidden"
        }
      });

      const adminLogin = await modernizedLogin(target, target.credentials.username, target.credentials.password);
      const adminDelete = await requestText(
        `${target.apiBaseUrl}/api/patients/${encodeURIComponent(createdPubpid)}`,
        {
          method: "DELETE",
          headers: { "X-OpenEMR-Session": adminLogin.sessionId! }
        }
      );
      expect(adminDelete.statusCode).toBe(204);
      const deletedLegacyPid = createdLegacyPid;
      createdLegacyPid = null;
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-184-patient-mutation-authorization-policy-admin-delete",
        description:
          "Captures modernized admin Demographics write cleanup authority for the clinician-created patient with session material redacted.",
        expected: {
          statusCode: 204,
          createdPubpid,
          adminUsername: target.credentials.username,
          requiredSection: "patients",
          requiredPermission: "demo",
          requiredReturnValue: "write",
          sessionIdentifierRedacted: true
        },
        actual: {
          statusCode: adminDelete.statusCode,
          adminLogin: summarizeLogin(adminLogin),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-patient-mutation-authorization-policy",
          workflow: "patient-mutation-authorization-policy-admin-delete"
        }
      });

      const afterCleanup = await targetDb.findPatientByCanonicalId(createdPubpid);
      expect(afterCleanup).toBeNull();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-184-patient-mutation-authorization-policy-cleanup",
        description:
          "Captures final database cleanup for the temporary Slice 184 patient mutation authorization-policy record.",
        expected: {
          createdPubpid,
          patientRemoved: true,
          secretMaterialRedacted: true
        },
        actual: {
          createdPubpid,
          deletedLegacyPid,
          afterCleanup: afterCleanup === null ? null : summarizePatient(afterCleanup)
        },
        context: {
          suite: "workflow-patient-mutation-authorization-policy",
          workflow: "patient-mutation-authorization-policy-cleanup"
        }
      });
    } finally {
      if (createdLegacyPid !== null) {
        const adminLogin = await modernizedLogin(target, target.credentials.username, target.credentials.password);
        await requestText(`${target.apiBaseUrl}/api/patients/${encodeURIComponent(createdPubpid)}`, {
          method: "DELETE",
          headers: { "X-OpenEMR-Session": adminLogin.sessionId! }
        });
      }
    }
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

function summarizePatient(patient: {
  pubpid: string;
  pid: number;
  lname: string;
  fname: string;
  providerId?: number | null;
}) {
  return {
    canonicalId: patient.pubpid,
    legacyPid: patient.pid,
    displayName: `${patient.lname}, ${patient.fname}`,
    providerId: patient.providerId ?? null
  };
}

function summarizePatientChart(chart: PatientChartResponse) {
  return {
    canonicalId: chart.canonicalId,
    legacyPid: chart.legacyPid,
    pubpid: chart.pubpid,
    displayName: chart.displayName
  };
}

function summarizeAccessControl(accessControl: AccessControlSnapshot) {
  return {
    groupPermissionCount: accessControl.groupPermissions.length,
    userMembershipCount: accessControl.userMemberships.length,
    adminDemographicsWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "admin" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "demo" &&
        permission.returnValue === "write"
    ),
    frontDeskDemographicsWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "front" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "demo" &&
        permission.returnValue === "write"
    ),
    clinicianDemographicsAddOnly: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "clin" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "demo" &&
        permission.returnValue === "addonly"
    ),
    clinicianDemographicsWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "clin" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "demo" &&
        permission.returnValue === "write"
    ),
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
    hasSessionId: Boolean(login.sessionId),
    sessionIdRedacted: true
  };
}

function summarizeAuthorizationFailure(failure: ModernizedAuthorizationFailure) {
  return {
    authenticated: failure.authenticated,
    authorized: failure.authorized,
    username: failure.username,
    role: failure.role,
    requiredSection: failure.requiredSection,
    requiredPermission: failure.requiredPermission,
    requiredReturnValue: failure.requiredReturnValue,
    failureReason: failure.failureReason,
    sessionSource: failure.sessionSource,
    hasSessionId: Boolean(failure.sessionId),
    sessionIdRedacted: true
  };
}

function summarizeRenderedText(text: string | null, markers: string[]) {
  const body = text ?? "";
  return {
    bodyLength: body.length,
    bodyPreview: body.slice(0, 240),
    markers: Object.fromEntries(markers.map((marker) => [marker, body.includes(marker)]))
  };
}

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-12) || "local";
}
