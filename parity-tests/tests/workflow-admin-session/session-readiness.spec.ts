import { test, expect } from "../../src/fixtures/parityTest.js";
import { requestText } from "../../src/http/httpClient.js";
import type { RuntimeTarget } from "../../src/config/targets.js";

type QueryableDb = {
  queryRows<T extends Record<string, string>>(sql: string): Promise<T[]>;
};

type ModernizedLoginResponse = {
  authenticated: boolean;
  username: string;
  displayName: string;
  role: string;
  staffId?: number | null;
  failureReason?: string | null;
  sessionId?: string | null;
  sessionCreatedAt?: string | null;
  sessionExpiresAt?: string | null;
};

type ModernizedSessionResponse = {
  authenticated: boolean;
  sessionId?: string | null;
  username: string;
  displayName: string;
  role: string;
  staffId?: number | null;
  createdAt?: string | null;
  lastSeenAt?: string | null;
  expiresAt?: string | null;
  endedAt?: string | null;
  failureReason?: string | null;
  sessionSource: string;
};

test.describe("admin session readiness parity @workflow-admin-session @slice161 @admin @security", () => {
  test("creates and ends an authenticated admin session", async ({ page, target, targetDb }) => {
    if (target.type === "legacy-openemr") {
      const login = await legacyLogin(target, target.credentials.password);
      expect(login.statusCode).toBe(200);
      expect(login.finalUrl).toContain("/interface/main/tabs/main.php");
      expect(login.body).toContain("patient-data-template");
      expect(getCookie(login.cookies, "OpenEMR")).toBeTruthy();

      const logout = await requestText(`${target.publicUrl}/interface/logout.php`, {
        cookies: login.cookies,
        followRedirects: true
      });
      expect(logout.statusCode).toBe(200);
      expect(logout.body).toMatch(/OpenEMR|login|logout/i);

      const afterLogout = await requestText(`${target.publicUrl}/interface/main/tabs/main.php`, {
        cookies: login.cookies,
        followRedirects: false
      });
      expect(afterLogout.body).not.toContain("patient-data-template");
      return;
    }

    const success = await modernizedLogin(target, target.credentials.password);
    expect(success).toMatchObject({
      authenticated: true,
      username: "admin",
      displayName: "Administrator",
      role: "administrator"
    });
    expect(success.sessionId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(success.sessionCreatedAt).toBeTruthy();
    expect(success.sessionExpiresAt).toBeTruthy();

    const sessionId = success.sessionId!;
    const session = await modernizedCurrentSession(target, sessionId);
    expect(session).toMatchObject({
      authenticated: true,
      sessionId,
      username: "admin",
      displayName: "Administrator",
      role: "administrator",
      sessionSource: "modernized-openemr"
    });

    const db = targetDb as QueryableDb;
    const activeRows = await db.queryRows<{ sessionId: string; username: string; endedAt: string; sessionSource: string }>(`
      select id::text as "sessionId", username, coalesce(ended_at::text, '') as "endedAt", session_source as "sessionSource"
      from auth_sessions
      where id = '${sessionId}';
    `);
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0]).toMatchObject({
      sessionId,
      username: "admin",
      endedAt: "",
      sessionSource: "modernized-openemr"
    });

    const logout = await modernizedLogout(target, sessionId);
    expect(logout.authenticated).toBe(false);
    expect(logout.sessionId).toBe(sessionId);
    expect(logout.endedAt).toBeTruthy();

    const afterLogout = await modernizedCurrentSession(target, sessionId);
    expect(afterLogout.authenticated).toBe(false);
    expect(afterLogout.failureReason).toMatch(/not active/i);

    const endedRows = await db.queryRows<{ endedAt: string }>(`
      select coalesce(ended_at::text, '') as "endedAt"
      from auth_sessions
      where id = '${sessionId}';
    `);
    expect(endedRows[0].endedAt).not.toBe("");

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Admin" }).click();

    const loginPanel = page.locator('form[aria-label="Login readiness"]');
    await loginPanel.getByLabel("Username").fill(target.credentials.username);
    await loginPanel.getByLabel("Password").fill(target.credentials.password);
    await loginPanel.getByRole("button", { name: "Verify Login" }).click();

    const sessionPanel = page.locator('[aria-label="Session readiness"]');
    await expect(sessionPanel).toBeVisible();
    await expect(sessionPanel).toContainText("Active session for Administrator (admin)");
    await expect(sessionPanel).toContainText("modernized-openemr");

    await sessionPanel.getByRole("button", { name: "Validate Session" }).click();
    await expect(sessionPanel).toContainText("Active session for Administrator (admin)");

    await sessionPanel.getByRole("button", { name: "End Session" }).click();
    await expect(sessionPanel).toContainText("Session ended for admin");
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

async function modernizedCurrentSession(target: RuntimeTarget, sessionId: string): Promise<ModernizedSessionResponse> {
  const response = await requestText(`${target.apiBaseUrl}/api/auth/session`, {
    headers: {
      "X-OpenEMR-Session": sessionId
    }
  });

  expect(response.statusCode).toBe(200);
  return JSON.parse(response.body) as ModernizedSessionResponse;
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
