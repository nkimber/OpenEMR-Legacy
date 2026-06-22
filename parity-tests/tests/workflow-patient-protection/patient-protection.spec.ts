import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";

test.describe("patient chart protection parity @slice165 @patient-protection", () => {
  test("requires an active session before patient search and chart data are visible", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId("MOD-PAT-0001");
    expect(patient).not.toBeNull();

    if (target.type === "legacy-openemr") {
      await page.goto(`${target.publicUrl}/interface/patient_file/summary/demographics.php?set_pid=${patient!.pid}`);
      await expect(page.locator("body")).not.toContainText(patient!.pubpid);
      await expect(page.locator("body")).not.toContainText(patient!.fname);
      await expect(page.locator("body")).not.toContainText(patient!.lname);

      await loginToLegacyOpenEmr(page, target);
      await openPatientSummaryDirect(page, target, patient!.pid);
      await expectRenderedText(page, patient!.fname);
      await expectRenderedText(page, patient!.lname);
      await expectRenderedText(page, String(patient!.pid));
      return;
    }

    const unauthenticatedSearch = await page.request.get(
      `${target.apiBaseUrl}/api/patients?search=${encodeURIComponent(patient!.pubpid)}&limit=25`
    );
    expect(unauthenticatedSearch.status()).toBe(401);
    const unauthenticatedSearchBody = await unauthenticatedSearch.json();
    expect(unauthenticatedSearchBody).toMatchObject({
      authenticated: false,
      sessionSource: "modernized-openemr"
    });

    const unauthenticatedChart = await page.request.get(
      `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`
    );
    expect(unauthenticatedChart.status()).toBe(401);

    const loginResponse = await page.request.post(`${target.apiBaseUrl}/api/auth/login`, {
      data: target.credentials
    });
    expect(loginResponse.ok()).toBeTruthy();
    const login = await loginResponse.json();
    expect(login.authenticated).toBe(true);
    expect(login.sessionId).toBeTruthy();

    const authenticatedSearch = await page.request.get(
      `${target.apiBaseUrl}/api/patients?search=${encodeURIComponent(patient!.pubpid)}&limit=25`,
      { headers: { "X-OpenEMR-Session": login.sessionId } }
    );
    expect(authenticatedSearch.ok()).toBeTruthy();
    const search = await authenticatedSearch.json();
    expect(search.patients).toHaveLength(1);
    expect(search.patients[0]).toMatchObject({
      canonicalId: patient!.pubpid,
      legacyPid: patient!.pid,
      displayName: "Stone, Avery"
    });

    const authenticatedChart = await page.request.get(
      `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
      { headers: { "X-OpenEMR-Session": login.sessionId } }
    );
    expect(authenticatedChart.ok()).toBeTruthy();
    const chart = await authenticatedChart.json();
    expect(chart).toMatchObject({
      canonicalId: patient!.pubpid,
      legacyPid: patient!.pid,
      displayName: "Stone, Avery",
      purpose: "Stable search and demographics navigation"
    });

    await page.goto(target.publicUrl);
    await expect(page.getByRole("heading", { name: "Patient/Client" })).toBeVisible();
    await expect(page.locator("body")).toContainText("Sign in to search patient charts");
    await expect(page.locator("body")).toContainText("Sign in to load patient charts");
    await expect(page.locator("body")).not.toContainText("Stone, Avery");

    const accessPanel = page.locator('form[aria-label="Patient access"]');
    await accessPanel.getByLabel("Username").fill(target.credentials.username);
    await accessPanel.getByLabel("Password").fill(target.credentials.password);
    await accessPanel.getByRole("button", { name: "Verify Patient Access" }).click();

    await page.getByLabel("Search patients").fill(patient!.pubpid);
    await expect(page.getByRole("button", { name: /Stone, Avery/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Stone, Avery" })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(`PID ${patient!.pid}`);
    await expect(page.locator("body")).toContainText("Stable search and demographics navigation");
  });
});
