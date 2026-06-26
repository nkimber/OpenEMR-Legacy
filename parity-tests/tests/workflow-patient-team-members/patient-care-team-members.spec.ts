import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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
  }, testInfo) => {
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

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-200-patient-care-team-members-precondition",
      description: "Captures the Slice 200 multi-member care-team mutation precondition: anchor patient, original team members, and proposed temporary two-member update.",
      expected: {
        anchorCanonicalId: careTeamMembersAnchorPatientId,
        update: {
          teamName: updated.teamName,
          teamStatus: updated.teamStatus,
          members: updated.members
        },
        cleanup: "Restore the original multi-member care-team assignment after verification."
      },
      actual: {
        patient,
        original,
        updated
      },
      context: {
        canonicalId: careTeamMembersAnchorPatientId,
        suite: "workflow-patient-care-team-members",
        workflow: "patient-care-team-members-precondition"
      }
    });

    try {
      await workflow.updatePatientCareTeamMembersAssignment(updated);

      const actual = await workflow.getPatientCareTeamMembersAssignment(patient!.pid);
      expect(actual).toEqual(updated);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-200-patient-care-team-members-updated",
        description: "Captures the database/read-model state after applying the temporary Slice 200 two-member care-team update.",
        expected: {
          teamName: updated.teamName,
          teamStatus: updated.teamStatus,
          memberCount: 2,
          members: updated.members.map((member) => ({
            memberName: member.memberName,
            roleDisplay: member.roleDisplay,
            facilityName: member.facilityName,
            providerSince: member.providerSince,
            memberStatus: member.memberStatus,
            note: member.note
          }))
        },
        actual: {
          patient,
          original,
          updated,
          actual
        },
        context: {
          canonicalId: careTeamMembersAnchorPatientId,
          suite: "workflow-patient-care-team-members",
          workflow: "patient-care-team-members-updated"
        }
      });

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
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-200-patient-care-team-members-legacy-surface",
          description: "Captures the Slice 200 legacy UI evidence that OpenEMR patient summary renders the temporary two-member care team.",
          expected: {
            patientLastNameVisible: patient!.lname,
            teamName: updated.teamName,
            renderedMembers: [
              {
                memberName: "Chen, Alex",
                roleDisplay: "Primary Care Provider",
                facilityName: "East County Care Center"
              },
              {
                memberName: "Morris, Robin",
                roleDisplay: "Case Manager",
                facilityName: "Modernization Family Medicine"
              }
            ]
          },
          actual: {
            patient,
            updated,
            surface: {
              patientSummaryReached: true,
              renderedFields: {
                lastName: patient!.lname,
                teamName: updated.teamName,
                memberNames: ["Chen, Alex", "Morris, Robin"],
                roleDisplays: ["Primary Care Provider", "Case Manager"],
                facilityNames: ["East County Care Center", "Modernization Family Medicine"]
              }
            }
          },
          context: {
            canonicalId: careTeamMembersAnchorPatientId,
            suite: "workflow-patient-care-team-members",
            workflow: "patient-care-team-members-legacy-surface"
          }
        });
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
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-200-patient-care-team-members-modernized-api",
          description: "Captures the Slice 200 modernized patient chart API response after applying the temporary two-member care-team update.",
          expected: {
            pubpid: patient!.pubpid,
            careTeam: {
              teamName: updated.teamName,
              teamStatus: updated.teamStatus,
              teamStatusDisplay: updated.teamStatusDisplay,
              members: updated.members.map((member) => ({
                userId: member.userId,
                memberName: member.memberName,
                role: member.role,
                roleDisplay: member.roleDisplay,
                facilityId: member.facilityId,
                facilityName: member.facilityName,
                providerSince: member.providerSince,
                status: member.memberStatus,
                statusDisplay: member.memberStatusDisplay,
                note: member.note
              }))
            }
          },
          actual: {
            status: chartResponse.status(),
            chart
          },
          context: {
            canonicalId: careTeamMembersAnchorPatientId,
            suite: "workflow-patient-care-team-members",
            workflow: "patient-care-team-members-modernized-api"
          }
        });

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
        const careTeamPanelText = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-200-patient-care-team-members-modernized-surface",
          description: "Captures the Slice 200 modernized Patient/Client care-team rendering after the temporary two-member update.",
          expected: {
            heading: patient!.lname,
            panelTextIncludes: [
              "Care Team",
              "Alex Chen",
              "Robin Morris",
              "Primary Care Provider",
              "Case Manager",
              "East County Care Center",
              "Modernization Family Medicine",
              "Slice 200 transition navigator"
            ]
          },
          actual: {
            patient,
            careTeamPanelText
          },
          context: {
            canonicalId: careTeamMembersAnchorPatientId,
            suite: "workflow-patient-care-team-members",
            workflow: "patient-care-team-members-modernized-surface"
          }
        });
      }
    } finally {
      await workflow.updatePatientCareTeamMembersAssignment(original);
    }

    const restored = await workflow.getPatientCareTeamMembersAssignment(patient!.pid);
    expect(restored).toEqual(original);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-200-patient-care-team-members-cleanup",
      description: "Captures the Slice 200 cleanup state after restoring the original multi-member care-team assignment.",
      expected: {
        restoredOriginal: original
      },
      actual: {
        patient,
        restored
      },
      context: {
        canonicalId: careTeamMembersAnchorPatientId,
        suite: "workflow-patient-care-team-members",
        workflow: "patient-care-team-members-cleanup"
      }
    });
  });
});
