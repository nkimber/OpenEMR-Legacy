import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalProfileAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const profileChangeInput = {
  email: "nora.profile.slice251@example.test",
  phoneHome: "(619) 555-2510",
  phoneCell: "(619) 555-2511",
  street: "251 Portal Review Lane",
  city: "National City",
  state: "CA",
  postalCode: "91951"
};

test.describe("patient portal profile change request parity @slice251 @workflow-patient-portal-profile-change-request @patients @portal", () => {
  test("stores portal profile edits as pending review without mutating the chart profile", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalProfileAnchorPatientId);
    expect(patient).not.toBeNull();

    await workflow.cleanupPatientPortalProfileChange(portalLoginUsername, portalPassword);
    try {
      const beforeProfile = await workflow.getPatientPortalProfile(portalLoginUsername, portalPassword);
      expect(beforeProfile).toMatchObject({
        authenticated: true,
        hasPendingProfileChanges: false,
        pendingChange: null
      });
      expect(beforeProfile.demographics.email).toBe(portalLoginUsername);
      expect(beforeProfile.demographics.street).toBe("104 Test Patient Avenue");

      const submittedProfile = await workflow.submitPatientPortalProfileChange(
        portalLoginUsername,
        portalPassword,
        profileChangeInput
      );

      expect(submittedProfile).toMatchObject({
        authenticated: true,
        username: portalLoginUsername,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        hasPendingProfileChanges: true,
        failureReason: null
      });
      expect(submittedProfile.demographics.email).toBe(portalLoginUsername);
      expect(submittedProfile.demographics.street).toBe("104 Test Patient Avenue");
      expect(submittedProfile.pendingChange).toMatchObject({
        status: "waiting",
        pendingAction: "review",
        narrative: "Patient request changes to demographics."
      });
      expect(submittedProfile.pendingChange?.demographics).toMatchObject(profileChangeInput);

      const refreshedProfile = await workflow.getPatientPortalProfile(portalLoginUsername, portalPassword);
      expect(refreshedProfile.hasPendingProfileChanges).toBe(true);
      expect(refreshedProfile.pendingChange?.demographics).toMatchObject(profileChangeInput);
      expect(refreshedProfile.demographics.email).toBe(portalLoginUsername);
      expect(refreshedProfile.demographics.street).toBe("104 Test Patient Avenue");

      if (target.type === "legacy-openemr") {
        await expectLegacyPortalProfilePendingChange(page, target);
      } else {
        await expectModernizedPortalProfilePendingChange(page, target);
      }
    } finally {
      await workflow.cleanupPatientPortalProfileChange(portalLoginUsername, portalPassword);
    }
  });
});

async function expectLegacyPortalProfilePendingChange(page: Page, target: RuntimeTarget) {
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
  await expect(page.locator("body")).toContainText("Edit Pending Changes.");
}

async function expectModernizedPortalProfilePendingChange(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const profileRegion = page.getByRole("region", { name: "Patient portal profile" });
  await expect(profileRegion).toContainText("Profile From Medical Records");
  await expect(profileRegion).toContainText("Edit Pending Changes.");
  await expect(profileRegion).toContainText("Pending review");
  await expect(profileRegion).toContainText(profileChangeInput.email);
  await expect(profileRegion).toContainText(profileChangeInput.street);
  await expect(profileRegion).toContainText(profileChangeInput.phoneHome);
  await expect(profileRegion).toContainText(profileChangeInput.phoneCell);
}
