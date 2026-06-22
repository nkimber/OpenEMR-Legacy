import { test, expect } from "../../src/fixtures/parityTest.js";
import { requestText } from "../../src/http/httpClient.js";
import { expectRenderedText, loginToLegacyOpenEmr, openAccessControlDirect } from "../../src/ui/legacyOpenEmr.js";
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

type AdministrationDirectoryResponse = {
  counts: {
    users: number;
    accessGroups: number;
    accessGroupPermissions: number;
    accessUserMemberships: number;
  };
  accessControl: {
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
};

test.describe("administration authorization policy parity @workflow-admin-authorization-policy @slice173 @admin @security", () => {
  test("enforces ACL Administration access for the administration API", async ({ page, target, targetDb }) => {
    const accessControl = await targetDb.getAdministrationAccessControl();
    expect(accessControl.groupPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "admin",
          sectionValue: "admin",
          permissionValue: "acl",
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
          sectionValue: "admin",
          permissionValue: "acl"
        })
      ])
    );

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openAccessControlDirect(page, target);
      await expectRenderedText(page, "Groups and Access Controls");
      await expectRenderedText(page, "ACL Administration");
      await expectRenderedText(page, "Front Office");
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

    const frontDeskDirectory = await requestText(`${target.apiBaseUrl}/api/administration/directory`, {
      headers: {
        "X-OpenEMR-Session": frontDeskLogin.sessionId!
      }
    });
    expect(frontDeskDirectory.statusCode).toBe(403);
    const frontDeskFailure = JSON.parse(frontDeskDirectory.body) as ModernizedAuthorizationFailure;
    expect(frontDeskFailure).toMatchObject({
      authenticated: true,
      authorized: false,
      username: "gold-frontdesk-01",
      role: "frontdesk",
      requiredSection: "admin",
      requiredPermission: "acl",
      requiredReturnValue: "write",
      sessionSource: "modernized-openemr"
    });
    expect(frontDeskFailure.failureReason).toMatch(/not authorized/i);

    const frontDeskMutation = await requestText(`${target.apiBaseUrl}/api/administration/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-OpenEMR-Session": frontDeskLogin.sessionId!
      },
      body: JSON.stringify({
        username: "slice173-forbidden",
        firstName: "Forbidden",
        lastName: "User",
        role: "frontdesk",
        calendar: false,
        facilityId: 10,
        email: "slice173-forbidden@example.test",
        npi: "",
        active: true
      })
    });
    expect(frontDeskMutation.statusCode).toBe(403);

    const adminLogin = await modernizedLogin(target, target.credentials.username, target.credentials.password);
    expect(adminLogin).toMatchObject({
      authenticated: true,
      username: "admin",
      role: "administrator"
    });

    const adminDirectory = await requestText(`${target.apiBaseUrl}/api/administration/directory`, {
      headers: {
        "X-OpenEMR-Session": adminLogin.sessionId!
      }
    });
    expect(adminDirectory.statusCode).toBe(200);
    const directory = JSON.parse(adminDirectory.body) as AdministrationDirectoryResponse;
    expect(directory.counts.users).toBeGreaterThanOrEqual(20);
    expect(directory.counts.accessGroups).toBe(7);
    expect(directory.counts.accessGroupPermissions).toBe(203);
    expect(directory.counts.accessUserMemberships).toBe(4);
    expect(directory.accessControl.userMemberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userValue: "admin", groupValue: "admin", groupName: "Administrators" }),
        expect.objectContaining({ userValue: "gold-frontdesk-01", groupValue: "front", groupName: "Front Office" }),
        expect.objectContaining({ userValue: "gold-provider-01", groupValue: "clin", groupName: "Clinicians" })
      ])
    );

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Admin" }).click();
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();

    const loginPanel = page.locator('form[aria-label="Login readiness"]');
    await loginPanel.getByLabel("Username").fill("gold-frontdesk-01");
    await loginPanel.getByLabel("Password").fill("pass");
    await loginPanel.getByRole("button", { name: "Verify Login" }).click();

    await expect(page.locator("body")).toContainText("Signed in as Parker Fleming");
    await expect(page.locator("body")).toContainText("Administration directory load requires ACL Administration access");
    await expect(page.locator("body")).not.toContainText("Users And Facilities");

    await loginPanel.getByLabel("Username").fill(target.credentials.username);
    await loginPanel.getByLabel("Password").fill(target.credentials.password);
    await loginPanel.getByRole("button", { name: "Verify Login" }).click();

    await expect(page.locator("body")).toContainText("Administration Directory");
    await expect(page.locator("body")).toContainText("Users And Facilities");
    await expect(page.locator("body")).toContainText("ACL Administration");
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
