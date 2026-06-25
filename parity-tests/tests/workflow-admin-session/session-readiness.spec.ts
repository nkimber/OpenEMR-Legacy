import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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
  test("creates and ends an authenticated admin session", async ({ page, target, targetDb }, testInfo) => {
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-161-admin-session-precondition",
      description:
        "Captures the Slice 161 admin-session readiness precondition without storing password or live session material.",
      expected: {
        username: "admin",
        expectedLegacyCookieName: "OpenEMR",
        expectedModernizedSessionSource: "modernized-openemr",
        passwordMaterialRedacted: true,
        sessionIdentifiersRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true
      },
      context: {
        suite: "workflow-admin-session",
        workflow: "admin-session-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      const login = await legacyLogin(target, target.credentials.password);
      expect(login.statusCode).toBe(200);
      expect(login.finalUrl).toContain("/interface/main/tabs/main.php");
      expect(login.body).toContain("patient-data-template");
      expect(getCookie(login.cookies, "OpenEMR")).toBeTruthy();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-161-admin-session-login",
        description:
          "Captures legacy OpenEMR session creation markers after a successful admin login, with cookie values redacted.",
        expected: {
          statusCode: 200,
          finalUrlContains: "/interface/main/tabs/main.php",
          containsPatientDataTemplate: true,
          openEmrCookieIssued: true
        },
        actual: {
          statusCode: login.statusCode,
          finalUrl: login.finalUrl,
          containsPatientDataTemplate: login.body.includes("patient-data-template"),
          openEmrCookieIssued: Boolean(getCookie(login.cookies, "OpenEMR")),
          cookieNames: getCookieNames(login.cookies),
          cookieValuesRedacted: true,
          bodyLength: login.body.length,
          bodyPreview: login.body.slice(0, 240)
        },
        context: {
          suite: "workflow-admin-session",
          workflow: "admin-session-login"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-161-admin-session-logout",
        description:
          "Captures legacy OpenEMR logout and post-logout access markers, with cookie values redacted.",
        expected: {
          logoutStatusCode: 200,
          logoutBodyMatchesOpenEmrOrLoginOrLogout: true,
          postLogoutContainsPatientDataTemplate: false
        },
        actual: {
          logout: {
            statusCode: logout.statusCode,
            bodyMatchesOpenEmrOrLoginOrLogout: /OpenEMR|login|logout/i.test(logout.body),
            bodyLength: logout.body.length,
            bodyPreview: logout.body.slice(0, 240)
          },
          afterLogout: {
            statusCode: afterLogout.statusCode,
            containsPatientDataTemplate: afterLogout.body.includes("patient-data-template"),
            bodyLength: afterLogout.body.length,
            bodyPreview: afterLogout.body.slice(0, 240)
          },
          cookieNames: getCookieNames(login.cookies),
          cookieValuesRedacted: true
        },
        context: {
          suite: "workflow-admin-session",
          workflow: "admin-session-logout"
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
    expect(success.sessionId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(success.sessionCreatedAt).toBeTruthy();
    expect(success.sessionExpiresAt).toBeTruthy();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-161-admin-session-login",
      description:
        "Captures modernized API session creation facts after a successful admin login, with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: "admin",
        displayName: "Administrator",
        role: "administrator",
        sessionIssued: true,
        sessionIdentifierRedacted: true
      },
      actual: {
        authenticated: success.authenticated,
        username: success.username,
        displayName: success.displayName,
        role: success.role,
        staffId: success.staffId,
        sessionIssued: Boolean(success.sessionId),
        sessionIdRedacted: true,
        sessionCreatedAt: success.sessionCreatedAt,
        sessionExpiresAt: success.sessionExpiresAt
      },
      context: {
        suite: "workflow-admin-session",
        workflow: "admin-session-login"
      }
    });

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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-161-admin-session-current",
      description:
        "Captures modernized current-session API facts for the active admin session, with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: "admin",
        role: "administrator",
        sessionSource: "modernized-openemr",
        sessionIdentifierRedacted: true
      },
      actual: {
        authenticated: session.authenticated,
        sessionIssued: Boolean(session.sessionId),
        sessionIdRedacted: true,
        username: session.username,
        displayName: session.displayName,
        role: session.role,
        staffId: session.staffId,
        createdAt: session.createdAt,
        lastSeenAt: session.lastSeenAt,
        expiresAt: session.expiresAt,
        endedAt: session.endedAt,
        sessionSource: session.sessionSource
      },
      context: {
        suite: "workflow-admin-session",
        workflow: "admin-session-current"
      }
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-161-admin-session-active-db",
      description:
        "Captures modernized auth_sessions persistence facts while the admin session is active, with the session identifier redacted.",
      expected: {
        activeRows: 1,
        username: "admin",
        endedAt: "",
        sessionSource: "modernized-openemr",
        sessionIdentifierRedacted: true
      },
      actual: {
        activeRows: activeRows.map((row) => ({
          sessionIdRedacted: true,
          sessionIssued: Boolean(row.sessionId),
          username: row.username,
          endedAt: row.endedAt,
          sessionSource: row.sessionSource
        }))
      },
      context: {
        suite: "workflow-admin-session",
        workflow: "admin-session-active-db"
      }
    });

    const logout = await modernizedLogout(target, sessionId);
    expect(logout.authenticated).toBe(false);
    expect(logout.sessionId).toBe(sessionId);
    expect(logout.endedAt).toBeTruthy();

    const afterLogout = await modernizedCurrentSession(target, sessionId);
    expect(afterLogout.authenticated).toBe(false);
    expect(afterLogout.failureReason).toMatch(/not active/i);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-161-admin-session-logout",
      description:
        "Captures modernized logout and invalidated-session API facts, with the session identifier redacted.",
      expected: {
        logoutAuthenticated: false,
        endedAtPresent: true,
        afterLogoutAuthenticated: false,
        afterLogoutFailureReasonPattern: "not active",
        sessionIdentifierRedacted: true
      },
      actual: {
        logout: {
          authenticated: logout.authenticated,
          sessionIssued: Boolean(logout.sessionId),
          sessionIdRedacted: true,
          endedAt: logout.endedAt,
          sessionSource: logout.sessionSource
        },
        afterLogout: {
          authenticated: afterLogout.authenticated,
          sessionIssued: Boolean(afterLogout.sessionId),
          sessionIdRedacted: true,
          failureReason: afterLogout.failureReason,
          sessionSource: afterLogout.sessionSource
        }
      },
      context: {
        suite: "workflow-admin-session",
        workflow: "admin-session-logout"
      }
    });

    const endedRows = await db.queryRows<{ endedAt: string }>(`
      select coalesce(ended_at::text, '') as "endedAt"
      from auth_sessions
      where id = '${sessionId}';
    `);
    expect(endedRows[0].endedAt).not.toBe("");
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-161-admin-session-ended-db",
      description:
        "Captures modernized auth_sessions persistence facts after logout, with the session identifier redacted.",
      expected: {
        endedRows: 1,
        endedAtPresent: true,
        sessionIdentifierRedacted: true
      },
      actual: {
        rowCount: endedRows.length,
        endedRows: endedRows.map((row) => ({
          endedAtPresent: row.endedAt !== "",
          endedAt: row.endedAt
        }))
      },
      context: {
        suite: "workflow-admin-session",
        workflow: "admin-session-ended-db"
      }
    });

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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-161-admin-session-rendered",
      description:
        "Captures modernized Admin-page session readiness rendering facts after login, validation, and logout.",
      expected: {
        rendersActiveSession: "Active session for Administrator (admin)",
        rendersSessionSource: "modernized-openemr",
        rendersEndedSession: "Session ended for admin"
      },
      actual: {
        surfaceFacts: {
          modernizedAdminSessionPanel: {
            renderedActiveSession: "Active session for Administrator (admin)",
            renderedSessionSource: "modernized-openemr",
            renderedEndedSession: "Session ended for admin",
            username: target.credentials.username,
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-admin-session",
        workflow: "admin-session-rendered"
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

function getCookieNames(cookies: string[]) {
  return cookies.map((cookie) => cookie.split("=", 1)[0]).filter(Boolean);
}
