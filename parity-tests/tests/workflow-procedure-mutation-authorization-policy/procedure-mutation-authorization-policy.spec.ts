import { test, expect } from "../../src/fixtures/parityTest.js";
import { requestText } from "../../src/http/httpClient.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureResultsDirect
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

type ProcedureMutationResponse = {
  id: number;
};

const procedureMutationAuthorizationPatientId = "MOD-PAT-0009";

test.describe("procedure mutation authorization policy parity @workflow-procedure-mutation-authorization-policy @slice183 @procedures @security", () => {
  test("enforces procedure add-only, write, and sign ACL boundaries", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureMutationAuthorizationPatientId);
    expect(patient).not.toBeNull();

    const procedures = await targetDb.getProcedureResultsForPatient(patient!.pid);
    const anchorOrder = procedures.orders.find((item) => item.procedureName === "Complete blood count") ?? procedures.orders[0];
    expect(anchorOrder).toBeDefined();
    expect(anchorOrder!.encounterId).toBeTruthy();
    const anchorReport = anchorOrder!.reports.find((item) => item.status === "complete") ?? anchorOrder!.reports[0];
    expect(anchorReport).toBeDefined();

    const accessControl = await targetDb.getAdministrationAccessControl();
    expect(accessControl.groupPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "admin",
          sectionValue: "patients",
          permissionValue: "lab",
          returnValue: "write"
        }),
        expect.objectContaining({
          groupValue: "admin",
          sectionValue: "patients",
          permissionValue: "sign",
          returnValue: "write"
        }),
        expect.objectContaining({
          groupValue: "clin",
          sectionValue: "patients",
          permissionValue: "lab",
          returnValue: "addonly"
        })
      ])
    );
    expect(accessControl.groupPermissions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "clin",
          sectionValue: "patients",
          permissionValue: "lab",
          returnValue: "write"
        }),
        expect.objectContaining({
          groupValue: "clin",
          sectionValue: "patients",
          permissionValue: "sign"
        })
      ])
    );

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openProcedureResultsDirect(page, target, patient!.pid);
      await expectRenderedText(page, "Order Report Results");
      await expectRenderedText(page, anchorOrder!.procedureName);
      await expectRenderedText(page, anchorReport!.specimenNumber);
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

    const suffix = workflowSuffix();
    const procedureName = `Addonly Procedure Auth ${suffix}`;
    const clinicianLogin = await modernizedLogin(target, "gold-provider-01", "pass");
    expect(clinicianLogin).toMatchObject({
      authenticated: true,
      username: "gold-provider-01",
      displayName: "Alex Walker",
      role: "provider",
      staffId: 101
    });

    const clinicianHeaders = { "X-OpenEMR-Session": clinicianLogin.sessionId! };
    const clinicianRead = await requestText(`${target.apiBaseUrl}/api/procedures/${encodeURIComponent(patient!.pubpid)}`, {
      headers: clinicianHeaders
    });
    expect(clinicianRead.statusCode).toBe(200);
    expect(clinicianRead.body).toContain(anchorOrder!.procedureName);

    let createdOrderId: number | null = null;
    try {
      const createOrder = await postJson<ProcedureMutationResponse>(
        target,
        "/api/procedures/orders",
        clinicianHeaders,
        {
          patientId: patient!.pubpid,
          providerId: patient!.providerId,
          labId: 501,
          encounterId: anchorOrder!.encounterId,
          dateOrdered: "2026-06-18",
          priority: "routine",
          status: "pending",
          procedureCode: "85025",
          procedureName,
          procedureType: "laboratory",
          diagnosis: "Z00.00",
          instructions: "Created by the procedure mutation authorization policy suite."
        },
        201
      );
      createdOrderId = createOrder.id;
      expect(createdOrderId).toBeGreaterThan(0);

      const createReport = await postJson<ProcedureMutationResponse>(
        target,
        "/api/procedures/reports",
        clinicianHeaders,
        {
          orderId: createdOrderId,
          dateCollected: "2026-06-18 12:30:00",
          dateReport: "2026-06-18 13:00:00",
          specimenNumber: `ADDONLY-${suffix}`,
          reportStatus: "final",
          reviewStatus: "received",
          notes: "Created by the procedure mutation authorization policy suite."
        },
        201
      );
      const createdReportId = createReport.id;
      expect(createdReportId).toBeGreaterThan(0);

      const clinicianUpdate = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/procedures/orders/${createdOrderId}/status`,
        clinicianHeaders,
        { status: "complete" },
        403
      );
      expect(clinicianUpdate).toMatchObject({
        authenticated: true,
        authorized: false,
        username: "gold-provider-01",
        role: "provider",
        requiredSection: "patients",
        requiredPermission: "lab",
        requiredReturnValue: "write",
        sessionSource: "modernized-openemr"
      });

      const clinicianSign = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/procedures/reports/${createdReportId}/sign`,
        clinicianHeaders,
        {
          reviewedBy: "gold-provider-01",
          reviewedAt: "2026-06-18 13:30:00"
        },
        403
      );
      expect(clinicianSign).toMatchObject({
        authenticated: true,
        authorized: false,
        username: "gold-provider-01",
        role: "provider",
        requiredSection: "patients",
        requiredPermission: "sign",
        requiredReturnValue: "write",
        sessionSource: "modernized-openemr"
      });

      const clinicianDelete = await requestText(`${target.apiBaseUrl}/api/procedures/orders/${createdOrderId}`, {
        method: "DELETE",
        headers: clinicianHeaders
      });
      expect(clinicianDelete.statusCode).toBe(403);

      const adminLogin = await modernizedLogin(target, target.credentials.username, target.credentials.password);
      const adminHeaders = { "X-OpenEMR-Session": adminLogin.sessionId! };
      const adminComplete = await putJson<ProcedureMutationResponse>(
        target,
        `/api/procedures/orders/${createdOrderId}/status`,
        adminHeaders,
        { status: "complete" },
        200
      );
      expect(adminComplete.id).toBe(createdOrderId);

      const adminSign = await putJson<ProcedureMutationResponse>(
        target,
        `/api/procedures/reports/${createdReportId}/sign`,
        adminHeaders,
        {
          reviewedBy: "admin",
          reviewedAt: "2026-06-18 13:45:00"
        },
        200
      );
      expect(adminSign.id).toBe(createdReportId);

      const adminDelete = await requestText(`${target.apiBaseUrl}/api/procedures/orders/${createdOrderId}`, {
        method: "DELETE",
        headers: adminHeaders
      });
      expect(adminDelete.statusCode).toBe(204);
      createdOrderId = null;

      const afterCleanup = await targetDb.getProcedureResultsForPatient(patient!.pid);
      expect(afterCleanup.orders.find((item) => item.procedureName === procedureName)).toBeUndefined();
    } finally {
      if (createdOrderId !== null) {
        const adminLogin = await modernizedLogin(target, target.credentials.username, target.credentials.password);
        await requestText(`${target.apiBaseUrl}/api/procedures/orders/${createdOrderId}`, {
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
