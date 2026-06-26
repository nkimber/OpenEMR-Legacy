import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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
  }, testInfo) => {
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

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-199-patient-care-team-precondition",
      description: "Captures the Slice 199 care-team mutation precondition: anchor patient, original care-team assignment, and proposed temporary lead-member update.",
      expected: {
        anchorCanonicalId: careTeamAnchorPatientId,
        update: {
          teamName: updated.teamName,
          teamStatus: updated.teamStatus,
          userId: updated.userId,
          memberName: updated.memberName,
          role: updated.role,
          facilityId: updated.facilityId,
          facilityName: updated.facilityName,
          providerSince: updated.providerSince,
          memberStatus: updated.memberStatus,
          note: updated.note
        },
        cleanup: "Restore the original care-team assignment after verification."
      },
      actual: {
        patient,
        original,
        updated
      },
      context: {
        canonicalId: careTeamAnchorPatientId,
        suite: "workflow-patient-care-team",
        workflow: "patient-care-team-precondition"
      }
    });

    try {
      await workflow.updatePatientCareTeamAssignment(updated);

      const actual = await workflow.getPatientCareTeamAssignment(patient!.pid);
      expect(actual).toEqual(updated);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-199-patient-care-team-updated",
        description: "Captures the database/read-model state after applying the temporary Slice 199 care-team lead-member update.",
        expected: {
          teamName: updated.teamName,
          teamStatus: updated.teamStatus,
          memberName: updated.memberName,
          roleDisplay: updated.roleDisplay,
          facilityName: updated.facilityName,
          providerSince: updated.providerSince,
          memberStatus: updated.memberStatus,
          note: updated.note
        },
        actual: {
          patient,
          original,
          updated,
          actual
        },
        context: {
          canonicalId: careTeamAnchorPatientId,
          suite: "workflow-patient-care-team",
          workflow: "patient-care-team-updated"
        }
      });

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
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-199-patient-care-team-legacy-surface",
          description: "Captures the Slice 199 legacy UI evidence that OpenEMR patient summary renders the temporary care-team lead member.",
          expected: {
            patientLastNameVisible: patient!.lname,
            teamName: updated.teamName,
            memberName: "Chen, Alex",
            roleDisplay: updated.roleDisplay,
            facilityName: updated.facilityName,
            providerSince: updated.providerSince,
            statusDisplay: updated.memberStatusDisplay
          },
          actual: {
            patient,
            updated,
            surface: {
              patientSummaryReached: true,
              renderedFields: {
                lastName: patient!.lname,
                teamName: updated.teamName,
                memberName: "Chen, Alex",
                roleDisplay: updated.roleDisplay,
                facilityName: updated.facilityName,
                providerSince: updated.providerSince,
                statusDisplay: updated.memberStatusDisplay
              }
            }
          },
          context: {
            canonicalId: careTeamAnchorPatientId,
            suite: "workflow-patient-care-team",
            workflow: "patient-care-team-legacy-surface"
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
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-199-patient-care-team-modernized-api",
          description: "Captures the Slice 199 modernized patient chart API response after applying the temporary care-team lead-member update.",
          expected: {
            pubpid: patient!.pubpid,
            careTeam: {
              teamName: updated.teamName,
              teamStatus: updated.teamStatus,
              teamStatusDisplay: updated.teamStatusDisplay,
              member: {
                userId: updated.userId,
                memberName: updated.memberName,
                role: updated.role,
                roleDisplay: updated.roleDisplay,
                facilityId: updated.facilityId,
                facilityName: updated.facilityName,
                providerSince: updated.providerSince,
                status: updated.memberStatus,
                statusDisplay: updated.memberStatusDisplay,
                note: updated.note
              }
            }
          },
          actual: {
            status: chartResponse.status(),
            chart
          },
          context: {
            canonicalId: careTeamAnchorPatientId,
            suite: "workflow-patient-care-team",
            workflow: "patient-care-team-modernized-api"
          }
        });

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Care Team");
        await expect(page.locator("body")).toContainText("Alex Chen");
        await expect(page.locator("body")).toContainText("Primary Care Provider");
        await expect(page.locator("body")).toContainText("East County Care Center");
        await expect(page.locator("body")).toContainText("2026-06-18");
        await expect(page.locator("body")).toContainText("Slice 199 care coordination anchor");
        const careTeamPanelText = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-199-patient-care-team-modernized-surface",
          description: "Captures the Slice 199 modernized Patient/Client care-team rendering after the temporary lead-member update.",
          expected: {
            heading: patient!.lname,
            panelTextIncludes: [
              "Care Team",
              updated.memberName,
              updated.roleDisplay,
              updated.facilityName,
              updated.providerSince,
              updated.note
            ]
          },
          actual: {
            patient,
            careTeamPanelText
          },
          context: {
            canonicalId: careTeamAnchorPatientId,
            suite: "workflow-patient-care-team",
            workflow: "patient-care-team-modernized-surface"
          }
        });
      }
    } finally {
      await workflow.updatePatientCareTeamAssignment(original);
    }

    const restored = await workflow.getPatientCareTeamAssignment(patient!.pid);
    expect(restored).toEqual(original);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-199-patient-care-team-cleanup",
      description: "Captures the Slice 199 cleanup state after restoring the original care-team assignment.",
      expected: {
        restoredOriginal: original
      },
      actual: {
        patient,
        restored
      },
      context: {
        canonicalId: careTeamAnchorPatientId,
        suite: "workflow-patient-care-team",
        workflow: "patient-care-team-cleanup"
      }
    });
  });
});
