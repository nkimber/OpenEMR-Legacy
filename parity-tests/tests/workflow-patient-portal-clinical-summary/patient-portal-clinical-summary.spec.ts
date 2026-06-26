import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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
    target,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalClinicalAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-222-patient-portal-clinical-summary-precondition",
      description: "Captures the Slice 222 portal clinical-summary precondition: the signed-in anchor patient exists before projecting clinical-list and prescription facts.",
      expected: {
        canonicalId: portalClinicalAnchorPatientId,
        portalUsername: portalLoginUsername
      },
      actual: {
        canonicalId: portalClinicalAnchorPatientId,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        portalUsername: portalLoginUsername
      },
      context: {
        suite: "workflow-patient-portal-clinical-summary",
        workflow: "patient-portal-clinical-summary-precondition"
      }
    });

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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-222-patient-portal-clinical-summary-result",
      description: "Captures the Slice 222 portal clinical-summary projection, including patient-visible problems, allergies, medication-list rows, and active prescriptions.",
      expected: {
        displayName: "Kim, Nora",
        problemTitles: ["Low back pain, unspecified", "Anxiety disorder, unspecified"],
        allergyTitles: ["Latex"],
        medicationTitles: ["Omeprazole 20 mg", "Sumatriptan 50 mg", "Sertraline 50 mg"],
        prescriptionDrugs: ["Omeprazole", "Sumatriptan", "Sertraline"]
      },
      actual: {
        authenticated: summary.authenticated,
        username: summary.username,
        portalUsername: summary.portalUsername,
        pid: summary.pid,
        pubpid: summary.pubpid,
        displayName: summary.displayName,
        problemCount: summary.problemCount,
        allergyCount: summary.allergyCount,
        medicationCount: summary.medicationCount,
        prescriptionCount: summary.prescriptionCount,
        problems: summary.problems,
        allergies: summary.allergies,
        medications: summary.medications,
        prescriptions: summary.prescriptions
      },
      context: {
        suite: "workflow-patient-portal-clinical-summary",
        workflow: "patient-portal-clinical-summary-result"
      }
    });
  });

  test("renders clinical summary facts on the portal surface", async ({
    page,
    target
  }, testInfo) => {
    test.setTimeout(120_000);

    if (target.type === "legacy-openemr") {
      const legacySurface = await expectLegacyPatientPortalClinicalSummary(page, target);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-222-patient-portal-clinical-summary-legacy-surface",
        description: "Captures the legacy OpenEMR portal clinical-summary surface across problems, allergies, medications, and prescriptions pages.",
        expected: {
          pages: ["get_problems.php", "get_allergies.php", "get_medications.php", "get_prescriptions.php"],
          problemTitles: ["Low back pain, unspecified", "Anxiety disorder, unspecified"],
          allergyTitles: ["Latex"],
          medicationTitles: ["Omeprazole 20 mg", "Sumatriptan 50 mg", "Sertraline 50 mg"],
          prescriptionDrugs: ["Omeprazole", "Sumatriptan", "Sertraline"]
        },
        actual: legacySurface,
        context: {
          suite: "workflow-patient-portal-clinical-summary",
          workflow: "patient-portal-clinical-summary-legacy-surface"
        }
      });
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-222-patient-portal-clinical-summary-modernized-surface",
      description: "Captures the modernized Portal clinical-summary surface rendered for the signed-in patient.",
      expected: {
        heading: "Clinical Summary",
        counts: ["2 problems", "1 allergy", "3 medications", "3 prescriptions"],
        visibleFacts: ["Low back pain, unspecified", "Latex", "Sertraline 50 mg", "Sertraline"]
      },
      actual: {
        url: page.url(),
        regionText: await clinicalRegion.innerText()
      },
      context: {
        suite: "workflow-patient-portal-clinical-summary",
        workflow: "patient-portal-clinical-summary-modernized-surface"
      }
    });
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
  const problemsText = await page.locator("body").innerText();

  await page.goto(`${target.publicUrl}/portal/get_allergies.php`);
  await expectRenderedText(page, /Title|Allergy/i);
  await expect(page.locator("body")).toContainText("Latex");
  const allergiesText = await page.locator("body").innerText();

  await page.goto(`${target.publicUrl}/portal/get_medications.php`);
  await expectRenderedText(page, /Drug|Medication/i);
  await expect(page.locator("body")).toContainText("Omeprazole 20 mg");
  await expect(page.locator("body")).toContainText("Sertraline 50 mg");
  const medicationsText = await page.locator("body").innerText();

  await page.goto(`${target.publicUrl}/portal/get_prescriptions.php`);
  await expectRenderedText(page, /Drug|Prescription/i);
  await expect(page.locator("body")).toContainText("Omeprazole");
  await expect(page.locator("body")).toContainText("Sertraline");
  const prescriptionsText = await page.locator("body").innerText();

  return {
    problemsUrl: `${target.publicUrl}/portal/get_problems.php`,
    allergiesUrl: `${target.publicUrl}/portal/get_allergies.php`,
    medicationsUrl: `${target.publicUrl}/portal/get_medications.php`,
    prescriptionsUrl: `${target.publicUrl}/portal/get_prescriptions.php`,
    problemsText,
    allergiesText,
    medicationsText,
    prescriptionsText
  };
}
