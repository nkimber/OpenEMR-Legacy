import { test, expect } from "../../src/fixtures/parityTest.js";
import { isSuccessStatus, requestText } from "../../src/http/httpClient.js";

test.describe("HTTP functional contract @http", () => {
  test("health endpoint reports ready", async ({ target }) => {
    const response = await requestText(target.healthUrl, { allowSelfSigned: true });

    expect(isSuccessStatus(response.statusCode)).toBe(true);
  });

  test("login page exposes the expected username and password fields", async ({ target }) => {
    test.skip(target.type !== "legacy-openemr", "Legacy login form is not part of the modernized read-only patient slice.");

    const response = await requestText(`${target.publicUrl}/interface/login/login.php?site=default`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("OpenEMR Login");
    expect(response.body).toContain('name="authUser"');
    expect(response.body).toContain('name="clearPass"');
  });

  test("admin login reaches the OpenEMR application shell", async ({ target }) => {
    test.skip(target.type !== "legacy-openemr", "Modernized authentication is deferred to a later slice.");

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

  test("modernized patient search API returns the stable anchor patient", async ({ target }) => {
    test.skip(target.type !== "modernized-openemr", "Modernized API contract only applies to the modernized target.");

    const response = await requestText(`${target.apiBaseUrl}/api/patients?search=MOD-PAT-0001&limit=5`);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      totalMatches: number;
      patients: Array<{
        canonicalId: string;
        legacyPid: number;
        pubpid: string;
        displayName: string;
      }>;
    };

    expect(body.totalMatches).toBe(1);
    expect(body.patients[0]).toMatchObject({
      canonicalId: "MOD-PAT-0001",
      legacyPid: 100001,
      pubpid: "MOD-PAT-0001",
      displayName: "Stone, Avery"
    });
  });

  test("modernized chart summary API returns comparable patient activity facts", async ({ target }) => {
    test.skip(target.type !== "modernized-openemr", "Modernized API contract only applies to the modernized target.");

    const response = await requestText(`${target.apiBaseUrl}/api/patients/MOD-PAT-0001`);
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as {
      canonicalId: string;
      legacyPid: number;
      displayName: string;
      counts: {
        appointments: number;
        encounters: number;
        prescriptions: number;
        billingItems: number;
        labOrders: number;
      };
    };

    expect(body.canonicalId).toBe("MOD-PAT-0001");
    expect(body.legacyPid).toBe(100001);
    expect(body.displayName).toBe("Stone, Avery");
    expect(body.counts.appointments).toBeGreaterThanOrEqual(3);
    expect(body.counts.encounters).toBeGreaterThanOrEqual(1);
    expect(body.counts.prescriptions).toBeGreaterThanOrEqual(2);
    expect(body.counts.billingItems).toBeGreaterThanOrEqual(1);
    expect(body.counts.labOrders).toBeGreaterThanOrEqual(1);
  });
});
