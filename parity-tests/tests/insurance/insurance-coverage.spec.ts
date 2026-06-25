import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientInsuranceBrowseDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const insuranceAnchorPatientId = "MOD-PAT-0005";

test.describe("patient insurance coverage parity @slice28 @insurance", () => {
  test("stable insurance anchor has primary and secondary coverage", async ({ target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(insuranceAnchorPatientId);
    expect(patient).not.toBeNull();

    const coverage = await targetDb.getPatientInsuranceForPatient(patient!.pid);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-28-insurance-coverage-anchor",
      description: "Verifies the Slice 28 insurance anchor patient and normalized primary/secondary coverage facts.",
      expected: {
        patient: {
          pubpid: insuranceAnchorPatientId
        },
        insurance: [
          {
            type: "primary",
            provider: "Northstar HMO",
            planName: "Medicare Advantage",
            policyNumber: "POL100005",
            groupNumber: "GRP104",
            relationship: "self"
          },
          {
            type: "secondary",
            provider: "Acme Health",
            planName: "Family Choice",
            policyNumber: "SEC100005",
            groupNumber: "GRP204",
            relationship: "spouse"
          }
        ]
      },
      actual: {
        patient,
        coverage
      },
      context: {
        canonicalId: insuranceAnchorPatientId,
        suite: "insurance",
        workflow: "patient-insurance-coverage"
      }
    });

    expect(coverage.patientId).toBe(patient!.pid);
    expect(coverage.insurance).toMatchObject([
      {
        type: "primary",
        provider: "Northstar HMO",
        planName: "Medicare Advantage",
        policyNumber: "POL100005",
        groupNumber: "GRP104",
        relationship: "self"
      },
      {
        type: "secondary",
        provider: "Acme Health",
        planName: "Family Choice",
        policyNumber: "SEC100005",
        groupNumber: "GRP204",
        relationship: "spouse"
      }
    ]);
  });

  test("insurance coverage is visible in the application UI", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(insuranceAnchorPatientId);
    expect(patient).not.toBeNull();

    const coverage = await targetDb.getPatientInsuranceForPatient(patient!.pid);
    const primary = coverage.insurance[0];
    const secondary = coverage.insurance[1];
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-28-insurance-ui-precondition",
      description: "Captures the Slice 28 primary and secondary insurance rows before steering legacy insurance browse screens or the modernized chart Insurance panel.",
      expected: {
        patient: {
          pubpid: insuranceAnchorPatientId,
          displayName: "Morgan, Elias"
        },
        visibleCoverage: [
          {
            type: "primary",
            provider: "Northstar HMO",
            planName: "Medicare Advantage",
            policyNumber: "POL100005",
            groupNumber: "GRP104"
          },
          {
            type: "secondary",
            provider: "Acme Health",
            planName: "Family Choice",
            policyNumber: "SEC100005",
            groupNumber: "GRP204"
          }
        ]
      },
      actual: {
        patient,
        coverage,
        primary,
        secondary
      },
      context: {
        canonicalId: insuranceAnchorPatientId,
        suite: "insurance",
        workflow: "patient-insurance-ui"
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientInsuranceBrowseDirect(page, target, patient!.pid, "primary");

      await expectRenderedText(page, "Insurance Provider");
      await expectRenderedText(page, primary.provider);
      await expectRenderedText(page, primary.planName);
      await expectRenderedText(page, primary.policyNumber);
      await expectRenderedText(page, primary.groupNumber);

      await openPatientInsuranceBrowseDirect(page, target, patient!.pid, "secondary");
      await expectRenderedText(page, secondary.provider);
      await expectRenderedText(page, secondary.planName);
      await expectRenderedText(page, secondary.policyNumber);
      await expectRenderedText(page, secondary.groupNumber);
      return;
    }

    await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);

    await expect(page.getByRole("button", { name: /Morgan, Elias/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Morgan, Elias" })).toBeVisible();

    const insurancePanel = page.getByLabel("Insurance coverage", { exact: true });
    await expect(insurancePanel).toContainText(primary.provider);
    await expect(insurancePanel).toContainText(primary.planName);
    await expect(insurancePanel).toContainText(primary.policyNumber);
    await expect(insurancePanel).toContainText(primary.groupNumber);
    await expect(insurancePanel).toContainText(secondary.provider);
    await expect(insurancePanel).toContainText(secondary.planName);
    await expect(insurancePanel).toContainText(secondary.policyNumber);
    await expect(insurancePanel).toContainText(secondary.groupNumber);
  });
});
