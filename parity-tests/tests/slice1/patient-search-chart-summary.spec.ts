import { test, expect } from "../../src/fixtures/parityTest.js";
import { isSuccessStatus, requestText } from "../../src/http/httpClient.js";
import { loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";

test.describe("patient search and chart summary parity @slice1 @patient-chart", () => {
  test("target health endpoint is reachable", async ({ target }) => {
    const response = await requestText(target.healthUrl, { allowSelfSigned: true });

    expect(isSuccessStatus(response.statusCode)).toBe(true);
  });

  test("stable anchor patient has comparable demographic and activity facts", async ({ targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId("MOD-PAT-0001");
    expect(patient).not.toBeNull();
    expect(patient).toMatchObject({
      pid: 100001,
      pubpid: "MOD-PAT-0001",
      fname: "Avery",
      lname: "Stone"
    });

    const counts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(counts.appointments).toBeGreaterThanOrEqual(3);
    expect(counts.encounters).toBeGreaterThanOrEqual(1);
    expect(counts.prescriptions).toBeGreaterThanOrEqual(2);
    expect(counts.billingLineItems).toBeGreaterThanOrEqual(1);
    expect(counts.procedureOrders).toBeGreaterThanOrEqual(1);
  });

  test("stable anchor patient chart is visible in the application UI", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId("MOD-PAT-0001");
    expect(patient).not.toBeNull();

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientSummaryDirect(page, target, patient!.pid);

      await expect(page.locator("body")).toContainText(patient!.fname);
      await expect(page.locator("body")).toContainText(patient!.lname);
      await expect(page.locator("body")).toContainText(patient!.pubpid);
      return;
    }

    await page.goto(target.publicUrl);
    await expect(page.getByRole("heading", { name: "Patient/Client" })).toBeVisible();
    await page.getByLabel("Search patients").fill(patient!.pubpid);

    await expect(page.getByRole("button", { name: /Stone, Avery/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Stone, Avery" })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(`PID ${patient!.pid}`);
    await expect(page.locator("body")).toContainText("Stable search and demographics navigation");
  });
});
