import { test, expect } from "../../src/fixtures/parityTest.js";
import { isSuccessStatus, requestText } from "../../src/http/httpClient.js";

test.describe("legacy HTTP functional contract @http", () => {
  test("health endpoint reports ready", async ({ target }) => {
    const response = await requestText(target.healthUrl, { allowSelfSigned: true });

    expect(isSuccessStatus(response.statusCode)).toBe(true);
  });

  test("login page exposes the expected username and password fields", async ({ target }) => {
    const response = await requestText(`${target.publicUrl}/interface/login/login.php?site=default`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("OpenEMR Login");
    expect(response.body).toContain('name="authUser"');
    expect(response.body).toContain('name="clearPass"');
  });

  test("admin login reaches the OpenEMR application shell", async ({ target }) => {
    const body = new URLSearchParams({
      new_login_session_management: "1",
      authUser: target.credentials.username,
      clearPass: target.credentials.password,
      languageChoice: "1"
    }).toString();
    const response = await requestText(`${target.publicUrl}/interface/main/main_screen.php?auth=login&site=default`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": String(Buffer.byteLength(body))
      },
      body,
      followRedirects: true
    });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("<title>OpenEMR</title>");
    expect(response.body).toContain("patient-data-template");
  });
});
