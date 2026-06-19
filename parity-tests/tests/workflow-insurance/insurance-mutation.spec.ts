import { test, expect } from "../../src/fixtures/parityTest.js";
import type { Page } from "@playwright/test";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientInsuranceBrowseDirect } from "../../src/ui/legacyOpenEmr.js";

const insuranceMutationAnchorPatientId = "MOD-PAT-0005";

test.describe("patient insurance mutation parity @slice34 @workflow-insurance @mutation", () => {
  test("creates, renders, updates, and removes an insurance coverage row", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
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
      expect(afterCreateCoverage.insurance).toHaveLength(beforeCoverage.insurance.length + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientInsuranceBrowseDirect(page, target, patient!.pid, "tertiary");
        await expectRenderedText(page, createdCoverage.provider);
        await expectRenderedText(page, createdCoverage.planName);
        await expectRenderedText(page, createdCoverage.policyNumber);
        await expectRenderedText(page, createdCoverage.groupNumber);
      } else {
        await openModernizedPatientChart(page, target.publicUrl, patient!.pubpid);
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

      if (target.type === "legacy-openemr") {
        await openPatientInsuranceBrowseDirect(page, target, patient!.pid, "tertiary");
        await expectRenderedText(page, updatedCoverage.provider);
        await expectRenderedText(page, updatedCoverage.planName);
        await expectRenderedText(page, updatedCoverage.policyNumber);
        await expectRenderedText(page, updatedCoverage.groupNumber);
      } else {
        await openModernizedPatientChart(page, target.publicUrl, patient!.pubpid);
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
      await expect(workflow.getPatientInsurance(insuranceId)).resolves.toBeNull();
    }
  });
});

async function openModernizedPatientChart(page: Page, publicUrl: string, pubpid: string) {
  await page.goto(publicUrl);
  await expect(page.getByRole("heading", { name: "Patient/Client" })).toBeVisible();
  await page.getByLabel("Search patients").fill(pubpid);
  await expect(page.getByRole("heading", { name: "Morgan, Elias" })).toBeVisible();
}

function workflowSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 100000)}`;
}
