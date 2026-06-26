import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { requestText } from "../../src/http/httpClient.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";

const patientAuthorizationPatientId = "MOD-PAT-0001";

type ModernizedLoginResponse = {
  authenticated: boolean;
  username: string;
  displayName: string;
  role: string;
  staffId?: number | null;
  sessionId?: string | null;
};

type PatientSearchResponse = {
  totalMatches: number;
  patients: Array<{
    canonicalId: string;
    legacyPid: number;
    displayName: string;
  }>;
};

type PatientChartResponse = {
  canonicalId: string;
  legacyPid: number;
  displayName: string;
  purpose?: string | null;
};

type ModernizedAuthenticationFailure = {
  authenticated: boolean;
  sessionSource: string;
  failureReason?: string | null;
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

test.describe("patient chart authorization policy parity @workflow-patient-authorization-policy @slice178 @patients @security", () => {
  test("honors Demographics ACL access for patient APIs and UI", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(patientAuthorizationPatientId);
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
        })
      ])
    );
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-178-patient-authorization-policy-precondition",
      description:
        "Captures the Slice 178 patient chart authorization-policy precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: patientAuthorizationPatientId,
        requiredSection: "patients",
        requiredPermission: "demo",
        requiredReturnValue: "view",
        adminWriteSatisfiesView: true,
        frontOfficeWriteSatisfiesView: true,
        modernizedPatientSearchPath: "/api/patients",
        modernizedPatientChartPath: "/api/patients/{canonicalId}",
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
        suite: "workflow-patient-authorization-policy",
        workflow: "patient-authorization-policy-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientSummaryDirect(page, target, patient!.pid);
      await expectRenderedText(page, patient!.fname);
      await expectRenderedText(page, patient!.lname);
      await expectRenderedText(page, String(patient!.pid));
      const patientSummaryText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-178-patient-authorization-policy-legacy-rendered",
        description:
          "Captures legacy OpenEMR patient-summary Demographics rendering markers after admin login, with credentials redacted.",
        expected: {
          canonicalPatientId: patient!.pubpid,
          containsFirstName: patient!.fname,
          containsLastName: patient!.lname,
          containsLegacyPid: String(patient!.pid),
          passwordMaterialRedacted: true
        },
        actual: {
          patientSummary: summarizeRenderedText(patientSummaryText, [patient!.fname, patient!.lname, String(patient!.pid)]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-patient-authorization-policy",
          workflow: "patient-authorization-policy-legacy-rendered"
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

    const unauthenticatedSearch = await requestText(
      `${target.apiBaseUrl}/api/patients?search=${encodeURIComponent(patient!.pubpid)}&limit=5`
    );
    expect(unauthenticatedSearch.statusCode).toBe(401);
    const unauthenticatedSearchBody = JSON.parse(unauthenticatedSearch.body) as ModernizedAuthenticationFailure;
    expect(unauthenticatedSearchBody).toMatchObject({
      authenticated: false,
      sessionSource: "modernized-openemr"
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-178-patient-authorization-policy-unauthenticated-search",
      description:
        "Captures modernized patient search authentication rejection facts before ACL policy evaluation.",
      expected: {
        statusCode: 401,
        authenticated: false,
        sessionSource: "modernized-openemr",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: unauthenticatedSearch.statusCode,
        body: summarizeAuthenticationFailure(unauthenticatedSearchBody)
      },
      context: {
        suite: "workflow-patient-authorization-policy",
        workflow: "patient-authorization-policy-unauthenticated-search"
      }
    });

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
      probe: "slice-178-patient-authorization-policy-frontdesk-login",
      description:
        "Captures modernized front-desk session setup for patient Demographics policy checks with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: "gold-frontdesk-01",
        role: "frontdesk",
        staffId: 117,
        sessionIdentifierRedacted: true
      },
      actual: summarizeLogin(frontDeskLogin),
      context: {
        suite: "workflow-patient-authorization-policy",
        workflow: "patient-authorization-policy-frontdesk-login"
      }
    });

    const frontDeskSearch = await requestText(
      `${target.apiBaseUrl}/api/patients?search=${encodeURIComponent(patient!.pubpid)}&limit=5`,
      {
        headers: {
          "X-OpenEMR-Session": frontDeskLogin.sessionId!
        }
      }
    );
    expect(frontDeskSearch.statusCode).toBe(200);
    const search = JSON.parse(frontDeskSearch.body) as PatientSearchResponse;
    expect(search.patients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalId: patient!.pubpid,
          legacyPid: patient!.pid,
          displayName: "Stone, Avery"
        })
      ])
    );
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-178-patient-authorization-policy-frontdesk-search",
      description:
        "Captures modernized front-desk patient search allow facts through Front Office Demographics ACL access.",
      expected: {
        statusCode: 200,
        canonicalId: patient!.pubpid,
        legacyPid: patient!.pid,
        displayName: "Stone, Avery",
        requiredSection: "patients",
        requiredPermission: "demo",
        requiredReturnValue: "view",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskSearch.statusCode,
        search: summarizePatientSearch(search),
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-patient-authorization-policy",
        workflow: "patient-authorization-policy-frontdesk-search"
      }
    });

    const frontDeskChart = await requestText(
      `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
      {
        headers: {
          "X-OpenEMR-Session": frontDeskLogin.sessionId!
        }
      }
    );
    expect(frontDeskChart.statusCode).toBe(200);
    const chart = JSON.parse(frontDeskChart.body) as PatientChartResponse;
    expect(chart).toMatchObject({
      canonicalId: patient!.pubpid,
      legacyPid: patient!.pid,
      displayName: "Stone, Avery",
      purpose: "Stable search and demographics navigation"
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-178-patient-authorization-policy-frontdesk-chart",
      description:
        "Captures modernized front-desk patient chart allow facts through Front Office Demographics ACL access.",
      expected: {
        statusCode: 200,
        canonicalId: patient!.pubpid,
        legacyPid: patient!.pid,
        displayName: "Stone, Avery",
        purpose: "Stable search and demographics navigation",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskChart.statusCode,
        chart: summarizePatientChart(chart),
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-patient-authorization-policy",
        workflow: "patient-authorization-policy-frontdesk-chart"
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
      probe: "slice-178-patient-authorization-policy-admin-login",
      description:
        "Captures modernized admin session setup for patient Demographics policy checks with password and session identifier redacted.",
      expected: {
        authenticated: true,
        username: "admin",
        role: "administrator",
        sessionIdentifierRedacted: true,
        passwordMaterialRedacted: true
      },
      actual: summarizeLogin(adminLogin),
      context: {
        suite: "workflow-patient-authorization-policy",
        workflow: "patient-authorization-policy-admin-login"
      }
    });

    const adminChart = await requestText(`${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`, {
      headers: {
        "X-OpenEMR-Session": adminLogin.sessionId!
      }
    });
    expect(adminChart.statusCode).toBe(200);
    const adminChartBody = JSON.parse(adminChart.body) as PatientChartResponse;
    expect(adminChartBody).toMatchObject({
      canonicalId: patient!.pubpid,
      legacyPid: patient!.pid,
      displayName: "Stone, Avery",
      purpose: "Stable search and demographics navigation"
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-178-patient-authorization-policy-admin-chart",
      description:
        "Captures modernized admin patient chart allow facts through administrator Demographics ACL access.",
      expected: {
        statusCode: 200,
        canonicalId: patient!.pubpid,
        legacyPid: patient!.pid,
        displayName: "Stone, Avery",
        purpose: "Stable search and demographics navigation",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: adminChart.statusCode,
        chart: summarizePatientChart(adminChartBody),
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-patient-authorization-policy",
        workflow: "patient-authorization-policy-admin-chart"
      }
    });

    await page.goto(target.publicUrl);
    await expect(page.getByRole("heading", { name: "Patient/Client" })).toBeVisible();

    const accessPanel = page.locator('form[aria-label="Patient access"]');
    await accessPanel.getByLabel("Username").fill("gold-frontdesk-01");
    await accessPanel.getByLabel("Password").fill("pass");
    await accessPanel.getByRole("button", { name: "Verify Patient Access" }).click();

    await expect(page.locator("body")).toContainText("Signed in as Parker Fleming");
    await expect(page.locator("body")).not.toContainText("Sign in to search patient charts");

    await page.getByLabel("Search patients").fill(patient!.pubpid);
    await expect(page.getByRole("button", { name: /Stone, Avery/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Stone, Avery" })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(`PID ${patient!.pid}`);
    await expect(page.locator("body")).toContainText("Stable search and demographics navigation");
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-178-patient-authorization-policy-rendered",
      description:
        "Captures modernized Patient/Client-page Demographics ACL rendering facts after front-desk allow.",
      expected: {
        frontDeskSignedIn: "Signed in as Parker Fleming",
        hidesSignedOutSearchPromptAfterLogin: true,
        rendersDisplayName: "Stone, Avery",
        rendersCanonicalId: patient!.pubpid,
        rendersLegacyPid: `PID ${patient!.pid}`,
        rendersPurpose: "Stable search and demographics navigation"
      },
      actual: {
        surfaceFacts: {
          modernizedPatientClientPage: {
            renderedFrontDeskSignedIn: "Signed in as Parker Fleming",
            didNotRenderSignedOutSearchPromptAfterLogin: true,
            renderedDisplayName: "Stone, Avery",
            renderedCanonicalId: patient!.pubpid,
            renderedLegacyPid: `PID ${patient!.pid}`,
            renderedPurpose: "Stable search and demographics navigation",
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-patient-authorization-policy",
        workflow: "patient-authorization-policy-rendered"
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
    frontOfficeDemographicsWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "front" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "demo" &&
        permission.returnValue === "write"
    ),
    frontDeskFrontOfficeMembership: accessControl.userMemberships.some(
      (membership) => membership.userValue === "gold-frontdesk-01" && membership.groupValue === "front"
    ),
    sampleGroupPermissions: accessControl.groupPermissions.slice(0, 8),
    sampleUserMemberships: accessControl.userMemberships.slice(0, 8)
  };
}

function summarizeAuthenticationFailure(failure: ModernizedAuthenticationFailure) {
  return {
    authenticated: failure.authenticated,
    sessionSource: failure.sessionSource,
    failureReason: failure.failureReason ?? null,
    sessionIdRedacted: true
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

function summarizePatientSearch(search: PatientSearchResponse) {
  return {
    totalMatches: search.totalMatches,
    patients: search.patients.slice(0, 8)
  };
}

function summarizePatientChart(chart: PatientChartResponse) {
  return {
    canonicalId: chart.canonicalId,
    legacyPid: chart.legacyPid,
    displayName: chart.displayName,
    purpose: chart.purpose ?? null
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
