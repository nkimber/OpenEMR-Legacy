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
  }, testInfo) => {
    test.setTimeout(150_000);

    const patient = await targetDb.findPatientByCanonicalId(portalProfileAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-253-patient-portal-profile-review-accept-precondition",
      description: "Captures the Slice 253 portal profile review accept precondition: the signed-in anchor patient exists before staff accepts a pending profile edit.",
      expected: {
        canonicalId: portalProfileAnchorPatientId,
        portalUsername: portalLoginUsername,
        acceptedChange: profileChangeInput
      },
      actual: {
        canonicalId: portalProfileAnchorPatientId,
        patient
      },
      context: {
        suite: "workflow-patient-portal-profile-review-accept",
        workflow: "patient-portal-profile-review-accept-precondition"
      }
    });

    await workflow.cleanupPatientPortalProfileChange(portalLoginUsername, portalPassword);
    const originalProfile = await workflow.getPatientPortalProfile(portalLoginUsername, portalPassword);
    expect(originalProfile.authenticated).toBe(true);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-253-patient-portal-profile-review-accept-original-profile",
      description: "Captures the original Slice 253 chart demographics before staff accepts the submitted portal profile edit.",
      expected: {
        authenticated: true,
        hasPendingProfileChanges: false
      },
      actual: summarizePortalProfile(originalProfile),
      context: {
        canonicalId: portalProfileAnchorPatientId,
        suite: "workflow-patient-portal-profile-review-accept",
        workflow: "patient-portal-profile-review-accept-original-profile"
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
        probe: "slice-253-patient-portal-profile-review-accept-queued-request",
        description: "Captures the waiting Slice 253 profile review request before staff commits the requested demographics to the chart.",
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
          suite: "workflow-patient-portal-profile-review-accept",
          workflow: "patient-portal-profile-review-accept-queued-request"
        }
      });

      if (target.type === "modernized-openemr") {
        const modernizedUi = await expectModernizedPortalProfileReviewAccept(page, target);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-253-patient-portal-profile-review-accept-modernized-ui",
          description: "Captures the modernized Admin Commit to Chart rendering and success message for the Slice 253 staff accept action.",
          expected: {
            regionName: "Portal activity review queue",
            action: "Commit to Chart",
            successMessage: "Committed Nora Kim profile edits to chart",
            removedPendingRequestFromRegion: true
          },
          actual: modernizedUi,
          context: {
            canonicalId: portalProfileAnchorPatientId,
            suite: "workflow-patient-portal-profile-review-accept",
            workflow: "patient-portal-profile-review-accept-modernized-ui"
          }
        });
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
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-253-patient-portal-profile-review-accept-legacy-action",
          description: "Captures the legacy normalized staff accept action after committing the Slice 253 portal profile edit to chart demographics.",
          expected: {
            accepted: true,
            id: reviewRequest!.id,
            pid: patient!.pid,
            status: "closed",
            pendingAction: "completed",
            actionTaken: "accept",
            narrative: "Changes reviewed and committed to demographics.",
            tableAction: "update",
            demographics: profileChangeInput
          },
          actual: summarizeProfileReviewAcceptResult(accepted),
          context: {
            canonicalId: portalProfileAnchorPatientId,
            suite: "workflow-patient-portal-profile-review-accept",
            workflow: "patient-portal-profile-review-accept-legacy-action"
          }
        });
      }

      const afterQueue = await workflow.getPatientPortalProfileReviewQueue();
      expect(afterQueue.profileReviewRequests.find((request) => request.pubpid === portalProfileAnchorPatientId)).toBeUndefined();
      expect(afterQueue.waitingProfileReviewCount).toBeLessThan(queue.waitingProfileReviewCount);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-253-patient-portal-profile-review-accept-after-queue",
        description: "Captures the Slice 253 staff review queue after accepting the profile edit, proving the waiting request is closed and removed from the active queue.",
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
          suite: "workflow-patient-portal-profile-review-accept",
          workflow: "patient-portal-profile-review-accept-after-queue"
        }
      });

      const acceptedProfile = await workflow.getPatientPortalProfile(portalLoginUsername, portalPassword);
      expect(acceptedProfile).toMatchObject({
        authenticated: true,
        hasPendingProfileChanges: false,
        pendingChange: null
      });
      expect(acceptedProfile.demographics).toMatchObject(profileChangeInput);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-253-patient-portal-profile-review-accept-profile",
        description: "Captures the Slice 253 accepted portal profile after staff commits requested demographics into chart demographics.",
        expected: {
          authenticated: true,
          hasPendingProfileChanges: false,
          pendingChange: null,
          demographics: profileChangeInput
        },
        actual: summarizePortalProfile(acceptedProfile),
        context: {
          canonicalId: portalProfileAnchorPatientId,
          suite: "workflow-patient-portal-profile-review-accept",
          workflow: "patient-portal-profile-review-accept-profile"
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
        probe: "slice-253-patient-portal-profile-review-accept-restored",
        description: "Captures the final Slice 253 restoration state after resetting chart demographics and removing portal profile review activity.",
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
          suite: "workflow-patient-portal-profile-review-accept",
          workflow: "patient-portal-profile-review-accept-restored"
        }
      });
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

  return {
    regionName: "Portal activity review queue",
    action: "Commit to Chart",
    renderedTextAfterAction: await reviewQueue.innerText(),
    successMessage: "Committed Nora Kim profile edits to chart",
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
