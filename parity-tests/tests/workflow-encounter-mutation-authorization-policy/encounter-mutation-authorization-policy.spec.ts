import { test, expect } from "../../src/fixtures/parityTest.js";
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

const encounterMutationAuthorizationPatientId = "MOD-PAT-0001";
const encounterMutationAuthorizationFromDate = "2026-01-01";

test.describe("encounter mutation authorization policy parity @workflow-encounter-mutation-authorization-policy @slice185 @encounters @security", () => {
  test("enforces Authorize Any Encounter write access for core encounter mutations", async ({ page, target, targetDb }) => {
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

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
      await expectRenderedText(page, new RegExp(escapeRegex(encounterTopic(clinical!.reason)), "i"));
      await expectRenderedText(page, "SOAP");
      await expectRenderedText(page, "Vitals");
      await expectRenderedText(page, /Assessment:/i);
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

      const clinicianDelete = await deleteJson<ModernizedAuthorizationFailure>(
        target,
        `/api/encounters/${encodeURIComponent(String(encounter!.encounter))}`,
        clinicianHeaders,
        403
      );
      expectAuthorizationFailure(clinicianDelete);

      const adminDetail = await requestText(
        `${target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(encounter!.encounter))}`,
        { headers: adminHeaders }
      );
      expect(adminDetail.statusCode).toBe(200);
      const adminDetailBody = JSON.parse(adminDetail.body) as EncounterDetailResponse;
      expect(adminDetailBody.reason).toBe(clinical!.reason);
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

function encounterTopic(reason: string) {
  return reason.replace(/^Follow-up for\s+/i, "").replace(/^Comprehensive\s+/i, "");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
