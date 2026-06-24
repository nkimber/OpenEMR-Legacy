import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalClinicalAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const inactiveEndDate = "2026-08-15";

const expectedActivePrescriptions = [
  { drug: "Omeprazole", endDate: null },
  { drug: "Sumatriptan", endDate: null },
  { drug: "Sertraline", endDate: null }
];

test.describe("patient portal prescription end-date parity @slice245 @workflow-patient-portal-prescription-end-date @patients @portal @clinical-lists", () => {
  test("excludes ended prescriptions from the portal active prescription list", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalClinicalAnchorPatientId);
    expect(patient).not.toBeNull();

    const endedDrug = `Portal Ended Prescription ${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let prescriptionId: number | string | null = null;

    try {
      prescriptionId = await workflow.createPrescription({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        startDate: "2026-07-15",
        drug: endedDrug,
        rxNormCode: "1049502",
        dosage: "1 tablet daily",
        quantity: "30",
        refills: 0,
        note: "Created for patient portal ended-prescription parity.",
        diagnosis: "Z00.00"
      });

      await workflow.deactivatePrescription(
        prescriptionId,
        inactiveEndDate,
        "Ended for patient portal active-prescription parity."
      );

      const ended = await workflow.getPrescription(prescriptionId);
      expect(ended).toMatchObject({
        active: 0,
        endDate: inactiveEndDate,
        drug: endedDrug
      });

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
        endDate: prescription.endDate
      }))).toEqual(expectedActivePrescriptions);
      expect(summary.prescriptions.some((prescription) => prescription.drug === endedDrug)).toBe(false);

      if (target.type === "legacy-openemr") {
        await expectLegacyActivePrescriptionEndDates(page, target, endedDrug);
      } else {
        await expectModernizedActivePrescriptionEndDates(page, target, endedDrug);
      }
    } finally {
      if (prescriptionId !== null) {
        await workflow.deletePrescription(prescriptionId);
      }
    }
  });
});

async function expectLegacyActivePrescriptionEndDates(page: Page, target: RuntimeTarget, endedDrug: string) {
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
  await expect(page.locator("body")).toContainText("End Date");
  for (const expected of expectedActivePrescriptions) {
    await expect(page.locator("body")).toContainText(expected.drug);
  }
  await expect(page.locator("body")).not.toContainText(endedDrug);
}

async function expectModernizedActivePrescriptionEndDates(page: Page, target: RuntimeTarget, endedDrug: string) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const clinicalRegion = page.getByRole("region", { name: "Patient portal clinical summary" });
  await expect(clinicalRegion).toContainText("3 prescriptions");
  const prescriptionRegion = page.getByRole("region", { name: "Patient portal prescriptions" });

  for (const expected of expectedActivePrescriptions) {
    const card = prescriptionRegion.locator("article.clinical-item").filter({ hasText: expected.drug }).first();
    await expect(card).toContainText(expected.drug);
    await expect(card).toContainText("End Date Active");
  }
  await expect(prescriptionRegion).not.toContainText(endedDrug);
}
