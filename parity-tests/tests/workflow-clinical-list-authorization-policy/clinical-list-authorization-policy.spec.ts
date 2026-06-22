import { test, expect } from "../../src/fixtures/parityTest.js";
import { requestText } from "../../src/http/httpClient.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";
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

test.describe("clinical list authorization policy parity @workflow-clinical-list-authorization-policy @slice175 @clinical-lists @security", () => {
  test("enforces Medical/History access for clinical list APIs and UI", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId("MOD-PAT-0001");
    expect(patient).not.toBeNull();

    const lists = await targetDb.getClinicalListsForPatient(patient!.pid);
    const problem = lists.problems.find((item) => item.title.includes("diabetes")) ?? lists.problems[0];
    const allergy = lists.allergies.find((item) => item.title === "Penicillin") ?? lists.allergies[0];
    const medication = lists.medications.find((item) => item.title.startsWith("Metformin")) ?? lists.medications[0];
    const prescription = lists.prescriptions.find((item) => item.drug === "Metformin") ?? lists.prescriptions[0];

    expect(problem).toBeTruthy();
    expect(allergy).toBeTruthy();
    expect(medication).toBeTruthy();
    expect(prescription).toBeTruthy();

    const accessControl = await targetDb.getAdministrationAccessControl();
    expect(accessControl.groupPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "admin",
          sectionValue: "patients",
          permissionValue: "med",
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
          permissionValue: "med"
        })
      ])
    );

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientSummaryDirect(page, target, patient!.pid);
      await expectRenderedText(page, problem.title);
      await expectRenderedText(page, allergy.title);
      await expectRenderedText(page, medication.title);
      await expectRenderedText(page, prescription.drug);
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

    const frontDeskLists = await requestText(
      `${target.apiBaseUrl}/api/clinical-lists/${encodeURIComponent(patient!.pubpid)}`,
      {
        headers: {
          "X-OpenEMR-Session": frontDeskLogin.sessionId!
        }
      }
    );
    expect(frontDeskLists.statusCode).toBe(403);
    const frontDeskFailure = JSON.parse(frontDeskLists.body) as ModernizedAuthorizationFailure;
    expect(frontDeskFailure).toMatchObject({
      authenticated: true,
      authorized: false,
      username: "gold-frontdesk-01",
      role: "frontdesk",
      requiredSection: "patients",
      requiredPermission: "med",
      requiredReturnValue: "view",
      sessionSource: "modernized-openemr"
    });
    expect(frontDeskFailure.failureReason).toMatch(/not authorized/i);

    const frontDeskMutationBody = JSON.stringify({
      patientId: patient!.pubpid,
      title: "Blocked Medical History Allergy",
      dateTime: "2026-06-18 09:00:00",
      comments: "This request should be rejected before mutation.",
      reaction: "Rash",
      severity: "mild",
      listOptionId: "parity-allergy"
    });
    const frontDeskMutation = await requestText(`${target.apiBaseUrl}/api/clinical-lists/allergies`, {
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

    const adminLists = await requestText(`${target.apiBaseUrl}/api/clinical-lists/${encodeURIComponent(patient!.pubpid)}`, {
      headers: {
        "X-OpenEMR-Session": adminLogin.sessionId!
      }
    });
    expect(adminLists.statusCode).toBe(200);
    const adminListsBody = JSON.parse(adminLists.body) as {
      patientId: string;
      legacyPid: number;
      patientDisplayName: string;
      problems: Array<{ title: string }>;
      allergies: Array<{ title: string }>;
      medications: Array<{ title: string }>;
      prescriptions: Array<{ drug: string }>;
    };
    expect(adminListsBody).toMatchObject({
      patientId: patient!.pubpid,
      legacyPid: patient!.pid,
      patientDisplayName: "Stone, Avery"
    });
    expect(adminListsBody.problems).toEqual(expect.arrayContaining([expect.objectContaining({ title: problem.title })]));
    expect(adminListsBody.allergies).toEqual(expect.arrayContaining([expect.objectContaining({ title: allergy.title })]));
    expect(adminListsBody.medications).toEqual(expect.arrayContaining([expect.objectContaining({ title: medication.title })]));
    expect(adminListsBody.prescriptions).toEqual(expect.arrayContaining([expect.objectContaining({ drug: prescription.drug })]));

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Lists" }).click();
    await expect(page.getByRole("heading", { name: "Lists", exact: true })).toBeVisible();

    const accessPanel = page.locator('form[aria-label="Lists access"]');
    await accessPanel.getByLabel("Username").fill("gold-frontdesk-01");
    await accessPanel.getByLabel("Password").fill("pass");
    await accessPanel.getByRole("button", { name: "Verify Lists Access" }).click();

    await expect(page.locator("body")).toContainText("Signed in as Parker Fleming");
    await expect(page.locator("body")).toContainText("Clinical lists load requires Medical/History access");
    await expect(page.locator("body")).not.toContainText("Stone, Avery");
    await expect(page.locator("body")).not.toContainText(allergy.title);

    await accessPanel.getByLabel("Username").fill(target.credentials.username);
    await accessPanel.getByLabel("Password").fill(target.credentials.password);
    await accessPanel.getByRole("button", { name: "Verify Lists Access" }).click();
    await page.getByLabel("Clinical lists patient ID").fill(patient!.pubpid);

    await expect(page.getByRole("heading", { name: "Stone, Avery" })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(problem.title);
    await expect(page.locator("body")).toContainText(allergy.title);
    await expect(page.locator("body")).toContainText(medication.title);
    await expect(page.locator("body")).toContainText(prescription.drug);
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
