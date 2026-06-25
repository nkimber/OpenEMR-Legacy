import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { requestText } from "../../src/http/httpClient.js";
import type { RuntimeTarget } from "../../src/config/targets.js";

type QueryableDb = {
  queryRows<T extends Record<string, string>>(sql: string): Promise<T[]>;
};

type LoginAuditRow = {
  id: string;
  success: string;
  username: string;
  comment: string;
  logSource?: string;
};

test.describe("admin login audit readiness parity @workflow-admin-login-audit @slice160 @admin @security @audit", () => {
  test("records successful and failed admin login audit rows", async ({ page, target, targetDb }, testInfo) => {
    const db = targetDb as QueryableDb;
    const maxId = target.type === "legacy-openemr"
      ? await getLegacyMaxLoginAuditId(db)
      : await getModernizedMaxLoginAuditId(db);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-160-admin-login-audit-precondition",
      description:
        "Captures the Slice 160 login-audit precondition: audit table boundary, configured username, and redacted login attempt plan.",
      expected: {
        username: "admin",
        auditEvent: "login",
        expectedNewRowsAtLeast: 2,
        expectedSuccessAndFailure: true,
        passwordMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        maxAuditIdBeforeLoginAttempts: maxId,
        configuredUsername: target.credentials.username,
        passwordRedacted: true
      },
      context: {
        suite: "workflow-admin-login-audit",
        workflow: "admin-login-audit-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      const success = await legacyLogin(target, target.credentials.password);
      expect(success.statusCode).toBe(200);
      expect(success.body).toContain("patient-data-template");

      const rejected = await legacyLogin(target, "wrong-pass");
      expect(rejected.statusCode).toBe(200);
      expect(rejected.body).not.toContain("patient-data-template");

      const rows = await getLegacyLoginAuditRows(db, maxId);
      assertLoginAuditRows(rows);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-160-admin-login-audit-rows",
        description:
          "Captures legacy OpenEMR log rows created by successful and failed admin login attempts.",
        expected: {
          successAttemptStatusCode: 200,
          failedAttemptStatusCode: 200,
          rowsAtLeast: 2,
          includesSuccessRow: true,
          includesFailureRow: true,
          successCommentPattern: "success:",
          failureCommentPattern: "failure: user password incorrect"
        },
        actual: {
          maxAuditIdBeforeLoginAttempts: maxId,
          successAttempt: {
            statusCode: success.statusCode,
            containsPatientDataTemplate: success.body.includes("patient-data-template")
          },
          rejectedAttempt: {
            statusCode: rejected.statusCode,
            containsPatientDataTemplate: rejected.body.includes("patient-data-template")
          },
          rows,
          normalizedSummary: summarizeLoginAuditRows(rows)
        },
        context: {
          suite: "workflow-admin-login-audit",
          workflow: "admin-login-audit-rows"
        }
      });
      return;
    }

    const success = await modernizedLogin(target, target.credentials.password);
    expect(success.authenticated).toBe(true);

    const rejected = await modernizedLogin(target, "wrong-pass");
    expect(rejected.authenticated).toBe(false);

    const rows = await getModernizedLoginAuditRows(db, maxId);
    assertLoginAuditRows(rows);
    expect(rows.every((row) => row.logSource === "modernized-openemr")).toBe(true);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-160-admin-login-audit-rows",
      description:
        "Captures modernized auth_audit_events rows created by successful and failed admin login attempts.",
      expected: {
        successAuthenticated: true,
        failureAuthenticated: false,
        rowsAtLeast: 2,
        includesSuccessRow: true,
        includesFailureRow: true,
        logSource: "modernized-openemr",
        passwordMaterialRedacted: true
      },
      actual: {
        maxAuditIdBeforeLoginAttempts: maxId,
        successAttempt: {
          authenticated: success.authenticated,
          username: success.username,
          sessionIssued: Boolean(success.sessionId)
        },
        rejectedAttempt: {
          authenticated: rejected.authenticated,
          username: rejected.username,
          failureReason: rejected.failureReason
        },
        rows,
        normalizedSummary: summarizeLoginAuditRows(rows)
      },
      context: {
        suite: "workflow-admin-login-audit",
        workflow: "admin-login-audit-rows"
      }
    });

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Admin" }).click();

    const loginPanel = page.locator('form[aria-label="Login readiness"]');
    await loginPanel.getByLabel("Username").fill(target.credentials.username);
    await loginPanel.getByLabel("Password").fill(target.credentials.password);
    await loginPanel.getByRole("button", { name: "Verify Login" }).click();

    const auditPanel = page.locator('[aria-label="Login audit events"]');
    await expect(auditPanel).toBeVisible();
    await expect(auditPanel).toContainText("Login Audit");
    await expect(auditPanel).toContainText("admin");
    await expect(auditPanel).toContainText("Success");
    await expect(auditPanel).toContainText("Failure");
    await expect(auditPanel).toContainText("modernized-openemr");
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-160-admin-login-audit-rendered",
      description:
        "Captures modernized Admin-page login audit rendering facts after successful and failed attempts are recorded.",
      expected: {
        rendersLoginAuditHeading: "Login Audit",
        rendersUsername: "admin",
        rendersSuccess: "Success",
        rendersFailure: "Failure",
        rendersLogSource: "modernized-openemr"
      },
      actual: {
        rows,
        surfaceFacts: {
          modernizedAdminLoginAuditPanel: {
            renderedHeading: "Login Audit",
            renderedUsername: "admin",
            renderedSuccess: "Success",
            renderedFailure: "Failure",
            renderedLogSource: "modernized-openemr",
            passwordRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-admin-login-audit",
        workflow: "admin-login-audit-rendered"
      }
    });
  });
});

async function getLegacyMaxLoginAuditId(db: QueryableDb): Promise<number> {
  const rows = await db.queryRows<{ maxId: string }>(`
    select coalesce(max(id), 0) as maxId
    from log
    where event = 'login'
      and user = 'admin';
  `);

  return Number.parseInt(rows[0]?.maxId ?? "0", 10);
}

async function getModernizedMaxLoginAuditId(db: QueryableDb): Promise<number> {
  const rows = await db.queryRows<{ maxId: string }>(`
    select coalesce(max(id), 0)::text as "maxId"
    from auth_audit_events
    where event = 'login'
      and lower(username) = 'admin';
  `);

  return Number.parseInt(rows[0]?.maxId ?? "0", 10);
}

async function getLegacyLoginAuditRows(db: QueryableDb, minId: number): Promise<LoginAuditRow[]> {
  return await db.queryRows<LoginAuditRow>(`
    select
      cast(id as char) as id,
      cast(success as char) as success,
      user as username,
      coalesce(from_base64(comments), '') as comment
    from log
    where event = 'login'
      and user = 'admin'
      and id > ${minId}
    order by id desc;
  `);
}

async function getModernizedLoginAuditRows(db: QueryableDb, minId: number): Promise<LoginAuditRow[]> {
  return await db.queryRows<LoginAuditRow>(`
    select
      id::text as id,
      success::text as success,
      username,
      comment,
      log_source as "logSource"
    from auth_audit_events
    where event = 'login'
      and lower(username) = 'admin'
      and id > ${minId}
    order by id desc;
  `);
}

function assertLoginAuditRows(rows: LoginAuditRow[]) {
  expect(rows.length).toBeGreaterThanOrEqual(2);

  const successRow = rows.find((row) => isSuccess(row.success));
  const failureRow = rows.find((row) => !isSuccess(row.success));

  expect(successRow, "login audit should include a success row").toBeTruthy();
  expect(failureRow, "login audit should include a failure row").toBeTruthy();
  expect(successRow?.username.toLowerCase()).toBe("admin");
  expect(failureRow?.username.toLowerCase()).toBe("admin");
  expect(successRow?.comment).toMatch(/success:/i);
  expect(failureRow?.comment).toMatch(/failure:.*user password incorrect/i);
}

function isSuccess(value: string) {
  return ["1", "t", "true"].includes(value.toLowerCase());
}

function summarizeLoginAuditRows(rows: LoginAuditRow[]) {
  return {
    rowCount: rows.length,
    successCount: rows.filter((row) => isSuccess(row.success)).length,
    failureCount: rows.filter((row) => !isSuccess(row.success)).length,
    usernames: [...new Set(rows.map((row) => row.username.toLowerCase()))],
    logSources: [...new Set(rows.map((row) => row.logSource).filter(Boolean))]
  };
}

type ModernizedLoginResponse = {
  authenticated: boolean;
  username: string;
  failureReason?: string | null;
  sessionId?: string | null;
};

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
