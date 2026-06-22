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

type PatientMessagesResponse = {
  patientId: string;
  legacyPid: number;
  patientDisplayName: string;
  messages: Array<{ id: string; title: string; status: string; assignedTo?: string | null }>;
};

const messageAuthorizationPatientId = "MOD-PAT-0004";
const careTeamMessageTitle = "Care team follow-up";
const portalMessageTitle = "Portal message";

test.describe("patient message authorization policy parity @workflow-message-authorization-policy @slice180 @messages @security", () => {
  test("enforces Patient Notes access for message APIs and UI", async ({ page, target, targetDb }) => {
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

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientNotesDirect(page, target, patient!.pid);
      await expectRenderedText(page, careTeamMessageTitle);
      await expectRenderedText(page, portalMessageTitle);
      await expectRenderedText(page, /Patient Notes|Messages|Notes/i);
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

    const adminLogin = await modernizedLogin(target, target.credentials.username, target.credentials.password);
    expect(adminLogin).toMatchObject({
      authenticated: true,
      username: "admin",
      role: "administrator"
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
