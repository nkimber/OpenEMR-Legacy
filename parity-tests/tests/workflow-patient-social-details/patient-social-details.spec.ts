import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDemographicsEditDirect,
  openPatientSummaryDirect
} from "../../src/ui/legacyOpenEmr.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const socialDetailsAnchorPatientId = "MOD-PAT-0010";

type PatientChartSocialDetails = {
  pubpid: string;
  race?: string | null;
  ethnicity?: string | null;
  interpreter?: string | null;
  familySize?: string | null;
  monthlyIncome?: string | null;
  homeless?: string | null;
  financialReviewDate?: string | null;
};

test.describe("patient social detail parity @slice196 @workflow-patient-social-details @mutation @patients", () => {
  test("updates, renders, and restores patient social and demographic detail fields", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(socialDetailsAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientDemographics(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient demographics record.");
    }

    const updated = {
      ...original,
      race: "Asian",
      ethnicity: "Hispanic or Latino",
      interpreter: "Slice 196 interpreter requested",
      familySize: "4",
      monthlyIncome: "4196",
      homeless: "YES",
      financialReviewDate: "2026-02-15"
    };

    try {
      await workflow.updatePatientDemographics(updated);

      const actual = await workflow.getPatientDemographics(patient!.pid);
      expect(actual).toEqual(updated);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, patient!.lname);
        await openPatientDemographicsEditDirect(page, target, patient!.pid);
        await expectRenderedText(page, updated.race);
        await expectRenderedText(page, updated.ethnicity);
        await expectRenderedText(page, updated.interpreter);
        await expectRenderedText(page, updated.familySize);
        await expectRenderedText(page, updated.monthlyIncome);
        await expectRenderedText(page, /Yes|YES/);
        await expectRenderedText(page, updated.financialReviewDate);
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const chartResponse = await page.request.get(
          `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
          { headers }
        );
        expect(chartResponse.ok()).toBeTruthy();
        const chart = (await chartResponse.json()) as PatientChartSocialDetails;
        expect(chart).toMatchObject({
          pubpid: patient!.pubpid,
          race: updated.race,
          ethnicity: updated.ethnicity,
          interpreter: updated.interpreter,
          familySize: updated.familySize,
          monthlyIncome: updated.monthlyIncome,
          homeless: updated.homeless,
          financialReviewDate: updated.financialReviewDate
        });

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Demographics");
        await expect(page.locator("body")).toContainText(updated.race);
        await expect(page.locator("body")).toContainText(updated.ethnicity);
        await expect(page.locator("body")).toContainText(updated.interpreter);
        await expect(page.locator("body")).toContainText("Family size");
        await expect(page.locator("body")).toContainText(updated.familySize);
        await expect(page.locator("body")).toContainText("Monthly income");
        await expect(page.locator("body")).toContainText(updated.monthlyIncome);
        await expect(page.locator("body")).toContainText("Homeless");
        await expect(page.locator("body")).toContainText("Yes");
        await expect(page.locator("body")).toContainText(updated.financialReviewDate);
      }
    } finally {
      await workflow.updatePatientDemographics(original);
    }

    const restored = await workflow.getPatientDemographics(patient!.pid);
    expect(restored).toEqual(original);
  });
});
