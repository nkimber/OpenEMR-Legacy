import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import type { Page } from "@playwright/test";
import type { RuntimeTarget } from "../../src/config/targets.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientInsuranceBrowseDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const insuranceMutationAnchorPatientId = "MOD-PAT-0005";

test.describe("patient insurance mutation parity @slice34 @workflow-insurance @mutation", () => {
  test("creates, renders, updates, and removes an insurance coverage row", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(insuranceMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCoverage = await targetDb.getPatientInsuranceForPatient(patient!.pid);
    const suffix = workflowSuffix();
    const createdCoverage = {
      patientId: patient!.pid,
      type: "tertiary",
      provider: "Acme Health",
      planName: `Parity Bridge ${suffix}`,
      policyNumber: `PAR${suffix}`,
      groupNumber: `PGRP${suffix}`,
      relationship: "self"
    };
    const updatedCoverage = {
      ...createdCoverage,
      provider: "Northstar HMO",
      planName: `Parity Updated ${suffix}`,
      policyNumber: `UPD${suffix}`,
      groupNumber: `UGRP${suffix}`
    };
    let insuranceId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-34-insurance-mutation-precondition",
        description: "Captures the Slice 34 insurance mutation anchor patient, baseline coverage rows, and proposed temporary tertiary insurance payloads before create.",
        expected: {
          patient: {
            pubpid: insuranceMutationAnchorPatientId,
            displayName: "Morgan, Elias"
          },
          baseline: {
            coverageTypes: ["primary", "secondary"],
            createDelta: 1,
            cleanupDeltaFromBaseline: 0
          },
          proposedCoverage: {
            create: {
              type: "tertiary",
              provider: "Acme Health",
              planNamePrefix: "Parity Bridge ",
              policyNumberPrefix: "PAR",
              groupNumberPrefix: "PGRP",
              relationship: "self"
            },
            update: {
              type: "tertiary",
              provider: "Northstar HMO",
              planNamePrefix: "Parity Updated ",
              policyNumberPrefix: "UPD",
              groupNumberPrefix: "UGRP",
              relationship: "self"
            }
          }
        },
        actual: {
          patient,
          beforeCoverage,
          createdCoverage,
          updatedCoverage
        },
        context: {
          canonicalId: insuranceMutationAnchorPatientId,
          suite: "workflow-insurance",
          workflow: "patient-insurance-mutation"
        }
      });

      insuranceId = await workflow.createPatientInsurance(createdCoverage);
      const created = await workflow.getPatientInsurance(insuranceId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        type: createdCoverage.type,
        provider: createdCoverage.provider,
        planName: createdCoverage.planName,
        policyNumber: createdCoverage.policyNumber,
        groupNumber: createdCoverage.groupNumber,
        relationship: createdCoverage.relationship
      });

      const afterCreateCoverage = await targetDb.getPatientInsuranceForPatient(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-34-insurance-mutation-created",
        description: "Captures the temporary Slice 34 tertiary insurance row and coverage-count increment immediately after create.",
        expected: {
          createdCoverage,
          countChange: {
            insurance: beforeCoverage.insurance.length + 1
          }
        },
        actual: {
          insuranceId,
          created,
          beforeCoverage,
          afterCreateCoverage
        },
        context: {
          canonicalId: insuranceMutationAnchorPatientId,
          suite: "workflow-insurance",
          workflow: "patient-insurance-mutation-created"
        }
      });
      expect(afterCreateCoverage.insurance).toHaveLength(beforeCoverage.insurance.length + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientInsuranceBrowseDirect(page, target, patient!.pid, "tertiary");
        await expectRenderedText(page, createdCoverage.provider);
        await expectRenderedText(page, createdCoverage.planName);
        await expectRenderedText(page, createdCoverage.policyNumber);
        await expectRenderedText(page, createdCoverage.groupNumber);
      } else {
        await openModernizedPatientChart(page, target, patient!.pubpid);
        const insurancePanel = page.getByLabel("Insurance coverage", { exact: true });
        await expect(insurancePanel).toContainText(createdCoverage.provider);
        await expect(insurancePanel).toContainText(createdCoverage.planName);
        await expect(insurancePanel).toContainText(createdCoverage.policyNumber);
        await expect(insurancePanel).toContainText(createdCoverage.groupNumber);
        await expect(page.getByLabel("Insurance coverage form")).toBeVisible();
      }

      await workflow.updatePatientInsurance(insuranceId, updatedCoverage);
      const updated = await workflow.getPatientInsurance(insuranceId);
      expect(updated).toMatchObject({
        patientId: patient!.pid,
        type: updatedCoverage.type,
        provider: updatedCoverage.provider,
        planName: updatedCoverage.planName,
        policyNumber: updatedCoverage.policyNumber,
        groupNumber: updatedCoverage.groupNumber,
        relationship: updatedCoverage.relationship
      });

      const afterUpdateCoverage = await targetDb.getPatientInsuranceForPatient(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-34-insurance-mutation-updated",
        description: "Captures the temporary Slice 34 tertiary insurance row after payer, plan, policy, and group updates.",
        expected: {
          updatedCoverage,
          countChange: {
            insurance: beforeCoverage.insurance.length + 1
          }
        },
        actual: {
          insuranceId,
          updated,
          beforeCoverage,
          afterUpdateCoverage
        },
        context: {
          canonicalId: insuranceMutationAnchorPatientId,
          suite: "workflow-insurance",
          workflow: "patient-insurance-mutation-updated"
        }
      });
      expect(afterUpdateCoverage.insurance).toHaveLength(beforeCoverage.insurance.length + 1);

      if (target.type === "legacy-openemr") {
        await openPatientInsuranceBrowseDirect(page, target, patient!.pid, "tertiary");
        await expectRenderedText(page, updatedCoverage.provider);
        await expectRenderedText(page, updatedCoverage.planName);
        await expectRenderedText(page, updatedCoverage.policyNumber);
        await expectRenderedText(page, updatedCoverage.groupNumber);
      } else {
        await openModernizedPatientChart(page, target, patient!.pubpid);
        const insurancePanel = page.getByLabel("Insurance coverage", { exact: true });
        await expect(insurancePanel).toContainText(updatedCoverage.provider);
        await expect(insurancePanel).toContainText(updatedCoverage.planName);
        await expect(insurancePanel).toContainText(updatedCoverage.policyNumber);
        await expect(insurancePanel).toContainText(updatedCoverage.groupNumber);
      }
    } finally {
      if (insuranceId !== null) {
        await workflow.deletePatientInsurance(insuranceId);
      }
    }

    const afterCleanupCoverage = await targetDb.getPatientInsuranceForPatient(patient!.pid);
    expect(afterCleanupCoverage.insurance).toHaveLength(beforeCoverage.insurance.length);
    if (insuranceId !== null) {
      const afterCleanup = await workflow.getPatientInsurance(insuranceId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-34-insurance-mutation-cleanup",
        description: "Captures the final Slice 34 hard-delete cleanup state for the temporary tertiary insurance row.",
        expected: {
          deletedCoverage: null,
          countChange: {
            insurance: beforeCoverage.insurance.length
          }
        },
        actual: {
          insuranceId,
          afterCleanup,
          beforeCoverage,
          afterCleanupCoverage
        },
        context: {
          canonicalId: insuranceMutationAnchorPatientId,
          suite: "workflow-insurance",
          workflow: "patient-insurance-mutation-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

async function openModernizedPatientChart(page: Page, target: RuntimeTarget, pubpid: string) {
  await openAuthenticatedModernizedPatient(page, target, pubpid);
  await expect(page.getByRole("heading", { name: "Morgan, Elias" })).toBeVisible();
}

function workflowSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 100000)}`;
}
