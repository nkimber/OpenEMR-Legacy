import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedAdmin } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalProfileAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const profileChangeInput = {
  email: "nora.review.slice252@example.test",
  phoneHome: "(619) 555-2520",
  phoneCell: "(619) 555-2521",
  street: "252 Portal Review Queue",
  city: "National City",
  state: "CA",
  postalCode: "91952"
};

test.describe("patient portal profile review queue parity @slice252 @workflow-patient-portal-profile-review-queue @patients @portal @admin", () => {
  test("surfaces waiting portal profile edits in the staff review queue", async ({
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
      const beforeQueue = await workflow.getPatientPortalProfileReviewQueue();
      expect(beforeQueue.profileReviewRequests.find((request) => request.pubpid === portalProfileAnchorPatientId)).toBeUndefined();

      await workflow.submitPatientPortalProfileChange(portalLoginUsername, portalPassword, profileChangeInput);

      const queue = await workflow.getPatientPortalProfileReviewQueue();
      expect(queue.waitingAuditCount).toBeGreaterThanOrEqual(beforeQueue.waitingAuditCount + 1);
      expect(queue.waitingProfileReviewCount).toBeGreaterThanOrEqual(beforeQueue.waitingProfileReviewCount + 1);

      const reviewRequest = queue.profileReviewRequests.find((request) => request.pubpid === portalProfileAnchorPatientId);
      expect(reviewRequest).toBeTruthy();
      expect(reviewRequest).toMatchObject({
        pubpid: portalProfileAnchorPatientId,
        pid: patient!.pid,
        activity: "profile",
        requireAudit: 1,
        pendingAction: "review",
        actionTaken: "",
        status: "waiting",
        narrative: "Patient request changes to demographics.",
        tableAction: "",
        checksum: "0"
      });
      expect(reviewRequest!.patientName).toContain("Nora");
      expect(reviewRequest!.patientName).toContain("Kim");
      expect(reviewRequest!.requestedDemographics).toMatchObject(profileChangeInput);

      if (target.type === "modernized-openemr") {
        await expectModernizedPortalProfileReviewQueue(page, target);
      }
    } finally {
      await workflow.cleanupPatientPortalProfileChange(portalLoginUsername, portalPassword);
    }
  });
});

async function expectModernizedPortalProfileReviewQueue(page: Page, target: RuntimeTarget) {
  await openAuthenticatedModernizedAdmin(page, target);

  const reviewQueue = page.getByRole("region", { name: "Portal activity review queue" });
  await expect(reviewQueue).toContainText("Portal Activity Review");
  await expect(reviewQueue).toContainText("Profile changes");
  await expect(reviewQueue).toContainText("Patient request changes to demographics.");
  await expect(reviewQueue).toContainText("Nora Kim");
  await expect(reviewQueue).toContainText(portalProfileAnchorPatientId);
  await expect(reviewQueue).toContainText(profileChangeInput.email);
  await expect(reviewQueue).toContainText(profileChangeInput.street);
  await expect(reviewQueue).toContainText(profileChangeInput.phoneHome);
  await expect(reviewQueue).toContainText(profileChangeInput.phoneCell);
}
