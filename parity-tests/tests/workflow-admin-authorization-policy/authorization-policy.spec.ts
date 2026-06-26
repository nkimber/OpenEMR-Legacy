import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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

test.describe("administration authorization policy parity @workflow-admin-authorization-policy @slice173 @admin @security", () => {
  test("enforces ACL Administration access for the administration API", async ({ page, target, targetDb }, testInfo) => {
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-173-admin-authorization-policy-precondition",
      description:
        "Captures the Slice 173 administration authorization-policy precondition without storing password, cookie, or session material.",
      expected: {
        requiredSection: "admin",
        requiredPermission: "acl",
        requiredReturnValue: "write",
        adminGroupHasAclWrite: true,
        frontOfficeGroupHasPatientDemoWrite: true,
        frontOfficeGroupDoesNotHaveAclAdministration: true,
        modernizedDirectoryPath: "/api/administration/directory",
        modernizedUserMutationPath: "/api/administration/users",
        secretMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true,
        accessControl: summarizeAccessControl(accessControl)
      },
      context: {
        suite: "workflow-admin-authorization-policy",
        workflow: "admin-authorization-policy-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openAccessControlDirect(page, target);
      await expectRenderedText(page, "Groups and Access Controls");
      await expectRenderedText(page, "ACL Administration");
      await expectRenderedText(page, "Front Office");
      const legacyAclText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-173-admin-authorization-policy-legacy-rendered",
        description:
          "Captures legacy OpenEMR ACL matrix rendering markers after admin login, with credentials redacted.",
        expected: {
          containsGroupsAndAccessControls: true,
          containsAclAdministration: true,
          containsFrontOffice: true,
          passwordMaterialRedacted: true
        },
        actual: {
          rendered: summarizeRenderedText(legacyAclText, [
            "Groups and Access Controls",
            "ACL Administration",
            "Front Office"
          ]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-admin-authorization-policy",
          workflow: "admin-authorization-policy-legacy-rendered"
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
      probe: "slice-173-admin-authorization-policy-frontdesk-login",
      description:
        "Captures modernized front-desk session setup for ACL policy checks with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: "gold-frontdesk-01",
        role: "frontdesk",
        staffId: 117,
        sessionIdentifierRedacted: true
      },
      actual: summarizeLogin(frontDeskLogin),
      context: {
        suite: "workflow-admin-authorization-policy",
        workflow: "admin-authorization-policy-frontdesk-login"
      }
    });

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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-173-admin-authorization-policy-frontdesk-directory-forbidden",
      description:
        "Captures modernized front-desk administration directory rejection facts with session material redacted.",
      expected: {
        statusCode: 403,
        authenticated: true,
        authorized: false,
        username: "gold-frontdesk-01",
        role: "frontdesk",
        requiredSection: "admin",
        requiredPermission: "acl",
        requiredReturnValue: "write",
        failureReasonContains: "not authorized",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskDirectory.statusCode,
        body: summarizeAuthorizationFailure(frontDeskFailure)
      },
      context: {
        suite: "workflow-admin-authorization-policy",
        workflow: "admin-authorization-policy-frontdesk-directory-forbidden"
      }
    });

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
    const frontDeskMutationFailure = JSON.parse(frontDeskMutation.body) as ModernizedAuthorizationFailure;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-173-admin-authorization-policy-frontdesk-mutation-forbidden",
      description:
        "Captures modernized front-desk administration mutation rejection facts with session material redacted.",
      expected: {
        statusCode: 403,
        createRejected: true,
        attemptedUsername: "slice173-forbidden",
        requiredSection: "admin",
        requiredPermission: "acl",
        requiredReturnValue: "write",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskMutation.statusCode,
        body: summarizeAuthorizationFailure(frontDeskMutationFailure)
      },
      context: {
        suite: "workflow-admin-authorization-policy",
        workflow: "admin-authorization-policy-frontdesk-mutation-forbidden"
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
      probe: "slice-173-admin-authorization-policy-admin-login",
      description:
        "Captures modernized admin session setup for ACL policy checks with password and session identifier redacted.",
      expected: {
        authenticated: true,
        username: "admin",
        role: "administrator",
        sessionIdentifierRedacted: true,
        passwordMaterialRedacted: true
      },
      actual: summarizeLogin(adminLogin),
      context: {
        suite: "workflow-admin-authorization-policy",
        workflow: "admin-authorization-policy-admin-login"
      }
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-173-admin-authorization-policy-admin-directory",
      description:
        "Captures modernized admin administration directory allow facts with session material redacted.",
      expected: {
        statusCode: 200,
        usersAtLeast: 20,
        accessGroups: 7,
        accessGroupPermissions: 203,
        accessUserMemberships: 4,
        includesAdminMembership: true,
        includesFrontOfficeMembership: true,
        includesClinicianMembership: true,
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: adminDirectory.statusCode,
        counts: directory.counts,
        membershipFacts: {
          includesAdminMembership: directory.accessControl.userMemberships.some(
            (membership) => membership.userValue === "admin" && membership.groupValue === "admin"
          ),
          includesFrontOfficeMembership: directory.accessControl.userMemberships.some(
            (membership) => membership.userValue === "gold-frontdesk-01" && membership.groupValue === "front"
          ),
          includesClinicianMembership: directory.accessControl.userMemberships.some(
            (membership) => membership.userValue === "gold-provider-01" && membership.groupValue === "clin"
          )
        },
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-admin-authorization-policy",
        workflow: "admin-authorization-policy-admin-directory"
      }
    });

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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-173-admin-authorization-policy-rendered",
      description:
        "Captures modernized Admin-page ACL retry rendering facts for front-desk denial followed by admin allow.",
      expected: {
        frontDeskSignedIn: "Signed in as Parker Fleming",
        frontDeskDeniedMessage: "Administration directory load requires ACL Administration access",
        hidesUsersAndFacilitiesForFrontDesk: true,
        rendersAdministrationDirectoryForAdmin: true,
        rendersUsersAndFacilitiesForAdmin: true,
        rendersAclAdministrationForAdmin: true
      },
      actual: {
        surfaceFacts: {
          modernizedAdminPage: {
            renderedFrontDeskSignedIn: "Signed in as Parker Fleming",
            renderedFrontDeskDeniedMessage: "Administration directory load requires ACL Administration access",
            didNotRenderUsersAndFacilitiesForFrontDesk: true,
            renderedAdministrationDirectoryForAdmin: true,
            renderedUsersAndFacilitiesForAdmin: true,
            renderedAclAdministrationForAdmin: true,
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-admin-authorization-policy",
        workflow: "admin-authorization-policy-rendered"
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

function summarizeAccessControl(accessControl: AccessControlSnapshot) {
  return {
    groupPermissionCount: accessControl.groupPermissions.length,
    userMembershipCount: accessControl.userMemberships.length,
    adminAclWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "admin" &&
        permission.sectionValue === "admin" &&
        permission.permissionValue === "acl" &&
        permission.returnValue === "write"
    ),
    frontOfficePatientDemoWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "front" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "demo" &&
        permission.returnValue === "write"
    ),
    frontOfficeAclAdministration: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "front" &&
        permission.sectionValue === "admin" &&
        permission.permissionValue === "acl"
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

function summarizeRenderedText(text: string | null, markers: string[]) {
  const body = text ?? "";
  return {
    bodyLength: body.length,
    bodyPreview: body.slice(0, 240),
    markers: Object.fromEntries(markers.map((marker) => [marker, body.includes(marker)]))
  };
}
