import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDemographicsEditDirect,
  openPatientSummaryDirect
} from "../../src/ui/legacyOpenEmr.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const providerAssignmentAnchorPatientId = "MOD-PAT-0010";
const targetProviderId = 103;
const targetProviderName = "Alex Chen";

type PatientChartProviderAssignment = {
  pubpid: string;
  providerId?: number | null;
  primaryProviderName?: string | null;
};

test.describe("patient provider assignment parity @slice198 @workflow-patient-provider-assignment @mutation @patients", () => {
  test("updates, renders, and restores patient primary provider assignment", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(providerAssignmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientProviderAssignment(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient provider assignment.");
    }

    const updated = {
      ...original,
      providerId: targetProviderId,
      providerName: targetProviderName
    };

    try {
      await workflow.updatePatientProviderAssignment(updated);

      const actual = await workflow.getPatientProviderAssignment(patient!.pid);
      expect(actual).toEqual(updated);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, patient!.lname);
        await openPatientDemographicsEditDirect(page, target, patient!.pid);
        await expectRenderedText(page, patient!.pubpid);
        await expectRenderedText(page, targetProviderName);
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const chartResponse = await page.request.get(
          `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
          { headers }
        );
        expect(chartResponse.ok()).toBeTruthy();
        const chart = (await chartResponse.json()) as PatientChartProviderAssignment;
        expect(chart).toMatchObject({
          pubpid: patient!.pubpid,
          providerId: targetProviderId,
          primaryProviderName: targetProviderName
        });

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Primary Provider");
        await expect(page.locator("body")).toContainText(targetProviderName);
        await expect(page.locator("body")).toContainText(String(targetProviderId));
      }
    } finally {
      await workflow.updatePatientProviderAssignment(original);
    }

    const restored = await workflow.getPatientProviderAssignment(patient!.pid);
    expect(restored).toEqual(original);
  });
});
