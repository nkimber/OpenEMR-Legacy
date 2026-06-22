import { test, expect } from "../../src/fixtures/parityTest.js";
import { requestText } from "../../src/http/httpClient.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openEncounterDirect,
  openFeeSheetDirect
} from "../../src/ui/legacyOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";

type ModernizedLoginResponse = {
  authenticated: boolean;
  username: string;
  displayName: string;
  role: string;
  staffId?: number | null;
  sessionId?: string | null;
};

type ModernizedAuthorizationFailure = {
  authenticated: boolean;
  authorized: boolean;
  sessionId?: string | null;
  username: string;
  role: string;
  requiredSection: string;
  requiredPermission: string;
  requiredReturnValue: string;
  failureReason?: string | null;
  sessionSource: string;
};

type PatientBillingResponse = {
  patientId: string;
  legacyPid: number;
  patientDisplayName: string;
  encounters: Array<{
    encounter: number;
    lines: Array<{ id: string; code: string; codeText: string; fee?: number | null }>;
  }>;
};

const billingAuthorizationPatientId = "MOD-PAT-0001";

test.describe("billing authorization policy parity @workflow-billing-authorization-policy @slice181 @billing @security", () => {
  test("enforces Billing access for fee sheet and revenue-cycle APIs and UI", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(billingAuthorizationPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    const billingLines = await targetDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
    const officeVisit = billingLines.find((line) => line.code === "99214");
    const venipuncture = billingLines.find((line) => line.code === "36415");
    expect(officeVisit).toBeTruthy();
    expect(venipuncture).toBeTruthy();

    const accessControl = await targetDb.getAdministrationAccessControl();
    expect(accessControl.groupPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "admin",
          sectionValue: "acct",
          permissionValue: "bill",
          returnValue: "write"
        }),
        expect.objectContaining({
          groupValue: "back",
          sectionValue: "acct",
          permissionValue: "bill",
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
    expect(accessControl.groupPermissions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "front",
          sectionValue: "acct",
          permissionValue: "bill"
        })
      ])
    );

    if (target.type === "legacy-openemr") {
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

    const frontDeskLogin = await modernizedLogin(target, "gold-frontdesk-01", "pass");
    expect(frontDeskLogin).toMatchObject({
      authenticated: true,
      username: "gold-frontdesk-01",
      displayName: "Parker Fleming",
      role: "frontdesk",
      staffId: 117
    });
    expect(frontDeskLogin.sessionId).toMatch(/^[0-9a-f-]{36}$/i);

    const frontDeskBilling = await requestText(
      `${target.apiBaseUrl}/api/billing/${encodeURIComponent(patient!.pubpid)}`,
      {
        headers: {
          "X-OpenEMR-Session": frontDeskLogin.sessionId!
        }
      }
    );
    expect(frontDeskBilling.statusCode).toBe(403);
    const frontDeskFailure = JSON.parse(frontDeskBilling.body) as ModernizedAuthorizationFailure;
    expect(frontDeskFailure).toMatchObject({
      authenticated: true,
      authorized: false,
      username: "gold-frontdesk-01",
      role: "frontdesk",
      requiredSection: "acct",
      requiredPermission: "bill",
      requiredReturnValue: "view",
      sessionSource: "modernized-openemr"
    });
    expect(frontDeskFailure.failureReason).toMatch(/not authorized/i);

    const frontDeskBatch = await requestText(`${target.apiBaseUrl}/api/billing/statements/batch?limit=5`, {
      headers: {
        "X-OpenEMR-Session": frontDeskLogin.sessionId!
      }
    });
    expect(frontDeskBatch.statusCode).toBe(403);

    const frontDeskMutationBody = JSON.stringify({
      patientId: patient!.pubpid,
      encounter: encounter!.encounter,
      billingDate: "2026-06-18",
      codeType: "CPT4",
      code: "99213",
      codeText: "Blocked Billing Authorization Line",
      fee: 125,
      units: 1,
      justify: "Z00.00"
    });
    const frontDeskMutation = await requestText(`${target.apiBaseUrl}/api/billing/lines`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(frontDeskMutationBody)),
        "X-OpenEMR-Session": frontDeskLogin.sessionId!
      },
      body: frontDeskMutationBody
    });
    expect(frontDeskMutation.statusCode).toBe(403);

    const adminLogin = await modernizedLogin(target, target.credentials.username, target.credentials.password);
    expect(adminLogin).toMatchObject({
      authenticated: true,
      username: "admin",
      role: "administrator"
    });

    const adminBilling = await requestText(`${target.apiBaseUrl}/api/billing/${encodeURIComponent(patient!.pubpid)}`, {
      headers: {
        "X-OpenEMR-Session": adminLogin.sessionId!
      }
    });
    expect(adminBilling.statusCode).toBe(200);
    const adminBillingBody = JSON.parse(adminBilling.body) as PatientBillingResponse;
    const adminEncounter = adminBillingBody.encounters.find((item) => item.encounter === encounter!.encounter);
    expect(adminBillingBody).toMatchObject({
      patientId: patient!.pubpid,
      legacyPid: patient!.pid,
      patientDisplayName: `${patient!.lname}, ${patient!.fname}`
    });
    expect(adminEncounter?.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: officeVisit!.code,
          codeText: officeVisit!.codeText
        }),
        expect.objectContaining({
          code: venipuncture!.code,
          codeText: venipuncture!.codeText
        })
      ])
    );

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Fees" }).click();
    await expect(page.getByRole("heading", { name: "Fees", exact: true })).toBeVisible();

    const accessPanel = page.locator('form[aria-label="Billing access"]');
    await accessPanel.getByLabel("Username").fill("gold-frontdesk-01");
    await accessPanel.getByLabel("Password").fill("pass");
    await accessPanel.getByRole("button", { name: "Verify Billing Access" }).click();

    await expect(page.locator("body")).toContainText("Signed in as Parker Fleming");
    await expect(page.locator("body")).toContainText("Patient billing load requires Billing access");
    await expect(page.locator("body")).not.toContainText("Selected Fee Sheet Codes and Charges");
    await expect(page.locator("body")).not.toContainText(officeVisit!.codeText);

    await accessPanel.getByLabel("Username").fill(target.credentials.username);
    await accessPanel.getByLabel("Password").fill(target.credentials.password);
    await accessPanel.getByRole("button", { name: "Verify Billing Access" }).click();
    await expect(page.getByLabel("Fees patient ID")).toBeEnabled();
    await page.getByLabel("Fees patient ID").fill(patient!.pubpid);

    await expect(page.getByRole("heading", { name: adminBillingBody.patientDisplayName })).toBeVisible();
    await expect(page.locator("body")).toContainText("Selected Fee Sheet Codes and Charges");
    await expect(page.locator("body")).toContainText(officeVisit!.code);
    await expect(page.locator("body")).toContainText(officeVisit!.codeText);
    await expect(page.locator("body")).toContainText(venipuncture!.code);
    await expect(page.locator("body")).toContainText(venipuncture!.codeText);
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
