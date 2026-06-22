import { test, expect } from "../../src/fixtures/parityTest.js";
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

const messageMutationAuthorizationPatientId = "MOD-PAT-0004";
const careTeamMessageTitle = "Care team follow-up";
const portalMessageTitle = "Portal message";

test.describe("patient message mutation authorization policy parity @workflow-message-mutation-authorization-policy @slice187 @messages @security", () => {
  test("separates Patient Notes add-only creation from write-level message changes", async ({ page, target, targetDb }) => {
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

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientNotesDirect(page, target, patient!.pid);
      await expectRenderedText(page, careTeamMessageTitle);
      await expectRenderedText(page, portalMessageTitle);
      await expectRenderedText(page, /Patient Notes|Messages|Notes/i);
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

    const clinicianLogin = await modernizedLogin(target, "gold-provider-01", "pass");
    expect(clinicianLogin).toMatchObject({
      authenticated: true,
      username: "gold-provider-01",
      displayName: "Alex Walker",
      role: "provider",
      staffId: 101
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

      const clinicianArchive = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/messages/${encodeURIComponent(createdMessageId)}/soft-delete`,
        clinicianHeaders,
        undefined,
        403
      );
      expectAuthorizationFailure(clinicianArchive);

      const clinicianDelete = await deleteJson<ModernizedAuthorizationFailure>(
        target,
        `/api/messages/${encodeURIComponent(createdMessageId)}`,
        clinicianHeaders,
        403
      );
      expectAuthorizationFailure(clinicianDelete);
    } finally {
      if (createdMessageId !== null) {
        await requestText(`${target.apiBaseUrl}/api/messages/${encodeURIComponent(createdMessageId)}`, {
          method: "DELETE",
          headers: adminHeaders
        });
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.messages).toBe(beforeCounts.messages);
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
