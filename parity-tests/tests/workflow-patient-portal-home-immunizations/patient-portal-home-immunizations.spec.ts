import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalHomeAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const vaccine = "Influenza, seasonal, injectable";

const expectedPermanentImmunization = {
  administeredDate: "2026-01-12",
  administeredFormatted: "01/12/2026",
  cvxCode: "141",
  codeText: vaccine,
  note: "Seasonal influenza vaccine for portal-messaging.",
  completionStatus: "completed",
  addedErroneously: 0
};

test.describe("patient portal home immunization parity @slice249 @workflow-patient-portal-home-immunizations @patients @portal", () => {
  test("shows portal health-snapshot immunizations including entered-in-error rows", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalHomeAnchorPatientId);
    expect(patient).not.toBeNull();

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const lotNumber = `PORTAL-HOME-IMM-${suffix}`;
    const errorNote = `Entered in error for portal home immunization parity ${suffix}.`;
    let immunizationId: number | string | null = null;

    try {
      immunizationId = await workflow.createImmunization({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        encounter: 0,
        administeredAt: "2026-08-20 09:15:00",
        immunizationId: 30,
        cvxCode: "141",
        vaccine,
        manufacturer: "Sanofi Pasteur",
        lotNumber,
        administeredBy: "admin",
        educationDate: "2026-08-20",
        visDate: "2026-08-01",
        amountAdministered: 0.5,
        amountAdministeredUnit: "mL",
        expirationDate: "2027-06-30",
        route: "intramuscular",
        administrationSite: "right deltoid",
        completionStatus: "completed",
        informationSource: "new_immunization_record",
        note: "Created for patient portal home immunization parity."
      });

      await workflow.markImmunizationEnteredInError(immunizationId, errorNote);

      const home = await workflow.getPatientPortalHomeSummary(portalLoginUsername, portalPassword);
      expect(home).toMatchObject({
        authenticated: true,
        username: portalLoginUsername,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        immunizationCount: 2,
        failureReason: null
      });

      expect(home.immunizations).toEqual(expect.arrayContaining([
        expect.objectContaining(expectedPermanentImmunization),
        expect.objectContaining({
          administeredDate: "2026-08-20",
          administeredFormatted: "08/20/2026",
          cvxCode: "141",
          codeText: vaccine,
          note: errorNote,
          completionStatus: "completed",
          addedErroneously: 1
        })
      ]));

      if (target.type === "legacy-openemr") {
        await expectLegacyPortalHomeImmunizations(page, target, errorNote);
      } else {
        await expectModernizedPortalHomeImmunizations(page, target, errorNote);
      }
    } finally {
      if (immunizationId !== null) {
        await workflow.deleteImmunization(immunizationId);
      }
    }
  });
});

async function expectLegacyPortalHomeImmunizations(page: Page, target: RuntimeTarget, errorNote: string) {
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
  await expectRenderedText(page, /Health Snapshot|Patient Immunization/i);
  await expect(page.locator("body")).toContainText("01/12/2026");
  await expect(page.locator("body")).toContainText("08/20/2026");
  await expect(page.locator("body")).toContainText(vaccine);
  await expect(page.locator("body")).toContainText(errorNote);
  await expect(page.locator("body")).toContainText("completed");
}

async function expectModernizedPortalHomeImmunizations(page: Page, target: RuntimeTarget, errorNote: string) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const immunizationRegion = page.getByRole("region", { name: "Patient portal immunizations" });
  await expect(immunizationRegion).toContainText("2 records");
  await expect(immunizationRegion).toContainText("01/12/2026");
  await expect(immunizationRegion).toContainText("08/20/2026");
  await expect(immunizationRegion).toContainText(vaccine);
  await expect(immunizationRegion).toContainText("Seasonal influenza vaccine for portal-messaging.");
  await expect(immunizationRegion).toContainText(errorNote);
  await expect(immunizationRegion).toContainText("Entered in error");
}
