import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { requestText } from "../../src/http/httpClient.js";
import { expectRenderedText, loginToLegacyOpenEmr, openEncounterDirect } from "../../src/ui/legacyOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";

const encounterAuthorizationPatientId = "MOD-PAT-0001";
const encounterAuthorizationFromDate = "2026-01-01";

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
    hasVitals: boolean;
    hasSoapNote: boolean;
  }>;
};

type EncounterDetailResponse = {
  encounter: number;
  patientId: string;
  legacyPid: number;
  reason?: string | null;
  vitals?: {
    bloodPressure?: string | null;
  } | null;
  soapNote?: {
    assessment?: string | null;
  } | null;
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

test.describe("encounter authorization policy parity @workflow-encounter-authorization-policy @slice177 @encounters @security", () => {
  test("enforces Authorize Any Encounter access for encounter APIs and UI", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterAuthorizationPatientId);
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
          groupValue: "front",
          sectionValue: "patients",
          permissionValue: "appt",
          returnValue: "write"
        })
      ])
    );
    expect(accessControl.groupPermissions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "front",
          sectionValue: "encounters",
          permissionValue: "auth_a"
        })
      ])
    );
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-177-encounter-authorization-policy-precondition",
      description:
        "Captures the Slice 177 encounter authorization-policy precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: encounterAuthorizationPatientId,
        fromDate: encounterAuthorizationFromDate,
        requiredSection: "encounters",
        requiredPermission: "auth_a",
        requiredReturnValue: "view",
        adminWriteSatisfiesView: true,
        frontOfficeGroupDoesNotHaveAuthorizeAnyEncounterAccess: true,
        modernizedEncounterSearchPath: "/api/encounters",
        modernizedEncounterDetailPath: "/api/encounters/{encounterId}",
        modernizedEncounterMutationPath: "/api/encounters",
        secretMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true,
        patient: summarizePatient(patient!),
        encounter: summarizeEncounter(encounter!),
        clinical: summarizeClinical(clinical!),
        accessControl: summarizeAccessControl(accessControl)
      },
      context: {
        suite: "workflow-encounter-authorization-policy",
        workflow: "encounter-authorization-policy-precondition"
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
        probe: "slice-177-encounter-authorization-policy-legacy-rendered",
        description:
          "Captures legacy OpenEMR encounter rendering markers after admin login, with credentials redacted.",
        expected: {
          encounter: encounter!.encounter,
          containsReasonTopic: encounterTopic(clinical!.reason),
          containsSoap: true,
          containsVitals: true,
          containsAssessmentLabel: true,
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
          suite: "workflow-encounter-authorization-policy",
          workflow: "encounter-authorization-policy-legacy-rendered"
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
      probe: "slice-177-encounter-authorization-policy-frontdesk-login",
      description:
        "Captures modernized front-desk session setup for encounter policy checks with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: "gold-frontdesk-01",
        role: "frontdesk",
        staffId: 117,
        sessionIdentifierRedacted: true
      },
      actual: summarizeLogin(frontDeskLogin),
      context: {
        suite: "workflow-encounter-authorization-policy",
        workflow: "encounter-authorization-policy-frontdesk-login"
      }
    });

    const frontDeskSearch = await requestText(
      `${target.apiBaseUrl}/api/encounters?patientId=${encodeURIComponent(patient!.pubpid)}&from=${encounterAuthorizationFromDate}&limit=5`,
      {
        headers: {
          "X-OpenEMR-Session": frontDeskLogin.sessionId!
        }
      }
    );
    expect(frontDeskSearch.statusCode).toBe(403);
    const frontDeskFailure = JSON.parse(frontDeskSearch.body) as ModernizedAuthorizationFailure;
    expect(frontDeskFailure).toMatchObject({
      authenticated: true,
      authorized: false,
      username: "gold-frontdesk-01",
      role: "frontdesk",
      requiredSection: "encounters",
      requiredPermission: "auth_a",
      requiredReturnValue: "view",
      sessionSource: "modernized-openemr"
    });
    expect(frontDeskFailure.failureReason).toMatch(/not authorized/i);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-177-encounter-authorization-policy-frontdesk-search-forbidden",
      description:
        "Captures modernized front-desk encounter search rejection facts with session material redacted.",
      expected: {
        statusCode: 403,
        authenticated: true,
        authorized: false,
        username: "gold-frontdesk-01",
        role: "frontdesk",
        requiredSection: "encounters",
        requiredPermission: "auth_a",
        requiredReturnValue: "view",
        failureReasonContains: "not authorized",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskSearch.statusCode,
        body: summarizeAuthorizationFailure(frontDeskFailure)
      },
      context: {
        suite: "workflow-encounter-authorization-policy",
        workflow: "encounter-authorization-policy-frontdesk-search-forbidden"
      }
    });

    const frontDeskMutationBody = JSON.stringify({
      patientId: patient!.pubpid,
      dateTime: "2026-06-18 10:00:00",
      reason: "Blocked Encounter Authorization",
      facilityId: 10,
      billingFacilityId: 10
    });
    const frontDeskMutation = await requestText(`${target.apiBaseUrl}/api/encounters`, {
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
      probe: "slice-177-encounter-authorization-policy-frontdesk-mutation-forbidden",
      description:
        "Captures modernized front-desk encounter mutation rejection facts with request and session material redacted.",
      expected: {
        statusCode: 403,
        encounterMutationRejected: true,
        requiredSection: "encounters",
        requiredPermission: "auth_a",
        requiredReturnValue: "write",
        submittedReason: "Blocked Encounter Authorization",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskMutation.statusCode,
        body: summarizeAuthorizationFailure(frontDeskMutationFailure),
        request: {
          patientId: patient!.pubpid,
          reason: "Blocked Encounter Authorization",
          facilityId: 10,
          billingFacilityId: 10,
          passwordRedacted: true,
          sessionHeaderRedacted: true
        }
      },
      context: {
        suite: "workflow-encounter-authorization-policy",
        workflow: "encounter-authorization-policy-frontdesk-mutation-forbidden"
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
      probe: "slice-177-encounter-authorization-policy-admin-login",
      description:
        "Captures modernized admin session setup for encounter policy checks with password and session identifier redacted.",
      expected: {
        authenticated: true,
        username: "admin",
        role: "administrator",
        sessionIdentifierRedacted: true,
        passwordMaterialRedacted: true
      },
      actual: summarizeLogin(adminLogin),
      context: {
        suite: "workflow-encounter-authorization-policy",
        workflow: "encounter-authorization-policy-admin-login"
      }
    });

    const adminSearch = await requestText(
      `${target.apiBaseUrl}/api/encounters?patientId=${encodeURIComponent(patient!.pubpid)}&from=${encounterAuthorizationFromDate}&limit=5`,
      {
        headers: {
          "X-OpenEMR-Session": adminLogin.sessionId!
        }
      }
    );
    expect(adminSearch.statusCode).toBe(200);
    const adminSearchBody = JSON.parse(adminSearch.body) as EncounterSearchResponse;
    expect(adminSearchBody.encounters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          encounter: encounter!.encounter,
          patientId: patient!.pubpid,
          legacyPid: patient!.pid,
          reason: clinical!.reason,
          hasVitals: true,
          hasSoapNote: true
        })
      ])
    );
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-177-encounter-authorization-policy-admin-search",
      description:
        "Captures modernized admin encounter search allow facts with session material redacted.",
      expected: {
        statusCode: 200,
        encounter: encounter!.encounter,
        patientId: patient!.pubpid,
        legacyPid: patient!.pid,
        reason: clinical!.reason,
        hasVitals: true,
        hasSoapNote: true,
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: adminSearch.statusCode,
        totalMatches: adminSearchBody.totalMatches,
        includesEncounter: adminSearchBody.encounters.some((item) => item.encounter === encounter!.encounter),
        sampleEncounters: adminSearchBody.encounters.slice(0, 5),
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-encounter-authorization-policy",
        workflow: "encounter-authorization-policy-admin-search"
      }
    });

    const adminDetail = await requestText(`${target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(encounter!.encounter))}`, {
      headers: {
        "X-OpenEMR-Session": adminLogin.sessionId!
      }
    });
    expect(adminDetail.statusCode).toBe(200);
    const detail = JSON.parse(adminDetail.body) as EncounterDetailResponse;
    expect(detail).toMatchObject({
      encounter: encounter!.encounter,
      patientId: patient!.pubpid,
      legacyPid: patient!.pid,
      reason: clinical!.reason
    });
    expect(detail.vitals?.bloodPressure).toBe(clinical!.bloodPressure);
    expect(detail.soapNote?.assessment).toBe(clinical!.assessment);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-177-encounter-authorization-policy-admin-detail",
      description:
        "Captures modernized admin encounter detail allow facts with session material redacted.",
      expected: {
        statusCode: 200,
        encounter: encounter!.encounter,
        patientId: patient!.pubpid,
        legacyPid: patient!.pid,
        reason: clinical!.reason,
        bloodPressure: clinical!.bloodPressure,
        assessment: clinical!.assessment,
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: adminDetail.statusCode,
        detail: summarizeEncounterDetail(detail),
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-encounter-authorization-policy",
        workflow: "encounter-authorization-policy-admin-detail"
      }
    });

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Encounters" }).click();
    await expect(page.getByRole("heading", { name: "Encounters", exact: true })).toBeVisible();

    const accessPanel = page.locator('form[aria-label="Encounter access"]');
    await accessPanel.getByLabel("Username").fill("gold-frontdesk-01");
    await accessPanel.getByLabel("Password").fill("pass");
    await accessPanel.getByRole("button", { name: "Verify Encounter Access" }).click();

    await expect(page.locator("body")).toContainText("Signed in as Parker Fleming");
    await expect(page.locator("body")).toContainText("Encounter search requires Encounter access");
    await expect(page.locator(".appointment-list")).not.toContainText(clinical!.reason);
    await expect(page.locator(".appointment-detail-panel")).not.toContainText(clinical!.reason);

    await accessPanel.getByLabel("Username").fill(target.credentials.username);
    await accessPanel.getByLabel("Password").fill(target.credentials.password);
    await accessPanel.getByRole("button", { name: "Verify Encounter Access" }).click();
    await page.getByLabel("Encounter patient ID").fill(patient!.pubpid);
    await page.getByLabel("Encounter from date").fill(encounterAuthorizationFromDate);

    const encounterButton = page.getByRole("button", { name: new RegExp(escapeRegex(encounterTopic(clinical!.reason)), "i") }).first();
    await expect(encounterButton).toBeVisible();
    await encounterButton.click();

    await expect(page.getByRole("heading", { name: clinical!.reason })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(`PID ${patient!.pid}`);
    await expect(page.locator("body")).toContainText("SOAP Note");
    await expect(page.locator("body")).toContainText("Vitals");
    await expect(page.locator("body")).toContainText(clinical!.assessment);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-177-encounter-authorization-policy-rendered",
      description:
        "Captures modernized Encounters-page ACL retry rendering facts for front-desk denial followed by admin allow.",
      expected: {
        frontDeskSignedIn: "Signed in as Parker Fleming",
        frontDeskDeniedMessage: "Encounter search requires Encounter access",
        hidesEncounterForFrontDesk: true,
        rendersEncounterForAdmin: true,
        rendersCanonicalId: patient!.pubpid,
        rendersLegacyPid: `PID ${patient!.pid}`,
        rendersSoapNote: true,
        rendersVitals: true,
        rendersAssessment: clinical!.assessment
      },
      actual: {
        surfaceFacts: {
          modernizedEncountersPage: {
            renderedFrontDeskSignedIn: "Signed in as Parker Fleming",
            renderedFrontDeskDeniedMessage: "Encounter search requires Encounter access",
            didNotRenderEncounterForFrontDesk: true,
            renderedEncounterForAdmin: true,
            renderedCanonicalId: patient!.pubpid,
            renderedLegacyPid: `PID ${patient!.pid}`,
            renderedSoapNote: true,
            renderedVitals: true,
            renderedAssessment: true,
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-encounter-authorization-policy",
        workflow: "encounter-authorization-policy-rendered"
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

function encounterTopic(reason: string) {
  return reason.replace(/^Follow-up for\s+/i, "").replace(/^Comprehensive\s+/i, "");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function summarizePatient(patient: { pubpid: string; pid: number; lname: string; fname: string }) {
  return {
    canonicalId: patient.pubpid,
    legacyPid: patient.pid,
    displayName: `${patient.lname}, ${patient.fname}`
  };
}

function summarizeEncounter(encounter: { encounter: number; [key: string]: unknown }) {
  return {
    encounter: encounter.encounter
  };
}

function summarizeClinical(clinical: { reason: string; bloodPressure?: string | null; assessment?: string | null }) {
  return {
    reason: clinical.reason,
    reasonTopic: encounterTopic(clinical.reason),
    bloodPressure: clinical.bloodPressure ?? null,
    assessment: clinical.assessment ?? null
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
    frontOfficeAppointmentWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "front" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "appt" &&
        permission.returnValue === "write"
    ),
    frontOfficeAuthorizeAnyEncounterAccess: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "front" &&
        permission.sectionValue === "encounters" &&
        permission.permissionValue === "auth_a"
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

function summarizeEncounterDetail(detail: EncounterDetailResponse) {
  return {
    encounter: detail.encounter,
    patientId: detail.patientId,
    legacyPid: detail.legacyPid,
    reason: detail.reason ?? null,
    bloodPressure: detail.vitals?.bloodPressure ?? null,
    assessment: detail.soapNote?.assessment ?? null
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
