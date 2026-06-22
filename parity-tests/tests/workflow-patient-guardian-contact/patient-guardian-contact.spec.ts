import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDemographicsEditDirect,
  openPatientSummaryDirect
} from "../../src/ui/legacyOpenEmr.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const guardianContactAnchorPatientId = "MOD-PAT-0010";

type PatientChartGuardianContact = {
  pubpid: string;
  motherName?: string | null;
  guardianName?: string | null;
  guardianRelationship?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
};

test.describe("patient guardian contact parity @slice194 @workflow-patient-guardian-contact @mutation @patients", () => {
  test("updates, renders, and restores patient guardian contact fields", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(guardianContactAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientGuardianContact(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient guardian-contact record.");
    }

    const updated = {
      ...original,
      motherName: "Slice 194 Mother Contact",
      guardianName: "Slice 194 Guardian Contact",
      guardianRelationship: "guardian",
      guardianPhone: "(619) 555-1944",
      guardianEmail: "slice194.guardian@example.test"
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
        await expectRenderedText(page, updated.guardianPhone);
        await expectRenderedText(page, updated.guardianEmail);
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const chartResponse = await page.request.get(
          `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
          { headers }
        );
        expect(chartResponse.ok()).toBeTruthy();
        const chart = (await chartResponse.json()) as PatientChartGuardianContact;
        expect(chart).toMatchObject({
          pubpid: patient!.pubpid,
          motherName: updated.motherName,
          guardianName: updated.guardianName,
          guardianRelationship: updated.guardianRelationship,
          guardianPhone: updated.guardianPhone,
          guardianEmail: updated.guardianEmail
        });

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Guardian Contact");
        await expect(page.locator("body")).toContainText(updated.motherName);
        await expect(page.locator("body")).toContainText(updated.guardianName);
        await expect(page.locator("body")).toContainText("Guardian");
        await expect(page.locator("body")).toContainText(updated.guardianPhone);
        await expect(page.locator("body")).toContainText(updated.guardianEmail);
      }
    } finally {
      await workflow.updatePatientGuardianContact(original);
    }

    const restored = await workflow.getPatientGuardianContact(patient!.pid);
    expect(restored).toEqual(original);
  });
});
