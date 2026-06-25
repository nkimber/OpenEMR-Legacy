import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalProfileAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal profile parity @slice250 @workflow-patient-portal-profile @patients @portal", () => {
  test("shows portal demographics and insurance profile facts", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalProfileAnchorPatientId);
    expect(patient).not.toBeNull();

    const profile = await workflow.getPatientPortalProfile(portalLoginUsername, portalPassword);
    expect(profile).toMatchObject({
      authenticated: true,
      username: portalLoginUsername,
      portalUsername: portalLoginUsername,
      pid: patient!.pid,
      pubpid: patient!.pubpid,
      displayName: "Kim, Nora",
      hasPendingProfileChanges: false,
      insuranceCount: 2,
      failureReason: null
    });

    expect(profile.demographics).toMatchObject({
      firstName: "Nora",
      lastName: "Kim",
      dateOfBirth: "2002-05-05",
      sex: "Male",
      email: portalLoginUsername,
      street: "104 Test Patient Avenue",
      city: "National City",
      state: "CA",
      postalCode: "91950",
      phoneHome: "(619) 555-1004",
      phoneCell: "(619) 555-1004",
      motherName: "Avery Kim",
      guardianName: "Jordan Kim"
    });

    expect(profile.insurance).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: "primary",
        provider: "Evergreen PPO",
        planName: "Community HMO",
        policyNumber: "POL100004",
        groupNumber: "GRP103",
        subscriberName: "Nora Kim",
        subscriberRelationship: "self",
        subscriberDateOfBirth: "2002-05-05"
      }),
      expect.objectContaining({
        type: "secondary",
        provider: "Harbor Mutual",
        planName: "Standard Silver",
        policyNumber: "SEC100004",
        groupNumber: "GRP203",
        subscriberName: "Casey Kim",
        subscriberRelationship: "spouse",
        subscriberDateOfBirth: "1975-04-04"
      })
    ]));

    if (target.type === "legacy-openemr") {
      await expectLegacyPortalProfile(page, target);
    } else {
      await expectModernizedPortalProfile(page, target);
    }
  });
});

async function expectLegacyPortalProfile(page: Page, target: RuntimeTarget) {
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
  await page.goto(`${target.publicUrl}/portal/get_profile.php`);
  await expectRenderedText(page, /Profile From Medical Records/i);
  await expect(page.locator("body")).toContainText("Nora");
  await expect(page.locator("body")).toContainText("Kim");
  await expect(page.locator("body")).toContainText(portalLoginUsername);
  await expect(page.locator("body")).toContainText("Community HMO");
  await expect(page.locator("body")).toContainText("Standard Silver");
  await expect(page.locator("body")).toContainText("POL100004");
  await expect(page.locator("body")).toContainText("SEC100004");
}

async function expectModernizedPortalProfile(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const profileRegion = page.getByRole("region", { name: "Patient portal profile" });
  await expect(profileRegion).toContainText("Profile From Medical Records");
  await expect(profileRegion).toContainText("Nora Kim");
  await expect(profileRegion).toContainText("2002-05-05");
  await expect(profileRegion).toContainText(portalLoginUsername);
  await expect(profileRegion).toContainText("104 Test Patient Avenue");
  await expect(profileRegion).toContainText("Avery Kim");
  await expect(profileRegion).toContainText("Jordan Kim");
  await expect(profileRegion).toContainText("Community HMO");
  await expect(profileRegion).toContainText("Standard Silver");
  await expect(profileRegion).toContainText("POL100004");
  await expect(profileRegion).toContainText("SEC100004");
}
