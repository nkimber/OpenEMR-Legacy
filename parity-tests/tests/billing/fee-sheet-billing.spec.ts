import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openEncounterDirect,
  openFeeSheetDirect
} from "../../src/ui/legacyOpenEmr.js";

const billingAnchorPatientId = "MOD-PAT-0001";

test.describe("fee sheet billing parity @slice7 @billing", () => {
  test("stable billing anchor has seeded CPT fee sheet lines", async ({ targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(billingAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    const billingLines = await targetDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
    expect(billingLines.length).toBeGreaterThanOrEqual(2);
    expect(
      billingLines.some(
        (line) =>
          line.codeType === "CPT4" &&
          line.code === "99214" &&
          line.codeText === "Established patient office visit" &&
          line.justify === "E78.5"
      )
    ).toBe(true);
    expect(
      billingLines.some(
        (line) => line.codeType === "CPT4" && line.code === "36415" && line.codeText === "Routine venipuncture"
      )
    ).toBe(true);
  });

  test("seeded fee sheet billing codes are visible in the application UI", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(billingAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    const billingLines = await targetDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
    expect(billingLines.length).toBeGreaterThanOrEqual(2);
    const officeVisit = billingLines.find((line) => line.code === "99214") ?? billingLines[0];
    const venipuncture = billingLines.find((line) => line.code === "36415") ?? billingLines[1];

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
      await openFeeSheetDirect(page, target, patient!.pid, encounter!.encounter);

      await expectRenderedText(page, "Selected Fee Sheet Codes and Charges");
      await expectRenderedText(page, officeVisit.code);
      await expectRenderedText(page, officeVisit.codeText);
      await expectRenderedText(page, venipuncture.code);
      await expectRenderedText(page, venipuncture.codeText);
      return;
    }

    await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText("Selected Fee Sheet Codes and Charges");
    await expect(page.locator("body")).toContainText(`Encounter ${encounter!.encounter}`);
    await expect(page.locator("body")).toContainText(officeVisit.code);
    await expect(page.locator("body")).toContainText(officeVisit.codeText);
    await expect(page.locator("body")).toContainText(venipuncture.code);
    await expect(page.locator("body")).toContainText(venipuncture.codeText);
  });
});
