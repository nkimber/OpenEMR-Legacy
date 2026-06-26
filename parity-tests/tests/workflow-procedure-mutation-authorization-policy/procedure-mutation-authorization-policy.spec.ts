import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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

const procedureMutationAuthorizationPatientId = "MOD-PAT-0009";

test.describe("procedure mutation authorization policy parity @workflow-procedure-mutation-authorization-policy @slice183 @procedures @security", () => {
  test("enforces procedure add-only, write, and sign ACL boundaries", async ({ page, target, targetDb }, testInfo) => {
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-183-procedure-mutation-authorization-policy-precondition",
      description:
        "Captures the Slice 183 procedure mutation authorization-policy precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: procedureMutationAuthorizationPatientId,
        anchorProcedureName: "Complete blood count",
        requiredLabAddOnlyForClinicianCreate: true,
        requiredLabWriteForStatusAndDelete: true,
        requiredSignWriteForReportSign: true,
        adminLabWriteSatisfiesMutation: true,
        adminSignWriteSatisfiesSignoff: true,
        clinicianHasLabAddOnly: true,
        clinicianDoesNotHaveLabWriteOrSign: true,
        modernizedOrderCreatePath: "/api/procedures/orders",
        modernizedReportCreatePath: "/api/procedures/reports",
        modernizedOrderStatusPath: "/api/procedures/orders/{orderId}/status",
        modernizedReportSignPath: "/api/procedures/reports/{reportId}/sign",
        modernizedOrderDeletePath: "/api/procedures/orders/{orderId}",
        secretMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true,
        patient: summarizePatient(patient!),
        anchorOrder: summarizeProcedureOrder(anchorOrder!),
        anchorReport: summarizeProcedureReport(anchorReport!),
        accessControl: summarizeAccessControl(accessControl)
      },
      context: {
        suite: "workflow-procedure-mutation-authorization-policy",
        workflow: "procedure-mutation-authorization-policy-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openProcedureResultsDirect(page, target, patient!.pid);
      await expectRenderedText(page, "Order Report Results");
      await expectRenderedText(page, anchorOrder!.procedureName);
      await expectRenderedText(page, anchorReport!.specimenNumber);
      const procedureText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-183-procedure-mutation-authorization-policy-legacy-rendered",
        description:
          "Captures legacy OpenEMR procedure-result rendering markers after admin login, with credentials redacted.",
        expected: {
          canonicalPatientId: patient!.pubpid,
          containsOrderReportResults: "Order Report Results",
          containsProcedureName: anchorOrder!.procedureName,
          containsSpecimenNumber: anchorReport!.specimenNumber,
          passwordMaterialRedacted: true
        },
        actual: {
          procedureResults: summarizeRenderedText(procedureText, [
            "Order Report Results",
            anchorOrder!.procedureName,
            anchorReport!.specimenNumber
          ]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-procedure-mutation-authorization-policy",
          workflow: "procedure-mutation-authorization-policy-legacy-rendered"
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-183-procedure-mutation-authorization-policy-clinician-login",
      description:
        "Captures modernized clinician session setup for procedure mutation policy checks with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: "gold-provider-01",
        role: "provider",
        staffId: 101,
        sessionIdentifierRedacted: true
      },
      actual: summarizeLogin(clinicianLogin),
      context: {
        suite: "workflow-procedure-mutation-authorization-policy",
        workflow: "procedure-mutation-authorization-policy-clinician-login"
      }
    });

    const clinicianHeaders = { "X-OpenEMR-Session": clinicianLogin.sessionId! };
    const clinicianRead = await requestText(`${target.apiBaseUrl}/api/procedures/${encodeURIComponent(patient!.pubpid)}`, {
      headers: clinicianHeaders
    });
    expect(clinicianRead.statusCode).toBe(200);
    expect(clinicianRead.body).toContain(anchorOrder!.procedureName);
    const clinicianReadBody = JSON.parse(clinicianRead.body) as {
      patientId: string;
      patientDisplayName: string;
      orders: Array<{ name?: string | null; code?: string | null; orderStatus?: string | null }>;
    };
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-183-procedure-mutation-authorization-policy-clinician-read",
      description:
        "Captures modernized clinician Lab Results add-only read visibility with session material redacted.",
      expected: {
        statusCode: 200,
        patientId: patient!.pubpid,
        anchorProcedureName: anchorOrder!.procedureName,
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: clinicianRead.statusCode,
        body: {
          patientId: clinicianReadBody.patientId,
          patientDisplayName: clinicianReadBody.patientDisplayName,
          orderCount: clinicianReadBody.orders.length,
          includesAnchorProcedure: clinicianReadBody.orders.some((order) => order.name === anchorOrder!.procedureName),
          sampleOrders: clinicianReadBody.orders.slice(0, 5)
        },
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-procedure-mutation-authorization-policy",
        workflow: "procedure-mutation-authorization-policy-clinician-read"
      }
    });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-183-procedure-mutation-authorization-policy-clinician-order-created",
        description:
          "Captures modernized clinician Lab Results add-only order creation facts with request and session material redacted.",
        expected: {
          statusCode: 201,
          createdOrderIdGreaterThanZero: true,
          patientId: patient!.pubpid,
          procedureName,
          procedureCode: "85025",
          requiredSection: "patients",
          requiredPermission: "lab",
          requiredReturnValue: "addonly",
          sessionIdentifierRedacted: true
        },
        actual: {
          response: createOrder,
          request: {
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
            passwordRedacted: true,
            sessionHeaderRedacted: true
          }
        },
        context: {
          suite: "workflow-procedure-mutation-authorization-policy",
          workflow: "procedure-mutation-authorization-policy-clinician-order-created"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-183-procedure-mutation-authorization-policy-clinician-report-created",
        description:
          "Captures modernized clinician Lab Results add-only report creation facts with request and session material redacted.",
        expected: {
          statusCode: 201,
          createdReportIdGreaterThanZero: true,
          orderId: createdOrderId,
          specimenNumber: `ADDONLY-${suffix}`,
          requiredSection: "patients",
          requiredPermission: "lab",
          requiredReturnValue: "addonly",
          sessionIdentifierRedacted: true
        },
        actual: {
          response: createReport,
          request: {
            orderId: createdOrderId,
            dateCollected: "2026-06-18 12:30:00",
            dateReport: "2026-06-18 13:00:00",
            specimenNumber: `ADDONLY-${suffix}`,
            reportStatus: "final",
            reviewStatus: "received",
            passwordRedacted: true,
            sessionHeaderRedacted: true
          }
        },
        context: {
          suite: "workflow-procedure-mutation-authorization-policy",
          workflow: "procedure-mutation-authorization-policy-clinician-report-created"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-183-procedure-mutation-authorization-policy-clinician-status-forbidden",
        description:
          "Captures modernized clinician Lab Results write denial for order status update with session material redacted.",
        expected: {
          statusCode: 403,
          orderId: createdOrderId,
          requiredSection: "patients",
          requiredPermission: "lab",
          requiredReturnValue: "write",
          sessionIdentifierRedacted: true
        },
        actual: {
          body: summarizeAuthorizationFailure(clinicianUpdate),
          request: {
            status: "complete",
            passwordRedacted: true,
            sessionHeaderRedacted: true
          }
        },
        context: {
          suite: "workflow-procedure-mutation-authorization-policy",
          workflow: "procedure-mutation-authorization-policy-clinician-status-forbidden"
        }
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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-183-procedure-mutation-authorization-policy-clinician-sign-forbidden",
        description:
          "Captures modernized clinician Sign Lab Results denial for report sign-off with session material redacted.",
        expected: {
          statusCode: 403,
          reportId: createdReportId,
          requiredSection: "patients",
          requiredPermission: "sign",
          requiredReturnValue: "write",
          sessionIdentifierRedacted: true
        },
        actual: {
          body: summarizeAuthorizationFailure(clinicianSign),
          request: {
            reviewedBy: "gold-provider-01",
            reviewedAt: "2026-06-18 13:30:00",
            passwordRedacted: true,
            sessionHeaderRedacted: true
          }
        },
        context: {
          suite: "workflow-procedure-mutation-authorization-policy",
          workflow: "procedure-mutation-authorization-policy-clinician-sign-forbidden"
        }
      });

      const clinicianDelete = await requestText(`${target.apiBaseUrl}/api/procedures/orders/${createdOrderId}`, {
        method: "DELETE",
        headers: clinicianHeaders
      });
      expect(clinicianDelete.statusCode).toBe(403);
      const clinicianDeleteFailure = JSON.parse(clinicianDelete.body) as ModernizedAuthorizationFailure;
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-183-procedure-mutation-authorization-policy-clinician-delete-forbidden",
        description:
          "Captures modernized clinician Lab Results write denial for procedure-order deletion with session material redacted.",
        expected: {
          statusCode: 403,
          orderId: createdOrderId,
          requiredSection: "patients",
          requiredPermission: "lab",
          requiredReturnValue: "write",
          sessionIdentifierRedacted: true
        },
        actual: {
          statusCode: clinicianDelete.statusCode,
          body: summarizeAuthorizationFailure(clinicianDeleteFailure),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-procedure-mutation-authorization-policy",
          workflow: "procedure-mutation-authorization-policy-clinician-delete-forbidden"
        }
      });

      const adminLogin = await modernizedLogin(target, target.credentials.username, target.credentials.password);
      const adminHeaders = { "X-OpenEMR-Session": adminLogin.sessionId! };
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-183-procedure-mutation-authorization-policy-admin-login",
        description:
          "Captures modernized admin session setup for procedure mutation cleanup with password and session identifier redacted.",
        expected: {
          authenticated: true,
          username: "admin",
          role: "administrator",
          sessionIdentifierRedacted: true,
          passwordMaterialRedacted: true
        },
        actual: summarizeLogin(adminLogin),
        context: {
          suite: "workflow-procedure-mutation-authorization-policy",
          workflow: "procedure-mutation-authorization-policy-admin-login"
        }
      });
      const adminComplete = await putJson<ProcedureMutationResponse>(
        target,
        `/api/procedures/orders/${createdOrderId}/status`,
        adminHeaders,
        { status: "complete" },
        200
      );
      expect(adminComplete.id).toBe(createdOrderId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-183-procedure-mutation-authorization-policy-admin-status-updated",
        description:
          "Captures modernized admin Lab Results write allow facts for order status update with session material redacted.",
        expected: {
          statusCode: 200,
          orderId: createdOrderId,
          status: "complete",
          requiredSection: "patients",
          requiredPermission: "lab",
          requiredReturnValue: "write",
          sessionIdentifierRedacted: true
        },
        actual: {
          response: adminComplete,
          request: {
            status: "complete",
            passwordRedacted: true,
            sessionHeaderRedacted: true
          }
        },
        context: {
          suite: "workflow-procedure-mutation-authorization-policy",
          workflow: "procedure-mutation-authorization-policy-admin-status-updated"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-183-procedure-mutation-authorization-policy-admin-signed",
        description:
          "Captures modernized admin Sign Lab Results allow facts for report sign-off with session material redacted.",
        expected: {
          statusCode: 200,
          reportId: createdReportId,
          reviewedBy: "admin",
          requiredSection: "patients",
          requiredPermission: "sign",
          requiredReturnValue: "write",
          sessionIdentifierRedacted: true
        },
        actual: {
          response: adminSign,
          request: {
            reviewedBy: "admin",
            reviewedAt: "2026-06-18 13:45:00",
            passwordRedacted: true,
            sessionHeaderRedacted: true
          }
        },
        context: {
          suite: "workflow-procedure-mutation-authorization-policy",
          workflow: "procedure-mutation-authorization-policy-admin-signed"
        }
      });

      const adminDelete = await requestText(`${target.apiBaseUrl}/api/procedures/orders/${createdOrderId}`, {
        method: "DELETE",
        headers: adminHeaders
      });
      expect(adminDelete.statusCode).toBe(204);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-183-procedure-mutation-authorization-policy-admin-deleted",
        description:
          "Captures modernized admin Lab Results write allow facts for procedure-order deletion with session material redacted.",
        expected: {
          statusCode: 204,
          orderId: createdOrderId,
          requiredSection: "patients",
          requiredPermission: "lab",
          requiredReturnValue: "write",
          sessionIdentifierRedacted: true
        },
        actual: {
          statusCode: adminDelete.statusCode,
          responseBodyLength: adminDelete.body.length,
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-procedure-mutation-authorization-policy",
          workflow: "procedure-mutation-authorization-policy-admin-deleted"
        }
      });
      createdOrderId = null;

      const afterCleanup = await targetDb.getProcedureResultsForPatient(patient!.pid);
      expect(afterCleanup.orders.find((item) => item.procedureName === procedureName)).toBeUndefined();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-183-procedure-mutation-authorization-policy-cleanup",
        description:
          "Captures final procedure mutation authorization-policy cleanup state after admin deletion.",
        expected: {
          temporaryProcedureName: procedureName,
          temporaryOrderRemoved: true,
          patientId: patient!.pubpid
        },
        actual: {
          orderCount: afterCleanup.orders.length,
          temporaryOrderPresent: afterCleanup.orders.some((item) => item.procedureName === procedureName),
          sampleOrders: afterCleanup.orders.slice(0, 5).map(summarizeProcedureOrder)
        },
        context: {
          suite: "workflow-procedure-mutation-authorization-policy",
          workflow: "procedure-mutation-authorization-policy-cleanup"
        }
      });
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

function summarizeProcedureOrder(order: {
  id?: number | string | null;
  procedureCode?: string | null;
  procedureName?: string | null;
  orderStatus?: string | null;
  encounterId?: number | null;
  reports?: Array<unknown>;
}) {
  return {
    id: order.id ?? null,
    procedureCode: order.procedureCode ?? null,
    procedureName: order.procedureName ?? null,
    orderStatus: order.orderStatus ?? null,
    encounterId: order.encounterId ?? null,
    reportCount: order.reports?.length ?? null
  };
}

function summarizeProcedureReport(report: {
  id?: number | string | null;
  status?: string | null;
  specimenNumber?: string | null;
  reportDate?: string | null;
  collectedDate?: string | null;
}) {
  return {
    id: report.id ?? null,
    status: report.status ?? null,
    specimenNumber: report.specimenNumber ?? null,
    reportDate: report.reportDate ?? null,
    collectedDate: report.collectedDate ?? null
  };
}

function summarizeAccessControl(accessControl: AccessControlSnapshot) {
  return {
    groupPermissionCount: accessControl.groupPermissions.length,
    userMembershipCount: accessControl.userMemberships.length,
    adminLabResultsWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "admin" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "lab" &&
        permission.returnValue === "write"
    ),
    adminSignLabResultsWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "admin" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "sign" &&
        permission.returnValue === "write"
    ),
    clinicianLabResultsAddOnly: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "clin" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "lab" &&
        permission.returnValue === "addonly"
    ),
    clinicianLabResultsWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "clin" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "lab" &&
        permission.returnValue === "write"
    ),
    clinicianSignLabResultsAccess: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "clin" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "sign"
    ),
    providerClinicianMembership: accessControl.userMemberships.some(
      (membership) => membership.userValue === "gold-provider-01" && membership.groupValue === "clin"
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
