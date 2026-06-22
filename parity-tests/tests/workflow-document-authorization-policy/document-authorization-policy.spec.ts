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

const documentAuthorizationPatientId = "MOD-PAT-0001";
const documentAuthorizationAnchorName = "Primary care intake packet";

test.describe("patient document authorization policy parity @workflow-document-authorization-policy @slice179 @documents @security", () => {
  test("enforces Documents access for document APIs and UI", async ({ page, target, targetDb }) => {
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

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientDocumentsDirect(page, target, patient!.pid);
      await expandPatientDocumentCategories(page, ["Medical Record"]);
      await expectRenderedText(page, documentAuthorizationAnchorName);
      await expectRenderedText(page, "Medical Record");
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

    const frontDeskContent = await requestText(
      `${target.apiBaseUrl}/api/documents/${encodeURIComponent(String(intakePacket!.id))}/content`,
      {
        headers: {
          "X-OpenEMR-Session": frontDeskLogin.sessionId!
        }
      }
    );
    expect(frontDeskContent.statusCode).toBe(403);

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

    const adminLogin = await modernizedLogin(target, target.credentials.username, target.credentials.password);
    expect(adminLogin).toMatchObject({
      authenticated: true,
      username: "admin",
      role: "administrator"
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
