import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type {
  PatientPortalProfilePendingChange,
  PatientPortalProfileResult
} from "../../src/workflows/legacyWorkflowActions.js";
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
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalProfileAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-251-patient-portal-profile-change-precondition",
      description: "Captures the Slice 251 portal profile change precondition: the signed-in anchor patient exists before pending profile edits are submitted.",
      expected: {
        canonicalId: portalProfileAnchorPatientId,
        portalUsername: portalLoginUsername,
        proposedChange: profileChangeInput
      },
      actual: {
        patient
      },
      context: {
        canonicalId: portalProfileAnchorPatientId,
        suite: "workflow-patient-portal-profile-change-request",
        workflow: "patient-portal-profile-change-precondition"
      }
    });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-251-patient-portal-profile-change-before",
        description: "Captures the clean Slice 251 portal profile state before submitting the pending profile edit request.",
        expected: {
          hasPendingProfileChanges: false,
          pendingChange: null,
          persistedDemographics: {
            email: portalLoginUsername,
            street: "104 Test Patient Avenue"
          }
        },
        actual: summarizeProfile(beforeProfile),
        context: {
          canonicalId: portalProfileAnchorPatientId,
          suite: "workflow-patient-portal-profile-change-request",
          workflow: "patient-portal-profile-change-before"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-251-patient-portal-profile-change-submitted",
        description: "Captures the submitted Slice 251 pending profile edit request while proving medical-record demographics remain unchanged.",
        expected: {
          hasPendingProfileChanges: true,
          pendingChange: {
            status: "waiting",
            pendingAction: "review",
            narrative: "Patient request changes to demographics.",
            demographics: profileChangeInput
          },
          unchangedMedicalRecordDemographics: {
            email: portalLoginUsername,
            street: "104 Test Patient Avenue"
          }
        },
        actual: summarizeProfile(submittedProfile),
        context: {
          canonicalId: portalProfileAnchorPatientId,
          suite: "workflow-patient-portal-profile-change-request",
          workflow: "patient-portal-profile-change-submitted"
        }
      });

      const refreshedProfile = await workflow.getPatientPortalProfile(portalLoginUsername, portalPassword);
      expect(refreshedProfile.hasPendingProfileChanges).toBe(true);
      expect(refreshedProfile.pendingChange?.demographics).toMatchObject(profileChangeInput);
      expect(refreshedProfile.demographics.email).toBe(portalLoginUsername);
      expect(refreshedProfile.demographics.street).toBe("104 Test Patient Avenue");
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-251-patient-portal-profile-change-refreshed",
        description: "Captures the refreshed Slice 251 portal profile state after submission, proving the waiting review request persists while chart demographics remain unchanged.",
        expected: {
          hasPendingProfileChanges: true,
          pendingChangeDemographics: profileChangeInput,
          unchangedMedicalRecordDemographics: {
            email: portalLoginUsername,
            street: "104 Test Patient Avenue"
          }
        },
        actual: summarizeProfile(refreshedProfile),
        context: {
          canonicalId: portalProfileAnchorPatientId,
          suite: "workflow-patient-portal-profile-change-request",
          workflow: "patient-portal-profile-change-refreshed"
        }
      });

      if (target.type === "legacy-openemr") {
        const legacyUi = await expectLegacyPortalProfilePendingChange(page, target);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-251-patient-portal-profile-change-legacy-ui",
          description: "Captures the legacy portal profile pending-change rendering after Slice 251 submission.",
          expected: {
            urlIncludes: "/portal/get_profile.php",
            visibleFacts: [
              "Profile From Medical Records",
              "Edit Pending Changes."
            ]
          },
          actual: legacyUi,
          context: {
            canonicalId: portalProfileAnchorPatientId,
            suite: "workflow-patient-portal-profile-change-request",
            workflow: "patient-portal-profile-change-legacy-ui"
          }
        });
      } else {
        const modernizedUi = await expectModernizedPortalProfilePendingChange(page, target);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-251-patient-portal-profile-change-modernized-ui",
          description: "Captures the modernized Portal pending profile-change rendering after Slice 251 submission.",
          expected: {
            regionName: "Patient portal profile",
            visibleFacts: [
              "Profile From Medical Records",
              "Edit Pending Changes.",
              "Pending review",
              profileChangeInput.email,
              profileChangeInput.street,
              profileChangeInput.phoneHome,
              profileChangeInput.phoneCell
            ]
          },
          actual: modernizedUi,
          context: {
            canonicalId: portalProfileAnchorPatientId,
            suite: "workflow-patient-portal-profile-change-request",
            workflow: "patient-portal-profile-change-modernized-ui"
          }
        });
      }
    } finally {
      await workflow.cleanupPatientPortalProfileChange(portalLoginUsername, portalPassword);
      const afterCleanupProfile = await workflow.getPatientPortalProfile(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-251-patient-portal-profile-change-cleanup",
        description: "Captures the final Slice 251 cleanup state after removing any pending profile edit request.",
        expected: {
          hasPendingProfileChanges: false,
          pendingChange: null,
          restoredDemographics: {
            email: portalLoginUsername,
            street: "104 Test Patient Avenue"
          }
        },
        actual: summarizeProfile(afterCleanupProfile),
        context: {
          canonicalId: portalProfileAnchorPatientId,
          suite: "workflow-patient-portal-profile-change-request",
          workflow: "patient-portal-profile-change-cleanup"
        }
      });
      expect(afterCleanupProfile.hasPendingProfileChanges).toBe(false);
      expect(afterCleanupProfile.pendingChange).toBeNull();
      expect(afterCleanupProfile.demographics.email).toBe(portalLoginUsername);
      expect(afterCleanupProfile.demographics.street).toBe("104 Test Patient Avenue");
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
  return {
    url: page.url(),
    bodyText: await page.locator("body").innerText()
  };
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
  return {
    url: page.url(),
    regionText: await profileRegion.innerText()
  };
}

function summarizeProfile(profile: PatientPortalProfileResult) {
  return {
    authenticated: profile.authenticated,
    username: profile.username,
    portalUsername: profile.portalUsername,
    canonicalId: profile.canonicalId,
    pid: profile.pid,
    pubpid: profile.pubpid,
    displayName: profile.displayName,
    hasPendingProfileChanges: profile.hasPendingProfileChanges,
    failureReason: profile.failureReason,
    demographics: {
      email: profile.demographics.email,
      phoneHome: profile.demographics.phoneHome,
      phoneCell: profile.demographics.phoneCell,
      street: profile.demographics.street,
      city: profile.demographics.city,
      state: profile.demographics.state,
      postalCode: profile.demographics.postalCode
    },
    pendingChange: summarizePendingChange(profile.pendingChange)
  };
}

function summarizePendingChange(pendingChange: PatientPortalProfilePendingChange | null) {
  if (!pendingChange) {
    return null;
  }

  return {
    id: pendingChange.id,
    status: pendingChange.status,
    pendingAction: pendingChange.pendingAction,
    narrative: pendingChange.narrative,
    requestedAt: pendingChange.requestedAt,
    updatedAt: pendingChange.updatedAt,
    demographics: {
      email: pendingChange.demographics.email,
      phoneHome: pendingChange.demographics.phoneHome,
      phoneCell: pendingChange.demographics.phoneCell,
      street: pendingChange.demographics.street,
      city: pendingChange.demographics.city,
      state: pendingChange.demographics.state,
      postalCode: pendingChange.demographics.postalCode
    }
  };
}
