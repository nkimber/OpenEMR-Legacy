import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const careTeamMembersAnchorPatientId = "MOD-PAT-0010";

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

test.describe("patient care team members parity @slice200 @workflow-patient-care-team-members @mutation @patients", () => {
  test("updates, renders, and restores multi-member patient care teams", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(careTeamMembersAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientCareTeamMembersAssignment(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient care team members assignment.");
    }

    const updated = {
      ...original,
      teamName: "Care Team",
      teamStatus: "active",
      teamStatusDisplay: "Active",
      members: [
        {
          userId: 103,
          memberName: "Alex Chen",
          role: "primary_care_provider",
          roleDisplay: "Primary Care Provider",
          facilityId: 12,
          facilityName: "East County Care Center",
          providerSince: "2026-06-18",
          memberStatus: "active",
          memberStatusDisplay: "Active",
          note: "Slice 200 primary care coordinator"
        },
        {
          userId: 104,
          memberName: "Robin Morris",
          role: "case_manager",
          roleDisplay: "Case Manager",
          facilityId: 10,
          facilityName: "Modernization Family Medicine",
          providerSince: "2026-06-19",
          memberStatus: "active",
          memberStatusDisplay: "Active",
          note: "Slice 200 transition navigator"
        }
      ]
    };

    try {
      await workflow.updatePatientCareTeamMembersAssignment(updated);

      const actual = await workflow.getPatientCareTeamMembersAssignment(patient!.pid);
      expect(actual).toEqual(updated);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, patient!.lname);
        await expectRenderedText(page, "Care Team");
        await expectRenderedText(page, "Chen, Alex");
        await expectRenderedText(page, "Morris, Robin");
        await expectRenderedText(page, "Primary Care Provider");
        await expectRenderedText(page, "Case Manager");
        await expectRenderedText(page, "East County Care Center");
        await expectRenderedText(page, "Modernization Family Medicine");
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
        expect(chart.careTeam?.members).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              userId: 103,
              memberName: "Alex Chen",
              role: "primary_care_provider",
              roleDisplay: "Primary Care Provider",
              facilityId: 12,
              facilityName: "East County Care Center",
              providerSince: "2026-06-18",
              status: "active",
              statusDisplay: "Active",
              note: "Slice 200 primary care coordinator"
            }),
            expect.objectContaining({
              userId: 104,
              memberName: "Robin Morris",
              role: "case_manager",
              roleDisplay: "Case Manager",
              facilityId: 10,
              facilityName: "Modernization Family Medicine",
              providerSince: "2026-06-19",
              status: "active",
              statusDisplay: "Active",
              note: "Slice 200 transition navigator"
            })
          ])
        );

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Care Team");
        await expect(page.locator("body")).toContainText("Alex Chen");
        await expect(page.locator("body")).toContainText("Robin Morris");
        await expect(page.locator("body")).toContainText("Primary Care Provider");
        await expect(page.locator("body")).toContainText("Case Manager");
        await expect(page.locator("body")).toContainText("East County Care Center");
        await expect(page.locator("body")).toContainText("Modernization Family Medicine");
        await expect(page.locator("body")).toContainText("Slice 200 transition navigator");
      }
    } finally {
      await workflow.updatePatientCareTeamMembersAssignment(original);
    }

    const restored = await workflow.getPatientCareTeamMembersAssignment(patient!.pid);
    expect(restored).toEqual(original);
  });
});
