import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDemographicsEditDirect,
  openPatientSummaryDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const demographicsAnchorPatientId = "MOD-PAT-0010";

test.describe("patient demographics mutation parity @slice36 @workflow-demographics @mutation", () => {
  test("updates, renders, and restores patient demographic data", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(demographicsAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientDemographics(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient demographics record.");
    }

    const updated = {
      ...original,
      firstName: "Morgan",
      lastName: "Parity",
      preferredName: "Slice36",
      sex: original.sex === "Female" ? "Male" : "Female",
      dateOfBirth: "1984-03-12",
      street: "36 Parity Way",
      city: "Bridgeport",
      state: "CT",
      postalCode: "06460",
      maritalStatus: "married",
      occupation: "Workflow Analyst"
    };

    try {
      await workflow.updatePatientDemographics(updated);

      const actual = await workflow.getPatientDemographics(patient!.pid);
      expect(actual).toEqual(updated);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);

        await expectRenderedText(page, updated.firstName);
        await expectRenderedText(page, updated.lastName);
        await openPatientDemographicsEditDirect(page, target, patient!.pid);
        await expectRenderedText(page, updated.preferredName);
        await expectRenderedText(page, updated.street);
        await expectRenderedText(page, updated.city);
        await expectRenderedText(page, updated.postalCode);
      } else {
        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);

        await expect(page.getByRole("heading", { name: /Parity, Morgan/ })).toBeVisible();
        await expect(page.locator("body")).toContainText(updated.dateOfBirth);
        await expect(page.locator("body")).toContainText(updated.street);
        await expect(page.locator("body")).toContainText(updated.city);
        await expect(page.locator("body")).toContainText(updated.occupation);
        await expect(page.locator("body")).toContainText("Marital status");
      }
    } finally {
      await workflow.updatePatientDemographics(original);
    }

    const restored = await workflow.getPatientDemographics(patient!.pid);
    expect(restored).toEqual(original);
  });
});
