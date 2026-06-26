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

type ProcedureResultsResponse = {
  patientId: string;
  legacyPid: number;
  patientDisplayName: string;
  orders: Array<{
    id: number;
    encounter?: number | null;
    code?: string | null;
    name?: string | null;
    orderStatus?: string | null;
    reports: Array<{
      id: number;
      status?: string | null;
      results: Array<{
        text?: string | null;
        result?: string | null;
        resultStatus?: string | null;
      }>;
    }>;
  }>;
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

const procedureAuthorizationPatientId = "MOD-PAT-0009";

test.describe("procedure authorization policy parity @workflow-procedure-authorization-policy @slice182 @procedures @security", () => {
  test("enforces Lab Results access for procedure APIs and UI", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureAuthorizationPatientId);
    expect(patient).not.toBeNull();

    const procedures = await targetDb.getProcedureResultsForPatient(patient!.pid);
    const order = procedures.orders.find((item) => item.procedureName === "Complete blood count") ?? procedures.orders[0];
    expect(order).toBeDefined();
    expect(order!.encounterId).toBeTruthy();
    const report = order!.reports.find((item) => item.status === "complete") ?? order!.reports[0];
    expect(report).toBeDefined();
    const hemoglobin = report!.results.find((item) => item.text === "Hemoglobin") ?? report!.results[0];
    expect(hemoglobin).toBeDefined();

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
          groupValue: "front",
          sectionValue: "patients",
          permissionValue: "demo",
          returnValue: "write"
        })
      ])
    );
    expect(accessControl.groupPermissions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "front",
          sectionValue: "patients",
          permissionValue: "lab"
        })
      ])
    );
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-182-procedure-authorization-policy-precondition",
      description:
        "Captures the Slice 182 procedure authorization-policy precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: procedureAuthorizationPatientId,
        procedureName: "Complete blood count",
        resultText: "Hemoglobin",
        requiredSection: "patients",
        requiredPermission: "lab",
        requiredReturnValue: "view",
        adminWriteSatisfiesView: true,
        frontOfficeGroupDoesNotHaveLabResultsAccess: true,
        modernizedProcedureResultsPath: "/api/procedures/{canonicalId}",
        modernizedProcedureCatalogPath: "/api/procedures/order-catalog",
        modernizedProcedureOrderCreatePath: "/api/procedures/orders",
        secretMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true,
        patient: summarizePatient(patient!),
        procedureOrder: summarizeProcedureOrder(order!),
        procedureReport: summarizeProcedureReport(report!),
        procedureResult: summarizeProcedureResult(hemoglobin!),
        accessControl: summarizeAccessControl(accessControl)
      },
      context: {
        suite: "workflow-procedure-authorization-policy",
        workflow: "procedure-authorization-policy-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openProcedureResultsDirect(page, target, patient!.pid);
      await expectRenderedText(page, "Order Report Results");
      await expectRenderedText(page, order!.procedureName);
      await expectRenderedText(page, hemoglobin!.text);
      await expectRenderedText(page, /Final|Reviewed|complete/i);
      const procedureText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-182-procedure-authorization-policy-legacy-rendered",
        description:
          "Captures legacy OpenEMR procedure-result rendering markers after admin login, with credentials redacted.",
        expected: {
          canonicalPatientId: patient!.pubpid,
          containsOrderReportResults: "Order Report Results",
          containsProcedureName: order!.procedureName,
          containsResultText: hemoglobin!.text,
          containsFinalOrReviewedMarker: true,
          passwordMaterialRedacted: true
        },
        actual: {
          procedureResults: summarizeRenderedText(procedureText, [
            "Order Report Results",
            order!.procedureName,
            hemoglobin!.text,
            "Final",
            "Reviewed",
            "complete"
          ]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-procedure-authorization-policy",
          workflow: "procedure-authorization-policy-legacy-rendered"
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
      probe: "slice-182-procedure-authorization-policy-frontdesk-login",
      description:
        "Captures modernized front-desk session setup for procedure policy checks with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: "gold-frontdesk-01",
        role: "frontdesk",
        staffId: 117,
        sessionIdentifierRedacted: true
      },
      actual: summarizeLogin(frontDeskLogin),
      context: {
        suite: "workflow-procedure-authorization-policy",
        workflow: "procedure-authorization-policy-frontdesk-login"
      }
    });

    const frontDeskProcedureResults = await requestText(
      `${target.apiBaseUrl}/api/procedures/${encodeURIComponent(patient!.pubpid)}`,
      {
        headers: {
          "X-OpenEMR-Session": frontDeskLogin.sessionId!
        }
      }
    );
    expect(frontDeskProcedureResults.statusCode).toBe(403);
    const frontDeskFailure = JSON.parse(frontDeskProcedureResults.body) as ModernizedAuthorizationFailure;
    expect(frontDeskFailure).toMatchObject({
      authenticated: true,
      authorized: false,
      username: "gold-frontdesk-01",
      role: "frontdesk",
      requiredSection: "patients",
      requiredPermission: "lab",
      requiredReturnValue: "view",
      sessionSource: "modernized-openemr"
    });
    expect(frontDeskFailure.failureReason).toMatch(/not authorized/i);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-182-procedure-authorization-policy-frontdesk-results-forbidden",
      description:
        "Captures modernized front-desk procedure-result rejection facts with session material redacted.",
      expected: {
        statusCode: 403,
        authenticated: true,
        authorized: false,
        username: "gold-frontdesk-01",
        role: "frontdesk",
        requiredSection: "patients",
        requiredPermission: "lab",
        requiredReturnValue: "view",
        failureReasonContains: "not authorized",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskProcedureResults.statusCode,
        body: summarizeAuthorizationFailure(frontDeskFailure)
      },
      context: {
        suite: "workflow-procedure-authorization-policy",
        workflow: "procedure-authorization-policy-frontdesk-results-forbidden"
      }
    });

    const frontDeskCatalog = await requestText(`${target.apiBaseUrl}/api/procedures/order-catalog`, {
      headers: {
        "X-OpenEMR-Session": frontDeskLogin.sessionId!
      }
    });
    expect(frontDeskCatalog.statusCode).toBe(403);
    const frontDeskCatalogFailure = JSON.parse(frontDeskCatalog.body) as ModernizedAuthorizationFailure;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-182-procedure-authorization-policy-frontdesk-catalog-forbidden",
      description:
        "Captures modernized front-desk procedure order-catalog rejection facts with session material redacted.",
      expected: {
        statusCode: 403,
        catalogRejected: true,
        requiredSection: "patients",
        requiredPermission: "lab",
        requiredReturnValue: "view",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskCatalog.statusCode,
        body: summarizeAuthorizationFailure(frontDeskCatalogFailure)
      },
      context: {
        suite: "workflow-procedure-authorization-policy",
        workflow: "procedure-authorization-policy-frontdesk-catalog-forbidden"
      }
    });

    const frontDeskMutationBody = JSON.stringify({
      patientId: patient!.pubpid,
      providerId: 101,
      labId: 501,
      encounterId: order!.encounterId,
      dateOrdered: "2026-06-18",
      priority: "routine",
      status: "pending",
      procedureCode: "85025",
      procedureName: "Blocked Procedure Authorization Order",
      procedureType: "laboratory",
      diagnosis: "Z00.00",
      instructions: "This request should be rejected before mutation."
    });
    const frontDeskMutation = await requestText(`${target.apiBaseUrl}/api/procedures/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(frontDeskMutationBody)),
        "X-OpenEMR-Session": frontDeskLogin.sessionId!
      },
      body: frontDeskMutationBody
    });
    expect(frontDeskMutation.statusCode).toBe(403);
    const frontDeskMutationFailure = JSON.parse(frontDeskMutation.body) as ModernizedAuthorizationFailure;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-182-procedure-authorization-policy-frontdesk-create-forbidden",
      description:
        "Captures modernized front-desk procedure-order create rejection facts with request and session material redacted.",
      expected: {
        statusCode: 403,
        createRejected: true,
        requiredSection: "patients",
        requiredPermission: "lab",
        requiredReturnValue: "addonly",
        submittedProcedureCode: "85025",
        submittedProcedureName: "Blocked Procedure Authorization Order",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskMutation.statusCode,
        body: summarizeAuthorizationFailure(frontDeskMutationFailure),
        request: {
          patientId: patient!.pubpid,
          providerId: 101,
          labId: 501,
          encounterId: order!.encounterId,
          dateOrdered: "2026-06-18",
          priority: "routine",
          status: "pending",
          procedureCode: "85025",
          procedureName: "Blocked Procedure Authorization Order",
          procedureType: "laboratory",
          diagnosis: "Z00.00",
          passwordRedacted: true,
          sessionHeaderRedacted: true
        }
      },
      context: {
        suite: "workflow-procedure-authorization-policy",
        workflow: "procedure-authorization-policy-frontdesk-create-forbidden"
      }
    });

    const adminLogin = await modernizedLogin(target, target.credentials.username, target.credentials.password);
    expect(adminLogin).toMatchObject({
      authenticated: true,
      username: "admin",
      role: "administrator"
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-182-procedure-authorization-policy-admin-login",
      description:
        "Captures modernized admin session setup for procedure policy checks with password and session identifier redacted.",
      expected: {
        authenticated: true,
        username: "admin",
        role: "administrator",
        sessionIdentifierRedacted: true,
        passwordMaterialRedacted: true
      },
      actual: summarizeLogin(adminLogin),
      context: {
        suite: "workflow-procedure-authorization-policy",
        workflow: "procedure-authorization-policy-admin-login"
      }
    });

    const adminProcedureResults = await requestText(
      `${target.apiBaseUrl}/api/procedures/${encodeURIComponent(patient!.pubpid)}`,
      {
        headers: {
          "X-OpenEMR-Session": adminLogin.sessionId!
        }
      }
    );
    expect(adminProcedureResults.statusCode).toBe(200);
    const adminProceduresBody = JSON.parse(adminProcedureResults.body) as ProcedureResultsResponse;
    const adminOrder = adminProceduresBody.orders.find((item) => item.name === order!.procedureName);
    const adminReport = adminOrder?.reports.find((item) => item.status === report!.status) ?? adminOrder?.reports[0];
    const adminHemoglobin = adminReport?.results.find((item) => item.text === hemoglobin!.text);
    expect(adminProceduresBody).toMatchObject({
      patientId: patient!.pubpid,
      legacyPid: patient!.pid,
      patientDisplayName: `${patient!.lname}, ${patient!.fname}`
    });
    expect(adminOrder).toMatchObject({
      code: order!.procedureCode,
      name: order!.procedureName,
      orderStatus: order!.orderStatus
    });
    expect(adminHemoglobin).toMatchObject({
      text: hemoglobin!.text,
      result: hemoglobin!.result,
      resultStatus: hemoglobin!.resultStatus
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-182-procedure-authorization-policy-admin-results",
      description:
        "Captures modernized admin procedure-result allow facts with session material redacted.",
      expected: {
        statusCode: 200,
        patientId: patient!.pubpid,
        legacyPid: patient!.pid,
        patientDisplayName: `${patient!.lname}, ${patient!.fname}`,
        procedureCode: order!.procedureCode,
        procedureName: order!.procedureName,
        resultText: hemoglobin!.text,
        resultValue: hemoglobin!.result,
        resultStatus: hemoglobin!.resultStatus,
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: adminProcedureResults.statusCode,
        procedureResults: summarizeProcedureResultsResponse(adminProceduresBody, order!.procedureName),
        includesAnchorOrder: Boolean(adminOrder),
        includesAnchorResult: Boolean(adminHemoglobin),
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-procedure-authorization-policy",
        workflow: "procedure-authorization-policy-admin-results"
      }
    });

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Procedures" }).click();
    await expect(page.getByRole("heading", { name: "Procedures", exact: true })).toBeVisible();

    const accessPanel = page.locator('form[aria-label="Procedures access"]');
    await accessPanel.getByLabel("Username").fill("gold-frontdesk-01");
    await accessPanel.getByLabel("Password").fill("pass");
    await accessPanel.getByRole("button", { name: "Verify Procedures Access" }).click();

    await expect(page.locator("body")).toContainText("Signed in as Parker Fleming");
    await expect(page.locator("body")).toContainText("Procedure results load requires Procedure access");
    await expect(page.locator("body")).not.toContainText(order!.procedureName);

    await accessPanel.getByLabel("Username").fill(target.credentials.username);
    await accessPanel.getByLabel("Password").fill(target.credentials.password);
    await accessPanel.getByRole("button", { name: "Verify Procedures Access" }).click();
    await expect(page.getByLabel("Procedure patient ID")).toBeEnabled();
    await page.getByLabel("Procedure patient ID").fill(patient!.pubpid);

    await expect(page.getByRole("heading", { name: `${patient!.lname}, ${patient!.fname}` })).toBeVisible();
    await expect(page.locator("body")).toContainText("Order Report Results");
    await expect(page.locator("body")).toContainText(order!.procedureName);
    await expect(page.locator("body")).toContainText(order!.procedureCode);
    await expect(page.locator("body")).toContainText(hemoglobin!.text);
    await expect(page.locator("body")).toContainText(hemoglobin!.result);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-182-procedure-authorization-policy-rendered",
      description:
        "Captures modernized Procedures-page ACL retry rendering facts for front-desk denial followed by admin allow.",
      expected: {
        frontDeskSignedIn: "Signed in as Parker Fleming",
        frontDeskDeniedMessage: "Procedure results load requires Procedure access",
        hidesProcedureForFrontDesk: true,
        rendersPatientHeadingForAdmin: `${patient!.lname}, ${patient!.fname}`,
        rendersOrderReportResultsForAdmin: "Order Report Results",
        rendersProcedureNameForAdmin: order!.procedureName,
        rendersProcedureCodeForAdmin: order!.procedureCode,
        rendersResultTextForAdmin: hemoglobin!.text,
        rendersResultValueForAdmin: hemoglobin!.result
      },
      actual: {
        surfaceFacts: {
          modernizedProceduresPage: {
            renderedFrontDeskSignedIn: "Signed in as Parker Fleming",
            renderedFrontDeskDeniedMessage: "Procedure results load requires Procedure access",
            didNotRenderProcedureForFrontDesk: true,
            renderedPatientHeadingForAdmin: `${patient!.lname}, ${patient!.fname}`,
            renderedOrderReportResultsForAdmin: "Order Report Results",
            renderedProcedureNameForAdmin: order!.procedureName,
            renderedProcedureCodeForAdmin: order!.procedureCode,
            renderedResultTextForAdmin: hemoglobin!.text,
            renderedResultValueForAdmin: hemoglobin!.result,
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-procedure-authorization-policy",
        workflow: "procedure-authorization-policy-rendered"
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

function summarizePatient(patient: { pubpid: string; pid: number; lname: string; fname: string }) {
  return {
    canonicalId: patient.pubpid,
    legacyPid: patient.pid,
    displayName: `${patient.lname}, ${patient.fname}`
  };
}

function summarizeProcedureOrder(order: {
  id?: number | string | null;
  procedureCode?: string | null;
  procedureName?: string | null;
  orderStatus?: string | null;
  encounterId?: number | null;
}) {
  return {
    id: order.id ?? null,
    procedureCode: order.procedureCode ?? null,
    procedureName: order.procedureName ?? null,
    orderStatus: order.orderStatus ?? null,
    encounterId: order.encounterId ?? null
  };
}

function summarizeProcedureReport(report: {
  id?: number | string | null;
  status?: string | null;
  reportDate?: string | null;
  collectedDate?: string | null;
}) {
  return {
    id: report.id ?? null,
    status: report.status ?? null,
    reportDate: report.reportDate ?? null,
    collectedDate: report.collectedDate ?? null
  };
}

function summarizeProcedureResult(result: {
  text?: string | null;
  result?: string | null;
  resultStatus?: string | null;
  range?: string | null;
  abnormal?: string | null;
}) {
  return {
    text: result.text ?? null,
    result: result.result ?? null,
    resultStatus: result.resultStatus ?? null,
    range: result.range ?? null,
    abnormal: result.abnormal ?? null
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
    frontOfficeDemographicsWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "front" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "demo" &&
        permission.returnValue === "write"
    ),
    frontOfficeLabResultsAccess: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "front" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "lab"
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

function summarizeProcedureResultsResponse(response: ProcedureResultsResponse, anchorProcedureName: string) {
  const selectedOrder = response.orders.find((item) => item.name === anchorProcedureName) ?? null;
  return {
    patientId: response.patientId,
    legacyPid: response.legacyPid,
    patientDisplayName: response.patientDisplayName,
    orderCount: response.orders.length,
    selectedOrder: selectedOrder
      ? {
          id: selectedOrder.id,
          encounter: selectedOrder.encounter ?? null,
          code: selectedOrder.code ?? null,
          name: selectedOrder.name ?? null,
          orderStatus: selectedOrder.orderStatus ?? null,
          reportCount: selectedOrder.reports.length,
          sampleReports: selectedOrder.reports.slice(0, 3)
        }
      : null
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
