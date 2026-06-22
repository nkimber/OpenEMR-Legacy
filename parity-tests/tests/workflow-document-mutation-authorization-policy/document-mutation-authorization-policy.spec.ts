import { test, expect } from "../../src/fixtures/parityTest.js";
import { requestText } from "../../src/http/httpClient.js";
import {
  expandPatientDocumentCategories,
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDocumentsDirect
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

type DocumentMutationResponse = {
  id: number;
  detail: {
    patientId: string;
    legacyPid: number;
    documents: Array<{
      id: number;
      patientId: string;
      legacyPid: number;
      name: string;
      categoryName: string;
      contentPreview?: string | null;
    }>;
  };
};

type DocumentListResponse = {
  patientId: string;
  legacyPid: number;
  documents: Array<{ id: number; name: string; categoryName: string }>;
};

type DocumentContentResponse = {
  id: number;
  name: string;
  categoryName: string;
  content?: string | null;
  contentPreview?: string | null;
};

const documentMutationAuthorizationPatientId = "MOD-PAT-0001";
const documentMutationAuthorizationAnchorName = "Primary care intake packet";

test.describe("patient document mutation authorization policy parity @workflow-document-mutation-authorization-policy @slice186 @documents @security", () => {
  test("separates Documents add-only filing from write and delete authority", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(documentMutationAuthorizationPatientId);
    expect(patient).not.toBeNull();

    const documents = await targetDb.getPatientDocumentsForPatient(patient!.pid);
    const intakePacket = documents.documents.find((document) => document.name === documentMutationAuthorizationAnchorName);
    expect(intakePacket).toBeTruthy();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const accessControl = await targetDb.getAdministrationAccessControl();
    expect(accessControl.groupPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "admin",
          sectionValue: "patients",
          permissionValue: "docs",
          returnValue: "write"
        }),
        expect.objectContaining({
          groupValue: "admin",
          sectionValue: "patients",
          permissionValue: "docs_rm",
          returnValue: "write"
        }),
        expect.objectContaining({
          groupValue: "clin",
          sectionValue: "patients",
          permissionValue: "docs",
          returnValue: "addonly"
        })
      ])
    );
    expect(accessControl.groupPermissions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "clin",
          sectionValue: "patients",
          permissionValue: "docs",
          returnValue: "write"
        }),
        expect.objectContaining({
          groupValue: "clin",
          sectionValue: "patients",
          permissionValue: "docs_rm"
        })
      ])
    );

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientDocumentsDirect(page, target, patient!.pid);
      await expandPatientDocumentCategories(page, ["Medical Record"]);
      await expectRenderedText(page, documentMutationAuthorizationAnchorName);
      await expectRenderedText(page, "Medical Record");
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
      `${target.apiBaseUrl}/api/documents/${encodeURIComponent(patient!.pubpid)}`,
      { headers: clinicianHeaders }
    );
    expect(clinicianList.statusCode).toBe(200);
    const clinicianListBody = JSON.parse(clinicianList.body) as DocumentListResponse;
    expect(clinicianListBody.documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: intakePacket!.id,
          name: documentMutationAuthorizationAnchorName,
          categoryName: "Medical Record"
        })
      ])
    );

    const clinicianContent = await requestText(
      `${target.apiBaseUrl}/api/documents/${encodeURIComponent(String(intakePacket!.id))}/content`,
      { headers: clinicianHeaders }
    );
    expect(clinicianContent.statusCode).toBe(200);
    const clinicianContentBody = JSON.parse(clinicianContent.body) as DocumentContentResponse;
    expect(clinicianContentBody.content ?? clinicianContentBody.contentPreview ?? "").toContain(
      "Gold synthetic document DOC-MOD-PAT-0001-1"
    );

    const temporaryDocumentName = `Slice 186 Add-Only Document ${Date.now()}`;
    let createdDocumentId: number | null = null;
    try {
      const created = await postJson<DocumentMutationResponse>(
        target,
        "/api/documents",
        clinicianHeaders,
        {
          patientId: patient!.pubpid,
          categoryId: 3,
          name: temporaryDocumentName,
          docDate: "2026-06-18",
          encounter: 1000013,
          content: "Created by the Slice 186 document mutation authorization policy test.",
          notes: "Clinician add-only document filing should be allowed."
        },
        201
      );
      createdDocumentId = created.id;
      expect(created.detail).toMatchObject({
        patientId: patient!.pubpid,
        legacyPid: patient!.pid
      });
      const createdDocument = created.detail.documents.find((document) => document.id === createdDocumentId);
      expect(createdDocument).toMatchObject({
        patientId: patient!.pubpid,
        legacyPid: patient!.pid,
        name: temporaryDocumentName,
        categoryName: "Medical Record"
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.documents).toBe(beforeCounts.documents + 1);

      const clinicianAfterCreate = await requestText(
        `${target.apiBaseUrl}/api/documents/${encodeURIComponent(patient!.pubpid)}`,
        { headers: clinicianHeaders }
      );
      expect(clinicianAfterCreate.statusCode).toBe(200);
      const clinicianAfterCreateBody = JSON.parse(clinicianAfterCreate.body) as DocumentListResponse;
      expect(clinicianAfterCreateBody.documents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: createdDocumentId,
            name: temporaryDocumentName,
            categoryName: "Medical Record"
          })
        ])
      );

      const clinicianMetadataUpdate = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/documents/${encodeURIComponent(String(createdDocumentId))}/metadata`,
        clinicianHeaders,
        {
          categoryId: 3,
          name: `${temporaryDocumentName} Blocked`,
          docDate: "2026-06-19",
          encounter: 1000013,
          notes: "This metadata update should be blocked."
        },
        403
      );
      expectAuthorizationFailure(clinicianMetadataUpdate, "docs", "write");

      const clinicianContentReplace = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/documents/${encodeURIComponent(String(createdDocumentId))}/content`,
        clinicianHeaders,
        {
          fileName: "blocked-slice-186.txt",
          content: "This content replacement should be blocked."
        },
        403
      );
      expectAuthorizationFailure(clinicianContentReplace, "docs", "write");

      const clinicianSign = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/documents/${encodeURIComponent(String(createdDocumentId))}/sign`,
        clinicianHeaders,
        {
          reviewStatus: "approved",
          reviewedBy: "gold-provider-01"
        },
        403
      );
      expectAuthorizationFailure(clinicianSign, "docs", "write");

      const clinicianArchive = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/documents/${encodeURIComponent(String(createdDocumentId))}/soft-delete`,
        clinicianHeaders,
        undefined,
        403
      );
      expectAuthorizationFailure(clinicianArchive, "docs", "write");

      const clinicianDelete = await deleteJson<ModernizedAuthorizationFailure>(
        target,
        `/api/documents/${encodeURIComponent(String(createdDocumentId))}`,
        clinicianHeaders,
        403
      );
      expectAuthorizationFailure(clinicianDelete, "docs_rm", "write");
    } finally {
      if (createdDocumentId !== null) {
        await requestText(`${target.apiBaseUrl}/api/documents/${encodeURIComponent(String(createdDocumentId))}`, {
          method: "DELETE",
          headers: adminHeaders
        });
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.documents).toBe(beforeCounts.documents);
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

function expectAuthorizationFailure(
  response: ModernizedAuthorizationFailure,
  requiredPermission: string,
  requiredReturnValue: string
) {
  expect(response).toMatchObject({
    authenticated: true,
    authorized: false,
    username: "gold-provider-01",
    role: "provider",
    requiredSection: "patients",
    requiredPermission,
    requiredReturnValue,
    sessionSource: "modernized-openemr"
  });
  expect(response.failureReason).toMatch(/not authorized/i);
}
