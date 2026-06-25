import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedAdmin } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalProfileAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const profileChangeInput = {
  email: "nora.revert.slice254@example.test",
  phoneHome: "(619) 555-2540",
  phoneCell: "(619) 555-2541",
  street: "254 Reverted Portal Way",
  city: "National City",
  state: "CA",
  postalCode: "91954"
};

test.describe("patient portal profile review revert parity @slice254 @workflow-patient-portal-profile-review-revert @patients @portal @admin", () => {
  test("reverts a reviewed portal profile edit while leaving chart demographics unchanged", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    test.setTimeout(150_000);

    const patient = await targetDb.findPatientByCanonicalId(portalProfileAnchorPatientId);
    expect(patient).not.toBeNull();

    await workflow.cleanupPatientPortalProfileChange(portalLoginUsername, portalPassword);
    const originalProfile = await workflow.getPatientPortalProfile(portalLoginUsername, portalPassword);
    expect(originalProfile.authenticated).toBe(true);

    try {
      await workflow.submitPatientPortalProfileChange(portalLoginUsername, portalPassword, profileChangeInput);

      const queue = await workflow.getPatientPortalProfileReviewQueue();
      const reviewRequest = queue.profileReviewRequests.find((request) => request.pubpid === portalProfileAnchorPatientId);
      expect(reviewRequest).toBeTruthy();
      expect(reviewRequest).toMatchObject({
        pubpid: portalProfileAnchorPatientId,
        pid: patient!.pid,
        activity: "profile",
        requireAudit: 1,
        pendingAction: "review",
        status: "waiting",
        narrative: "Patient request changes to demographics."
      });
      expect(reviewRequest!.requestedDemographics).toMatchObject(profileChangeInput);

      if (target.type === "modernized-openemr") {
        await expectModernizedPortalProfileReviewRevert(page, target);
      } else {
        const reverted = await workflow.revertPatientPortalProfileReview(reviewRequest!.id);
        expect(reverted).toMatchObject({
          accepted: true,
          id: reviewRequest!.id,
          pid: patient!.pid,
          status: "closed",
          pendingAction: "completed",
          actionTaken: "accept",
          narrative: "Changes reviewed and committed to demographics.",
          tableAction: "update"
        });
        expect(reverted!.actionUser).toBeTruthy();
        expect(reverted!.actionTakenAt).toBeTruthy();
        expect(reverted!.demographics).toMatchObject(originalProfile.demographics);
      }

      const afterQueue = await workflow.getPatientPortalProfileReviewQueue();
      expect(afterQueue.profileReviewRequests.find((request) => request.pubpid === portalProfileAnchorPatientId)).toBeUndefined();
      expect(afterQueue.waitingProfileReviewCount).toBeLessThan(queue.waitingProfileReviewCount);

      const revertedProfile = await workflow.getPatientPortalProfile(portalLoginUsername, portalPassword);
      expect(revertedProfile).toMatchObject({
        authenticated: true,
        hasPendingProfileChanges: false,
        pendingChange: null
      });
      expect(revertedProfile.demographics).toMatchObject(originalProfile.demographics);
      expect(revertedProfile.demographics.email).not.toBe(profileChangeInput.email);
    } finally {
      await workflow.restorePatientPortalProfileAfterReview(
        portalLoginUsername,
        portalPassword,
        originalProfile.demographics
      );
    }
  });
});

async function expectModernizedPortalProfileReviewRevert(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedAdmin(page, target);

  const reviewQueue = page.getByRole("region", { name: "Portal activity review queue" });
  await expect(reviewQueue).toContainText("Portal Activity Review");
  await expect(reviewQueue).toContainText("Nora Kim");
  await expect(reviewQueue).toContainText(profileChangeInput.email);
  await reviewQueue.getByRole("button", { name: "Revert Edits" }).click();

  await expect(page.locator("body")).toContainText("Reverted Nora Kim profile edits");
  await expect(reviewQueue).not.toContainText(profileChangeInput.email);
}
