import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientImmunizationsDirect } from "../../src/ui/legacyOpenEmr.js";

const immunizationAnchorPatientId = "MOD-PAT-0007";

test.describe("immunizations parity @slice29 @immunizations", () => {
  test("stable pediatric anchor has rich immunization history", async ({ targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(immunizationAnchorPatientId);
    expect(patient).not.toBeNull();

    const immunizations = await targetDb.getPatientImmunizationsForPatient(patient!.pid);
    expect(immunizations.patientId).toBe(patient!.pid);
    expect(immunizations.immunizations.length).toBeGreaterThanOrEqual(8);
    expect(immunizations.immunizations.some((item) => item.vaccine === "Influenza, seasonal, injectable" && item.cvxCode === "141")).toBe(true);
    expect(immunizations.immunizations.some((item) => item.vaccine === "Hep A, ped/adol, 2 dose" && item.manufacturer === "GlaxoSmithKline")).toBe(true);
    expect(immunizations.immunizations.some((item) => item.administeredDate.startsWith("2026-"))).toBe(true);
    expect(immunizations.immunizations.every((item) => item.lotNumber.startsWith("LOT-"))).toBe(true);
  });

  test("immunizations are visible in the application UI", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(immunizationAnchorPatientId);
    expect(patient).not.toBeNull();
    const immunizations = await targetDb.getPatientImmunizationsForPatient(patient!.pid);
    expect(immunizations.immunizations.length).toBeGreaterThanOrEqual(8);

    const influenza = immunizations.immunizations.find((item) => item.vaccine === "Influenza, seasonal, injectable") ?? immunizations.immunizations[0];
    const hepatitisA = immunizations.immunizations.find((item) => item.vaccine === "Hep A, ped/adol, 2 dose") ?? immunizations.immunizations[0];

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientImmunizationsDirect(page, target, patient!.pid);

      await expectRenderedText(page, "Vaccine");
      await expectRenderedText(page, influenza.vaccine);
      await expectRenderedText(page, hepatitisA.vaccine);
      await expectRenderedText(page, hepatitisA.manufacturer);
      await expectRenderedText(page, hepatitisA.lotNumber);
      return;
    }

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Lists" }).click();
    await expect(page.getByRole("heading", { name: "Lists" })).toBeVisible();

    await page.getByLabel("Clinical lists patient ID").fill(patient!.pubpid);

    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText("Immunizations");
    await expect(page.locator("body")).toContainText(influenza.vaccine);
    await expect(page.locator("body")).toContainText(hepatitisA.vaccine);
    await expect(page.locator("body")).toContainText(hepatitisA.manufacturer);
    await expect(page.locator("body")).toContainText(hepatitisA.lotNumber);
  });
});
