import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalClinicalAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

const expectedPrescriptions = [
  { drug: "Omeprazole", modifiedDate: "2026-03-10" },
  { drug: "Sumatriptan", modifiedDate: "2026-04-08" },
  { drug: "Sertraline", modifiedDate: "2026-05-07" }
];

test.describe("patient portal prescription modified-date parity @slice243 @workflow-patient-portal-prescription-modified-date @patients @portal @clinical-lists", () => {
  test("exposes active prescription modified dates in the portal clinical summary", async ({
    page,
    target,
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
      prescriptionCount: 3,
      failureReason: null
    });

    expect(summary.prescriptions.map((prescription) => ({
      drug: prescription.drug,
      modifiedDate: prescription.modifiedDate
    }))).toEqual(expectedPrescriptions);

    if (target.type === "legacy-openemr") {
      await expectLegacyPrescriptionModifiedDates(page, target);
    } else {
      await expectModernizedPrescriptionModifiedDates(page, target);
    }
  });
});

async function expectLegacyPrescriptionModifiedDates(page: Page, target: RuntimeTarget) {
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

  await page.goto(`${target.publicUrl}/portal/get_prescriptions.php`);
  await expectRenderedText(page, /Drug|Prescription/i);
  await expect(page.locator("body")).toContainText("Last Modified");
  for (const expected of expectedPrescriptions) {
    await expect(page.locator("body")).toContainText(expected.drug);
    await expect(page.locator("body")).toContainText(expected.modifiedDate);
  }
}

async function expectModernizedPrescriptionModifiedDates(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const clinicalRegion = page.getByRole("region", { name: "Patient portal clinical summary" });
  await expect(clinicalRegion).toContainText("3 prescriptions");
  const prescriptionRegion = page.getByRole("region", { name: "Patient portal prescriptions" });

  for (const expected of expectedPrescriptions) {
    const card = prescriptionRegion.locator("article.clinical-item").filter({ hasText: expected.drug }).first();
    await expect(card).toContainText(expected.drug);
    await expect(card).toContainText(`Modified ${expected.modifiedDate}`);
  }
}
