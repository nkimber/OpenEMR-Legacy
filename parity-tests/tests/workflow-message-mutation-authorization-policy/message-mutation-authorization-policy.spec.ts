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

type PatientMessageMutationResponse = {
  id: string;
  detail: {
    patientId: string;
    legacyPid: number;
    patientDisplayName: string;
    messages: Array<{
      id: string;
      title?: string | null;
      body?: string | null;
      status?: string | null;
      assignedTo?: string | null;
    }>;
  };
};

type PatientMessagesResponse = PatientMessageMutationResponse["detail"];

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

type PatientSummaryInput = {
  pid: number;
  pubpid: string;
  fname: string;
  lname: string;
  dob?: string | null;
};

type MessageSummaryInput = {
  id?: string | null;
  title?: string | null;
  body?: string | null;
  status?: string | null;
  assignedTo?: string | null;
  date?: string | null;
  portalRelation?: string | null;
};

const messageMutationAuthorizationPatientId = "MOD-PAT-0004";
const careTeamMessageTitle = "Care team follow-up";
const portalMessageTitle = "Portal message";

test.describe("patient message mutation authorization policy parity @workflow-message-mutation-authorization-policy @slice187 @messages @security", () => {
  test("separates Patient Notes add-only creation from write-level message changes", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(messageMutationAuthorizationPatientId);
    expect(patient).not.toBeNull();

    const messages = await targetDb.getPatientMessagesForPatient(patient!.pid);
    const careTeamMessage = messages.messages.find((message) => message.title === careTeamMessageTitle);
    const portalMessage = messages.messages.find((message) => message.title === portalMessageTitle);
    expect(careTeamMessage).toBeTruthy();
    expect(portalMessage).toBeTruthy();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
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
          groupValue: "clin",
          sectionValue: "patients",
          permissionValue: "notes",
          returnValue: "addonly"
        })
      ])
    );
    expect(accessControl.groupPermissions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "clin",
          sectionValue: "patients",
          permissionValue: "notes",
          returnValue: "write"
        })
      ])
    );
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-187-message-mutation-authorization-policy-precondition",
      description:
        "Captures the Slice 187 patient message mutation authorization-policy precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: messageMutationAuthorizationPatientId,
        careTeamMessageTitle,
        portalMessageTitle,
        clinicianPatientNotesAddOnly: true,
        clinicianPatientNotesWriteDenied: true,
        adminPatientNotesWrite: true,
        modernizedMessageCreatePath: "/api/messages",
        modernizedMessageStatusPath: "/api/messages/{messageId}/status",
        modernizedMessageContentPath: "/api/messages/{messageId}/content",
        modernizedMessageAssignmentPath: "/api/messages/{messageId}/assignment",
        modernizedMessageReplyPath: "/api/messages/{messageId}/reply",
        modernizedMessageArchivePath: "/api/messages/{messageId}/soft-delete",
        modernizedMessageDeletePath: "/api/messages/{messageId}",
        secretMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true,
        patient: summarizePatient(patient!),
        careTeamMessage: summarizeMessage(careTeamMessage!),
        portalMessage: summarizeMessage(portalMessage!),
        beforeCounts,
        accessControl: summarizeAccessControl(accessControl)
      },
      context: {
        suite: "workflow-message-mutation-authorization-policy",
        workflow: "message-mutation-authorization-policy-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientNotesDirect(page, target, patient!.pid);
      await expectRenderedText(page, careTeamMessageTitle);
      await expectRenderedText(page, portalMessageTitle);
      await expectRenderedText(page, /Patient Notes|Messages|Notes/i);
      const notesText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-187-message-mutation-authorization-policy-legacy-rendered",
        description:
          "Captures legacy OpenEMR Patient Notes rendering markers after admin login, with credentials redacted.",
        expected: {
          canonicalPatientId: patient!.pubpid,
          containsCareTeamMessage: careTeamMessageTitle,
          containsPortalMessage: portalMessageTitle,
          containsNotesHeading: "Patient Notes|Messages|Notes",
          passwordMaterialRedacted: true
        },
        actual: {
          notesPage: summarizeRenderedText(notesText, [careTeamMessageTitle, portalMessageTitle]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-message-mutation-authorization-policy",
          workflow: "message-mutation-authorization-policy-legacy-rendered"
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
      probe: "slice-187-message-mutation-authorization-policy-admin-login",
      description:
        "Captures modernized admin session setup for message mutation cleanup with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: target.credentials.username,
        role: "admin",
        sessionIdentifierRedacted: true
      },
      actual: summarizeLogin(adminLogin),
      context: {
        suite: "workflow-message-mutation-authorization-policy",
        workflow: "message-mutation-authorization-policy-admin-login"
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
      probe: "slice-187-message-mutation-authorization-policy-clinician-login",
      description:
        "Captures modernized clinician session setup for message mutation policy checks with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: "gold-provider-01",
        role: "provider",
        staffId: 101,
        sessionIdentifierRedacted: true
      },
      actual: summarizeLogin(clinicianLogin),
      context: {
        suite: "workflow-message-mutation-authorization-policy",
        workflow: "message-mutation-authorization-policy-clinician-login"
      }
    });
    const clinicianHeaders = { "X-OpenEMR-Session": clinicianLogin.sessionId! };

    const clinicianList = await requestText(
      `${target.apiBaseUrl}/api/messages/${encodeURIComponent(patient!.pubpid)}`,
      { headers: clinicianHeaders }
    );
    expect(clinicianList.statusCode).toBe(200);
    const clinicianListBody = JSON.parse(clinicianList.body) as PatientMessagesResponse;
    expect(clinicianListBody.messages).toEqual(
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
      probe: "slice-187-message-mutation-authorization-policy-clinician-read",
      description:
        "Captures modernized clinician message-list read visibility before add-only create and write denials.",
      expected: {
        statusCode: 200,
        careTeamMessageTitle,
        portalMessageTitle,
        requiredSection: "patients",
        requiredPermission: "notes",
        requiredReturnValue: "view",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: clinicianList.statusCode,
        messages: summarizeMessages(clinicianListBody),
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-message-mutation-authorization-policy",
        workflow: "message-mutation-authorization-policy-clinician-read"
      }
    });

    const temporaryMessageTitle = `Slice 187 Add-Only Message ${Date.now()}`;
    let createdMessageId: string | null = null;
    try {
      const created = await postJson<PatientMessageMutationResponse>(
        target,
        "/api/messages",
        clinicianHeaders,
        {
          patientId: patient!.pubpid,
          title: temporaryMessageTitle,
          body: "Created by the Slice 187 message mutation authorization policy test.",
          assignedTo: "admin"
        },
        201
      );
      createdMessageId = created.id;
      expect(created.detail).toMatchObject({
        patientId: patient!.pubpid,
        legacyPid: patient!.pid
      });
      expect(created.detail.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: createdMessageId,
            title: temporaryMessageTitle,
            status: "New",
            assignedTo: "admin"
          })
        ])
      );

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.messages).toBe(beforeCounts.messages + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-187-message-mutation-authorization-policy-clinician-create",
        description:
          "Captures modernized clinician Patient Notes add-only message creation facts with session material redacted.",
        expected: {
          statusCode: 201,
          temporaryMessageTitle,
          beforeMessageCount: beforeCounts.messages,
          afterMessageCount: beforeCounts.messages + 1,
          requiredSection: "patients",
          requiredPermission: "notes",
          requiredReturnValue: "addonly",
          sessionIdentifierRedacted: true
        },
        actual: {
          createdMessageId,
          messages: summarizeMessages(created.detail),
          afterCreateCounts,
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-message-mutation-authorization-policy",
          workflow: "message-mutation-authorization-policy-clinician-create"
        }
      });

      const clinicianStatusUpdate = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/messages/${encodeURIComponent(createdMessageId)}/status`,
        clinicianHeaders,
        {
          status: "Done",
          body: "This status update should be blocked."
        },
        403
      );
      expectAuthorizationFailure(clinicianStatusUpdate);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-187-message-mutation-authorization-policy-clinician-status-forbidden",
        description:
          "Captures modernized clinician message status-update denial facts with session material redacted.",
        expected: authorizationDenialExpectation("status", createdMessageId),
        actual: {
          denial: summarizeAuthorizationFailure(clinicianStatusUpdate),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-message-mutation-authorization-policy",
          workflow: "message-mutation-authorization-policy-clinician-status-forbidden"
        }
      });

      const clinicianContentUpdate = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/messages/${encodeURIComponent(createdMessageId)}/content`,
        clinicianHeaders,
        {
          title: `${temporaryMessageTitle} Blocked`,
          body: "This content edit should be blocked."
        },
        403
      );
      expectAuthorizationFailure(clinicianContentUpdate);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-187-message-mutation-authorization-policy-clinician-content-forbidden",
        description:
          "Captures modernized clinician message content-update denial facts with session material redacted.",
        expected: authorizationDenialExpectation("content", createdMessageId),
        actual: {
          denial: summarizeAuthorizationFailure(clinicianContentUpdate),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-message-mutation-authorization-policy",
          workflow: "message-mutation-authorization-policy-clinician-content-forbidden"
        }
      });

      const clinicianAssignmentUpdate = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/messages/${encodeURIComponent(createdMessageId)}/assignment`,
        clinicianHeaders,
        {
          assignedTo: "billing"
        },
        403
      );
      expectAuthorizationFailure(clinicianAssignmentUpdate);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-187-message-mutation-authorization-policy-clinician-assignment-forbidden",
        description:
          "Captures modernized clinician message assignment-update denial facts with session material redacted.",
        expected: authorizationDenialExpectation("assignment", createdMessageId),
        actual: {
          denial: summarizeAuthorizationFailure(clinicianAssignmentUpdate),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-message-mutation-authorization-policy",
          workflow: "message-mutation-authorization-policy-clinician-assignment-forbidden"
        }
      });

      const clinicianReply = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/messages/${encodeURIComponent(createdMessageId)}/reply`,
        clinicianHeaders,
        {
          body: "This reply should be blocked.",
          assignedTo: "admin"
        },
        403
      );
      expectAuthorizationFailure(clinicianReply);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-187-message-mutation-authorization-policy-clinician-reply-forbidden",
        description:
          "Captures modernized clinician message reply denial facts with session material redacted.",
        expected: authorizationDenialExpectation("reply", createdMessageId),
        actual: {
          denial: summarizeAuthorizationFailure(clinicianReply),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-message-mutation-authorization-policy",
          workflow: "message-mutation-authorization-policy-clinician-reply-forbidden"
        }
      });

      const clinicianArchive = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/messages/${encodeURIComponent(createdMessageId)}/soft-delete`,
        clinicianHeaders,
        undefined,
        403
      );
      expectAuthorizationFailure(clinicianArchive);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-187-message-mutation-authorization-policy-clinician-archive-forbidden",
        description:
          "Captures modernized clinician message archive denial facts with session material redacted.",
        expected: authorizationDenialExpectation("archive", createdMessageId),
        actual: {
          denial: summarizeAuthorizationFailure(clinicianArchive),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-message-mutation-authorization-policy",
          workflow: "message-mutation-authorization-policy-clinician-archive-forbidden"
        }
      });

      const clinicianDelete = await deleteJson<ModernizedAuthorizationFailure>(
        target,
        `/api/messages/${encodeURIComponent(createdMessageId)}`,
        clinicianHeaders,
        403
      );
      expectAuthorizationFailure(clinicianDelete);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-187-message-mutation-authorization-policy-clinician-delete-forbidden",
        description:
          "Captures modernized clinician message hard-delete denial facts with session material redacted.",
        expected: authorizationDenialExpectation("delete", createdMessageId),
        actual: {
          denial: summarizeAuthorizationFailure(clinicianDelete),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-message-mutation-authorization-policy",
          workflow: "message-mutation-authorization-policy-clinician-delete-forbidden"
        }
      });
    } finally {
      if (createdMessageId !== null) {
        const adminDelete = await requestText(`${target.apiBaseUrl}/api/messages/${encodeURIComponent(createdMessageId)}`, {
          method: "DELETE",
          headers: adminHeaders
        });
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-187-message-mutation-authorization-policy-admin-delete",
          description:
            "Captures modernized admin Patient Notes write cleanup authority for the temporary clinician-created message.",
          expected: {
            statusCode: 204,
            deletedMessageId: createdMessageId,
            requiredSection: "patients",
            requiredPermission: "notes",
            requiredReturnValue: "write",
            sessionIdentifierRedacted: true
          },
          actual: {
            statusCode: adminDelete.statusCode,
            deletedMessageId: createdMessageId,
            sessionHeaderRedacted: true
          },
          context: {
            suite: "workflow-message-mutation-authorization-policy",
            workflow: "message-mutation-authorization-policy-admin-delete"
          }
        });
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.messages).toBe(beforeCounts.messages);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-187-message-mutation-authorization-policy-cleanup",
      description:
        "Captures final cleanup proving temporary message count returned to the Slice 187 baseline.",
      expected: {
        beforeMessageCount: beforeCounts.messages,
        afterMessageCount: beforeCounts.messages,
        secretMaterialRedacted: true
      },
      actual: {
        beforeCounts,
        afterCleanupCounts
      },
      context: {
        suite: "workflow-message-mutation-authorization-policy",
        workflow: "message-mutation-authorization-policy-cleanup"
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
  const requestOptions: {
    method: string;
    headers: Record<string, string>;
    body?: string;
  } = {
    method,
    headers: {
      ...headers,
      "Content-Type": "application/json"
    }
  };

  if (payload !== undefined) {
    const body = JSON.stringify(payload);
    requestOptions.body = body;
    requestOptions.headers["Content-Length"] = String(Buffer.byteLength(body));
  }

  const response = await requestText(`${target.apiBaseUrl}${path}`, requestOptions);
  expect(response.statusCode).toBe(expectedStatusCode);
  return JSON.parse(response.body) as T;
}

function expectAuthorizationFailure(response: ModernizedAuthorizationFailure) {
  expect(response).toMatchObject({
    authenticated: true,
    authorized: false,
    username: "gold-provider-01",
    role: "provider",
    requiredSection: "patients",
    requiredPermission: "notes",
    requiredReturnValue: "write",
    sessionSource: "modernized-openemr"
  });
  expect(response.failureReason).toMatch(/not authorized/i);
}

function authorizationDenialExpectation(operation: string, messageId: string | null) {
  return {
    statusCode: 403,
    operation,
    messageId,
    requiredSection: "patients",
    requiredPermission: "notes",
    requiredReturnValue: "write",
    sessionIdentifierRedacted: true
  };
}

function summarizePatient(patient: PatientSummaryInput) {
  return {
    pid: patient.pid,
    pubpid: patient.pubpid,
    firstName: patient.fname,
    lastName: patient.lname,
    dateOfBirth: patient.dob ?? null
  };
}

function summarizeMessage(message: MessageSummaryInput) {
  return {
    id: message.id ?? null,
    title: message.title ?? null,
    status: message.status ?? null,
    assignedTo: message.assignedTo ?? null,
    date: message.date ?? null,
    portalRelation: message.portalRelation ?? null,
    body: summarizeText(message.body ?? null)
  };
}

function summarizeMessages(detail: PatientMessagesResponse) {
  return {
    patientId: detail.patientId,
    legacyPid: detail.legacyPid,
    patientDisplayName: detail.patientDisplayName,
    messageCount: detail.messages.length,
    containsCareTeamMessage: detail.messages.some((message) => message.title === careTeamMessageTitle),
    containsPortalMessage: detail.messages.some((message) => message.title === portalMessageTitle),
    sampleMessages: detail.messages.slice(0, 5).map(summarizeMessage)
  };
}

function summarizeAccessControl(accessControl: AccessControlSnapshot) {
  const hasPermission = (groupValue: string, returnValue: string) =>
    accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === groupValue &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "notes" &&
        permission.returnValue === returnValue
    );

  return {
    adminPatientNotesWrite: hasPermission("admin", "write"),
    clinicianPatientNotesAddOnly: hasPermission("clin", "addonly"),
    clinicianPatientNotesWrite: hasPermission("clin", "write"),
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
    sessionIdentifierPresent: Boolean(login.sessionId),
    sessionIdentifierRedacted: true
  };
}

function summarizeAuthorizationFailure(response: ModernizedAuthorizationFailure) {
  return {
    authenticated: response.authenticated,
    authorized: response.authorized,
    username: response.username,
    role: response.role,
    requiredSection: response.requiredSection,
    requiredPermission: response.requiredPermission,
    requiredReturnValue: response.requiredReturnValue,
    failureReason: response.failureReason ?? null,
    sessionSource: response.sessionSource,
    sessionIdentifierPresent: Boolean(response.sessionId),
    sessionIdentifierRedacted: true
  };
}

function summarizeRenderedText(text: string | null, markers: string[]) {
  const normalized = (text ?? "").replace(/\s+/g, " ").trim();
  return {
    textLength: normalized.length,
    preview: normalized.slice(0, 240),
    containsMarkers: Object.fromEntries(markers.map((marker) => [marker, normalized.includes(marker)])),
    containsNotesHeading: /Patient Notes|Messages|Notes/i.test(normalized)
  };
}

function summarizeText(text: string | null) {
  if (text === null) {
    return null;
  }

  const normalized = text.replace(/\s+/g, " ").trim();
  return {
    length: normalized.length,
    preview: normalized.slice(0, 80)
  };
}
