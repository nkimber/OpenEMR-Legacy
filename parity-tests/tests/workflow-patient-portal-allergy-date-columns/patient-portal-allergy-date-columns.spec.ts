import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalClinicalAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const inactiveEndDate = "2026-06-18";

const expectedAllergies = [
  {
    title: "Latex",
    reportedDate: "2024-07-21",
    startDate: "2024-07-21",
    endDate: null,
    referredBy: null,
    reaction: "skin irritation",
    severity: "low"
  }
];

test.describe("patient portal allergy date-column parity @slice248 @workflow-patient-portal-allergy-date-columns @patients @portal @clinical-lists", () => {
  test("exposes allergy reported, start, end, and referrer facts in the portal clinical summary", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalClinicalAnchorPatientId);
    expect(patient).not.toBeNull();

    const endedTitle = `Portal Ended Allergy ${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    let allergyId: number | string | null = null;

    try {
      allergyId = await workflow.createClinicalListEntry({
        patientId: patient!.pid,
        type: "allergy",
        title: endedTitle,
        dateTime: "2026-07-16 09:00:00",
        comments: "Created for patient portal allergy date-column parity.",
        reaction: "Hives",
        severity: "moderate",
        listOptionId: "parity-allergy"
      });

      await workflow.deactivateClinicalListEntry(
        allergyId,
        "Ended for patient portal allergy date-column parity."
      );

      const ended = await workflow.getClinicalListEntry(allergyId);
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
        allergyCount: 2,
        failureReason: null
      });

      expect(summary.allergies.slice(0, expectedAllergies.length).map((allergy) => ({
        title: allergy.title,
        reportedDate: allergy.reportedDate,
        startDate: allergy.startDate,
        endDate: allergy.endDate,
        referredBy: allergy.referredBy,
        reaction: allergy.reaction,
        severity: allergy.severity
      }))).toEqual(expectedAllergies);
      expect(summary.allergies).toEqual(expect.arrayContaining([
        expect.objectContaining({
          title: endedTitle,
          reportedDate: "2026-07-16",
          startDate: "2026-07-16",
          endDate: inactiveEndDate,
          referredBy: null,
          reaction: "Hives",
          severity: "moderate"
        })
      ]));

      if (target.type === "legacy-openemr") {
        await expectLegacyAllergyDateColumns(page, target, endedTitle);
      } else {
        await expectModernizedAllergyDateColumns(page, target, endedTitle);
      }
    } finally {
      if (allergyId !== null) {
        await workflow.deleteClinicalListEntry(allergyId);
      }
    }
  });
});

async function expectLegacyAllergyDateColumns(page: Page, target: RuntimeTarget, endedTitle: string) {
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

  await page.goto(`${target.publicUrl}/portal/get_allergies.php`);
  await expectRenderedText(page, /Title|Allergy/i);
  await expect(page.locator("body")).toContainText("Reported Date");
  await expect(page.locator("body")).toContainText("Start Date");
  await expect(page.locator("body")).toContainText("End Date");
  await expect(page.locator("body")).toContainText("Referrer");
  for (const expected of expectedAllergies) {
    await expect(page.locator("body")).toContainText(expected.title);
    await expect(page.locator("body")).toContainText(expected.reportedDate);
    await expect(page.locator("body")).toContainText(expected.startDate);
  }
  await expect(page.locator("body")).toContainText(endedTitle);
  await expect(page.locator("body")).toContainText(inactiveEndDate);
}

async function expectModernizedAllergyDateColumns(page: Page, target: RuntimeTarget, endedTitle: string) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const clinicalRegion = page.getByRole("region", { name: "Patient portal clinical summary" });
  await expect(clinicalRegion).toContainText("2 allergies");
  const allergyRegion = page.getByRole("region", { name: "Patient portal allergies" });

  for (const expected of expectedAllergies) {
    const card = allergyRegion.locator("article.clinical-item").filter({ hasText: expected.title }).first();
    await expect(card).toContainText(expected.title);
    await expect(card).toContainText(`Reported Date ${expected.reportedDate}`);
    await expect(card).toContainText(`Start Date ${expected.startDate}`);
    await expect(card).toContainText("End Date Active");
    await expect(card).toContainText("Referrer Not recorded");
  }

  const endedCard = allergyRegion.locator("article.clinical-item").filter({ hasText: endedTitle }).first();
  await expect(endedCard).toContainText(endedTitle);
  await expect(endedCard).toContainText("Reported Date 2026-07-16");
  await expect(endedCard).toContainText("Start Date 2026-07-16");
  await expect(endedCard).toContainText(`End Date ${inactiveEndDate}`);
  await expect(endedCard).toContainText("Referrer Not recorded");
}
