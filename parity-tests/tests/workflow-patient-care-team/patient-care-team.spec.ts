import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const careTeamAnchorPatientId = "MOD-PAT-0010";

type PatientChartCareTeam = {
  pubpid: string;
  careTeam?: {
    teamName: string;
    teamStatus: string;
    teamStatusDisplay: string;
    members: Array<{
      userId?: number | null;
      memberName?: string | null;
      role: string;
      roleDisplay: string;
      facilityId?: number | null;
      facilityName?: string | null;
      providerSince?: string | null;
      status: string;
      statusDisplay: string;
      note?: string | null;
    }>;
  } | null;
};

test.describe("patient care team parity @slice199 @workflow-patient-care-team @mutation @patients", () => {
  test("updates, renders, and restores patient care-team membership", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(careTeamAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientCareTeamAssignment(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient care team assignment.");
    }

    const updated = {
      ...original,
      teamName: "Care Team",
      teamStatus: "active",
      teamStatusDisplay: "Active",
      userId: 103,
      memberName: "Alex Chen",
      role: "primary_care_provider",
      roleDisplay: "Primary Care Provider",
      facilityId: 12,
      facilityName: "East County Care Center",
      providerSince: "2026-06-18",
      memberStatus: "active",
      memberStatusDisplay: "Active",
      note: "Slice 199 care coordination anchor"
    };

    try {
      await workflow.updatePatientCareTeamAssignment(updated);

      const actual = await workflow.getPatientCareTeamAssignment(patient!.pid);
      expect(actual).toEqual(updated);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, patient!.lname);
        await expectRenderedText(page, "Care Team");
        await expectRenderedText(page, "Chen, Alex");
        await expectRenderedText(page, "Primary Care Provider");
        await expectRenderedText(page, "East County Care Center");
        await expectRenderedText(page, "2026-06-18");
        await expectRenderedText(page, "Active");
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const chartResponse = await page.request.get(
          `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
          { headers }
        );
        expect(chartResponse.ok()).toBeTruthy();
        const chart = (await chartResponse.json()) as PatientChartCareTeam;
        expect(chart.pubpid).toBe(patient!.pubpid);
        expect(chart.careTeam).toMatchObject({
          teamName: "Care Team",
          teamStatus: "active",
          teamStatusDisplay: "Active"
        });
        expect(chart.careTeam?.members[0]).toMatchObject({
          userId: 103,
          memberName: "Alex Chen",
          role: "primary_care_provider",
          roleDisplay: "Primary Care Provider",
          facilityId: 12,
          facilityName: "East County Care Center",
          providerSince: "2026-06-18",
          status: "active",
          statusDisplay: "Active",
          note: "Slice 199 care coordination anchor"
        });

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Care Team");
        await expect(page.locator("body")).toContainText("Alex Chen");
        await expect(page.locator("body")).toContainText("Primary Care Provider");
        await expect(page.locator("body")).toContainText("East County Care Center");
        await expect(page.locator("body")).toContainText("2026-06-18");
        await expect(page.locator("body")).toContainText("Slice 199 care coordination anchor");
      }
    } finally {
      await workflow.updatePatientCareTeamAssignment(original);
    }

    const restored = await workflow.getPatientCareTeamAssignment(patient!.pid);
    expect(restored).toEqual(original);
  });
});
