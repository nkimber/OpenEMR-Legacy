import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalClinicalAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const inactiveEndDate = "2026-06-18";

const expectedMedications = [
  { title: "Omeprazole 20 mg", startDate: "2026-03-10", modifiedDate: "2026-03-10", endDate: null },
  { title: "Sumatriptan 50 mg", startDate: "2026-04-08", modifiedDate: "2026-04-08", endDate: null },
  { title: "Sertraline 50 mg", startDate: "2026-05-07", modifiedDate: "2026-05-07", endDate: null }
];

test.describe("patient portal medication date-column parity @slice246 @workflow-patient-portal-medication-date-columns @patients @portal @clinical-lists", () => {
  test("exposes medication start, last-modified, and ended-row facts in the portal clinical summary", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalClinicalAnchorPatientId);
    expect(patient).not.toBeNull();

    const endedTitle = `Portal Ended Medication ${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let medicationId: number | string | null = null;

    try {
      medicationId = await workflow.createMedication({
        patientId: patient!.pid,
        title: endedTitle,
        dateTime: "2026-07-15 09:00:00",
        diagnosis: "ICD10:Z00.00",
        comments: "Created for patient portal medication date-column parity."
      });

      await workflow.deactivateMedication(
        medicationId,
        "Ended for patient portal medication date-column parity."
      );

      const ended = await workflow.getMedication(medicationId);
      expect(ended).toMatchObject({
        activity: 0,
        title: endedTitle
      });

      const summary = await workflow.getPatientPortalClinicalSummary(portalLoginUsername, portalPassword);
      expect(summary).toMatchObject({
        authenticated: true,
        username: portalLoginUsername,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        medicationCount: 4,
        failureReason: null
      });

      expect(summary.medications.slice(0, expectedMedications.length).map((medication) => ({
        title: medication.title,
        startDate: medication.startDate,
        modifiedDate: medication.modifiedDate,
        endDate: medication.endDate
      }))).toEqual(expectedMedications);
      expect(summary.medications).toEqual(expect.arrayContaining([
        expect.objectContaining({
          title: endedTitle,
          startDate: "2026-07-15",
          endDate: inactiveEndDate
        })
      ]));

      if (target.type === "legacy-openemr") {
        await expectLegacyMedicationDateColumns(page, target, endedTitle);
      } else {
        await expectModernizedMedicationDateColumns(page, target, endedTitle);
      }
    } finally {
      if (medicationId !== null) {
        await workflow.deleteMedication(medicationId);
      }
    }
  });
});

async function expectLegacyMedicationDateColumns(page: Page, target: RuntimeTarget, endedTitle: string) {
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

  await page.goto(`${target.publicUrl}/portal/get_medications.php`);
  await expectRenderedText(page, /Drug|Medication/i);
  await expect(page.locator("body")).toContainText("Start Date");
  await expect(page.locator("body")).toContainText("Last Modified");
  await expect(page.locator("body")).toContainText("End Date");
  for (const expected of expectedMedications) {
    await expect(page.locator("body")).toContainText(expected.title);
    await expect(page.locator("body")).toContainText(expected.startDate);
    await expect(page.locator("body")).toContainText(expected.modifiedDate);
  }
  await expect(page.locator("body")).toContainText(endedTitle);
  await expect(page.locator("body")).toContainText(inactiveEndDate);
}

async function expectModernizedMedicationDateColumns(page: Page, target: RuntimeTarget, endedTitle: string) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const clinicalRegion = page.getByRole("region", { name: "Patient portal clinical summary" });
  await expect(clinicalRegion).toContainText("4 medications");
  const medicationRegion = page.getByRole("region", { name: "Patient portal medications" });

  for (const expected of expectedMedications) {
    const card = medicationRegion.locator("article.clinical-item").filter({ hasText: expected.title }).first();
    await expect(card).toContainText(expected.title);
    await expect(card).toContainText(`Start ${expected.startDate}`);
    await expect(card).toContainText(`Last Modified ${expected.modifiedDate}`);
    await expect(card).toContainText("End Date Active");
  }

  const endedCard = medicationRegion.locator("article.clinical-item").filter({ hasText: endedTitle }).first();
  await expect(endedCard).toContainText(endedTitle);
  await expect(endedCard).toContainText("Start 2026-07-15");
  await expect(endedCard).toContainText(`End Date ${inactiveEndDate}`);
}
