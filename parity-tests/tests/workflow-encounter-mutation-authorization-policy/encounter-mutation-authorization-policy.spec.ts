import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { requestText } from "../../src/http/httpClient.js";
import { expectRenderedText, loginToLegacyOpenEmr, openEncounterDirect } from "../../src/ui/legacyOpenEmr.js";
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

type EncounterSearchResponse = {
  totalMatches: number;
  encounters: Array<{
    encounter: number;
    patientId: string;
    legacyPid: number;
    reason?: string | null;
  }>;
};

type EncounterDetailResponse = {
  encounter: number;
  patientId: string;
  legacyPid: number;
  reason?: string | null;
  billingNote?: string | null;
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

const encounterMutationAuthorizationPatientId = "MOD-PAT-0001";
const encounterMutationAuthorizationFromDate = "2026-01-01";

test.describe("encounter mutation authorization policy parity @workflow-encounter-mutation-authorization-policy @slice185 @encounters @security", () => {
  test("enforces Authorize Any Encounter write access for core encounter mutations", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterMutationAuthorizationPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    const clinical = await targetDb.getEncounterClinicalDetail(patient!.pid, encounter!.encounter);
    expect(clinical).not.toBeNull();

    const accessControl = await targetDb.getAdministrationAccessControl();
    expect(accessControl.groupPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "admin",
          sectionValue: "encounters",
          permissionValue: "auth_a",
          returnValue: "write"
        }),
        expect.objectContaining({
          groupValue: "clin",
          sectionValue: "encounters",
          permissionValue: "auth",
          returnValue: "write"
        })
      ])
    );
    expect(accessControl.groupPermissions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "clin",
          sectionValue: "encounters",
          permissionValue: "auth_a"
        })
      ])
    );
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-185-encounter-mutation-authorization-policy-precondition",
      description:
        "Captures the Slice 185 encounter mutation authorization-policy precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: encounterMutationAuthorizationPatientId,
        clinicianTemporaryViewGrantRequired: true,
        clinicianCannotMutateWithViewOnlyGrant: true,
        adminAuthorizeAnyEncounterWrite: true,
        clinicianAuthorizePatientEncounterWriteOnly: true,
        modernizedEncounterCreatePath: "/api/encounters",
        modernizedEncounterUpdatePath: "/api/encounters/{encounterId}",
        modernizedEncounterSignPath: "/api/encounters/{encounterId}/sign",
        modernizedEncounterDeletePath: "/api/encounters/{encounterId}",
        secretMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true,
        patient: summarizePatient(patient!),
        encounter: summarizeEncounterDetail({
          encounter: encounter!.encounter,
          patientId: patient!.pubpid,
          legacyPid: patient!.pid,
          reason: clinical!.reason
        }),
        accessControl: summarizeAccessControl(accessControl)
      },
      context: {
        suite: "workflow-encounter-mutation-authorization-policy",
        workflow: "encounter-mutation-authorization-policy-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
      await expectRenderedText(page, new RegExp(escapeRegex(encounterTopic(clinical!.reason)), "i"));
      await expectRenderedText(page, "SOAP");
      await expectRenderedText(page, "Vitals");
      await expectRenderedText(page, /Assessment:/i);
      const encounterText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-185-encounter-mutation-authorization-policy-legacy-rendered",
        description:
          "Captures legacy OpenEMR encounter rendering markers after admin login, with credentials redacted.",
        expected: {
          canonicalPatientId: patient!.pubpid,
          encounterId: encounter!.encounter,
          containsEncounterTopic: encounterTopic(clinical!.reason),
          containsSoap: "SOAP",
          containsVitals: "Vitals",
          containsAssessment: "Assessment:",
          passwordMaterialRedacted: true
        },
        actual: {
          encounterPage: summarizeRenderedText(encounterText, [
            encounterTopic(clinical!.reason),
            "SOAP",
            "Vitals",
            "Assessment:"
          ]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-encounter-mutation-authorization-policy",
          workflow: "encounter-mutation-authorization-policy-legacy-rendered"
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
      probe: "slice-185-encounter-mutation-authorization-policy-admin-login",
      description:
        "Captures modernized admin session setup for temporary ACL grant management with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: target.credentials.username,
        role: "admin",
        sessionIdentifierRedacted: true
      },
      actual: summarizeLogin(adminLogin),
      context: {
        suite: "workflow-encounter-mutation-authorization-policy",
        workflow: "encounter-mutation-authorization-policy-admin-login"
      }
    });
    const clinicianViewGrant = {
      groupValue: "clin",
      sectionValue: "encounters",
      permissionValue: "auth_a",
      returnValue: "view"
    };

    let grantActive = false;
    try {
      await putJson<unknown>(
        target,
        "/api/administration/access-control/group-permissions",
        adminHeaders,
        clinicianViewGrant,
        200
      );
      grantActive = true;

      const afterGrant = await targetDb.getAdministrationAccessControl();
      expect(afterGrant.groupPermissions).toEqual(
        expect.arrayContaining([
          expect.objectContaining(clinicianViewGrant)
        ])
      );
      expect(afterGrant.groupPermissions).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            groupValue: "clin",
            sectionValue: "encounters",
            permissionValue: "auth_a",
            returnValue: "write"
          })
        ])
      );
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-185-encounter-mutation-authorization-policy-view-grant",
        description:
          "Captures the temporary Clinicians Authorize Any Encounter view-only grant used to prove read-only access without write authority.",
        expected: {
          grantApplied: clinicianViewGrant,
          clinicianHasAuthorizeAnyEncounterView: true,
          clinicianDoesNotHaveAuthorizeAnyEncounterWrite: true,
          sessionIdentifierRedacted: true
        },
        actual: {
          accessControl: summarizeAccessControl(afterGrant),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-encounter-mutation-authorization-policy",
          workflow: "encounter-mutation-authorization-policy-view-grant"
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
        probe: "slice-185-encounter-mutation-authorization-policy-clinician-login",
        description:
          "Captures modernized clinician session setup for encounter mutation policy checks with the session identifier redacted.",
        expected: {
          authenticated: true,
          username: "gold-provider-01",
          role: "provider",
          staffId: 101,
          sessionIdentifierRedacted: true
        },
        actual: summarizeLogin(clinicianLogin),
        context: {
          suite: "workflow-encounter-mutation-authorization-policy",
          workflow: "encounter-mutation-authorization-policy-clinician-login"
        }
      });
      const clinicianHeaders = { "X-OpenEMR-Session": clinicianLogin.sessionId! };

      const clinicianSearch = await requestText(
        `${target.apiBaseUrl}/api/encounters?patientId=${encodeURIComponent(patient!.pubpid)}&from=${encounterMutationAuthorizationFromDate}&limit=5`,
        { headers: clinicianHeaders }
      );
      expect(clinicianSearch.statusCode).toBe(200);
      const search = JSON.parse(clinicianSearch.body) as EncounterSearchResponse;
      expect(search.encounters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            encounter: encounter!.encounter,
            patientId: patient!.pubpid,
            legacyPid: patient!.pid,
            reason: clinical!.reason
          })
        ])
      );

      const clinicianDetail = await requestText(
        `${target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(encounter!.encounter))}`,
        { headers: clinicianHeaders }
      );
      expect(clinicianDetail.statusCode).toBe(200);
      const detail = JSON.parse(clinicianDetail.body) as EncounterDetailResponse;
      expect(detail).toMatchObject({
        encounter: encounter!.encounter,
        patientId: patient!.pubpid,
        legacyPid: patient!.pid,
        reason: clinical!.reason
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-185-encounter-mutation-authorization-policy-clinician-read",
        description:
          "Captures modernized clinician view-only encounter search/detail access before mutation denials.",
        expected: {
          searchStatusCode: 200,
          detailStatusCode: 200,
          encounterId: encounter!.encounter,
          patientId: patient!.pubpid,
          requiredSection: "encounters",
          requiredPermission: "auth_a",
          requiredReturnValue: "view",
          sessionIdentifierRedacted: true
        },
        actual: {
          searchStatusCode: clinicianSearch.statusCode,
          detailStatusCode: clinicianDetail.statusCode,
          search: summarizeEncounterSearch(search),
          detail: summarizeEncounterDetail(detail),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-encounter-mutation-authorization-policy",
          workflow: "encounter-mutation-authorization-policy-clinician-read"
        }
      });

      const clinicianCreate = await postJson<ModernizedAuthorizationFailure>(
        target,
        "/api/encounters",
        clinicianHeaders,
        {
          patientId: patient!.pubpid,
          providerId: patient!.providerId,
          dateTime: "2026-06-18 10:00:00",
          reason: "Blocked Encounter Mutation Authorization",
          facilityId: 10,
          billingFacilityId: 10,
          billingNote: "Blocked by encounter mutation authorization policy."
        },
        403
      );
      expectAuthorizationFailure(clinicianCreate);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-185-encounter-mutation-authorization-policy-clinician-create-forbidden",
        description:
          "Captures modernized clinician encounter-create denial facts with session material redacted.",
        expected: authorizationDenialExpectation(patient!.pubpid, "create"),
        actual: {
          denial: summarizeAuthorizationFailure(clinicianCreate),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-encounter-mutation-authorization-policy",
          workflow: "encounter-mutation-authorization-policy-clinician-create-forbidden"
        }
      });

      const clinicianUpdate = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/encounters/${encodeURIComponent(String(encounter!.encounter))}`,
        clinicianHeaders,
        {
          reason: "Blocked Encounter Update",
          sensitivity: "normal",
          referralSource: "parity",
          externalId: "BLOCKED185",
          posCode: 11,
          billingNote: "Blocked by encounter mutation authorization policy."
        },
        403
      );
      expectAuthorizationFailure(clinicianUpdate);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-185-encounter-mutation-authorization-policy-clinician-update-forbidden",
        description:
          "Captures modernized clinician encounter-update denial facts with session material redacted.",
        expected: authorizationDenialExpectation(patient!.pubpid, "update", encounter!.encounter),
        actual: {
          denial: summarizeAuthorizationFailure(clinicianUpdate),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-encounter-mutation-authorization-policy",
          workflow: "encounter-mutation-authorization-policy-clinician-update-forbidden"
        }
      });

      const clinicianSign = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/encounters/${encodeURIComponent(String(encounter!.encounter))}/sign`,
        clinicianHeaders,
        {
          signerUsername: "gold-provider-01",
          signedAt: "2026-06-18 10:15:00",
          isLock: false,
          amendment: "Blocked by encounter mutation authorization policy."
        },
        403
      );
      expectAuthorizationFailure(clinicianSign);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-185-encounter-mutation-authorization-policy-clinician-sign-forbidden",
        description:
          "Captures modernized clinician encounter-sign denial facts with session material redacted.",
        expected: authorizationDenialExpectation(patient!.pubpid, "sign", encounter!.encounter),
        actual: {
          denial: summarizeAuthorizationFailure(clinicianSign),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-encounter-mutation-authorization-policy",
          workflow: "encounter-mutation-authorization-policy-clinician-sign-forbidden"
        }
      });

      const clinicianDelete = await deleteJson<ModernizedAuthorizationFailure>(
        target,
        `/api/encounters/${encodeURIComponent(String(encounter!.encounter))}`,
        clinicianHeaders,
        403
      );
      expectAuthorizationFailure(clinicianDelete);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-185-encounter-mutation-authorization-policy-clinician-delete-forbidden",
        description:
          "Captures modernized clinician encounter-delete denial facts with session material redacted.",
        expected: authorizationDenialExpectation(patient!.pubpid, "delete", encounter!.encounter),
        actual: {
          denial: summarizeAuthorizationFailure(clinicianDelete),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-encounter-mutation-authorization-policy",
          workflow: "encounter-mutation-authorization-policy-clinician-delete-forbidden"
        }
      });

      const adminDetail = await requestText(
        `${target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(encounter!.encounter))}`,
        { headers: adminHeaders }
      );
      expect(adminDetail.statusCode).toBe(200);
      const adminDetailBody = JSON.parse(adminDetail.body) as EncounterDetailResponse;
      expect(adminDetailBody.reason).toBe(clinical!.reason);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-185-encounter-mutation-authorization-policy-admin-detail",
        description:
          "Captures modernized admin encounter-detail access after clinician mutation denials with session material redacted.",
        expected: {
          statusCode: 200,
          encounterId: encounter!.encounter,
          patientId: patient!.pubpid,
          requiredSection: "encounters",
          requiredPermission: "auth_a",
          requiredReturnValue: "write",
          sessionIdentifierRedacted: true
        },
        actual: {
          statusCode: adminDetail.statusCode,
          detail: summarizeEncounterDetail(adminDetailBody),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-encounter-mutation-authorization-policy",
          workflow: "encounter-mutation-authorization-policy-admin-detail"
        }
      });
    } finally {
      if (grantActive) {
        await requestText(
          `${target.apiBaseUrl}/api/administration/access-control/group-permissions/clin/encounters/auth_a`,
          {
            method: "DELETE",
            headers: adminHeaders
          }
        );
      }
    }

    const afterCleanup = await targetDb.getAdministrationAccessControl();
    expect(afterCleanup.groupPermissions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "clin",
          sectionValue: "encounters",
          permissionValue: "auth_a"
        })
      ])
    );
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-185-encounter-mutation-authorization-policy-cleanup",
      description:
        "Captures final cleanup proving the temporary Clinicians Authorize Any Encounter grant was removed.",
      expected: {
        temporaryGrantRemoved: true,
        groupValue: "clin",
        sectionValue: "encounters",
        permissionValue: "auth_a",
        secretMaterialRedacted: true
      },
      actual: {
        accessControl: summarizeAccessControl(afterCleanup)
      },
      context: {
        suite: "workflow-encounter-mutation-authorization-policy",
        workflow: "encounter-mutation-authorization-policy-cleanup"
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

function expectAuthorizationFailure(response: ModernizedAuthorizationFailure) {
  expect(response).toMatchObject({
    authenticated: true,
    authorized: false,
    username: "gold-provider-01",
    role: "provider",
    requiredSection: "encounters",
    requiredPermission: "auth_a",
    requiredReturnValue: "write",
    sessionSource: "modernized-openemr"
  });
  expect(response.failureReason).toMatch(/not authorized/i);
}

function authorizationDenialExpectation(patientId: string, operation: string, encounterId?: number) {
  return {
    statusCode: 403,
    operation,
    patientId,
    encounterId: encounterId ?? null,
    requiredSection: "encounters",
    requiredPermission: "auth_a",
    requiredReturnValue: "write",
    sessionIdentifierRedacted: true
  };
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

function summarizeEncounterSearch(search: EncounterSearchResponse) {
  return {
    totalMatches: search.totalMatches,
    encounters: search.encounters.slice(0, 5).map((encounter) => ({
      encounter: encounter.encounter,
      patientId: encounter.patientId,
      legacyPid: encounter.legacyPid,
      reason: encounter.reason ?? null
    }))
  };
}

function summarizeEncounterDetail(detail: EncounterDetailResponse) {
  return {
    encounter: detail.encounter,
    patientId: detail.patientId,
    legacyPid: detail.legacyPid,
    reason: detail.reason ?? null,
    billingNotePresent: Boolean(detail.billingNote)
  };
}

function summarizeAccessControl(accessControl: AccessControlSnapshot) {
  return {
    groupPermissionCount: accessControl.groupPermissions.length,
    userMembershipCount: accessControl.userMemberships.length,
    adminAuthorizeAnyEncounterWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "admin" &&
        permission.sectionValue === "encounters" &&
        permission.permissionValue === "auth_a" &&
        permission.returnValue === "write"
    ),
    clinicianAuthorizeAnyEncounterView: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "clin" &&
        permission.sectionValue === "encounters" &&
        permission.permissionValue === "auth_a" &&
        permission.returnValue === "view"
    ),
    clinicianAuthorizeAnyEncounterWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "clin" &&
        permission.sectionValue === "encounters" &&
        permission.permissionValue === "auth_a" &&
        permission.returnValue === "write"
    ),
    clinicianPatientEncounterWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "clin" &&
        permission.sectionValue === "encounters" &&
        permission.permissionValue === "auth" &&
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

function encounterTopic(reason: string) {
  return reason.replace(/^Follow-up for\s+/i, "").replace(/^Comprehensive\s+/i, "");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
