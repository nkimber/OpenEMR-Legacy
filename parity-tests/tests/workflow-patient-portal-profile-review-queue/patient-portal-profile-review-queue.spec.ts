import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedAdmin } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { PatientPortalProfileReviewQueueResult } from "../../src/workflows/legacyWorkflowActions.js";
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
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalProfileAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-252-patient-portal-profile-review-queue-precondition",
      description: "Captures the Slice 252 portal profile review queue precondition: the signed-in anchor patient exists before a waiting staff-review request is submitted.",
      expected: {
        canonicalId: portalProfileAnchorPatientId,
        portalUsername: portalLoginUsername,
        proposedChange: profileChangeInput
      },
      actual: {
        canonicalId: portalProfileAnchorPatientId,
        patient
      },
      context: {
        suite: "workflow-patient-portal-profile-review-queue",
        workflow: "patient-portal-profile-review-queue-precondition"
      }
    });

    await workflow.cleanupPatientPortalProfileChange(portalLoginUsername, portalPassword);
    try {
      const beforeQueue = await workflow.getPatientPortalProfileReviewQueue();
      expect(beforeQueue.profileReviewRequests.find((request) => request.pubpid === portalProfileAnchorPatientId)).toBeUndefined();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-252-patient-portal-profile-review-queue-before",
        description: "Captures the clean Slice 252 staff review queue state before submitting a new pending portal profile edit.",
        expected: {
          profileReviewRequestForAnchor: null
        },
        actual: summarizeProfileReviewQueue(beforeQueue, portalProfileAnchorPatientId),
        context: {
          canonicalId: portalProfileAnchorPatientId,
          suite: "workflow-patient-portal-profile-review-queue",
          workflow: "patient-portal-profile-review-queue-before"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-252-patient-portal-profile-review-queue-result",
        description: "Captures the Slice 252 waiting staff review queue projection after a patient submits portal profile edits.",
        expected: {
          waitingAuditCountDeltaAtLeast: 1,
          waitingProfileReviewCountDeltaAtLeast: 1,
          reviewRequest: {
            pubpid: portalProfileAnchorPatientId,
            pid: patient!.pid,
            activity: "profile",
            requireAudit: 1,
            pendingAction: "review",
            actionTaken: "",
            status: "waiting",
            narrative: "Patient request changes to demographics.",
            tableAction: "",
            checksum: "0",
            requestedDemographics: profileChangeInput
          }
        },
        actual: {
          before: summarizeProfileReviewQueue(beforeQueue, portalProfileAnchorPatientId),
          after: summarizeProfileReviewQueue(queue, portalProfileAnchorPatientId),
          countDeltas: {
            waitingAuditCount: queue.waitingAuditCount - beforeQueue.waitingAuditCount,
            waitingProfileReviewCount: queue.waitingProfileReviewCount - beforeQueue.waitingProfileReviewCount
          }
        },
        context: {
          canonicalId: portalProfileAnchorPatientId,
          suite: "workflow-patient-portal-profile-review-queue",
          workflow: "patient-portal-profile-review-queue-result"
        }
      });

      if (target.type === "modernized-openemr") {
        const modernizedUi = await expectModernizedPortalProfileReviewQueue(page, target);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-252-patient-portal-profile-review-queue-modernized-ui",
          description: "Captures the modernized Admin portal activity review queue rendering for the Slice 252 waiting profile edit.",
          expected: {
            regionName: "Portal activity review queue",
            visibleFacts: [
              "Portal Activity Review",
              "Profile changes",
              "Patient request changes to demographics.",
              "Nora Kim",
              portalProfileAnchorPatientId,
              profileChangeInput.email,
              profileChangeInput.street,
              profileChangeInput.phoneHome,
              profileChangeInput.phoneCell
            ]
          },
          actual: modernizedUi,
          context: {
            canonicalId: portalProfileAnchorPatientId,
            suite: "workflow-patient-portal-profile-review-queue",
            workflow: "patient-portal-profile-review-queue-modernized-ui"
          }
        });
      } else {
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-252-patient-portal-profile-review-queue-legacy-workflow",
          description: "Captures the legacy Slice 252 staff review queue facts through the normalized legacy workflow action used as the parity source of truth.",
          expected: {
            source: "legacy normalized workflow action",
            reviewRequestVisibleForStaffReview: true,
            requestedDemographics: profileChangeInput
          },
          actual: summarizeProfileReviewQueue(queue, portalProfileAnchorPatientId),
          context: {
            canonicalId: portalProfileAnchorPatientId,
            suite: "workflow-patient-portal-profile-review-queue",
            workflow: "patient-portal-profile-review-queue-legacy-workflow"
          }
        });
      }
    } finally {
      await workflow.cleanupPatientPortalProfileChange(portalLoginUsername, portalPassword);
      const afterCleanupQueue = await workflow.getPatientPortalProfileReviewQueue();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-252-patient-portal-profile-review-queue-cleanup",
        description: "Captures the final Slice 252 cleanup state after removing the pending portal profile edit from the staff review queue.",
        expected: {
          profileReviewRequestForAnchor: null
        },
        actual: summarizeProfileReviewQueue(afterCleanupQueue, portalProfileAnchorPatientId),
        context: {
          canonicalId: portalProfileAnchorPatientId,
          suite: "workflow-patient-portal-profile-review-queue",
          workflow: "patient-portal-profile-review-queue-cleanup"
        }
      });
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

  return {
    regionName: "Portal activity review queue",
    renderedText: await reviewQueue.innerText(),
    visibleFacts: {
      headline: "Portal Activity Review",
      section: "Profile changes",
      narrative: "Patient request changes to demographics.",
      patientName: "Nora Kim",
      canonicalId: portalProfileAnchorPatientId,
      requestedDemographics: profileChangeInput
    }
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
