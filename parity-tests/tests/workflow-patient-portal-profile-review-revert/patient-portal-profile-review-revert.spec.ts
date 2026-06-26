import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedAdmin } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type {
  PatientPortalProfileResult,
  PatientPortalProfileReviewAcceptResult,
  PatientPortalProfileReviewQueueResult
} from "../../src/workflows/legacyWorkflowActions.js";
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
  }, testInfo) => {
    test.setTimeout(150_000);

    const patient = await targetDb.findPatientByCanonicalId(portalProfileAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-254-patient-portal-profile-review-revert-precondition",
      description: "Captures the Slice 254 portal profile review revert precondition: the signed-in anchor patient exists before staff rejects a pending profile edit.",
      expected: {
        canonicalId: portalProfileAnchorPatientId,
        portalUsername: portalLoginUsername,
        rejectedChange: profileChangeInput
      },
      actual: {
        canonicalId: portalProfileAnchorPatientId,
        patient
      },
      context: {
        suite: "workflow-patient-portal-profile-review-revert",
        workflow: "patient-portal-profile-review-revert-precondition"
      }
    });

    await workflow.cleanupPatientPortalProfileChange(portalLoginUsername, portalPassword);
    const originalProfile = await workflow.getPatientPortalProfile(portalLoginUsername, portalPassword);
    expect(originalProfile.authenticated).toBe(true);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-254-patient-portal-profile-review-revert-original-profile",
      description: "Captures the original Slice 254 chart demographics before staff reverts the submitted portal profile edit.",
      expected: {
        authenticated: true,
        hasPendingProfileChanges: false
      },
      actual: summarizePortalProfile(originalProfile),
      context: {
        canonicalId: portalProfileAnchorPatientId,
        suite: "workflow-patient-portal-profile-review-revert",
        workflow: "patient-portal-profile-review-revert-original-profile"
      }
    });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-254-patient-portal-profile-review-revert-queued-request",
        description: "Captures the waiting Slice 254 profile review request before staff reverts the requested demographics.",
        expected: {
          reviewRequest: {
            pubpid: portalProfileAnchorPatientId,
            pid: patient!.pid,
            activity: "profile",
            requireAudit: 1,
            pendingAction: "review",
            status: "waiting",
            narrative: "Patient request changes to demographics.",
            requestedDemographics: profileChangeInput
          }
        },
        actual: summarizeProfileReviewQueue(queue, portalProfileAnchorPatientId),
        context: {
          canonicalId: portalProfileAnchorPatientId,
          suite: "workflow-patient-portal-profile-review-revert",
          workflow: "patient-portal-profile-review-revert-queued-request"
        }
      });

      if (target.type === "modernized-openemr") {
        const modernizedUi = await expectModernizedPortalProfileReviewRevert(page, target);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-254-patient-portal-profile-review-revert-modernized-ui",
          description: "Captures the modernized Admin Revert Edits rendering and success message for the Slice 254 staff revert action.",
          expected: {
            regionName: "Portal activity review queue",
            action: "Revert Edits",
            successMessage: "Reverted Nora Kim profile edits",
            removedPendingRequestFromRegion: true
          },
          actual: modernizedUi,
          context: {
            canonicalId: portalProfileAnchorPatientId,
            suite: "workflow-patient-portal-profile-review-revert",
            workflow: "patient-portal-profile-review-revert-modernized-ui"
          }
        });
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
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-254-patient-portal-profile-review-revert-legacy-action",
          description: "Captures the legacy normalized staff revert action after closing the Slice 254 portal profile edit while preserving original chart demographics.",
          expected: {
            accepted: true,
            id: reviewRequest!.id,
            pid: patient!.pid,
            status: "closed",
            pendingAction: "completed",
            actionTaken: "accept",
            narrative: "Changes reviewed and committed to demographics.",
            tableAction: "update",
            demographics: originalProfile.demographics
          },
          actual: summarizeProfileReviewAcceptResult(reverted),
          context: {
            canonicalId: portalProfileAnchorPatientId,
            suite: "workflow-patient-portal-profile-review-revert",
            workflow: "patient-portal-profile-review-revert-legacy-action"
          }
        });
      }

      const afterQueue = await workflow.getPatientPortalProfileReviewQueue();
      expect(afterQueue.profileReviewRequests.find((request) => request.pubpid === portalProfileAnchorPatientId)).toBeUndefined();
      expect(afterQueue.waitingProfileReviewCount).toBeLessThan(queue.waitingProfileReviewCount);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-254-patient-portal-profile-review-revert-after-queue",
        description: "Captures the Slice 254 staff review queue after reverting the profile edit, proving the waiting request is closed and removed from the active queue.",
        expected: {
          profileReviewRequestForAnchor: null,
          waitingProfileReviewCountLessThanBefore: true
        },
        actual: {
          before: summarizeProfileReviewQueue(queue, portalProfileAnchorPatientId),
          after: summarizeProfileReviewQueue(afterQueue, portalProfileAnchorPatientId),
          countDeltas: {
            waitingAuditCount: afterQueue.waitingAuditCount - queue.waitingAuditCount,
            waitingProfileReviewCount: afterQueue.waitingProfileReviewCount - queue.waitingProfileReviewCount
          }
        },
        context: {
          canonicalId: portalProfileAnchorPatientId,
          suite: "workflow-patient-portal-profile-review-revert",
          workflow: "patient-portal-profile-review-revert-after-queue"
        }
      });

      const revertedProfile = await workflow.getPatientPortalProfile(portalLoginUsername, portalPassword);
      expect(revertedProfile).toMatchObject({
        authenticated: true,
        hasPendingProfileChanges: false,
        pendingChange: null
      });
      expect(revertedProfile.demographics).toMatchObject(originalProfile.demographics);
      expect(revertedProfile.demographics.email).not.toBe(profileChangeInput.email);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-254-patient-portal-profile-review-revert-profile",
        description: "Captures the Slice 254 reverted portal profile after staff closes the request while leaving chart demographics unchanged.",
        expected: {
          authenticated: true,
          hasPendingProfileChanges: false,
          pendingChange: null,
          demographics: originalProfile.demographics,
          rejectedEmailNotPersisted: profileChangeInput.email
        },
        actual: summarizePortalProfile(revertedProfile),
        context: {
          canonicalId: portalProfileAnchorPatientId,
          suite: "workflow-patient-portal-profile-review-revert",
          workflow: "patient-portal-profile-review-revert-profile"
        }
      });
    } finally {
      await workflow.restorePatientPortalProfileAfterReview(
        portalLoginUsername,
        portalPassword,
        originalProfile.demographics
      );
      const restoredProfile = await workflow.getPatientPortalProfile(portalLoginUsername, portalPassword);
      const restoredQueue = await workflow.getPatientPortalProfileReviewQueue();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-254-patient-portal-profile-review-revert-restored",
        description: "Captures the final Slice 254 restoration state after removing portal profile review activity and preserving original chart demographics.",
        expected: {
          restoredDemographics: originalProfile.demographics,
          hasPendingProfileChanges: false,
          profileReviewRequestForAnchor: null
        },
        actual: {
          profile: summarizePortalProfile(restoredProfile),
          queue: summarizeProfileReviewQueue(restoredQueue, portalProfileAnchorPatientId)
        },
        context: {
          canonicalId: portalProfileAnchorPatientId,
          suite: "workflow-patient-portal-profile-review-revert",
          workflow: "patient-portal-profile-review-revert-restored"
        }
      });
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

  return {
    regionName: "Portal activity review queue",
    action: "Revert Edits",
    renderedTextAfterAction: await reviewQueue.innerText(),
    successMessage: "Reverted Nora Kim profile edits",
    visibleFactsBeforeAction: {
      headline: "Portal Activity Review",
      patientName: "Nora Kim",
      requestedEmail: profileChangeInput.email
    },
    removedPendingRequestFromRegion: true
  };
}

function summarizePortalProfile(profile: PatientPortalProfileResult) {
  return {
    authenticated: profile.authenticated,
    username: profile.username,
    portalUsername: profile.portalUsername,
    canonicalId: profile.canonicalId,
    pid: profile.pid,
    pubpid: profile.pubpid,
    displayName: profile.displayName,
    hasPendingProfileChanges: profile.hasPendingProfileChanges,
    demographics: profile.demographics,
    pendingChange: profile.pendingChange,
    failureReason: profile.failureReason,
    sessionSource: profile.sessionSource
  };
}

function summarizeProfileReviewQueue(
  queue: PatientPortalProfileReviewQueueResult,
  canonicalId: string
) {
  return {
    waitingAuditCount: queue.waitingAuditCount,
    waitingProfileReviewCount: queue.waitingProfileReviewCount,
    profileReviewRequestForAnchor: queue.profileReviewRequests.find((request) => request.pubpid === canonicalId) ?? null,
    profileReviewRequests: queue.profileReviewRequests.map((request) => ({
      id: request.id,
      requestedAt: request.requestedAt,
      pubpid: request.pubpid,
      pid: request.pid,
      patientName: request.patientName,
      activity: request.activity,
      requireAudit: request.requireAudit,
      pendingAction: request.pendingAction,
      actionTaken: request.actionTaken,
      status: request.status,
      narrative: request.narrative,
      tableAction: request.tableAction,
      checksum: request.checksum,
      requestedDemographics: request.requestedDemographics
    }))
  };
}

function summarizeProfileReviewAcceptResult(result: PatientPortalProfileReviewAcceptResult | null) {
  if (result === null) {
    return null;
  }

  return {
    accepted: result.accepted,
    id: result.id,
    patientId: result.patientId,
    pid: result.pid,
    status: result.status,
    pendingAction: result.pendingAction,
    actionTaken: result.actionTaken,
    narrative: result.narrative,
    tableAction: result.tableAction,
    actionUser: result.actionUser,
    actionTakenAt: result.actionTakenAt,
    demographics: result.demographics
  };
}
