import { test, expect } from "../../src/fixtures/parityTest.js";
import { loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";

test.describe("legacy Playwright UI contract @ui", () => {
  test("logs in with configured local demo credentials", async ({ page, target }) => {
    await loginToLegacyOpenEmr(page, target);

    await expect(page.locator("body")).toContainText(/OpenEMR|Patient/i);
  });

  test("opens the stable gold patient chart through the legacy UI", async ({ page, target, legacyDb }) => {
    const patient = await legacyDb.findPatientByCanonicalId("MOD-PAT-0001");
    expect(patient).not.toBeNull();

    await loginToLegacyOpenEmr(page, target);
    await openPatientSummaryDirect(page, target, patient!.pid);

    await expect(page.locator("body")).toContainText(patient!.fname);
    await expect(page.locator("body")).toContainText(patient!.lname);
    await expect(page.locator("body")).toContainText(patient!.pubpid);
  });
});
