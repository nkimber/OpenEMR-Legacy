import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const careTeamContactAnchorPatientId = "MOD-PAT-0010";
const careTeamContactId = 3200010;

type PatientChartCareTeam = {
  pubpid: string;
  careTeam?: {
    teamName: string;
    teamStatus: string;
    teamStatusDisplay: string;
    members: Array<{
      userId?: number | null;
      contactId?: number | null;
      memberType: string;
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

test.describe("patient care team contact parity @slice201 @workflow-patient-care-team-contact @mutation @patients", () => {
  test("updates, renders, and restores patient-contact care team members", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(careTeamContactAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientCareTeamMembersAssignment(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient care team assignment.");
    }

    const updated = {
      ...original,
      teamName: "Family Care Team",
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
          note: "Slice 201 clinical lead"
        },
        {
          userId: null,
          contactId: careTeamContactId,
          memberType: "contact" as const,
          memberName: "Casey Brooks",
          role: "caregiver",
          roleDisplay: "Caregiver",
          facilityId: null,
          facilityName: "",
          providerSince: "2026-06-20",
          memberStatus: "active",
          memberStatusDisplay: "Active",
          note: "Slice 201 family caregiver"
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
        await expectRenderedText(page, "Family Care Team");
        await expectRenderedText(page, "Chen, Alex");
        await expectRenderedText(page, /Casey|Brooks/);
        await expectRenderedText(page, "Caregiver");
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
          teamName: "Family Care Team",
          teamStatus: "active",
          teamStatusDisplay: "Active"
        });
        expect(chart.careTeam?.members).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              userId: 103,
              memberType: "provider",
              memberName: "Alex Chen",
              role: "primary_care_provider",
              roleDisplay: "Primary Care Provider",
              facilityId: 12,
              facilityName: "East County Care Center",
              providerSince: "2026-06-18",
              status: "active",
              statusDisplay: "Active",
              note: "Slice 201 clinical lead"
            }),
            expect.objectContaining({
              userId: null,
              contactId: careTeamContactId,
              memberType: "contact",
              memberName: "Casey Brooks",
              role: "caregiver",
              roleDisplay: "Caregiver",
              facilityId: null,
              providerSince: "2026-06-20",
              status: "active",
              statusDisplay: "Active",
              note: "Slice 201 family caregiver"
            })
          ])
        );

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Family Care Team");
        await expect(page.locator("body")).toContainText("Alex Chen");
        await expect(page.locator("body")).toContainText("Casey Brooks");
        await expect(page.locator("body")).toContainText("Patient contact");
        await expect(page.locator("body")).toContainText("Caregiver");
        await expect(page.locator("body")).toContainText("Slice 201 family caregiver");
      }
    } finally {
      await workflow.updatePatientCareTeamMembersAssignment(original);
    }

    const restored = await workflow.getPatientCareTeamMembersAssignment(patient!.pid);
    expect(restored).toEqual(original);
  });
});
