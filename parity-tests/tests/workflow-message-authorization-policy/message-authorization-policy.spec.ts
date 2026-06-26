import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { requestText } from "../../src/http/httpClient.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientNotesDirect } from "../../src/ui/legacyOpenEmr.js";
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

type PatientMessagesResponse = {
  patientId: string;
  legacyPid: number;
  patientDisplayName: string;
  messages: Array<{ id: string; title: string; status: string; assignedTo?: string | null }>;
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

const messageAuthorizationPatientId = "MOD-PAT-0004";
const careTeamMessageTitle = "Care team follow-up";
const portalMessageTitle = "Portal message";

test.describe("patient message authorization policy parity @workflow-message-authorization-policy @slice180 @messages @security", () => {
  test("enforces Patient Notes access for message APIs and UI", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(messageAuthorizationPatientId);
    expect(patient).not.toBeNull();

    const messages = await targetDb.getPatientMessagesForPatient(patient!.pid);
    const careTeamMessage = messages.messages.find((item) => item.title === careTeamMessageTitle);
    const portalMessage = messages.messages.find((item) => item.title === portalMessageTitle);
    expect(careTeamMessage).toBeTruthy();
    expect(portalMessage).toBeTruthy();

    const accessControl = await targetDb.getAdministrationAccessControl();
    expect(accessControl.groupPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "admin",
          sectionValue: "patients",
          permissionValue: "notes",
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
          permissionValue: "notes"
        })
      ])
    );
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-180-message-authorization-policy-precondition",
      description:
        "Captures the Slice 180 patient message authorization-policy precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: messageAuthorizationPatientId,
        careTeamMessageTitle,
        portalMessageTitle,
        requiredSection: "patients",
        requiredPermission: "notes",
        requiredReturnValue: "view",
        adminWriteSatisfiesView: true,
        frontOfficeGroupDoesNotHavePatientNotesAccess: true,
        modernizedMessageListPath: "/api/messages/{canonicalId}",
        modernizedMessageCreatePath: "/api/messages",
        secretMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true,
        patient: summarizePatient(patient!),
        messages: {
          messageCount: messages.messages.length,
          careTeamMessage: summarizeMessage(careTeamMessage!),
          portalMessage: summarizeMessage(portalMessage!)
        },
        accessControl: summarizeAccessControl(accessControl)
      },
      context: {
        suite: "workflow-message-authorization-policy",
        workflow: "message-authorization-policy-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientNotesDirect(page, target, patient!.pid);
      await expectRenderedText(page, careTeamMessageTitle);
      await expectRenderedText(page, portalMessageTitle);
      await expectRenderedText(page, /Patient Notes|Messages|Notes/i);
      const patientNotesText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-180-message-authorization-policy-legacy-rendered",
        description:
          "Captures legacy OpenEMR patient-notes rendering markers after admin login, with credentials redacted.",
        expected: {
          canonicalPatientId: patient!.pubpid,
          containsCareTeamMessage: careTeamMessageTitle,
          containsPortalMessage: portalMessageTitle,
          containsPatientNotesMarker: "Patient Notes",
          passwordMaterialRedacted: true
        },
        actual: {
          patientNotes: summarizeRenderedText(patientNotesText, [
            careTeamMessageTitle,
            portalMessageTitle,
            "Patient Notes"
          ]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-message-authorization-policy",
          workflow: "message-authorization-policy-legacy-rendered"
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
      probe: "slice-180-message-authorization-policy-frontdesk-login",
      description:
        "Captures modernized front-desk session setup for message policy checks with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: "gold-frontdesk-01",
        role: "frontdesk",
        staffId: 117,
        sessionIdentifierRedacted: true
      },
      actual: summarizeLogin(frontDeskLogin),
      context: {
        suite: "workflow-message-authorization-policy",
        workflow: "message-authorization-policy-frontdesk-login"
      }
    });

    const frontDeskMessages = await requestText(
      `${target.apiBaseUrl}/api/messages/${encodeURIComponent(patient!.pubpid)}`,
      {
        headers: {
          "X-OpenEMR-Session": frontDeskLogin.sessionId!
        }
      }
    );
    expect(frontDeskMessages.statusCode).toBe(403);
    const frontDeskFailure = JSON.parse(frontDeskMessages.body) as ModernizedAuthorizationFailure;
    expect(frontDeskFailure).toMatchObject({
      authenticated: true,
      authorized: false,
      username: "gold-frontdesk-01",
      role: "frontdesk",
      requiredSection: "patients",
      requiredPermission: "notes",
      requiredReturnValue: "view",
      sessionSource: "modernized-openemr"
    });
    expect(frontDeskFailure.failureReason).toMatch(/not authorized/i);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-180-message-authorization-policy-frontdesk-list-forbidden",
      description:
        "Captures modernized front-desk message-list rejection facts with session material redacted.",
      expected: {
        statusCode: 403,
        authenticated: true,
        authorized: false,
        username: "gold-frontdesk-01",
        role: "frontdesk",
        requiredSection: "patients",
        requiredPermission: "notes",
        requiredReturnValue: "view",
        failureReasonContains: "not authorized",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskMessages.statusCode,
        body: summarizeAuthorizationFailure(frontDeskFailure)
      },
      context: {
        suite: "workflow-message-authorization-policy",
        workflow: "message-authorization-policy-frontdesk-list-forbidden"
      }
    });

    const frontDeskCreateBody = JSON.stringify({
      patientId: patient!.pubpid,
      title: "Blocked Message Authorization Patient Note",
      body: "This request should be rejected before mutation.",
      assignedTo: "admin"
    });
    const frontDeskCreate = await requestText(`${target.apiBaseUrl}/api/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(frontDeskCreateBody)),
        "X-OpenEMR-Session": frontDeskLogin.sessionId!
      },
      body: frontDeskCreateBody
    });
    expect(frontDeskCreate.statusCode).toBe(403);
    const frontDeskCreateFailure = JSON.parse(frontDeskCreate.body) as ModernizedAuthorizationFailure;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-180-message-authorization-policy-frontdesk-create-forbidden",
      description:
        "Captures modernized front-desk message-create rejection facts with request and session material redacted.",
      expected: {
        statusCode: 403,
        createRejected: true,
        requiredSection: "patients",
        requiredPermission: "notes",
        requiredReturnValue: "addonly",
        submittedTitle: "Blocked Message Authorization Patient Note",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskCreate.statusCode,
        body: summarizeAuthorizationFailure(frontDeskCreateFailure),
        request: {
          patientId: patient!.pubpid,
          title: "Blocked Message Authorization Patient Note",
          assignedTo: "admin",
          passwordRedacted: true,
          sessionHeaderRedacted: true
        }
      },
      context: {
        suite: "workflow-message-authorization-policy",
        workflow: "message-authorization-policy-frontdesk-create-forbidden"
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
      probe: "slice-180-message-authorization-policy-admin-login",
      description:
        "Captures modernized admin session setup for message policy checks with password and session identifier redacted.",
      expected: {
        authenticated: true,
        username: "admin",
        role: "administrator",
        sessionIdentifierRedacted: true,
        passwordMaterialRedacted: true
      },
      actual: summarizeLogin(adminLogin),
      context: {
        suite: "workflow-message-authorization-policy",
        workflow: "message-authorization-policy-admin-login"
      }
    });

    const adminMessages = await requestText(`${target.apiBaseUrl}/api/messages/${encodeURIComponent(patient!.pubpid)}`, {
      headers: {
        "X-OpenEMR-Session": adminLogin.sessionId!
      }
    });
    expect(adminMessages.statusCode).toBe(200);
    const adminMessagesBody = JSON.parse(adminMessages.body) as PatientMessagesResponse;
    expect(adminMessagesBody).toMatchObject({
      patientId: patient!.pubpid,
      legacyPid: patient!.pid,
      patientDisplayName: `${patient!.lname}, ${patient!.fname}`
    });
    expect(adminMessagesBody.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: careTeamMessageTitle,
          status: careTeamMessage!.status
        }),
        expect.objectContaining({
          title: portalMessageTitle,
          status: portalMessage!.status
        })
      ])
    );
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-180-message-authorization-policy-admin-list",
      description:
        "Captures modernized admin message-list allow facts with session material redacted.",
      expected: {
        statusCode: 200,
        patientId: patient!.pubpid,
        legacyPid: patient!.pid,
        patientDisplayName: `${patient!.lname}, ${patient!.fname}`,
        careTeamMessageTitle,
        portalMessageTitle,
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: adminMessages.statusCode,
        messageList: summarizeMessageList(adminMessagesBody),
        includesCareTeamMessage: adminMessagesBody.messages.some((message) => message.title === careTeamMessageTitle),
        includesPortalMessage: adminMessagesBody.messages.some((message) => message.title === portalMessageTitle),
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-message-authorization-policy",
        workflow: "message-authorization-policy-admin-list"
      }
    });

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Messages" }).click();
    await expect(page.getByRole("heading", { name: "Messages", exact: true })).toBeVisible();

    const accessPanel = page.locator('form[aria-label="Messages access"]');
    await accessPanel.getByLabel("Username").fill("gold-frontdesk-01");
    await accessPanel.getByLabel("Password").fill("pass");
    await accessPanel.getByRole("button", { name: "Verify Messages Access" }).click();

    await expect(page.locator("body")).toContainText("Signed in as Parker Fleming");
    await expect(page.locator("body")).toContainText("Patient messages load requires Message access");
    await expect(page.locator("body")).not.toContainText(careTeamMessageTitle);

    await accessPanel.getByLabel("Username").fill(target.credentials.username);
    await accessPanel.getByLabel("Password").fill(target.credentials.password);
    await accessPanel.getByRole("button", { name: "Verify Messages Access" }).click();
    await expect(page.getByLabel("Messages patient ID")).toBeEnabled();
    await page.getByLabel("Messages patient ID").fill(patient!.pubpid);

    await expect(page.locator(".message-list-body")).toContainText(careTeamMessageTitle);
    await expect(page.locator(".message-list-body")).toContainText(portalMessageTitle);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-180-message-authorization-policy-rendered",
      description:
        "Captures modernized Messages-page ACL retry rendering facts for front-desk denial followed by admin allow.",
      expected: {
        frontDeskSignedIn: "Signed in as Parker Fleming",
        frontDeskDeniedMessage: "Patient messages load requires Message access",
        hidesCareTeamMessageForFrontDesk: true,
        rendersCareTeamMessageForAdmin: careTeamMessageTitle,
        rendersPortalMessageForAdmin: portalMessageTitle
      },
      actual: {
        surfaceFacts: {
          modernizedMessagesPage: {
            renderedFrontDeskSignedIn: "Signed in as Parker Fleming",
            renderedFrontDeskDeniedMessage: "Patient messages load requires Message access",
            didNotRenderCareTeamMessageForFrontDesk: true,
            renderedCareTeamMessageForAdmin: careTeamMessageTitle,
            renderedPortalMessageForAdmin: portalMessageTitle,
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-message-authorization-policy",
        workflow: "message-authorization-policy-rendered"
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

function summarizeMessage(message: { id?: string | number | null; title: string; status: string; assignedTo?: string | null }) {
  return {
    id: message.id ?? null,
    title: message.title,
    status: message.status,
    assignedTo: message.assignedTo ?? null
  };
}

function summarizeAccessControl(accessControl: AccessControlSnapshot) {
  return {
    groupPermissionCount: accessControl.groupPermissions.length,
    userMembershipCount: accessControl.userMemberships.length,
    adminPatientNotesWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "admin" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "notes" &&
        permission.returnValue === "write"
    ),
    frontOfficeDemographicsWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "front" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "demo" &&
        permission.returnValue === "write"
    ),
    frontOfficePatientNotesAccess: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "front" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "notes"
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

function summarizeMessageList(list: PatientMessagesResponse) {
  return {
    patientId: list.patientId,
    legacyPid: list.legacyPid,
    patientDisplayName: list.patientDisplayName,
    messageCount: list.messages.length,
    sampleMessages: list.messages.slice(0, 8)
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
