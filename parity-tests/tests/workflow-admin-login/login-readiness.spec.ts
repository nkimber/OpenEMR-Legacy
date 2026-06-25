import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { requestText } from "../../src/http/httpClient.js";
import type { RuntimeTarget } from "../../src/config/targets.js";

type ModernizedLoginResponse = {
  authenticated: boolean;
  username: string;
  displayName: string;
  role: string;
  staffId?: number | null;
  failureReason?: string | null;
};

test.describe("admin login readiness parity @workflow-admin-login @slice159 @admin @security", () => {
  test("accepts configured admin credentials and rejects an invalid password", async ({ page, target }, testInfo) => {
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-159-admin-login-precondition",
      description:
        "Captures the Slice 159 admin-login readiness precondition without storing password material.",
      expected: {
        username: "admin",
        successCredentialSource: "configured target credentials",
        invalidPasswordScenario: "wrong-pass is rejected",
        legacySuccessMarker: "patient-data-template",
        modernizedSuccessRole: "administrator"
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true
      },
      context: {
        suite: "workflow-admin-login",
        workflow: "admin-login-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      const success = await legacyLogin(target, target.credentials.password);
      expect(success.statusCode).toBe(200);
      expect(success.body).toContain("<title>OpenEMR</title>");
      expect(success.body).toContain("patient-data-template");
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-159-admin-login-success",
        description:
          "Captures legacy HTTP login success markers for the configured admin credential without storing password material.",
        expected: {
          statusCode: 200,
          containsOpenEmrTitle: true,
          containsPatientDataTemplate: true
        },
        actual: {
          statusCode: success.statusCode,
          containsOpenEmrTitle: success.body.includes("<title>OpenEMR</title>"),
          containsPatientDataTemplate: success.body.includes("patient-data-template"),
          bodyLength: success.body.length,
          bodyPreview: success.body.slice(0, 240)
        },
        context: {
          suite: "workflow-admin-login",
          workflow: "admin-login-success"
        }
      });

      const rejected = await legacyLogin(target, "wrong-pass");
      expect(rejected.statusCode).toBe(200);
      expect(rejected.body).not.toContain("patient-data-template");
      expect(rejected.body).toMatch(/login_screen\.php\?error=1|OpenEMR Login|Invalid/i);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-159-admin-login-rejected",
        description:
          "Captures legacy HTTP login rejection markers for an invalid admin password without storing password material.",
        expected: {
          statusCode: 200,
          containsPatientDataTemplate: false,
          containsLoginErrorMarker: true
        },
        actual: {
          statusCode: rejected.statusCode,
          containsPatientDataTemplate: rejected.body.includes("patient-data-template"),
          containsLoginErrorMarker: /login_screen\.php\?error=1|OpenEMR Login|Invalid/i.test(rejected.body),
          bodyLength: rejected.body.length,
          bodyPreview: rejected.body.slice(0, 240)
        },
        context: {
          suite: "workflow-admin-login",
          workflow: "admin-login-rejected"
        }
      });
      return;
    }

    const success = await modernizedLogin(target, target.credentials.password);
    expect(success).toMatchObject({
      authenticated: true,
      username: "admin",
      displayName: "Administrator",
      role: "administrator"
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-159-admin-login-success",
      description:
        "Captures modernized API login success facts for the configured admin credential without storing password material.",
      expected: {
        authenticated: true,
        username: "admin",
        displayName: "Administrator",
        role: "administrator"
      },
      actual: success,
      context: {
        suite: "workflow-admin-login",
        workflow: "admin-login-success"
      }
    });

    const rejected = await modernizedLogin(target, "wrong-pass");
    expect(rejected.authenticated).toBe(false);
    expect(rejected.failureReason).toMatch(/invalid username or password/i);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-159-admin-login-rejected",
      description:
        "Captures modernized API login rejection facts for an invalid admin password without storing password material.",
      expected: {
        authenticated: false,
        failureReasonPattern: "invalid username or password"
      },
      actual: rejected,
      context: {
        suite: "workflow-admin-login",
        workflow: "admin-login-rejected"
      }
    });

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Admin" }).click();

    const loginPanel = page.locator('form[aria-label="Login readiness"]');
    await expect(loginPanel).toBeVisible();
    await loginPanel.getByLabel("Username").fill(target.credentials.username);
    await loginPanel.getByLabel("Password").fill(target.credentials.password);
    await loginPanel.getByRole("button", { name: "Verify Login" }).click();

    await expect(loginPanel).toContainText("Signed in as Administrator (admin)");
    await expect(loginPanel).toContainText("administrator");
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-159-admin-login-rendered",
      description:
        "Captures modernized Admin-page login readiness rendering facts after verifying the configured admin credential.",
      expected: {
        rendersSignedInMessage: "Signed in as Administrator (admin)",
        rendersRole: "administrator"
      },
      actual: {
        surfaceFacts: {
          modernizedAdminLoginPanel: {
            renderedSignedInMessage: "Signed in as Administrator (admin)",
            renderedRole: "administrator",
            username: target.credentials.username,
            passwordRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-admin-login",
        workflow: "admin-login-rendered"
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
