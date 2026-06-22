import { test, expect } from "../../src/fixtures/parityTest.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openEncounterDirect,
  openFeeSheetDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterBillingAnchorPatientId = "MOD-PAT-0001";
const encounterBillingAnchorFromDate = "2026-01-01";
const officeVisitCode = "99214";
const officeVisitText = "Established patient office visit";
const venipunctureCode = "36415";
const venipunctureText = "Routine venipuncture";

test.describe("encounter billing linkage readiness parity @slice68 @encounter-billing @billing", () => {
  test("stable encounter anchor exposes linked fee-sheet billing facts", async ({ targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterBillingAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();
    expect(encounter!.encounter).toBe(1000013);

    const billingLines = await targetDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
    expect(billingLines).toHaveLength(2);

    const officeVisit = billingLines.find((line) => line.code === officeVisitCode);
    const venipuncture = billingLines.find((line) => line.code === venipunctureCode);

    expect(officeVisit).toMatchObject({
      codeType: "CPT4",
      code: officeVisitCode,
      codeText: officeVisitText,
      justify: "E78.5"
    });
    expect(Number(officeVisit!.fee)).toBe(168);

    expect(venipuncture).toMatchObject({
      codeType: "CPT4",
      code: venipunctureCode,
      codeText: venipunctureText,
      justify: "E78.5"
    });
    expect(Number(venipuncture!.fee)).toBe(18);
  });

  test("encounter-linked fee-sheet lines are reachable from the application surface", async ({
    page,
    target,
    targetDb
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterBillingAnchorPatientId);
    expect(patient).not.toBeNull();
    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
      await openFeeSheetDirect(page, target, patient!.pid, encounter!.encounter);

      await expectRenderedText(page, "Selected Fee Sheet Codes and Charges");
      await expectRenderedText(page, officeVisitCode);
      await expectRenderedText(page, officeVisitText);
      await expectRenderedText(page, venipunctureCode);
      await expectRenderedText(page, venipunctureText);
      return;
    }

    const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounter!.encounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
    expect(detailResponse.ok()).toBe(true);
    const detailPayload = await detailResponse.json();
    expect(detailPayload.billingLineCount).toBe(2);
    expect(detailPayload.billingLines).toHaveLength(2);
    expect(detailPayload.billingLines.map((line: { code: string }) => line.code).sort()).toEqual([
      venipunctureCode,
      officeVisitCode
    ]);

    await openAuthenticatedModernizedEncounters(page, target, patient!.pubpid, encounterBillingAnchorFromDate);

    const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
    await expect(encounterButton).toBeVisible();
    await encounterButton.click();

    const linkage = page.getByLabel("Encounter billing linkage");
    await expect(linkage).toBeVisible();
    await expect(linkage).toContainText("Fee Sheet Linkage");
    await expect(linkage).toContainText("$186.00");
    await expect(linkage).toContainText(officeVisitCode);
    await expect(linkage).toContainText(officeVisitText);
    await expect(linkage).toContainText("$168.00");
    await expect(linkage).toContainText(venipunctureCode);
    await expect(linkage).toContainText(venipunctureText);
    await expect(linkage).toContainText("$18.00");
    await expect(linkage).toContainText("Justification E78.5");
  });
});
