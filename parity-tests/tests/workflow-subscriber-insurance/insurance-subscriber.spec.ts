import { test, expect } from "../../src/fixtures/parityTest.js";
import type { Page } from "@playwright/test";
import type { RuntimeTarget } from "../../src/config/targets.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientInsuranceBrowseDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const insuranceSubscriberAnchorPatientId = "MOD-PAT-0005";

const expectedSecondarySubscriber = {
  type: "secondary",
  provider: "Acme Health",
  planName: "Family Choice",
  policyNumber: "SEC100005",
  groupNumber: "GRP204",
  relationship: "spouse",
  subscriberFirstName: "Jamie",
  subscriberMiddleName: "",
  subscriberLastName: "Morgan",
  subscriberDateOfBirth: "1976-05-05",
  subscriberSex: "Male",
  subscriberStreet: "2204 Mesa Partner Ave",
  subscriberStreetLine2: "",
  subscriberCity: "Poway",
  subscriberState: "CA",
  subscriberPostalCode: "92064",
  subscriberCountry: "US",
  subscriberPhone: "619-555-7004",
  subscriberEmployer: "Harbor Health Logistics",
  subscriberEmployerStreet: "4104 Benefits Way",
  subscriberEmployerStreetLine2: "",
  subscriberEmployerCity: "Poway",
  subscriberEmployerState: "CA",
  subscriberEmployerPostalCode: "92064",
  subscriberEmployerCountry: "US"
};

test.describe("patient insurance subscriber parity @slice203 @workflow-insurance-subscriber @mutation", () => {
  test("renders seeded subscriber details and captures subscriber updates", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(insuranceSubscriberAnchorPatientId);
    expect(patient).not.toBeNull();

    const coverage = await targetDb.getPatientInsuranceForPatient(patient!.pid);
    const secondary = coverage.insurance.find((item) => item.type === "secondary");
    expect(secondary).toMatchObject(expectedSecondarySubscriber);

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientInsuranceBrowseDirect(page, target, patient!.pid, "secondary");
      await expectRenderedText(page, expectedSecondarySubscriber.subscriberFirstName);
      await expectRenderedText(page, expectedSecondarySubscriber.subscriberLastName);
      await expectRenderedText(page, expectedSecondarySubscriber.subscriberStreet);
      await expectRenderedText(page, expectedSecondarySubscriber.subscriberPhone);
      await expectRenderedText(page, expectedSecondarySubscriber.subscriberEmployer);
    } else {
      await openModernizedPatientChart(page, target, patient!.pubpid);
      const insurancePanel = page.getByLabel("Insurance coverage", { exact: true });
      await expect(insurancePanel).toContainText("Jamie Morgan");
      await expect(insurancePanel).toContainText(expectedSecondarySubscriber.subscriberStreet);
      await expect(insurancePanel).toContainText(expectedSecondarySubscriber.subscriberPhone);
      await expect(insurancePanel).toContainText(expectedSecondarySubscriber.subscriberEmployer);
    }

    const suffix = workflowSuffix();
    const createdCoverage = {
      patientId: patient!.pid,
      type: "tertiary",
      provider: "Acme Health",
      planName: `Subscriber Bridge ${suffix}`,
      policyNumber: `SUB${suffix}`,
      groupNumber: `SGRP${suffix}`,
      relationship: "other",
      subscriberFirstName: "Taylor",
      subscriberMiddleName: "Q",
      subscriberLastName: "Coverage",
      subscriberDateOfBirth: "1982-03-14",
      subscriberSex: "Female",
      subscriberStreet: "77 Subscriber Plaza",
      subscriberStreetLine2: "Suite 3",
      subscriberCity: "San Diego",
      subscriberState: "CA",
      subscriberPostalCode: "92101",
      subscriberCountry: "US",
      subscriberPhone: "619-555-7788",
      subscriberEmployer: "Parity Subscriber Works",
      subscriberEmployerStreet: "88 Employer Row",
      subscriberEmployerStreetLine2: "",
      subscriberEmployerCity: "San Diego",
      subscriberEmployerState: "CA",
      subscriberEmployerPostalCode: "92101",
      subscriberEmployerCountry: "US"
    };
    const updatedCoverage = {
      ...createdCoverage,
      provider: "Northstar HMO",
      planName: `Subscriber Updated ${suffix}`,
      policyNumber: `SUBU${suffix}`,
      groupNumber: `SUGRP${suffix}`,
      subscriberFirstName: "Robin",
      subscriberMiddleName: "",
      subscriberLastName: "Updated",
      subscriberDateOfBirth: "1979-11-22",
      subscriberSex: "Male",
      subscriberStreet: "99 Updated Subscriber Lane",
      subscriberStreetLine2: "",
      subscriberCity: "Poway",
      subscriberState: "CA",
      subscriberPostalCode: "92064",
      subscriberPhone: "619-555-7799",
      subscriberEmployer: "Updated Subscriber Employer",
      subscriberEmployerStreet: "100 Updated Employer Way",
      subscriberEmployerCity: "Poway",
      subscriberEmployerPostalCode: "92064"
    };

    let insuranceId: number | string | null = null;
    try {
      insuranceId = await workflow.createPatientInsurance(createdCoverage);
      await expect(workflow.getPatientInsurance(insuranceId)).resolves.toMatchObject({
        ...createdCoverage
      });

      if (target.type === "legacy-openemr") {
        await openPatientInsuranceBrowseDirect(page, target, patient!.pid, "tertiary");
        await expectRenderedText(page, createdCoverage.policyNumber);
        await expectRenderedText(page, createdCoverage.subscriberFirstName);
        await expectRenderedText(page, createdCoverage.subscriberLastName);
        await expectRenderedText(page, createdCoverage.subscriberStreet);
        await expectRenderedText(page, createdCoverage.subscriberEmployer);
      } else {
        await openModernizedPatientChart(page, target, patient!.pubpid);
        const insurancePanel = page.getByLabel("Insurance coverage", { exact: true });
        await expect(insurancePanel).toContainText(createdCoverage.policyNumber);
        await expect(insurancePanel).toContainText("Taylor Q Coverage");
        await expect(insurancePanel).toContainText(createdCoverage.subscriberStreet);
        await expect(insurancePanel).toContainText(createdCoverage.subscriberEmployer);
      }

      await workflow.updatePatientInsurance(insuranceId, updatedCoverage);
      await expect(workflow.getPatientInsurance(insuranceId)).resolves.toMatchObject({
        ...updatedCoverage
      });

      if (target.type === "legacy-openemr") {
        await openPatientInsuranceBrowseDirect(page, target, patient!.pid, "tertiary");
        await expectRenderedText(page, updatedCoverage.policyNumber);
        await expectRenderedText(page, updatedCoverage.subscriberFirstName);
        await expectRenderedText(page, updatedCoverage.subscriberLastName);
        await expectRenderedText(page, updatedCoverage.subscriberStreet);
        await expectRenderedText(page, updatedCoverage.subscriberEmployer);
      } else {
        await openModernizedPatientChart(page, target, patient!.pubpid);
        const insurancePanel = page.getByLabel("Insurance coverage", { exact: true });
        await expect(insurancePanel).toContainText(updatedCoverage.policyNumber);
        await expect(insurancePanel).toContainText("Robin Updated");
        await expect(insurancePanel).toContainText(updatedCoverage.subscriberStreet);
        await expect(insurancePanel).toContainText(updatedCoverage.subscriberEmployer);
      }
    } finally {
      if (insuranceId !== null) {
        await workflow.deletePatientInsurance(insuranceId);
      }
    }

    if (insuranceId !== null) {
      await expect(workflow.getPatientInsurance(insuranceId)).resolves.toBeNull();
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
