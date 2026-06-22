import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openEncounterDirect,
  openFeeSheetDirect
} from "../../src/ui/legacyOpenEmr.js";
import {
  getModernizedAdminSessionHeaders,
  openAuthenticatedModernizedFees
} from "../../src/ui/modernizedOpenEmr.js";

const billingProtectionPatientId = "MOD-PAT-0001";

test.describe("billing protection parity @slice171 @billing-protection", () => {
  test("requires an active session before fee sheet and revenue-cycle data are visible", async ({
    page,
    target,
    targetDb
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(billingProtectionPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    const billingLines = await targetDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
    const officeVisit = billingLines.find((line) => line.code === "99214");
    const venipuncture = billingLines.find((line) => line.code === "36415");
    expect(officeVisit).toBeTruthy();
    expect(venipuncture).toBeTruthy();

    if (target.type === "legacy-openemr") {
      await page.goto(`${target.publicUrl}/interface/forms/fee_sheet/new.php?pid=${patient!.pid}&encounter=${encounter!.encounter}`);
      await expect(page.locator("body")).not.toContainText("Selected Fee Sheet Codes and Charges");
      await expect(page.locator("body")).not.toContainText(officeVisit!.codeText);

      await loginToLegacyOpenEmr(page, target);
      await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
      await openFeeSheetDirect(page, target, patient!.pid, encounter!.encounter);
      await expectRenderedText(page, "Selected Fee Sheet Codes and Charges");
      await expectRenderedText(page, officeVisit!.code);
      await expectRenderedText(page, officeVisit!.codeText);
      await expectRenderedText(page, venipuncture!.code);
      await expectRenderedText(page, venipuncture!.codeText);
      return;
    }

    const unauthenticatedBilling = await page.request.get(
      `${target.apiBaseUrl}/api/billing/${encodeURIComponent(patient!.pubpid)}`
    );
    expect(unauthenticatedBilling.status()).toBe(401);
    await expectUnauthenticatedResponse(unauthenticatedBilling);

    const unauthenticatedBatch = await page.request.get(`${target.apiBaseUrl}/api/billing/statements/batch?limit=5`);
    expect(unauthenticatedBatch.status()).toBe(401);
    await expectUnauthenticatedResponse(unauthenticatedBatch);

    const unauthenticatedCreate = await page.request.post(`${target.apiBaseUrl}/api/billing/lines`, {
      data: {
        patientId: patient!.pubpid,
        encounter: encounter!.encounter,
        billingDate: "2026-06-18",
        codeType: "CPT4",
        code: "99213",
        codeText: "Blocked Protection Billing Line",
        fee: 125,
        units: 1,
        justify: "Z00.00"
      }
    });
    expect(unauthenticatedCreate.status()).toBe(401);
    await expectUnauthenticatedResponse(unauthenticatedCreate);

    const headers = await getModernizedAdminSessionHeaders(page, target);
    const authenticatedBilling = await page.request.get(
      `${target.apiBaseUrl}/api/billing/${encodeURIComponent(patient!.pubpid)}`,
      { headers }
    );
    expect(authenticatedBilling.ok()).toBeTruthy();
    const authenticatedPayload = await authenticatedBilling.json() as {
      patientId: string;
      patientDisplayName: string;
      encounters: Array<{ encounter: number; lines: Array<{ code: string; codeText: string }> }>;
    };
    const authenticatedEncounter = authenticatedPayload.encounters.find((item) => item.encounter === encounter!.encounter);
    expect(authenticatedPayload.patientId).toBe(patient!.pubpid);
    expect(authenticatedEncounter?.lines.some((line) => line.code === officeVisit!.code && line.codeText === officeVisit!.codeText)).toBe(true);

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Fees" }).click();
    await expect(page.getByRole("heading", { name: "Fees", exact: true })).toBeVisible();
    await expect(page.locator('form[aria-label="Billing access"]')).toBeVisible();
    await expect(page.locator("body")).toContainText("Sign in to load fee sheet data");
    await expect(page.getByLabel("Fees patient ID")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save CPT" })).toBeDisabled();
    await expect(page.locator("body")).not.toContainText(officeVisit!.codeText);

    await openAuthenticatedModernizedFees(page, target, patient!.pubpid);
    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText("Selected Fee Sheet Codes and Charges");
    await expect(page.locator("body")).toContainText(officeVisit!.code);
    await expect(page.locator("body")).toContainText(officeVisit!.codeText);
    await expect(page.locator("body")).toContainText(venipuncture!.code);
    await expect(page.locator("body")).toContainText(venipuncture!.codeText);
  });
});

async function expectUnauthenticatedResponse(response: { json: () => Promise<unknown> }) {
  const payload = await response.json() as { authenticated?: boolean; sessionSource?: string };
  expect(payload).toMatchObject({
    authenticated: false,
    sessionSource: "modernized-openemr"
  });
}
