import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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

const documentMutationAuthorizationPatientId = "MOD-PAT-0001";
const documentMutationAuthorizationAnchorName = "Primary care intake packet";

test.describe("patient document mutation authorization policy parity @workflow-document-mutation-authorization-policy @slice186 @documents @security", () => {
  test("separates Documents add-only filing from write and delete authority", async ({ page, target, targetDb }, testInfo) => {
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-186-document-mutation-authorization-policy-precondition",
      description:
        "Captures the Slice 186 document mutation authorization-policy precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: documentMutationAuthorizationPatientId,
        anchorDocumentName: documentMutationAuthorizationAnchorName,
        clinicianDocumentsAddOnly: true,
        clinicianDocumentsWriteDenied: true,
        clinicianDocumentsDeleteDenied: true,
        adminDocumentsWrite: true,
        adminDocumentsDeleteWrite: true,
        modernizedDocumentCreatePath: "/api/documents",
        modernizedDocumentMetadataPath: "/api/documents/{documentId}/metadata",
        modernizedDocumentContentPath: "/api/documents/{documentId}/content",
        modernizedDocumentSignPath: "/api/documents/{documentId}/sign",
        modernizedDocumentArchivePath: "/api/documents/{documentId}/soft-delete",
        modernizedDocumentDeletePath: "/api/documents/{documentId}",
        secretMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true,
        patient: summarizePatient(patient!),
        anchorDocument: summarizeDocument(intakePacket!),
        beforeCounts,
        accessControl: summarizeAccessControl(accessControl)
      },
      context: {
        suite: "workflow-document-mutation-authorization-policy",
        workflow: "document-mutation-authorization-policy-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientDocumentsDirect(page, target, patient!.pid);
      await expandPatientDocumentCategories(page, ["Medical Record"]);
      await expectRenderedText(page, documentMutationAuthorizationAnchorName);
      await expectRenderedText(page, "Medical Record");
      const documentsText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-186-document-mutation-authorization-policy-legacy-rendered",
        description:
          "Captures legacy OpenEMR patient Documents rendering markers after admin login, with credentials redacted.",
        expected: {
          canonicalPatientId: patient!.pubpid,
          containsDocumentName: documentMutationAuthorizationAnchorName,
          containsCategoryName: "Medical Record",
          passwordMaterialRedacted: true
        },
        actual: {
          documentsPage: summarizeRenderedText(documentsText, [documentMutationAuthorizationAnchorName, "Medical Record"]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-document-mutation-authorization-policy",
          workflow: "document-mutation-authorization-policy-legacy-rendered"
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
      probe: "slice-186-document-mutation-authorization-policy-admin-login",
      description:
        "Captures modernized admin session setup for document mutation cleanup with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: target.credentials.username,
        role: "admin",
        sessionIdentifierRedacted: true
      },
      actual: summarizeLogin(adminLogin),
      context: {
        suite: "workflow-document-mutation-authorization-policy",
        workflow: "document-mutation-authorization-policy-admin-login"
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
      probe: "slice-186-document-mutation-authorization-policy-clinician-login",
      description:
        "Captures modernized clinician session setup for document mutation policy checks with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: "gold-provider-01",
        role: "provider",
        staffId: 101,
        sessionIdentifierRedacted: true
      },
      actual: summarizeLogin(clinicianLogin),
      context: {
        suite: "workflow-document-mutation-authorization-policy",
        workflow: "document-mutation-authorization-policy-clinician-login"
      }
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-186-document-mutation-authorization-policy-clinician-read",
      description:
        "Captures modernized clinician document list/content read visibility before add-only create and write denials.",
      expected: {
        listStatusCode: 200,
        contentStatusCode: 200,
        anchorDocumentName: documentMutationAuthorizationAnchorName,
        categoryName: "Medical Record",
        requiredSection: "patients",
        requiredPermission: "docs",
        requiredReturnValue: "view",
        sessionIdentifierRedacted: true
      },
      actual: {
        listStatusCode: clinicianList.statusCode,
        contentStatusCode: clinicianContent.statusCode,
        list: summarizeDocumentList(clinicianListBody),
        content: summarizeDocumentContent(clinicianContentBody),
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-document-mutation-authorization-policy",
        workflow: "document-mutation-authorization-policy-clinician-read"
      }
    });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-186-document-mutation-authorization-policy-clinician-create",
        description:
          "Captures modernized clinician Documents add-only filing facts with session material redacted.",
        expected: {
          statusCode: 201,
          temporaryDocumentName,
          beforeDocumentCount: beforeCounts.documents,
          afterDocumentCount: beforeCounts.documents + 1,
          requiredSection: "patients",
          requiredPermission: "docs",
          requiredReturnValue: "addonly",
          sessionIdentifierRedacted: true
        },
        actual: {
          createdDocumentId,
          createdDocument: createdDocument ? summarizeDocument(createdDocument) : null,
          afterCreateCounts,
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-document-mutation-authorization-policy",
          workflow: "document-mutation-authorization-policy-clinician-create"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-186-document-mutation-authorization-policy-clinician-metadata-forbidden",
        description:
          "Captures modernized clinician document metadata-update denial facts with session material redacted.",
        expected: authorizationDenialExpectation("metadata", "docs", "write", createdDocumentId),
        actual: {
          denial: summarizeAuthorizationFailure(clinicianMetadataUpdate),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-document-mutation-authorization-policy",
          workflow: "document-mutation-authorization-policy-clinician-metadata-forbidden"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-186-document-mutation-authorization-policy-clinician-content-forbidden",
        description:
          "Captures modernized clinician document content-replacement denial facts with session material redacted.",
        expected: authorizationDenialExpectation("content-replace", "docs", "write", createdDocumentId),
        actual: {
          denial: summarizeAuthorizationFailure(clinicianContentReplace),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-document-mutation-authorization-policy",
          workflow: "document-mutation-authorization-policy-clinician-content-forbidden"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-186-document-mutation-authorization-policy-clinician-sign-forbidden",
        description:
          "Captures modernized clinician document review/sign denial facts with session material redacted.",
        expected: authorizationDenialExpectation("sign", "docs", "write", createdDocumentId),
        actual: {
          denial: summarizeAuthorizationFailure(clinicianSign),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-document-mutation-authorization-policy",
          workflow: "document-mutation-authorization-policy-clinician-sign-forbidden"
        }
      });

      const clinicianArchive = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/documents/${encodeURIComponent(String(createdDocumentId))}/soft-delete`,
        clinicianHeaders,
        undefined,
        403
      );
      expectAuthorizationFailure(clinicianArchive, "docs", "write");
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-186-document-mutation-authorization-policy-clinician-archive-forbidden",
        description:
          "Captures modernized clinician document archive denial facts with session material redacted.",
        expected: authorizationDenialExpectation("archive", "docs", "write", createdDocumentId),
        actual: {
          denial: summarizeAuthorizationFailure(clinicianArchive),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-document-mutation-authorization-policy",
          workflow: "document-mutation-authorization-policy-clinician-archive-forbidden"
        }
      });

      const clinicianDelete = await deleteJson<ModernizedAuthorizationFailure>(
        target,
        `/api/documents/${encodeURIComponent(String(createdDocumentId))}`,
        clinicianHeaders,
        403
      );
      expectAuthorizationFailure(clinicianDelete, "docs_rm", "write");
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-186-document-mutation-authorization-policy-clinician-delete-forbidden",
        description:
          "Captures modernized clinician document hard-delete denial facts with session material redacted.",
        expected: authorizationDenialExpectation("delete", "docs_rm", "write", createdDocumentId),
        actual: {
          denial: summarizeAuthorizationFailure(clinicianDelete),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-document-mutation-authorization-policy",
          workflow: "document-mutation-authorization-policy-clinician-delete-forbidden"
        }
      });
    } finally {
      if (createdDocumentId !== null) {
        const adminDelete = await requestText(`${target.apiBaseUrl}/api/documents/${encodeURIComponent(String(createdDocumentId))}`, {
          method: "DELETE",
          headers: adminHeaders
        });
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-186-document-mutation-authorization-policy-admin-delete",
          description:
            "Captures modernized admin Documents Delete cleanup authority for the temporary clinician-created document.",
          expected: {
            statusCode: 204,
            deletedDocumentId: createdDocumentId,
            requiredSection: "patients",
            requiredPermission: "docs_rm",
            requiredReturnValue: "write",
            sessionIdentifierRedacted: true
          },
          actual: {
            statusCode: adminDelete.statusCode,
            deletedDocumentId: createdDocumentId,
            sessionHeaderRedacted: true
          },
          context: {
            suite: "workflow-document-mutation-authorization-policy",
            workflow: "document-mutation-authorization-policy-admin-delete"
          }
        });
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.documents).toBe(beforeCounts.documents);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-186-document-mutation-authorization-policy-cleanup",
      description:
        "Captures final cleanup proving temporary document count returned to the Slice 186 baseline.",
      expected: {
        beforeDocumentCount: beforeCounts.documents,
        afterDocumentCount: beforeCounts.documents,
        secretMaterialRedacted: true
      },
      actual: {
        beforeCounts,
        afterCleanupCounts
      },
      context: {
        suite: "workflow-document-mutation-authorization-policy",
        workflow: "document-mutation-authorization-policy-cleanup"
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

function authorizationDenialExpectation(
  operation: string,
  requiredPermission: string,
  requiredReturnValue: string,
  documentId: number | null
) {
  return {
    statusCode: 403,
    operation,
    documentId,
    requiredSection: "patients",
    requiredPermission,
    requiredReturnValue,
    sessionIdentifierRedacted: true
  };
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

function summarizeDocument(document: {
  id: number;
  patientId?: string | null;
  legacyPid?: number | null;
  name: string;
  categoryName: string;
  contentPreview?: string | null;
}) {
  return {
    id: document.id,
    patientId: document.patientId ?? null,
    legacyPid: document.legacyPid ?? null,
    name: document.name,
    categoryName: document.categoryName,
    contentPreview: document.contentPreview ? document.contentPreview.slice(0, 160) : null
  };
}

function summarizeDocumentList(list: DocumentListResponse) {
  return {
    patientId: list.patientId,
    legacyPid: list.legacyPid,
    documentCount: list.documents.length,
    sampleDocuments: list.documents.slice(0, 5).map(summarizeDocument),
    includesAnchorDocument: list.documents.some((document) => document.name === documentMutationAuthorizationAnchorName)
  };
}

function summarizeDocumentContent(content: DocumentContentResponse) {
  const body = content.content ?? content.contentPreview ?? "";
  return {
    id: content.id,
    name: content.name,
    categoryName: content.categoryName,
    bodyLength: body.length,
    bodyPreview: body.slice(0, 160),
    includesSyntheticAnchor: body.includes("Gold synthetic document DOC-MOD-PAT-0001-1")
  };
}

function summarizeAccessControl(accessControl: AccessControlSnapshot) {
  return {
    groupPermissionCount: accessControl.groupPermissions.length,
    userMembershipCount: accessControl.userMemberships.length,
    adminDocumentsWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "admin" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "docs" &&
        permission.returnValue === "write"
    ),
    adminDocumentsDeleteWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "admin" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "docs_rm" &&
        permission.returnValue === "write"
    ),
    clinicianDocumentsAddOnly: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "clin" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "docs" &&
        permission.returnValue === "addonly"
    ),
    clinicianDocumentsWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "clin" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "docs" &&
        permission.returnValue === "write"
    ),
    clinicianDocumentsDelete: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "clin" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "docs_rm"
    ),
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
