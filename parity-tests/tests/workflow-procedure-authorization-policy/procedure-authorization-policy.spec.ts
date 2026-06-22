import { test, expect } from "../../src/fixtures/parityTest.js";
import { requestText } from "../../src/http/httpClient.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureResultsDirect
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

type ProcedureResultsResponse = {
  patientId: string;
  legacyPid: number;
  patientDisplayName: string;
  orders: Array<{
    id: number;
    encounter?: number | null;
    code?: string | null;
    name?: string | null;
    orderStatus?: string | null;
    reports: Array<{
      id: number;
      status?: string | null;
      results: Array<{
        text?: string | null;
        result?: string | null;
        resultStatus?: string | null;
      }>;
    }>;
  }>;
};

const procedureAuthorizationPatientId = "MOD-PAT-0009";

test.describe("procedure authorization policy parity @workflow-procedure-authorization-policy @slice182 @procedures @security", () => {
  test("enforces Lab Results access for procedure APIs and UI", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureAuthorizationPatientId);
    expect(patient).not.toBeNull();

    const procedures = await targetDb.getProcedureResultsForPatient(patient!.pid);
    const order = procedures.orders.find((item) => item.procedureName === "Complete blood count") ?? procedures.orders[0];
    expect(order).toBeDefined();
    expect(order!.encounterId).toBeTruthy();
    const report = order!.reports.find((item) => item.status === "complete") ?? order!.reports[0];
    expect(report).toBeDefined();
    const hemoglobin = report!.results.find((item) => item.text === "Hemoglobin") ?? report!.results[0];
    expect(hemoglobin).toBeDefined();

    const accessControl = await targetDb.getAdministrationAccessControl();
    expect(accessControl.groupPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "admin",
          sectionValue: "patients",
          permissionValue: "lab",
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
          sectionValue: "patients",
          permissionValue: "lab"
        })
      ])
    );

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openProcedureResultsDirect(page, target, patient!.pid);
      await expectRenderedText(page, "Order Report Results");
      await expectRenderedText(page, order!.procedureName);
      await expectRenderedText(page, hemoglobin!.text);
      await expectRenderedText(page, /Final|Reviewed|complete/i);
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

    const frontDeskLogin = await modernizedLogin(target, "gold-frontdesk-01", "pass");
    expect(frontDeskLogin).toMatchObject({
      authenticated: true,
      username: "gold-frontdesk-01",
      displayName: "Parker Fleming",
      role: "frontdesk",
      staffId: 117
    });
    expect(frontDeskLogin.sessionId).toMatch(/^[0-9a-f-]{36}$/i);

    const frontDeskProcedureResults = await requestText(
      `${target.apiBaseUrl}/api/procedures/${encodeURIComponent(patient!.pubpid)}`,
      {
        headers: {
          "X-OpenEMR-Session": frontDeskLogin.sessionId!
        }
      }
    );
    expect(frontDeskProcedureResults.statusCode).toBe(403);
    const frontDeskFailure = JSON.parse(frontDeskProcedureResults.body) as ModernizedAuthorizationFailure;
    expect(frontDeskFailure).toMatchObject({
      authenticated: true,
      authorized: false,
      username: "gold-frontdesk-01",
      role: "frontdesk",
      requiredSection: "patients",
      requiredPermission: "lab",
      requiredReturnValue: "view",
      sessionSource: "modernized-openemr"
    });
    expect(frontDeskFailure.failureReason).toMatch(/not authorized/i);

    const frontDeskCatalog = await requestText(`${target.apiBaseUrl}/api/procedures/order-catalog`, {
      headers: {
        "X-OpenEMR-Session": frontDeskLogin.sessionId!
      }
    });
    expect(frontDeskCatalog.statusCode).toBe(403);

    const frontDeskMutationBody = JSON.stringify({
      patientId: patient!.pubpid,
      providerId: 101,
      labId: 501,
      encounterId: order!.encounterId,
      dateOrdered: "2026-06-18",
      priority: "routine",
      status: "pending",
      procedureCode: "85025",
      procedureName: "Blocked Procedure Authorization Order",
      procedureType: "laboratory",
      diagnosis: "Z00.00",
      instructions: "This request should be rejected before mutation."
    });
    const frontDeskMutation = await requestText(`${target.apiBaseUrl}/api/procedures/orders`, {
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

    const adminProcedureResults = await requestText(
      `${target.apiBaseUrl}/api/procedures/${encodeURIComponent(patient!.pubpid)}`,
      {
        headers: {
          "X-OpenEMR-Session": adminLogin.sessionId!
        }
      }
    );
    expect(adminProcedureResults.statusCode).toBe(200);
    const adminProceduresBody = JSON.parse(adminProcedureResults.body) as ProcedureResultsResponse;
    const adminOrder = adminProceduresBody.orders.find((item) => item.name === order!.procedureName);
    const adminReport = adminOrder?.reports.find((item) => item.status === report!.status) ?? adminOrder?.reports[0];
    const adminHemoglobin = adminReport?.results.find((item) => item.text === hemoglobin!.text);
    expect(adminProceduresBody).toMatchObject({
      patientId: patient!.pubpid,
      legacyPid: patient!.pid,
      patientDisplayName: `${patient!.lname}, ${patient!.fname}`
    });
    expect(adminOrder).toMatchObject({
      code: order!.procedureCode,
      name: order!.procedureName,
      orderStatus: order!.orderStatus
    });
    expect(adminHemoglobin).toMatchObject({
      text: hemoglobin!.text,
      result: hemoglobin!.result,
      resultStatus: hemoglobin!.resultStatus
    });

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Procedures" }).click();
    await expect(page.getByRole("heading", { name: "Procedures", exact: true })).toBeVisible();

    const accessPanel = page.locator('form[aria-label="Procedures access"]');
    await accessPanel.getByLabel("Username").fill("gold-frontdesk-01");
    await accessPanel.getByLabel("Password").fill("pass");
    await accessPanel.getByRole("button", { name: "Verify Procedures Access" }).click();

    await expect(page.locator("body")).toContainText("Signed in as Parker Fleming");
    await expect(page.locator("body")).toContainText("Procedure results load requires Procedure access");
    await expect(page.locator("body")).not.toContainText(order!.procedureName);

    await accessPanel.getByLabel("Username").fill(target.credentials.username);
    await accessPanel.getByLabel("Password").fill(target.credentials.password);
    await accessPanel.getByRole("button", { name: "Verify Procedures Access" }).click();
    await expect(page.getByLabel("Procedure patient ID")).toBeEnabled();
    await page.getByLabel("Procedure patient ID").fill(patient!.pubpid);

    await expect(page.getByRole("heading", { name: `${patient!.lname}, ${patient!.fname}` })).toBeVisible();
    await expect(page.locator("body")).toContainText("Order Report Results");
    await expect(page.locator("body")).toContainText(order!.procedureName);
    await expect(page.locator("body")).toContainText(order!.procedureCode);
    await expect(page.locator("body")).toContainText(hemoglobin!.text);
    await expect(page.locator("body")).toContainText(hemoglobin!.result);
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
