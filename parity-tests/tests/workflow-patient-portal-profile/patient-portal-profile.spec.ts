import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type {
  PatientPortalProfileInsurance,
  PatientPortalProfileResult
} from "../../src/workflows/legacyWorkflowActions.js";
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
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalProfileAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-250-patient-portal-profile-precondition",
      description: "Captures the Slice 250 portal profile precondition: the signed-in portal anchor patient exists before projecting demographics and insurance facts.",
      expected: {
        canonicalId: portalProfileAnchorPatientId,
        portalUsername: portalLoginUsername,
        displayName: "Kim, Nora"
      },
      actual: {
        patient
      },
      context: {
        canonicalId: portalProfileAnchorPatientId,
        suite: "workflow-patient-portal-profile",
        workflow: "patient-portal-profile-precondition"
      }
    });

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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-250-patient-portal-profile-result",
      description: "Captures the Slice 250 authenticated portal profile projection, including medical-record demographics and primary/secondary insurance facts.",
      expected: {
        authenticated: true,
        canonicalId: portalProfileAnchorPatientId,
        displayName: "Kim, Nora",
        hasPendingProfileChanges: false,
        demographics: {
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
        },
        insurance: [
          {
            type: "primary",
            provider: "Evergreen PPO",
            planName: "Community HMO",
            policyNumber: "POL100004",
            groupNumber: "GRP103",
            subscriberName: "Nora Kim",
            subscriberRelationship: "self",
            subscriberDateOfBirth: "2002-05-05"
          },
          {
            type: "secondary",
            provider: "Harbor Mutual",
            planName: "Standard Silver",
            policyNumber: "SEC100004",
            groupNumber: "GRP203",
            subscriberName: "Casey Kim",
            subscriberRelationship: "spouse",
            subscriberDateOfBirth: "1975-04-04"
          }
        ]
      },
      actual: summarizeProfile(profile),
      context: {
        canonicalId: portalProfileAnchorPatientId,
        suite: "workflow-patient-portal-profile",
        workflow: "patient-portal-profile-result"
      }
    });

    if (target.type === "legacy-openemr") {
      const legacyUi = await expectLegacyPortalProfile(page, target);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-250-patient-portal-profile-legacy-ui",
        description: "Captures the legacy portal Profile From Medical Records rendering for Slice 250 demographics and insurance facts.",
        expected: {
          urlIncludes: "/portal/get_profile.php",
          visibleFacts: [
            "Profile From Medical Records",
            "Nora",
            "Kim",
            portalLoginUsername,
            "Community HMO",
            "Standard Silver",
            "POL100004",
            "SEC100004"
          ]
        },
        actual: legacyUi,
        context: {
          canonicalId: portalProfileAnchorPatientId,
          suite: "workflow-patient-portal-profile",
          workflow: "patient-portal-profile-legacy-ui"
        }
      });
    } else {
      const modernizedUi = await expectModernizedPortalProfile(page, target);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-250-patient-portal-profile-modernized-ui",
        description: "Captures the modernized Portal profile region rendering for Slice 250 demographics and insurance facts.",
        expected: {
          regionName: "Patient portal profile",
          visibleFacts: [
            "Profile From Medical Records",
            "Nora Kim",
            "2002-05-05",
            portalLoginUsername,
            "104 Test Patient Avenue",
            "Avery Kim",
            "Jordan Kim",
            "Community HMO",
            "Standard Silver",
            "POL100004",
            "SEC100004"
          ]
        },
        actual: modernizedUi,
        context: {
          canonicalId: portalProfileAnchorPatientId,
          suite: "workflow-patient-portal-profile",
          workflow: "patient-portal-profile-modernized-ui"
        }
      });
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
  return {
    url: page.url(),
    bodyText: await page.locator("body").innerText()
  };
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
    insuranceCount: profile.insuranceCount,
    failureReason: profile.failureReason,
    demographics: profile.demographics,
    insurance: profile.insurance.map(summarizeInsurance)
  };
}

function summarizeInsurance(insurance: PatientPortalProfileInsurance) {
  return {
    type: insurance.type,
    provider: insurance.provider,
    planName: insurance.planName,
    policyNumber: insurance.policyNumber,
    groupNumber: insurance.groupNumber,
    subscriberName: insurance.subscriberName,
    subscriberRelationship: insurance.subscriberRelationship,
    subscriberDateOfBirth: insurance.subscriberDateOfBirth
  };
}
