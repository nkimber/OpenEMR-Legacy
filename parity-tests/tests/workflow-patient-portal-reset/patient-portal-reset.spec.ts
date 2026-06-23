import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDemographicsEditDirect
} from "../../src/ui/legacyOpenEmr.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const portalResetAnchorPatientId = "MOD-PAT-0004";

type PatientChartPortalReset = {
  pubpid: string;
  portalAccount?: {
    passwordStatus?: number | null;
    passwordStatusLabel: string;
    oneTimeLinkPending: boolean;
    resetStatusLabel: string;
  } | null;
};

test.describe("patient portal reset parity @slice205 @workflow-patient-portal-reset @mutation @patients", () => {
  test("issues, renders, and clears patient portal one-time reset state", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(portalResetAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientPortalAccountResetState(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient portal account reset state.");
    }

    expect(original).toMatchObject({
      passwordStatus: 1,
      passwordStatusLabel: "Patient-managed password",
      oneTimeLinkPending: false,
      resetStatusLabel: "No reset pending"
    });

    const issued = {
      ...original,
      passwordStatus: 0,
      passwordStatusLabel: "Temporary password issued",
      oneTimeLinkPending: true,
      resetStatusLabel: "One-time reset pending"
    };
    const cleared = {
      ...original,
      passwordStatus: 1,
      passwordStatusLabel: "Patient-managed password",
      oneTimeLinkPending: false,
      resetStatusLabel: "No reset pending"
    };

    try {
      await workflow.updatePatientPortalAccountResetState(issued);
      await expect(workflow.getPatientPortalAccountResetState(patient!.pid)).resolves.toEqual(issued);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDemographicsEditDirect(page, target, patient!.pid);
        await expectRenderedText(page, patient!.pubpid);
        await expectRenderedText(page, "mod-pat-0004@example.test");
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const issuedChartResponse = await page.request.get(
          `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
          { headers }
        );
        expect(issuedChartResponse.ok()).toBeTruthy();
        const issuedChart = (await issuedChartResponse.json()) as PatientChartPortalReset;
        expect(issuedChart.portalAccount).toMatchObject({
          passwordStatus: 0,
          passwordStatusLabel: "Temporary password issued",
          oneTimeLinkPending: true,
          resetStatusLabel: "One-time reset pending"
        });

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Portal Account");
        await expect(page.locator("body")).toContainText("Temporary password issued");
        await expect(page.locator("body")).toContainText("One-time reset pending");
        await expect(page.getByRole("button", { name: "Clear portal reset" })).toBeVisible();
      }

      await workflow.updatePatientPortalAccountResetState(cleared);
      await expect(workflow.getPatientPortalAccountResetState(patient!.pid)).resolves.toEqual(cleared);

      if (target.type !== "legacy-openemr") {
        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.locator("body")).toContainText("Patient-managed password");
        await expect(page.locator("body")).toContainText("No reset pending");
        await expect(page.getByRole("button", { name: "Issue portal reset" })).toBeVisible();
      }
    } finally {
      await workflow.updatePatientPortalAccountResetState(original);
    }

    const restored = await workflow.getPatientPortalAccountResetState(patient!.pid);
    expect(restored).toEqual(original);
  });
});
