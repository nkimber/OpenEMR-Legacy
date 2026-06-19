import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";

const clinicalListsAnchorPatientId = "MOD-PAT-0001";

test.describe("clinical lists and medications parity @slice4 @clinical-lists", () => {
  test("stable clinical-list anchor has problems, allergies, medications, and prescriptions", async ({ targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(clinicalListsAnchorPatientId);
    expect(patient).not.toBeNull();

    const lists = await targetDb.getClinicalListsForPatient(patient!.pid);
    expect(lists.patientId).toBe(patient!.pid);
    expect(lists.problems.some((item) => item.title.includes("diabetes"))).toBe(true);
    expect(lists.allergies.some((item) => item.title === "Penicillin" && item.reaction === "rash")).toBe(true);
    expect(lists.medications.some((item) => item.title.startsWith("Metformin"))).toBe(true);
    expect(lists.prescriptions.some((item) => item.drug === "Metformin" && item.route === "Oral")).toBe(true);
  });

  test("clinical lists are visible in the application UI", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(clinicalListsAnchorPatientId);
    expect(patient).not.toBeNull();
    const lists = await targetDb.getClinicalListsForPatient(patient!.pid);
    expect(lists.problems.length).toBeGreaterThan(0);
    expect(lists.allergies.length).toBeGreaterThan(0);
    expect(lists.medications.length).toBeGreaterThan(0);
    expect(lists.prescriptions.length).toBeGreaterThan(0);

    const problem = lists.problems.find((item) => item.title.includes("diabetes")) ?? lists.problems[0];
    const allergy = lists.allergies.find((item) => item.title === "Penicillin") ?? lists.allergies[0];
    const medication = lists.medications.find((item) => item.title.startsWith("Metformin")) ?? lists.medications[0];
    const prescription = lists.prescriptions.find((item) => item.drug === "Metformin") ?? lists.prescriptions[0];

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientSummaryDirect(page, target, patient!.pid);

      await expectRenderedText(page, problem.title);
      await expectRenderedText(page, allergy.title);
      await expectRenderedText(page, medication.title);
      await expectRenderedText(page, prescription.drug);
      return;
    }

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Lists" }).click();
    await expect(page.getByRole("heading", { name: "Lists" })).toBeVisible();

    await page.getByLabel("Clinical lists patient ID").fill(patient!.pubpid);

    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(problem.title);
    await expect(page.locator("body")).toContainText(allergy.title);
    await expect(page.locator("body")).toContainText(medication.title);
    await expect(page.locator("body")).toContainText(prescription.drug);
    await expect(page.locator("body")).toContainText("Prescriptions");
  });
});
