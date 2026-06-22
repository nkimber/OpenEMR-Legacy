import { test, expect } from "../../src/fixtures/parityTest.js";
import { requestText } from "../../src/http/httpClient.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";

const patientAuthorizationPatientId = "MOD-PAT-0001";

type ModernizedLoginResponse = {
  authenticated: boolean;
  username: string;
  displayName: string;
  role: string;
  staffId?: number | null;
  sessionId?: string | null;
};

type PatientSearchResponse = {
  totalMatches: number;
  patients: Array<{
    canonicalId: string;
    legacyPid: number;
    displayName: string;
  }>;
};

type PatientChartResponse = {
  canonicalId: string;
  legacyPid: number;
  displayName: string;
  purpose?: string | null;
};

test.describe("patient chart authorization policy parity @workflow-patient-authorization-policy @slice178 @patients @security", () => {
  test("honors Demographics ACL access for patient APIs and UI", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(patientAuthorizationPatientId);
    expect(patient).not.toBeNull();

    const accessControl = await targetDb.getAdministrationAccessControl();
    expect(accessControl.groupPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "admin",
          sectionValue: "patients",
          permissionValue: "demo",
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

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientSummaryDirect(page, target, patient!.pid);
      await expectRenderedText(page, patient!.fname);
      await expectRenderedText(page, patient!.lname);
      await expectRenderedText(page, String(patient!.pid));
      return;
    }

    expect(accessControl.userMemberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userValue: "gold-frontdesk-01",
          groupValue: "front",
          groupName: "Front Office"
        })
      ])
    );

    const unauthenticatedSearch = await requestText(
      `${target.apiBaseUrl}/api/patients?search=${encodeURIComponent(patient!.pubpid)}&limit=5`
    );
    expect(unauthenticatedSearch.statusCode).toBe(401);

    const frontDeskLogin = await modernizedLogin(target, "gold-frontdesk-01", "pass");
    expect(frontDeskLogin).toMatchObject({
      authenticated: true,
      username: "gold-frontdesk-01",
      displayName: "Parker Fleming",
      role: "frontdesk",
      staffId: 117
    });
    expect(frontDeskLogin.sessionId).toMatch(/^[0-9a-f-]{36}$/i);

    const frontDeskSearch = await requestText(
      `${target.apiBaseUrl}/api/patients?search=${encodeURIComponent(patient!.pubpid)}&limit=5`,
      {
        headers: {
          "X-OpenEMR-Session": frontDeskLogin.sessionId!
        }
      }
    );
    expect(frontDeskSearch.statusCode).toBe(200);
    const search = JSON.parse(frontDeskSearch.body) as PatientSearchResponse;
    expect(search.patients).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          canonicalId: patient!.pubpid,
          legacyPid: patient!.pid,
          displayName: "Stone, Avery"
        })
      ])
    );

    const frontDeskChart = await requestText(
      `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
      {
        headers: {
          "X-OpenEMR-Session": frontDeskLogin.sessionId!
        }
      }
    );
    expect(frontDeskChart.statusCode).toBe(200);
    const chart = JSON.parse(frontDeskChart.body) as PatientChartResponse;
    expect(chart).toMatchObject({
      canonicalId: patient!.pubpid,
      legacyPid: patient!.pid,
      displayName: "Stone, Avery",
      purpose: "Stable search and demographics navigation"
    });

    const adminLogin = await modernizedLogin(target, target.credentials.username, target.credentials.password);
    expect(adminLogin).toMatchObject({
      authenticated: true,
      username: "admin",
      role: "administrator"
    });

    const adminChart = await requestText(`${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`, {
      headers: {
        "X-OpenEMR-Session": adminLogin.sessionId!
      }
    });
    expect(adminChart.statusCode).toBe(200);

    await page.goto(target.publicUrl);
    await expect(page.getByRole("heading", { name: "Patient/Client" })).toBeVisible();

    const accessPanel = page.locator('form[aria-label="Patient access"]');
    await accessPanel.getByLabel("Username").fill("gold-frontdesk-01");
    await accessPanel.getByLabel("Password").fill("pass");
    await accessPanel.getByRole("button", { name: "Verify Patient Access" }).click();

    await expect(page.locator("body")).toContainText("Signed in as Parker Fleming");
    await expect(page.locator("body")).not.toContainText("Sign in to search patient charts");

    await page.getByLabel("Search patients").fill(patient!.pubpid);
    await expect(page.getByRole("button", { name: /Stone, Avery/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Stone, Avery" })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(`PID ${patient!.pid}`);
    await expect(page.locator("body")).toContainText("Stable search and demographics navigation");
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
