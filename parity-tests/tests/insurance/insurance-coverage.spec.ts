import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientInsuranceBrowseDirect } from "../../src/ui/legacyOpenEmr.js";

const insuranceAnchorPatientId = "MOD-PAT-0005";

test.describe("patient insurance coverage parity @slice28 @insurance", () => {
  test("stable insurance anchor has primary and secondary coverage", async ({ targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(insuranceAnchorPatientId);
    expect(patient).not.toBeNull();

    const coverage = await targetDb.getPatientInsuranceForPatient(patient!.pid);
    expect(coverage.patientId).toBe(patient!.pid);
    expect(coverage.insurance).toEqual([
      {
        type: "primary",
        provider: "Northstar HMO",
        planName: "Medicare Advantage",
        policyNumber: "POL100005",
        groupNumber: "GRP104",
        relationship: "self"
      },
      {
        type: "secondary",
        provider: "Acme Health",
        planName: "Family Choice",
        policyNumber: "SEC100005",
        groupNumber: "GRP204",
        relationship: "self"
      }
    ]);
  });

  test("insurance coverage is visible in the application UI", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(insuranceAnchorPatientId);
    expect(patient).not.toBeNull();

    const coverage = await targetDb.getPatientInsuranceForPatient(patient!.pid);
    const primary = coverage.insurance[0];
    const secondary = coverage.insurance[1];

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientInsuranceBrowseDirect(page, target, patient!.pid, "primary");

      await expectRenderedText(page, "Insurance Provider");
      await expectRenderedText(page, primary.provider);
      await expectRenderedText(page, primary.planName);
      await expectRenderedText(page, primary.policyNumber);
      await expectRenderedText(page, primary.groupNumber);

      await openPatientInsuranceBrowseDirect(page, target, patient!.pid, "secondary");
      await expectRenderedText(page, secondary.provider);
      await expectRenderedText(page, secondary.planName);
      await expectRenderedText(page, secondary.policyNumber);
      await expectRenderedText(page, secondary.groupNumber);
      return;
    }

    await page.goto(target.publicUrl);
    await expect(page.getByRole("heading", { name: "Patient/Client" })).toBeVisible();
    await page.getByLabel("Search patients").fill(patient!.pubpid);

    await expect(page.getByRole("button", { name: /Morgan, Elias/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Morgan, Elias" })).toBeVisible();

    const insurancePanel = page.getByLabel("Insurance coverage");
    await expect(insurancePanel).toContainText(primary.provider);
    await expect(insurancePanel).toContainText(primary.planName);
    await expect(insurancePanel).toContainText(primary.policyNumber);
    await expect(insurancePanel).toContainText(primary.groupNumber);
    await expect(insurancePanel).toContainText(secondary.provider);
    await expect(insurancePanel).toContainText(secondary.planName);
    await expect(insurancePanel).toContainText(secondary.policyNumber);
    await expect(insurancePanel).toContainText(secondary.groupNumber);
  });
});
