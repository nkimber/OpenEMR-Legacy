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

type AuthAuditResponse = {
  totalEvents: number;
  successfulLogins: number;
  failedLogins: number;
  events: Array<{
    username: string;
    success: boolean;
    logSource: string;
  }>;
};

test.describe("admin audit protection parity @workflow-admin-audit-protection @slice162 @admin @security @audit", () => {
  test("requires an authenticated admin session before login audit evidence is visible", async ({ page, target }) => {
    if (target.type === "legacy-openemr") {
      const unauthenticatedLogView = await requestText(`${target.publicUrl}/interface/logview/logview.php`);
      expect(unauthenticatedLogView.statusCode).not.toBe(200);
      expect(unauthenticatedLogView.body).not.toContain("Logs Viewer");

      const login = await legacyLogin(target, target.credentials.password);
      expect(login.statusCode).toBe(200);
      expect(login.body).toContain("patient-data-template");
      expect(getCookie(login.cookies, "OpenEMR")).toBeTruthy();

      const authenticatedLogView = await requestText(`${target.publicUrl}/interface/logview/logview.php`, {
        cookies: login.cookies
      });
      expect(authenticatedLogView.statusCode).toBe(200);
      expect(authenticatedLogView.body).toContain("Logs Viewer");
      expect(authenticatedLogView.body).toContain("Main Log");
      return;
    }

    const unauthenticatedAudit = await requestText(`${target.apiBaseUrl}/api/auth/login-audit?limit=5`);
    expect(unauthenticatedAudit.statusCode).toBe(401);
    const unauthenticatedSession = JSON.parse(unauthenticatedAudit.body) as ModernizedSessionResponse;
    expect(unauthenticatedSession).toMatchObject({
      authenticated: false,
      sessionSource: "modernized-openemr"
    });
    expect(unauthenticatedSession.failureReason).toMatch(/valid admin session/i);

    const login = await modernizedLogin(target, target.credentials.password);
    expect(login).toMatchObject({
      authenticated: true,
      username: "admin",
      displayName: "Administrator",
      role: "administrator"
    });
    expect(login.sessionId).toMatch(/^[0-9a-f-]{36}$/i);
    const sessionId = login.sessionId!;

    const authenticatedAudit = await requestText(`${target.apiBaseUrl}/api/auth/login-audit?limit=5`, {
      headers: {
        "X-OpenEMR-Session": sessionId
      }
    });
    expect(authenticatedAudit.statusCode).toBe(200);
    const audit = JSON.parse(authenticatedAudit.body) as AuthAuditResponse;
    expect(audit.totalEvents).toBeGreaterThanOrEqual(1);
    expect(audit.successfulLogins).toBeGreaterThanOrEqual(1);
    expect(audit.events.some((event) => event.username === "admin" && event.success && event.logSource === "modernized-openemr")).toBe(true);

    const logout = await modernizedLogout(target, sessionId);
    expect(logout.authenticated).toBe(false);

    const endedSessionAudit = await requestText(`${target.apiBaseUrl}/api/auth/login-audit?limit=5`, {
      headers: {
        "X-OpenEMR-Session": sessionId
      }
    });
    expect(endedSessionAudit.statusCode).toBe(401);
    const endedSession = JSON.parse(endedSessionAudit.body) as ModernizedSessionResponse;
    expect(endedSession.authenticated).toBe(false);
    expect(endedSession.failureReason).toMatch(/not active/i);

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Admin" }).click();

    const auditPanel = page.locator('[aria-label="Login audit events"]');
    await expect(auditPanel).toBeVisible();
    await expect(auditPanel).toContainText("Sign in to view login audit events");

    const loginPanel = page.locator('form[aria-label="Login readiness"]');
    await loginPanel.getByLabel("Username").fill(target.credentials.username);
    await loginPanel.getByLabel("Password").fill(target.credentials.password);
    await loginPanel.getByRole("button", { name: "Verify Login" }).click();

    await expect(auditPanel).toContainText("Login Audit");
    await expect(auditPanel).toContainText("admin");
    await expect(auditPanel).toContainText("Success");
    await expect(auditPanel).toContainText("modernized-openemr");
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

async function modernizedLogout(target: RuntimeTarget, sessionId: string): Promise<ModernizedSessionResponse> {
  const body = JSON.stringify({ sessionId });
  const response = await requestText(`${target.apiBaseUrl}/api/auth/logout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(body))
    },
    body
  });

  expect(response.statusCode).toBe(200);
  return JSON.parse(response.body) as ModernizedSessionResponse;
}

function getCookie(cookies: string[], name: string) {
  return cookies.find((cookie) => cookie.toLowerCase().startsWith(`${name.toLowerCase()}=`));
}
