import { test, expect } from "../../src/fixtures/parityTest.js";
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
  test("accepts configured admin credentials and rejects an invalid password", async ({ page, target }) => {
    if (target.type === "legacy-openemr") {
      const success = await legacyLogin(target, target.credentials.password);
      expect(success.statusCode).toBe(200);
      expect(success.body).toContain("<title>OpenEMR</title>");
      expect(success.body).toContain("patient-data-template");

      const rejected = await legacyLogin(target, "wrong-pass");
      expect(rejected.statusCode).toBe(200);
      expect(rejected.body).not.toContain("patient-data-template");
      expect(rejected.body).toMatch(/login_screen\.php\?error=1|OpenEMR Login|Invalid/i);
      return;
    }

    const success = await modernizedLogin(target, target.credentials.password);
    expect(success).toMatchObject({
      authenticated: true,
      username: "admin",
      displayName: "Administrator",
      role: "administrator"
    });

    const rejected = await modernizedLogin(target, "wrong-pass");
    expect(rejected.authenticated).toBe(false);
    expect(rejected.failureReason).toMatch(/invalid username or password/i);

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Admin" }).click();

    const loginPanel = page.locator('form[aria-label="Login readiness"]');
    await expect(loginPanel).toBeVisible();
    await loginPanel.getByLabel("Username").fill(target.credentials.username);
    await loginPanel.getByLabel("Password").fill(target.credentials.password);
    await loginPanel.getByRole("button", { name: "Verify Login" }).click();

    await expect(loginPanel).toContainText("Signed in as Administrator (admin)");
    await expect(loginPanel).toContainText("administrator");
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
