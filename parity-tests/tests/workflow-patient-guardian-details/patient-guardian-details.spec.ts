import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDemographicsEditDirect,
  openPatientSummaryDirect
} from "../../src/ui/legacyOpenEmr.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const guardianDetailsAnchorPatientId = "MOD-PAT-0010";

type PatientChartGuardianDetails = {
  pubpid: string;
  motherName?: string | null;
  guardianName?: string | null;
  guardianRelationship?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  guardianSex?: string | null;
  guardianAddress?: string | null;
  guardianCity?: string | null;
  guardianState?: string | null;
  guardianPostalCode?: string | null;
  guardianCountry?: string | null;
  guardianWorkPhone?: string | null;
};

test.describe("patient guardian demographic/address parity @slice195 @workflow-patient-guardian-details @mutation @patients", () => {
  test("updates, renders, and restores patient guardian demographic and address fields", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(guardianDetailsAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientGuardianContact(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient guardian-details record.");
    }

    const updated = {
      ...original,
      motherName: "Slice 195 Mother Detail",
      guardianName: "Slice 195 Guardian Detail",
      guardianRelationship: "guardian",
      guardianPhone: "(619) 555-1950",
      guardianEmail: "slice195.guardian@example.test",
      guardianSex: "Female",
      guardianAddress: "195 Guardian Way",
      guardianCity: "Chula Vista",
      guardianState: "California",
      guardianPostalCode: "91910",
      guardianCountry: "USA",
      guardianWorkPhone: "(619) 555-1951"
    };

    try {
      await workflow.updatePatientGuardianContact(updated);

      const actual = await workflow.getPatientGuardianContact(patient!.pid);
      expect(actual).toEqual(updated);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, patient!.lname);
        await openPatientDemographicsEditDirect(page, target, patient!.pid);
        await expectRenderedText(page, updated.motherName);
        await expectRenderedText(page, updated.guardianName);
        await expectRenderedText(page, "Guardian");
        await expectRenderedText(page, "Female");
        await expectRenderedText(page, updated.guardianAddress);
        await expectRenderedText(page, updated.guardianCity);
        await expectRenderedText(page, updated.guardianState);
        await expectRenderedText(page, updated.guardianPostalCode);
        await expectRenderedText(page, updated.guardianCountry);
        await expectRenderedText(page, updated.guardianPhone);
        await expectRenderedText(page, updated.guardianWorkPhone);
        await expectRenderedText(page, updated.guardianEmail);
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const chartResponse = await page.request.get(
          `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
          { headers }
        );
        expect(chartResponse.ok()).toBeTruthy();
        const chart = (await chartResponse.json()) as PatientChartGuardianDetails;
        expect(chart).toMatchObject({
          pubpid: patient!.pubpid,
          motherName: updated.motherName,
          guardianName: updated.guardianName,
          guardianRelationship: updated.guardianRelationship,
          guardianPhone: updated.guardianPhone,
          guardianEmail: updated.guardianEmail,
          guardianSex: updated.guardianSex,
          guardianAddress: updated.guardianAddress,
          guardianCity: updated.guardianCity,
          guardianState: updated.guardianState,
          guardianPostalCode: updated.guardianPostalCode,
          guardianCountry: updated.guardianCountry,
          guardianWorkPhone: updated.guardianWorkPhone
        });

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Guardian Contact");
        await expect(page.locator("body")).toContainText(updated.motherName);
        await expect(page.locator("body")).toContainText(updated.guardianName);
        await expect(page.locator("body")).toContainText("Guardian");
        await expect(page.locator("body")).toContainText("Female");
        await expect(page.locator("body")).toContainText(updated.guardianAddress);
        await expect(page.locator("body")).toContainText(updated.guardianCity);
        await expect(page.locator("body")).toContainText(updated.guardianState);
        await expect(page.locator("body")).toContainText(updated.guardianPostalCode);
        await expect(page.locator("body")).toContainText(updated.guardianCountry);
        await expect(page.locator("body")).toContainText(updated.guardianPhone);
        await expect(page.locator("body")).toContainText(updated.guardianWorkPhone);
        await expect(page.locator("body")).toContainText(updated.guardianEmail);
      }
    } finally {
      await workflow.updatePatientGuardianContact(original);
    }

    const restored = await workflow.getPatientGuardianContact(patient!.pid);
    expect(restored).toEqual(original);
  });
});
