import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";

test.describe("clinical list protection parity @slice166 @clinical-list-protection", () => {
  test("requires an active session before clinical lists are visible", async ({ page, target, targetDb }) => {
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

    if (target.type === "legacy-openemr") {
      await page.goto(`${target.publicUrl}/interface/patient_file/summary/demographics.php?set_pid=${patient!.pid}`);
      await expect(page.locator("body")).not.toContainText(problem.title);
      await expect(page.locator("body")).not.toContainText(allergy.title);
      await expect(page.locator("body")).not.toContainText(medication.title);
      await expect(page.locator("body")).not.toContainText(prescription.drug);

      await loginToLegacyOpenEmr(page, target);
      await openPatientSummaryDirect(page, target, patient!.pid);
      await expectRenderedText(page, problem.title);
      await expectRenderedText(page, allergy.title);
      await expectRenderedText(page, medication.title);
      await expectRenderedText(page, prescription.drug);
      return;
    }

    const unauthenticatedLists = await page.request.get(
      `${target.apiBaseUrl}/api/clinical-lists/${encodeURIComponent(patient!.pubpid)}`
    );
    expect(unauthenticatedLists.status()).toBe(401);
    const unauthenticatedListsBody = await unauthenticatedLists.json();
    expect(unauthenticatedListsBody).toMatchObject({
      authenticated: false,
      sessionSource: "modernized-openemr"
    });

    const unauthenticatedMutation = await page.request.post(`${target.apiBaseUrl}/api/clinical-lists/allergies`, {
      data: {
        patientId: patient!.pubpid,
        title: "Blocked Protection Allergy",
        dateTime: "2026-06-18 09:00:00",
        comments: "This request should be rejected before mutation.",
        reaction: "Rash",
        severity: "mild",
        listOptionId: "parity-allergy"
      }
    });
    expect(unauthenticatedMutation.status()).toBe(401);

    const loginResponse = await page.request.post(`${target.apiBaseUrl}/api/auth/login`, {
      data: target.credentials
    });
    expect(loginResponse.ok()).toBeTruthy();
    const login = await loginResponse.json();
    expect(login.authenticated).toBe(true);
    expect(login.sessionId).toBeTruthy();

    const authenticatedLists = await page.request.get(
      `${target.apiBaseUrl}/api/clinical-lists/${encodeURIComponent(patient!.pubpid)}`,
      { headers: { "X-OpenEMR-Session": login.sessionId } }
    );
    expect(authenticatedLists.ok()).toBeTruthy();
    const authenticatedBody = await authenticatedLists.json();
    expect(authenticatedBody).toMatchObject({
      patientId: patient!.pubpid,
      legacyPid: patient!.pid,
      patientDisplayName: "Stone, Avery"
    });
    expect(authenticatedBody.problems.some((item: { title: string }) => item.title === problem.title)).toBe(true);
    expect(authenticatedBody.allergies.some((item: { title: string }) => item.title === allergy.title)).toBe(true);

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Lists" }).click();
    await expect(page.getByRole("heading", { name: "Lists", exact: true })).toBeVisible();
    await expect(page.locator("body")).toContainText("Sign in to load clinical lists");
    await expect(page.locator("body")).not.toContainText("Stone, Avery");
    await expect(page.locator("body")).not.toContainText(allergy.title);

    const accessPanel = page.locator('form[aria-label="Lists access"]');
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
