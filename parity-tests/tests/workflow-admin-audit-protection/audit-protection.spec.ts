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
  test("requires an authenticated admin session before login audit evidence is visible", async ({ page, target }, testInfo) => {
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-162-admin-audit-protection-precondition",
      description:
        "Captures the Slice 162 admin-audit protection precondition without storing password, cookie, or session material.",
      expected: {
        username: "admin",
        legacyProtectedPath: "/interface/logview/logview.php",
        modernizedProtectedPath: "/api/auth/login-audit?limit=5",
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
        suite: "workflow-admin-audit-protection",
        workflow: "admin-audit-protection-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      const unauthenticatedLogView = await requestText(`${target.publicUrl}/interface/logview/logview.php`);
      expect(unauthenticatedLogView.statusCode).not.toBe(200);
      expect(unauthenticatedLogView.body).not.toContain("Logs Viewer");
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-162-admin-audit-protection-unauthenticated",
        description:
          "Captures legacy OpenEMR log viewer protection markers before an admin session is established.",
        expected: {
          statusCodeIsNot200: true,
          containsLogsViewer: false
        },
        actual: {
          statusCode: unauthenticatedLogView.statusCode,
          statusCodeIsNot200: unauthenticatedLogView.statusCode !== 200,
          containsLogsViewer: unauthenticatedLogView.body.includes("Logs Viewer"),
          bodyLength: unauthenticatedLogView.body.length,
          bodyPreview: unauthenticatedLogView.body.slice(0, 240)
        },
        context: {
          suite: "workflow-admin-audit-protection",
          workflow: "admin-audit-protection-unauthenticated"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-162-admin-audit-protection-authenticated",
        description:
          "Captures legacy OpenEMR log viewer visibility markers after an admin session is established, with cookies redacted.",
        expected: {
          loginStatusCode: 200,
          openEmrCookieIssued: true,
          authenticatedLogViewStatusCode: 200,
          containsLogsViewer: true,
          containsMainLog: true
        },
        actual: {
          login: {
            statusCode: login.statusCode,
            containsPatientDataTemplate: login.body.includes("patient-data-template"),
            openEmrCookieIssued: Boolean(getCookie(login.cookies, "OpenEMR")),
            cookieNames: getCookieNames(login.cookies),
            cookieValuesRedacted: true
          },
          authenticatedLogView: {
            statusCode: authenticatedLogView.statusCode,
            containsLogsViewer: authenticatedLogView.body.includes("Logs Viewer"),
            containsMainLog: authenticatedLogView.body.includes("Main Log"),
            bodyLength: authenticatedLogView.body.length,
            bodyPreview: authenticatedLogView.body.slice(0, 240)
          }
        },
        context: {
          suite: "workflow-admin-audit-protection",
          workflow: "admin-audit-protection-authenticated"
        }
      });
      return;
    }

    const unauthenticatedAudit = await requestText(`${target.apiBaseUrl}/api/auth/login-audit?limit=5`);
    expect(unauthenticatedAudit.statusCode).toBe(401);
    const unauthenticatedSession = JSON.parse(unauthenticatedAudit.body) as ModernizedSessionResponse;
    expect(unauthenticatedSession).toMatchObject({
      authenticated: false,
      sessionSource: "modernized-openemr"
    });
    expect(unauthenticatedSession.failureReason).toMatch(/valid (?:admin|OpenEMR) session/i);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-162-admin-audit-protection-unauthenticated",
      description:
        "Captures modernized login-audit API protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        authenticated: false,
        sessionSource: "modernized-openemr",
        failureReasonPattern: "valid admin or OpenEMR session"
      },
      actual: {
        statusCode: unauthenticatedAudit.statusCode,
        body: unauthenticatedSession
      },
      context: {
        suite: "workflow-admin-audit-protection",
        workflow: "admin-audit-protection-unauthenticated"
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-162-admin-audit-protection-authenticated",
      description:
        "Captures modernized login-audit API visibility facts after an admin session is established, with the session identifier redacted.",
      expected: {
        loginAuthenticated: true,
        authenticatedAuditStatusCode: 200,
        totalEventsAtLeast: 1,
        successfulLoginsAtLeast: 1,
        includesAdminSuccessFromModernizedSource: true,
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
        authenticatedAudit: {
          statusCode: authenticatedAudit.statusCode,
          summary: summarizeAudit(audit),
          sampleEvents: audit.events.slice(0, 5)
        }
      },
      context: {
        suite: "workflow-admin-audit-protection",
        workflow: "admin-audit-protection-authenticated"
      }
    });

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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-162-admin-audit-protection-ended-session",
      description:
        "Captures modernized login-audit API protection facts after the admin session has been ended, with the session identifier redacted.",
      expected: {
        logoutAuthenticated: false,
        endedSessionAuditStatusCode: 401,
        endedSessionAuthenticated: false,
        failureReasonPattern: "not active",
        sessionIdentifierRedacted: true
      },
      actual: {
        logout: {
          authenticated: logout.authenticated,
          sessionIssued: Boolean(logout.sessionId),
          sessionIdRedacted: true,
          sessionSource: logout.sessionSource
        },
        endedSessionAudit: {
          statusCode: endedSessionAudit.statusCode,
          body: {
            authenticated: endedSession.authenticated,
            username: endedSession.username,
            failureReason: endedSession.failureReason,
            sessionSource: endedSession.sessionSource,
            sessionIssued: Boolean(endedSession.sessionId),
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-admin-audit-protection",
        workflow: "admin-audit-protection-ended-session"
      }
    });

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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-162-admin-audit-protection-rendered",
      description:
        "Captures modernized Admin-page audit protection rendering facts before and after login.",
      expected: {
        rendersSignedOutPrompt: "Sign in to view login audit events",
        rendersLoginAuditHeading: "Login Audit",
        rendersUsername: "admin",
        rendersSuccess: "Success",
        rendersLogSource: "modernized-openemr"
      },
      actual: {
        surfaceFacts: {
          modernizedAdminLoginAuditPanel: {
            renderedSignedOutPrompt: "Sign in to view login audit events",
            renderedHeading: "Login Audit",
            renderedUsername: "admin",
            renderedSuccess: "Success",
            renderedLogSource: "modernized-openemr",
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-admin-audit-protection",
        workflow: "admin-audit-protection-rendered"
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

function summarizeAudit(audit: AuthAuditResponse) {
  return {
    totalEvents: audit.totalEvents,
    successfulLogins: audit.successfulLogins,
    failedLogins: audit.failedLogins,
    eventCount: audit.events.length,
    usernames: [...new Set(audit.events.map((event) => event.username.toLowerCase()))],
    logSources: [...new Set(audit.events.map((event) => event.logSource))]
  };
}
