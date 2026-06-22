import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDemographicsEditDirect,
  openPatientSummaryDirect
} from "../../src/ui/legacyOpenEmr.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const employerAnchorPatientId = "MOD-PAT-0010";

type PatientChartEmployer = {
  pubpid: string;
  employerName?: string | null;
  employerStreet?: string | null;
  employerCity?: string | null;
  employerState?: string | null;
  employerPostalCode?: string | null;
  employerCountry?: string | null;
};

test.describe("patient employer core parity @slice197 @workflow-patient-employer-core @mutation @patients", () => {
  test("updates, renders, and restores patient employer details", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(employerAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientEmployer(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient employer record.");
    }

    const updated = {
      ...original,
      employerName: "Slice 197 Employer",
      employerStreet: "197 Employer Plaza",
      employerCity: "San Diego",
      employerState: "CA",
      employerPostalCode: "92197",
      employerCountry: "USA"
    };

    try {
      await workflow.updatePatientEmployer(updated);

      const actual = await workflow.getPatientEmployer(patient!.pid);
      expect(actual).toEqual(updated);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, patient!.lname);
        await openPatientDemographicsEditDirect(page, target, patient!.pid);
        await expectRenderedText(page, updated.employerName);
        await expectRenderedText(page, updated.employerStreet);
        await expectRenderedText(page, updated.employerCity);
        await expectRenderedText(page, /California|CA/);
        await expectRenderedText(page, updated.employerPostalCode);
        await expectRenderedText(page, updated.employerCountry);
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const chartResponse = await page.request.get(
          `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
          { headers }
        );
        expect(chartResponse.ok()).toBeTruthy();
        const chart = (await chartResponse.json()) as PatientChartEmployer;
        expect(chart).toMatchObject({
          pubpid: patient!.pubpid,
          employerName: updated.employerName,
          employerStreet: updated.employerStreet,
          employerCity: updated.employerCity,
          employerState: updated.employerState,
          employerPostalCode: updated.employerPostalCode,
          employerCountry: updated.employerCountry
        });

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Employer");
        await expect(page.locator("body")).toContainText(updated.employerName);
        await expect(page.locator("body")).toContainText(updated.employerStreet);
        await expect(page.locator("body")).toContainText(updated.employerCity);
        await expect(page.locator("body")).toContainText(updated.employerState);
        await expect(page.locator("body")).toContainText(updated.employerPostalCode);
        await expect(page.locator("body")).toContainText(updated.employerCountry);
      }
    } finally {
      await workflow.updatePatientEmployer(original);
    }

    const restored = await workflow.getPatientEmployer(patient!.pid);
    expect(restored).toEqual(original);
  });
});
