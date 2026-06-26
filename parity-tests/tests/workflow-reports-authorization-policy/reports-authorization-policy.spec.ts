import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { requestText } from "../../src/http/httpClient.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openClinicalReportsDirect,
  openPatientListReportDirect
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

test.describe("operational reports authorization policy parity @workflow-reports-authorization-policy @slice174 @reports @security", () => {
  test("enforces Patient Report access for operational report APIs and UI", async ({ page, target, targetDb }, testInfo) => {
    const accessControl = await targetDb.getAdministrationAccessControl();
    expect(accessControl.groupPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "admin",
          sectionValue: "patients",
          permissionValue: "pat_rep",
          returnValue: "write"
        })
      ])
    );
    expect(accessControl.groupPermissions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "front",
          sectionValue: "patients",
          permissionValue: "pat_rep"
        })
      ])
    );
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-174-reports-authorization-policy-precondition",
      description:
        "Captures the Slice 174 operational reports authorization-policy precondition without storing password, cookie, or session material.",
      expected: {
        requiredSection: "patients",
        requiredPermission: "pat_rep",
        requiredReturnValue: "view",
        adminWriteSatisfiesView: true,
        adminGroupHasPatientReportWrite: true,
        frontOfficeGroupDoesNotHavePatientReportAccess: true,
        modernizedOperationalReportPath: "/api/reports/operational",
        modernizedOperationalReportExportPath: "/api/reports/operational/export",
        secretMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true,
        accessControl: summarizeAccessControl(accessControl)
      },
      context: {
        suite: "workflow-reports-authorization-policy",
        workflow: "reports-authorization-policy-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientListReportDirect(page, target);
      await expectRenderedText(page, "Patient List");
      await expectRenderedText(page, "Visits From");
      const patientListText = await page.locator("body").textContent();

      await openClinicalReportsDirect(page, target);
      await expectRenderedText(page, "Report - Clinical");
      await expectRenderedText(page, "Problem DX");
      const clinicalReportText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-174-reports-authorization-policy-legacy-rendered",
        description:
          "Captures legacy OpenEMR operational report rendering markers after admin login, with credentials redacted.",
        expected: {
          containsPatientList: true,
          containsVisitsFrom: true,
          containsClinicalReport: true,
          containsProblemDx: true,
          passwordMaterialRedacted: true
        },
        actual: {
          patientList: summarizeRenderedText(patientListText, ["Patient List", "Visits From"]),
          clinicalReport: summarizeRenderedText(clinicalReportText, ["Report - Clinical", "Problem DX"]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-reports-authorization-policy",
          workflow: "reports-authorization-policy-legacy-rendered"
        }
      });
      return;
    }

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
      probe: "slice-174-reports-authorization-policy-frontdesk-login",
      description:
        "Captures modernized front-desk session setup for report policy checks with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: "gold-frontdesk-01",
        role: "frontdesk",
        staffId: 117,
        sessionIdentifierRedacted: true
      },
      actual: summarizeLogin(frontDeskLogin),
      context: {
        suite: "workflow-reports-authorization-policy",
        workflow: "reports-authorization-policy-frontdesk-login"
      }
    });

    const frontDeskReport = await requestText(`${target.apiBaseUrl}/api/reports/operational`, {
      headers: {
        "X-OpenEMR-Session": frontDeskLogin.sessionId!
      }
    });
    expect(frontDeskReport.statusCode).toBe(403);
    const frontDeskFailure = JSON.parse(frontDeskReport.body) as ModernizedAuthorizationFailure;
    expect(frontDeskFailure).toMatchObject({
      authenticated: true,
      authorized: false,
      username: "gold-frontdesk-01",
      role: "frontdesk",
      requiredSection: "patients",
      requiredPermission: "pat_rep",
      requiredReturnValue: "view",
      sessionSource: "modernized-openemr"
    });
    expect(frontDeskFailure.failureReason).toMatch(/not authorized/i);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-174-reports-authorization-policy-frontdesk-report-forbidden",
      description:
        "Captures modernized front-desk operational report rejection facts with session material redacted.",
      expected: {
        statusCode: 403,
        authenticated: true,
        authorized: false,
        username: "gold-frontdesk-01",
        role: "frontdesk",
        requiredSection: "patients",
        requiredPermission: "pat_rep",
        requiredReturnValue: "view",
        failureReasonContains: "not authorized",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskReport.statusCode,
        body: summarizeAuthorizationFailure(frontDeskFailure)
      },
      context: {
        suite: "workflow-reports-authorization-policy",
        workflow: "reports-authorization-policy-frontdesk-report-forbidden"
      }
    });

    const frontDeskExport = await requestText(`${target.apiBaseUrl}/api/reports/operational/export`, {
      headers: {
        "X-OpenEMR-Session": frontDeskLogin.sessionId!
      }
    });
    expect(frontDeskExport.statusCode).toBe(403);
    const frontDeskExportFailure = JSON.parse(frontDeskExport.body) as ModernizedAuthorizationFailure;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-174-reports-authorization-policy-frontdesk-export-forbidden",
      description:
        "Captures modernized front-desk operational report export rejection facts with session material redacted.",
      expected: {
        statusCode: 403,
        exportRejected: true,
        requiredSection: "patients",
        requiredPermission: "pat_rep",
        requiredReturnValue: "view",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskExport.statusCode,
        body: summarizeAuthorizationFailure(frontDeskExportFailure)
      },
      context: {
        suite: "workflow-reports-authorization-policy",
        workflow: "reports-authorization-policy-frontdesk-export-forbidden"
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
      probe: "slice-174-reports-authorization-policy-admin-login",
      description:
        "Captures modernized admin session setup for report policy checks with password and session identifier redacted.",
      expected: {
        authenticated: true,
        username: "admin",
        role: "administrator",
        sessionIdentifierRedacted: true,
        passwordMaterialRedacted: true
      },
      actual: summarizeLogin(adminLogin),
      context: {
        suite: "workflow-reports-authorization-policy",
        workflow: "reports-authorization-policy-admin-login"
      }
    });

    const adminReport = await requestText(`${target.apiBaseUrl}/api/reports/operational`, {
      headers: {
        "X-OpenEMR-Session": adminLogin.sessionId!
      }
    });
    expect(adminReport.statusCode).toBe(200);
    const report = JSON.parse(adminReport.body) as {
      counts: { patients: number; futureAppointments: number; patientDocuments: number };
      providerActivity: Array<{ username: string; encounters: number }>;
    };
    expect(report.counts).toMatchObject({
      patients: 1000,
      futureAppointments: 1261,
      patientDocuments: 1200
    });
    expect(report.providerActivity).toEqual(
      expect.arrayContaining([expect.objectContaining({ username: "gold-provider-02", encounters: 176 })])
    );
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-174-reports-authorization-policy-admin-report",
      description:
        "Captures modernized admin operational report allow facts with session material redacted.",
      expected: {
        statusCode: 200,
        patients: 1000,
        futureAppointments: 1261,
        patientDocuments: 1200,
        providerUsername: "gold-provider-02",
        providerEncounters: 176,
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: adminReport.statusCode,
        counts: report.counts,
        providerActivitySample: report.providerActivity.slice(0, 5),
        includesGoldProvider02: report.providerActivity.some(
          (activity) => activity.username === "gold-provider-02" && activity.encounters === 176
        ),
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-reports-authorization-policy",
        workflow: "reports-authorization-policy-admin-report"
      }
    });

    const adminExport = await requestText(`${target.apiBaseUrl}/api/reports/operational/export`, {
      headers: {
        "X-OpenEMR-Session": adminLogin.sessionId!
      }
    });
    expect(adminExport.statusCode).toBe(200);
    expect(adminExport.body).toContain("Counts,Patients,Total,1000");
    expect(adminExport.body).toContain("Provider Activity,gold-provider-02,Encounters,176");
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-174-reports-authorization-policy-admin-export",
      description:
        "Captures modernized admin operational report CSV export allow facts with session material redacted.",
      expected: {
        statusCode: 200,
        containsPatientCountRow: "Counts,Patients,Total,1000",
        containsProviderActivityRow: "Provider Activity,gold-provider-02,Encounters,176",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: adminExport.statusCode,
        csvLength: adminExport.body.length,
        containsPatientCountRow: adminExport.body.includes("Counts,Patients,Total,1000"),
        containsProviderActivityRow: adminExport.body.includes("Provider Activity,gold-provider-02,Encounters,176"),
        csvPreview: adminExport.body.slice(0, 320),
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-reports-authorization-policy",
        workflow: "reports-authorization-policy-admin-export"
      }
    });

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Reports" }).click();
    await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();

    const accessPanel = page.locator('form[aria-label="Reports access"]');
    await accessPanel.getByLabel("Username").fill("gold-frontdesk-01");
    await accessPanel.getByLabel("Password").fill("pass");
    await accessPanel.getByRole("button", { name: "Verify Reports Access" }).click();

    await expect(page.locator("body")).toContainText("Signed in as Parker Fleming");
    await expect(page.locator("body")).toContainText("Operational reports load requires Patient Report access");
    await expect(page.locator("body")).not.toContainText("Gold Data Snapshot");

    await accessPanel.getByLabel("Username").fill(target.credentials.username);
    await accessPanel.getByLabel("Password").fill(target.credentials.password);
    await accessPanel.getByRole("button", { name: "Verify Reports Access" }).click();

    await expect(page.locator("body")).toContainText("Gold Data Snapshot");
    await expect(page.locator("body")).toContainText("gold-provider-02");
    await expect(page.getByRole("button", { name: /CSV Export/i })).toBeVisible();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-174-reports-authorization-policy-rendered",
      description:
        "Captures modernized Reports-page ACL retry rendering facts for front-desk denial followed by admin allow.",
      expected: {
        frontDeskSignedIn: "Signed in as Parker Fleming",
        frontDeskDeniedMessage: "Operational reports load requires Patient Report access",
        hidesGoldDataSnapshotForFrontDesk: true,
        rendersGoldDataSnapshotForAdmin: true,
        rendersGoldProvider02ForAdmin: true,
        rendersCsvExportForAdmin: true
      },
      actual: {
        surfaceFacts: {
          modernizedReportsPage: {
            renderedFrontDeskSignedIn: "Signed in as Parker Fleming",
            renderedFrontDeskDeniedMessage: "Operational reports load requires Patient Report access",
            didNotRenderGoldDataSnapshotForFrontDesk: true,
            renderedGoldDataSnapshotForAdmin: true,
            renderedGoldProvider02ForAdmin: true,
            renderedCsvExportForAdmin: true,
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-reports-authorization-policy",
        workflow: "reports-authorization-policy-rendered"
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

function summarizeAccessControl(accessControl: AccessControlSnapshot) {
  return {
    groupPermissionCount: accessControl.groupPermissions.length,
    userMembershipCount: accessControl.userMemberships.length,
    adminPatientReportWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "admin" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "pat_rep" &&
        permission.returnValue === "write"
    ),
    frontOfficePatientReportAccess: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "front" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "pat_rep"
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
