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

type DocumentListResponse = {
  patientId: string;
  legacyPid: number;
  patientDisplayName: string;
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

const documentAuthorizationPatientId = "MOD-PAT-0001";
const documentAuthorizationAnchorName = "Primary care intake packet";

test.describe("patient document authorization policy parity @workflow-document-authorization-policy @slice179 @documents @security", () => {
  test("enforces Documents access for document APIs and UI", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(documentAuthorizationPatientId);
    expect(patient).not.toBeNull();

    const documents = await targetDb.getPatientDocumentsForPatient(patient!.pid);
    const intakePacket = documents.documents.find((document) => document.name === documentAuthorizationAnchorName);
    expect(intakePacket).toBeTruthy();

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
          permissionValue: "docs"
        })
      ])
    );
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-179-document-authorization-policy-precondition",
      description:
        "Captures the Slice 179 document authorization-policy precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: documentAuthorizationPatientId,
        anchorDocumentName: documentAuthorizationAnchorName,
        requiredSection: "patients",
        requiredPermission: "docs",
        requiredReturnValue: "view",
        adminWriteSatisfiesView: true,
        frontOfficeGroupDoesNotHaveDocumentAccess: true,
        modernizedDocumentListPath: "/api/documents/{canonicalId}",
        modernizedDocumentContentPath: "/api/documents/{documentId}/content",
        modernizedDocumentCreatePath: "/api/documents",
        secretMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true,
        patient: summarizePatient(patient!),
        document: summarizeDocument(intakePacket!),
        accessControl: summarizeAccessControl(accessControl)
      },
      context: {
        suite: "workflow-document-authorization-policy",
        workflow: "document-authorization-policy-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientDocumentsDirect(page, target, patient!.pid);
      await expandPatientDocumentCategories(page, ["Medical Record"]);
      await expectRenderedText(page, documentAuthorizationAnchorName);
      await expectRenderedText(page, "Medical Record");
      const documentListText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-179-document-authorization-policy-legacy-rendered",
        description:
          "Captures legacy OpenEMR patient-document rendering markers after admin login, with credentials redacted.",
        expected: {
          canonicalPatientId: patient!.pubpid,
          containsAnchorDocument: documentAuthorizationAnchorName,
          containsMedicalRecordCategory: "Medical Record",
          passwordMaterialRedacted: true
        },
        actual: {
          documentList: summarizeRenderedText(documentListText, [documentAuthorizationAnchorName, "Medical Record"]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-document-authorization-policy",
          workflow: "document-authorization-policy-legacy-rendered"
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
      probe: "slice-179-document-authorization-policy-frontdesk-login",
      description:
        "Captures modernized front-desk session setup for document policy checks with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: "gold-frontdesk-01",
        role: "frontdesk",
        staffId: 117,
        sessionIdentifierRedacted: true
      },
      actual: summarizeLogin(frontDeskLogin),
      context: {
        suite: "workflow-document-authorization-policy",
        workflow: "document-authorization-policy-frontdesk-login"
      }
    });

    const frontDeskList = await requestText(
      `${target.apiBaseUrl}/api/documents/${encodeURIComponent(patient!.pubpid)}`,
      {
        headers: {
          "X-OpenEMR-Session": frontDeskLogin.sessionId!
        }
      }
    );
    expect(frontDeskList.statusCode).toBe(403);
    const frontDeskFailure = JSON.parse(frontDeskList.body) as ModernizedAuthorizationFailure;
    expect(frontDeskFailure).toMatchObject({
      authenticated: true,
      authorized: false,
      username: "gold-frontdesk-01",
      role: "frontdesk",
      requiredSection: "patients",
      requiredPermission: "docs",
      requiredReturnValue: "view",
      sessionSource: "modernized-openemr"
    });
    expect(frontDeskFailure.failureReason).toMatch(/not authorized/i);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-179-document-authorization-policy-frontdesk-list-forbidden",
      description:
        "Captures modernized front-desk document-list rejection facts with session material redacted.",
      expected: {
        statusCode: 403,
        authenticated: true,
        authorized: false,
        username: "gold-frontdesk-01",
        role: "frontdesk",
        requiredSection: "patients",
        requiredPermission: "docs",
        requiredReturnValue: "view",
        failureReasonContains: "not authorized",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskList.statusCode,
        body: summarizeAuthorizationFailure(frontDeskFailure)
      },
      context: {
        suite: "workflow-document-authorization-policy",
        workflow: "document-authorization-policy-frontdesk-list-forbidden"
      }
    });

    const frontDeskContent = await requestText(
      `${target.apiBaseUrl}/api/documents/${encodeURIComponent(String(intakePacket!.id))}/content`,
      {
        headers: {
          "X-OpenEMR-Session": frontDeskLogin.sessionId!
        }
      }
    );
    expect(frontDeskContent.statusCode).toBe(403);
    const frontDeskContentFailure = JSON.parse(frontDeskContent.body) as ModernizedAuthorizationFailure;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-179-document-authorization-policy-frontdesk-content-forbidden",
      description:
        "Captures modernized front-desk document-content rejection facts with session material redacted.",
      expected: {
        statusCode: 403,
        contentRejected: true,
        documentId: intakePacket!.id,
        requiredSection: "patients",
        requiredPermission: "docs",
        requiredReturnValue: "view",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskContent.statusCode,
        body: summarizeAuthorizationFailure(frontDeskContentFailure)
      },
      context: {
        suite: "workflow-document-authorization-policy",
        workflow: "document-authorization-policy-frontdesk-content-forbidden"
      }
    });

    const frontDeskCreateBody = JSON.stringify({
      patientId: patient!.pubpid,
      categoryId: 3,
      name: "Blocked Document Authorization Patient Document",
      docDate: "2026-06-18",
      encounter: 1000013,
      content: "This request should be rejected before mutation.",
      notes: "Document authorization check"
    });
    const frontDeskCreate = await requestText(`${target.apiBaseUrl}/api/documents`, {
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
      probe: "slice-179-document-authorization-policy-frontdesk-create-forbidden",
      description:
        "Captures modernized front-desk document-create rejection facts with request and session material redacted.",
      expected: {
        statusCode: 403,
        createRejected: true,
        requiredSection: "patients",
        requiredPermission: "docs",
        requiredReturnValue: "addonly",
        submittedName: "Blocked Document Authorization Patient Document",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskCreate.statusCode,
        body: summarizeAuthorizationFailure(frontDeskCreateFailure),
        request: {
          patientId: patient!.pubpid,
          categoryId: 3,
          name: "Blocked Document Authorization Patient Document",
          docDate: "2026-06-18",
          encounter: 1000013,
          passwordRedacted: true,
          sessionHeaderRedacted: true
        }
      },
      context: {
        suite: "workflow-document-authorization-policy",
        workflow: "document-authorization-policy-frontdesk-create-forbidden"
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
      probe: "slice-179-document-authorization-policy-admin-login",
      description:
        "Captures modernized admin session setup for document policy checks with password and session identifier redacted.",
      expected: {
        authenticated: true,
        username: "admin",
        role: "administrator",
        sessionIdentifierRedacted: true,
        passwordMaterialRedacted: true
      },
      actual: summarizeLogin(adminLogin),
      context: {
        suite: "workflow-document-authorization-policy",
        workflow: "document-authorization-policy-admin-login"
      }
    });

    const adminList = await requestText(`${target.apiBaseUrl}/api/documents/${encodeURIComponent(patient!.pubpid)}`, {
      headers: {
        "X-OpenEMR-Session": adminLogin.sessionId!
      }
    });
    expect(adminList.statusCode).toBe(200);
    const adminListBody = JSON.parse(adminList.body) as DocumentListResponse;
    expect(adminListBody).toMatchObject({
      patientId: patient!.pubpid,
      legacyPid: patient!.pid,
      patientDisplayName: "Stone, Avery"
    });
    expect(adminListBody.documents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: intakePacket!.id,
          name: documentAuthorizationAnchorName,
          categoryName: "Medical Record"
        })
      ])
    );
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-179-document-authorization-policy-admin-list",
      description:
        "Captures modernized admin document-list allow facts with session material redacted.",
      expected: {
        statusCode: 200,
        patientId: patient!.pubpid,
        legacyPid: patient!.pid,
        patientDisplayName: "Stone, Avery",
        documentId: intakePacket!.id,
        documentName: documentAuthorizationAnchorName,
        categoryName: "Medical Record",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: adminList.statusCode,
        documentList: summarizeDocumentList(adminListBody),
        includesAnchorDocument: adminListBody.documents.some((document) => document.id === intakePacket!.id),
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-document-authorization-policy",
        workflow: "document-authorization-policy-admin-list"
      }
    });

    const adminContent = await requestText(
      `${target.apiBaseUrl}/api/documents/${encodeURIComponent(String(intakePacket!.id))}/content`,
      {
        headers: {
          "X-OpenEMR-Session": adminLogin.sessionId!
        }
      }
    );
    expect(adminContent.statusCode).toBe(200);
    const adminContentBody = JSON.parse(adminContent.body) as DocumentContentResponse;
    expect(adminContentBody).toMatchObject({
      id: intakePacket!.id,
      name: documentAuthorizationAnchorName,
      categoryName: "Medical Record"
    });
    expect(adminContentBody.content ?? adminContentBody.contentPreview ?? "").toContain(
      "Gold synthetic document DOC-MOD-PAT-0001-1"
    );
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-179-document-authorization-policy-admin-content",
      description:
        "Captures modernized admin document-content allow facts with content shortened and session material redacted.",
      expected: {
        statusCode: 200,
        documentId: intakePacket!.id,
        documentName: documentAuthorizationAnchorName,
        categoryName: "Medical Record",
        containsGoldSyntheticAnchor: "Gold synthetic document DOC-MOD-PAT-0001-1",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: adminContent.statusCode,
        documentContent: summarizeDocumentContent(adminContentBody),
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-document-authorization-policy",
        workflow: "document-authorization-policy-admin-content"
      }
    });

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Documents" }).click();
    await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();

    const accessPanel = page.locator('form[aria-label="Documents access"]');
    await accessPanel.getByLabel("Username").fill("gold-frontdesk-01");
    await accessPanel.getByLabel("Password").fill("pass");
    await accessPanel.getByRole("button", { name: "Verify Documents Access" }).click();

    await expect(page.locator("body")).toContainText("Signed in as Parker Fleming");
    await expect(page.locator("body")).toContainText("Patient documents load requires Document access");
    await expect(page.locator("body")).not.toContainText(documentAuthorizationAnchorName);

    await accessPanel.getByLabel("Username").fill(target.credentials.username);
    await accessPanel.getByLabel("Password").fill(target.credentials.password);
    await accessPanel.getByRole("button", { name: "Verify Documents Access" }).click();
    await page.getByLabel("Documents patient ID").fill(patient!.pubpid);

    await expect(page.locator(".document-list-body")).toContainText(documentAuthorizationAnchorName);
    await expect(page.locator(".document-list-body")).toContainText("Medical Record");
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-179-document-authorization-policy-rendered",
      description:
        "Captures modernized Documents-page ACL retry rendering facts for front-desk denial followed by admin allow.",
      expected: {
        frontDeskSignedIn: "Signed in as Parker Fleming",
        frontDeskDeniedMessage: "Patient documents load requires Document access",
        hidesAnchorDocumentForFrontDesk: true,
        rendersAnchorDocumentForAdmin: documentAuthorizationAnchorName,
        rendersMedicalRecordCategoryForAdmin: "Medical Record"
      },
      actual: {
        surfaceFacts: {
          modernizedDocumentsPage: {
            renderedFrontDeskSignedIn: "Signed in as Parker Fleming",
            renderedFrontDeskDeniedMessage: "Patient documents load requires Document access",
            didNotRenderAnchorDocumentForFrontDesk: true,
            renderedAnchorDocumentForAdmin: documentAuthorizationAnchorName,
            renderedMedicalRecordCategoryForAdmin: "Medical Record",
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-document-authorization-policy",
        workflow: "document-authorization-policy-rendered"
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

function summarizeDocument(document: { id: number; name: string; categoryName: string }) {
  return {
    id: document.id,
    name: document.name,
    categoryName: document.categoryName
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
    frontOfficeDemographicsWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "front" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "demo" &&
        permission.returnValue === "write"
    ),
    frontOfficeDocumentsAccess: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "front" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "docs"
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

function summarizeDocumentList(list: DocumentListResponse) {
  return {
    patientId: list.patientId,
    legacyPid: list.legacyPid,
    patientDisplayName: list.patientDisplayName,
    documentCount: list.documents.length,
    sampleDocuments: list.documents.slice(0, 8)
  };
}

function summarizeDocumentContent(content: DocumentContentResponse) {
  const documentText = content.content ?? content.contentPreview ?? "";
  return {
    id: content.id,
    name: content.name,
    categoryName: content.categoryName,
    hasContent: Boolean(documentText),
    contentLength: documentText.length,
    contentPreview: documentText.slice(0, 240),
    containsGoldSyntheticAnchor: documentText.includes("Gold synthetic document DOC-MOD-PAT-0001-1")
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
