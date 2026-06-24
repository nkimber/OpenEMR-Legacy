import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalClinicalAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal clinical summary parity @slice222 @workflow-patient-portal-clinical-summary @patients @portal @clinical-lists", () => {
  test("lists clinical summary facts for the signed-in portal patient", async ({
    targetDb,
    workflow
  }) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalClinicalAnchorPatientId);
    expect(patient).not.toBeNull();

    const summary = await workflow.getPatientPortalClinicalSummary(portalLoginUsername, portalPassword);
    expect(summary).toMatchObject({
      authenticated: true,
      username: portalLoginUsername,
      portalUsername: portalLoginUsername,
      pid: patient!.pid,
      pubpid: patient!.pubpid,
      displayName: "Kim, Nora",
      problemCount: 2,
      allergyCount: 1,
      medicationCount: 3,
      prescriptionCount: 3,
      failureReason: null
    });

    expect(summary.problems.map((problem) => problem.title)).toEqual([
      "Low back pain, unspecified",
      "Anxiety disorder, unspecified"
    ]);
    expect(summary.allergies).toEqual([
      expect.objectContaining({
        title: "Latex",
        reaction: "skin irritation",
        severity: "low"
      })
    ]);
    expect(summary.medications.map((medication) => medication.title)).toEqual([
      "Omeprazole 20 mg",
      "Sumatriptan 50 mg",
      "Sertraline 50 mg"
    ]);
    expect(summary.prescriptions.map((prescription) => prescription.drug)).toEqual([
      "Omeprazole",
      "Sumatriptan",
      "Sertraline"
    ]);
    expect(summary.prescriptions).toEqual([
      expect.objectContaining({ drug: "Omeprazole", dosage: "20 mg", quantity: "30", route: "Oral" }),
      expect.objectContaining({ drug: "Sumatriptan", dosage: "50 mg", quantity: "30", route: "Oral" }),
      expect.objectContaining({ drug: "Sertraline", dosage: "50 mg", quantity: "30", route: "Oral" })
    ]);
  });

  test("renders clinical summary facts on the portal surface", async ({
    page,
    target
  }) => {
    test.setTimeout(120_000);

    if (target.type === "legacy-openemr") {
      await expectLegacyPatientPortalClinicalSummary(page, target);
      return;
    }

    await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
    const clinicalRegion = page.getByRole("region", { name: "Patient portal clinical summary" });
    await expect(clinicalRegion).toContainText("Clinical Summary");
    await expect(clinicalRegion).toContainText("2 problems");
    await expect(clinicalRegion).toContainText("1 allergy");
    await expect(clinicalRegion).toContainText("3 medications");
    await expect(clinicalRegion).toContainText("3 prescriptions");
    await expect(clinicalRegion).toContainText("Low back pain, unspecified");
    await expect(clinicalRegion).toContainText("Latex");
    await expect(clinicalRegion).toContainText("Sertraline 50 mg");
    await expect(clinicalRegion).toContainText("Sertraline");
  });
});

async function expectLegacyPatientPortalClinicalSummary(page: Page, target: RuntimeTarget) {
  await page.context().clearCookies();
  await page.goto(`${target.publicUrl}/portal/index.php?site=default&woops=1`);
  await page.locator("#uname").fill(portalLoginUsername);
  await page.locator("#pass").fill(portalPassword);

  const emailConfirmation = page.locator("#passaddon");
  if ((await emailConfirmation.count()) > 0 && await emailConfirmation.isVisible()) {
    await emailConfirmation.fill(portalLoginUsername);
  }

  await page.getByRole("button", { name: "Log In" }).click();
  await expect.poll(() => page.url()).toContain("/portal/home.php");

  await page.goto(`${target.publicUrl}/portal/get_problems.php`);
  await expectRenderedText(page, /Title|Problem/i);
  await expect(page.locator("body")).toContainText("Low back pain, unspecified");
  await expect(page.locator("body")).toContainText("Anxiety disorder, unspecified");

  await page.goto(`${target.publicUrl}/portal/get_allergies.php`);
  await expectRenderedText(page, /Title|Allergy/i);
  await expect(page.locator("body")).toContainText("Latex");

  await page.goto(`${target.publicUrl}/portal/get_medications.php`);
  await expectRenderedText(page, /Drug|Medication/i);
  await expect(page.locator("body")).toContainText("Omeprazole 20 mg");
  await expect(page.locator("body")).toContainText("Sertraline 50 mg");

  await page.goto(`${target.publicUrl}/portal/get_prescriptions.php`);
  await expectRenderedText(page, /Drug|Prescription/i);
  await expect(page.locator("body")).toContainText("Omeprazole");
  await expect(page.locator("body")).toContainText("Sertraline");
}
