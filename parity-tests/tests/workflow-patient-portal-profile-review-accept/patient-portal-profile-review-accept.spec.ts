import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedAdmin } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalProfileAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const profileChangeInput = {
  email: "nora.accept.slice253@example.test",
  phoneHome: "(619) 555-2530",
  phoneCell: "(619) 555-2531",
  street: "253 Accepted Portal Way",
  city: "National City",
  state: "CA",
  postalCode: "91953"
};

test.describe("patient portal profile review accept parity @slice253 @workflow-patient-portal-profile-review-accept @patients @portal @admin", () => {
  test("commits a reviewed portal profile edit to chart demographics", async ({
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
        await expectModernizedPortalProfileReviewAccept(page, target);
      } else {
        const accepted = await workflow.acceptPatientPortalProfileReview(reviewRequest!.id);
        expect(accepted).toMatchObject({
          accepted: true,
          id: reviewRequest!.id,
          pid: patient!.pid,
          status: "closed",
          pendingAction: "completed",
          actionTaken: "accept",
          narrative: "Changes reviewed and committed to demographics.",
          tableAction: "update"
        });
        expect(accepted!.actionUser).toBeTruthy();
        expect(accepted!.actionTakenAt).toBeTruthy();
        expect(accepted!.demographics).toMatchObject(profileChangeInput);
      }

      const afterQueue = await workflow.getPatientPortalProfileReviewQueue();
      expect(afterQueue.profileReviewRequests.find((request) => request.pubpid === portalProfileAnchorPatientId)).toBeUndefined();
      expect(afterQueue.waitingProfileReviewCount).toBeLessThan(queue.waitingProfileReviewCount);

      const acceptedProfile = await workflow.getPatientPortalProfile(portalLoginUsername, portalPassword);
      expect(acceptedProfile).toMatchObject({
        authenticated: true,
        hasPendingProfileChanges: false,
        pendingChange: null
      });
      expect(acceptedProfile.demographics).toMatchObject(profileChangeInput);
    } finally {
      await workflow.restorePatientPortalProfileAfterReview(
        portalLoginUsername,
        portalPassword,
        originalProfile.demographics
      );
    }
  });
});

async function expectModernizedPortalProfileReviewAccept(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedAdmin(page, target);

  const reviewQueue = page.getByRole("region", { name: "Portal activity review queue" });
  await expect(reviewQueue).toContainText("Portal Activity Review");
  await expect(reviewQueue).toContainText("Nora Kim");
  await expect(reviewQueue).toContainText(profileChangeInput.email);
  await reviewQueue.getByRole("button", { name: "Commit to Chart" }).click();

  await expect(page.locator("body")).toContainText("Committed Nora Kim profile edits to chart");
  await expect(reviewQueue).not.toContainText(profileChangeInput.email);
}
