import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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
  test("requires an authenticated admin session before administration directory evidence is visible", async ({ page, target }, testInfo) => {
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-163-admin-directory-protection-precondition",
      description:
        "Captures the Slice 163 admin-directory protection precondition without storing password, cookie, or session material.",
      expected: {
        username: "admin",
        legacyProtectedUserPath: "/interface/usergroup/usergroup_admin.php",
        legacyProtectedFacilityPath: "/interface/usergroup/facilities.php",
        modernizedProtectedDirectoryPath: "/api/administration/directory",
        modernizedProtectedMutationPath: "/api/administration/facilities",
        requiresAuthenticatedAdminSession: true,
        secretMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true
      },
      context: {
        suite: "workflow-admin-directory-protection",
        workflow: "admin-directory-protection-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      const unauthenticatedUsers = await requestText(`${target.publicUrl}/interface/usergroup/usergroup_admin.php`);
      expect(unauthenticatedUsers.body).not.toContain("Add User");
      expect(unauthenticatedUsers.body).not.toContain("gold-provider-02");

      const unauthenticatedFacilities = await requestText(`${target.publicUrl}/interface/usergroup/facilities.php`);
      expect(unauthenticatedFacilities.body).not.toContain("North County Clinic");
      expect(unauthenticatedFacilities.body).not.toContain("East County Care Center");
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-163-admin-directory-protection-unauthenticated",
        description:
          "Captures legacy OpenEMR administration directory protection markers before an admin session is established.",
        expected: {
          containsAddUser: false,
          containsGoldProvider02: false,
          containsNorthCountyClinic: false,
          containsEastCountyCareCenter: false
        },
        actual: {
          unauthenticatedUsers: {
            statusCode: unauthenticatedUsers.statusCode,
            containsAddUser: unauthenticatedUsers.body.includes("Add User"),
            containsGoldProvider02: unauthenticatedUsers.body.includes("gold-provider-02"),
            bodyLength: unauthenticatedUsers.body.length,
            bodyPreview: unauthenticatedUsers.body.slice(0, 240)
          },
          unauthenticatedFacilities: {
            statusCode: unauthenticatedFacilities.statusCode,
            containsNorthCountyClinic: unauthenticatedFacilities.body.includes("North County Clinic"),
            containsEastCountyCareCenter: unauthenticatedFacilities.body.includes("East County Care Center"),
            bodyLength: unauthenticatedFacilities.body.length,
            bodyPreview: unauthenticatedFacilities.body.slice(0, 240)
          }
        },
        context: {
          suite: "workflow-admin-directory-protection",
          workflow: "admin-directory-protection-unauthenticated"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-163-admin-directory-protection-authenticated",
        description:
          "Captures legacy OpenEMR administration directory visibility markers after an admin session is established, with cookies redacted.",
        expected: {
          loginStatusCode: 200,
          openEmrCookieIssued: true,
          authenticatedUsersStatusCode: 200,
          authenticatedFacilitiesStatusCode: 200,
          containsAddUser: true,
          containsNorthCountyClinic: true,
          containsEastCountyCareCenter: true
        },
        actual: {
          login: {
            statusCode: login.statusCode,
            containsPatientDataTemplate: login.body.includes("patient-data-template"),
            openEmrCookieIssued: Boolean(getCookie(login.cookies, "OpenEMR")),
            cookieNames: getCookieNames(login.cookies),
            cookieValuesRedacted: true
          },
          authenticatedUsers: {
            statusCode: authenticatedUsers.statusCode,
            containsAddUser: authenticatedUsers.body.includes("Add User"),
            bodyLength: authenticatedUsers.body.length,
            bodyPreview: authenticatedUsers.body.slice(0, 240)
          },
          authenticatedFacilities: {
            statusCode: authenticatedFacilities.statusCode,
            containsNorthCountyClinic: authenticatedFacilities.body.includes("North County Clinic"),
            containsEastCountyCareCenter: authenticatedFacilities.body.includes("East County Care Center"),
            bodyLength: authenticatedFacilities.body.length,
            bodyPreview: authenticatedFacilities.body.slice(0, 240)
          }
        },
        context: {
          suite: "workflow-admin-directory-protection",
          workflow: "admin-directory-protection-authenticated"
        }
      });
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-163-admin-directory-protection-unauthenticated",
      description:
        "Captures modernized administration directory API protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        authenticated: false,
        sessionSource: "modernized-openemr",
        failureReasonPattern: "valid admin or OpenEMR session"
      },
      actual: {
        statusCode: unauthenticatedDirectory.statusCode,
        body: unauthenticatedSession
      },
      context: {
        suite: "workflow-admin-directory-protection",
        workflow: "admin-directory-protection-unauthenticated"
      }
    });

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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-163-admin-directory-protection-unauthenticated-mutation",
      description:
        "Captures modernized administration mutation protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        attemptedFacilityCode: "NOAUTH",
        attemptedFacilityName: "No Auth Facility",
        mutationRejected: true
      },
      actual: {
        statusCode: unauthenticatedMutation.statusCode,
        bodyLength: unauthenticatedMutation.body.length,
        bodyPreview: unauthenticatedMutation.body.slice(0, 240)
      },
      context: {
        suite: "workflow-admin-directory-protection",
        workflow: "admin-directory-protection-unauthenticated-mutation"
      }
    });

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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-163-admin-directory-protection-authenticated",
      description:
        "Captures modernized administration directory API visibility facts after an admin session is established, with the session identifier redacted.",
      expected: {
        loginAuthenticated: true,
        authenticatedDirectoryStatusCode: 200,
        usersAtLeast: 20,
        facilitiesAtLeast: 3,
        accessGroupsGreaterThanZero: true,
        includesGoldProvider02: true,
        includesNorthCountyClinic: true,
        sessionIdentifierRedacted: true
      },
      actual: {
        login: {
          authenticated: login.authenticated,
          username: login.username,
          displayName: login.displayName,
          role: login.role,
          sessionIssued: Boolean(login.sessionId),
          sessionIdRedacted: true
        },
        authenticatedDirectory: {
          statusCode: authenticatedDirectory.statusCode,
          counts: directory.counts,
          includesGoldProvider02: directory.users.some((user) => user.username === "gold-provider-02"),
          includesNorthCountyClinic: directory.facilities.some(
            (facility) => facility.code === "NORTH" && facility.name === "North County Clinic"
          ),
          sampleUsers: directory.users.slice(0, 5),
          sampleFacilities: directory.facilities.slice(0, 5)
        }
      },
      context: {
        suite: "workflow-admin-directory-protection",
        workflow: "admin-directory-protection-authenticated"
      }
    });

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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-163-admin-directory-protection-rendered",
      description:
        "Captures modernized Admin-page directory protection rendering facts before and after login.",
      expected: {
        rendersSignedOutPrompt: "Sign in to load the users and facilities directory",
        hidesUsersAndFacilitiesBeforeLogin: true,
        rendersAdministrationDirectory: "Administration Directory",
        rendersUsersAndFacilities: "Users And Facilities",
        rendersGoldProvider02: "gold-provider-02",
        rendersNorthCountyClinic: "North County Clinic"
      },
      actual: {
        surfaceFacts: {
          modernizedAdminDirectoryPanel: {
            renderedSignedOutPrompt: "Sign in to load the users and facilities directory",
            didNotRenderUsersAndFacilitiesBeforeLogin: true,
            renderedAdministrationDirectory: "Administration Directory",
            renderedUsersAndFacilities: "Users And Facilities",
            renderedGoldProvider02: "gold-provider-02",
            renderedNorthCountyClinic: "North County Clinic",
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-admin-directory-protection",
        workflow: "admin-directory-protection-rendered"
      }
    });
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

function getCookieNames(cookies: string[]) {
  return cookies.map((cookie) => cookie.split("=", 1)[0]).filter(Boolean);
}
