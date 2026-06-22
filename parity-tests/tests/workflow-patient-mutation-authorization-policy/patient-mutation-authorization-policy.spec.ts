import { test, expect } from "../../src/fixtures/parityTest.js";
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

const patientMutationAuthorizationPatientId = "MOD-PAT-0010";

test.describe("patient chart mutation authorization policy parity @workflow-patient-mutation-authorization-policy @slice184 @patients @security", () => {
  test("enforces Demographics add-only and write ACL boundaries", async ({ page, target, targetDb }) => {
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

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientSummaryDirect(page, target, patient!.pid);
      await expectRenderedText(page, patient!.fname);
      await expectRenderedText(page, patient!.lname);
      await openPatientDemographicsEditDirect(page, target, patient!.pid);
      await expectRenderedText(page, patient!.pubpid);
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

      const adminLogin = await modernizedLogin(target, target.credentials.username, target.credentials.password);
      const adminDelete = await requestText(
        `${target.apiBaseUrl}/api/patients/${encodeURIComponent(createdPubpid)}`,
        {
          method: "DELETE",
          headers: { "X-OpenEMR-Session": adminLogin.sessionId! }
        }
      );
      expect(adminDelete.statusCode).toBe(204);
      createdLegacyPid = null;

      const afterCleanup = await targetDb.findPatientByCanonicalId(createdPubpid);
      expect(afterCleanup).toBeNull();
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

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-12) || "local";
}
