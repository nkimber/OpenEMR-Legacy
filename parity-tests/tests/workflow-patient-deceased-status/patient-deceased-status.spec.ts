import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDemographicsEditDirect,
  openPatientSummaryDirect
} from "../../src/ui/legacyOpenEmr.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const deceasedStatusAnchorPatientId = "MOD-PAT-0010";

type PatientChartDeceasedStatus = {
  pubpid: string;
  deceasedDate?: string | null;
  deceasedReason?: string | null;
};

test.describe("patient deceased status parity @slice193 @workflow-patient-deceased-status @mutation @patients", () => {
  test("updates, renders, and restores patient deceased date and reason", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(deceasedStatusAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientDeceasedStatus(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient deceased-status record.");
    }

    const updated = {
      ...original,
      deceasedDate: "2026-06-21",
      deceasedReason: "Slice 193 parity deceased-status readiness"
    };

    try {
      await workflow.updatePatientDeceasedStatus(updated);

      const actual = await workflow.getPatientDeceasedStatus(patient!.pid);
      expect(actual).toEqual(updated);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, patient!.lname);
        await openPatientDemographicsEditDirect(page, target, patient!.pid);
        await expectRenderedText(page, updated.deceasedDate);
        await expectRenderedText(page, updated.deceasedReason);
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const chartResponse = await page.request.get(
          `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
          { headers }
        );
        expect(chartResponse.ok()).toBeTruthy();
        const chart = (await chartResponse.json()) as PatientChartDeceasedStatus;
        expect(chart).toMatchObject({
          pubpid: patient!.pubpid,
          deceasedDate: updated.deceasedDate,
          deceasedReason: updated.deceasedReason
        });

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Deceased Status");
        await expect(page.locator("body")).toContainText("Deceased");
        await expect(page.locator("body")).toContainText(updated.deceasedDate);
        await expect(page.locator("body")).toContainText(updated.deceasedReason);
      }
    } finally {
      await workflow.updatePatientDeceasedStatus(original);
    }

    const restored = await workflow.getPatientDeceasedStatus(patient!.pid);
    expect(restored).toEqual(original);
  });
});
