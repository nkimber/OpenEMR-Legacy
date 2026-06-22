import { test, expect } from "../../src/fixtures/parityTest.js";
import { requestText } from "../../src/http/httpClient.js";
import type { RuntimeTarget } from "../../src/config/targets.js";

type ModernizedLoginResponse = {
  authenticated: boolean;
  username: string;
  displayName: string;
  role: string;
  sessionId?: string | null;
};

type ModernizedSessionResponse = {
  authenticated: boolean;
  sessionId?: string | null;
  username: string;
  failureReason?: string | null;
  sessionSource: string;
};

type AdministrationDirectoryResponse = {
  counts: {
    users: number;
    facilities: number;
    accessGroups: number;
  };
  users: Array<{
    username: string;
    displayName: string;
  }>;
  facilities: Array<{
    code: string;
    name: string;
  }>;
};

test.describe("admin directory protection parity @workflow-admin-directory-protection @slice163 @admin @security", () => {
  test("requires an authenticated admin session before administration directory evidence is visible", async ({ page, target }) => {
    if (target.type === "legacy-openemr") {
      const unauthenticatedUsers = await requestText(`${target.publicUrl}/interface/usergroup/usergroup_admin.php`);
      expect(unauthenticatedUsers.body).not.toContain("Add User");
      expect(unauthenticatedUsers.body).not.toContain("gold-provider-02");

      const unauthenticatedFacilities = await requestText(`${target.publicUrl}/interface/usergroup/facilities.php`);
      expect(unauthenticatedFacilities.body).not.toContain("North County Clinic");
      expect(unauthenticatedFacilities.body).not.toContain("East County Care Center");

      const login = await legacyLogin(target, target.credentials.password);
      expect(login.statusCode).toBe(200);
      expect(login.body).toContain("patient-data-template");
      expect(getCookie(login.cookies, "OpenEMR")).toBeTruthy();

      const authenticatedUsers = await requestText(`${target.publicUrl}/interface/usergroup/usergroup_admin.php`, {
        cookies: login.cookies
      });
      expect(authenticatedUsers.statusCode).toBe(200);
      expect(authenticatedUsers.body).toContain("Add User");

      const authenticatedFacilities = await requestText(`${target.publicUrl}/interface/usergroup/facilities.php`, {
        cookies: login.cookies
      });
      expect(authenticatedFacilities.statusCode).toBe(200);
      expect(authenticatedFacilities.body).toContain("North County Clinic");
      expect(authenticatedFacilities.body).toContain("East County Care Center");
      return;
    }

    const unauthenticatedDirectory = await requestText(`${target.apiBaseUrl}/api/administration/directory`);
    expect(unauthenticatedDirectory.statusCode).toBe(401);
    const unauthenticatedSession = JSON.parse(unauthenticatedDirectory.body) as ModernizedSessionResponse;
    expect(unauthenticatedSession).toMatchObject({
      authenticated: false,
      sessionSource: "modernized-openemr"
    });
    expect(unauthenticatedSession.failureReason).toMatch(/valid (admin|OpenEMR) session/i);

    const unauthenticatedMutation = await requestText(`${target.apiBaseUrl}/api/administration/facilities`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        code: "NOAUTH",
        name: "No Auth Facility",
        active: true
      })
    });
    expect(unauthenticatedMutation.statusCode).toBe(401);

    const login = await modernizedLogin(target, target.credentials.password);
    expect(login).toMatchObject({
      authenticated: true,
      username: "admin",
      displayName: "Administrator",
      role: "administrator"
    });
    expect(login.sessionId).toMatch(/^[0-9a-f-]{36}$/i);
    const sessionId = login.sessionId!;

    const authenticatedDirectory = await requestText(`${target.apiBaseUrl}/api/administration/directory`, {
      headers: {
        "X-OpenEMR-Session": sessionId
      }
    });
    expect(authenticatedDirectory.statusCode).toBe(200);
    const directory = JSON.parse(authenticatedDirectory.body) as AdministrationDirectoryResponse;
    expect(directory.counts.users).toBeGreaterThanOrEqual(20);
    expect(directory.counts.facilities).toBeGreaterThanOrEqual(3);
    expect(directory.counts.accessGroups).toBeGreaterThan(0);
    expect(directory.users.some((user) => user.username === "gold-provider-02")).toBe(true);
    expect(directory.facilities.some((facility) => facility.code === "NORTH" && facility.name === "North County Clinic")).toBe(true);

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Admin" }).click();
    await expect(page.locator("body")).toContainText("Sign in to load the users and facilities directory");
    await expect(page.locator("body")).not.toContainText("Users And Facilities");

    const loginPanel = page.locator('form[aria-label="Login readiness"]');
    await loginPanel.getByLabel("Username").fill(target.credentials.username);
    await loginPanel.getByLabel("Password").fill(target.credentials.password);
    await loginPanel.getByRole("button", { name: "Verify Login" }).click();

    await expect(page.locator("body")).toContainText("Administration Directory");
    await expect(page.locator("body")).toContainText("Users And Facilities");
    await expect(page.locator("body")).toContainText("gold-provider-02");
    await expect(page.locator("body")).toContainText("North County Clinic");
  });
});

async function legacyLogin(target: RuntimeTarget, password: string) {
  const body = new URLSearchParams({
    new_login_session_management: "1",
    authUser: target.credentials.username,
    clearPass: password,
    languageChoice: "1"
  }).toString();

  return await requestText(`${target.publicUrl}/interface/main/main_screen.php?auth=login&site=default`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": String(Buffer.byteLength(body))
    },
    body,
    followRedirects: true
  });
}

async function modernizedLogin(target: RuntimeTarget, password: string): Promise<ModernizedLoginResponse> {
  const body = JSON.stringify({
    username: target.credentials.username,
    password
  });

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

function getCookie(cookies: string[], name: string) {
  return cookies.find((cookie) => cookie.toLowerCase().startsWith(`${name.toLowerCase()}=`));
}
