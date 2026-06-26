import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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
  }, testInfo) => {
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

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-201-patient-care-team-contact-precondition",
      description: "Captures the Slice 201 contact-backed care-team mutation precondition: anchor patient, original care-team members, and proposed provider plus patient-contact update.",
      expected: {
        anchorCanonicalId: careTeamContactAnchorPatientId,
        contactId: careTeamContactId,
        update: {
          teamName: updated.teamName,
          teamStatus: updated.teamStatus,
          members: updated.members
        },
        cleanup: "Restore the original care-team members after contact-backed verification."
      },
      actual: {
        patient,
        original,
        updated
      },
      context: {
        canonicalId: careTeamContactAnchorPatientId,
        suite: "workflow-patient-care-team-contact",
        workflow: "patient-care-team-contact-precondition"
      }
    });

    try {
      await workflow.updatePatientCareTeamMembersAssignment(updated);

      const actual = await workflow.getPatientCareTeamMembersAssignment(patient!.pid);
      expect(actual).toEqual(updated);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-201-patient-care-team-contact-updated",
        description: "Captures the database/read-model state after applying the temporary Slice 201 provider plus patient-contact care-team update.",
        expected: {
          teamName: updated.teamName,
          teamStatus: updated.teamStatus,
          memberCount: 2,
          contactId: careTeamContactId,
          members: updated.members.map((member) => ({
            userId: member.userId,
            contactId: member.contactId ?? null,
            memberType: member.memberType ?? "provider",
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
          canonicalId: careTeamContactAnchorPatientId,
          suite: "workflow-patient-care-team-contact",
          workflow: "patient-care-team-contact-updated"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, patient!.lname);
        await expectRenderedText(page, "Family Care Team");
        await expectRenderedText(page, "Chen, Alex");
        await expectRenderedText(page, /Casey|Brooks/);
        await expectRenderedText(page, "Caregiver");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-201-patient-care-team-contact-legacy-surface",
          description: "Captures the Slice 201 legacy UI evidence that OpenEMR patient summary renders the temporary provider and contact care-team members.",
          expected: {
            patientLastNameVisible: patient!.lname,
            teamName: updated.teamName,
            providerMemberName: "Chen, Alex",
            contactMemberNamePattern: "Casey|Brooks",
            contactRoleDisplay: "Caregiver"
          },
          actual: {
            patient,
            updated,
            surface: {
              patientSummaryReached: true,
              renderedFields: {
                lastName: patient!.lname,
                teamName: updated.teamName,
                providerMemberName: "Chen, Alex",
                contactMemberName: "Casey Brooks",
                contactRoleDisplay: "Caregiver"
              }
            }
          },
          context: {
            canonicalId: careTeamContactAnchorPatientId,
            suite: "workflow-patient-care-team-contact",
            workflow: "patient-care-team-contact-legacy-surface"
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
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-201-patient-care-team-contact-modernized-api",
          description: "Captures the Slice 201 modernized patient chart API response after applying the temporary provider plus patient-contact care-team update.",
          expected: {
            pubpid: patient!.pubpid,
            careTeam: {
              teamName: updated.teamName,
              teamStatus: updated.teamStatus,
              teamStatusDisplay: updated.teamStatusDisplay,
              members: updated.members.map((member) => ({
                userId: member.userId,
                contactId: member.contactId ?? null,
                memberType: member.memberType ?? "provider",
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
            canonicalId: careTeamContactAnchorPatientId,
            suite: "workflow-patient-care-team-contact",
            workflow: "patient-care-team-contact-modernized-api"
          }
        });

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Family Care Team");
        await expect(page.locator("body")).toContainText("Alex Chen");
        await expect(page.locator("body")).toContainText("Casey Brooks");
        await expect(page.locator("body")).toContainText("Patient contact");
        await expect(page.locator("body")).toContainText("Caregiver");
        await expect(page.locator("body")).toContainText("Slice 201 family caregiver");
        const careTeamPanelText = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-201-patient-care-team-contact-modernized-surface",
          description: "Captures the Slice 201 modernized Patient/Client care-team rendering after the temporary provider plus patient-contact update.",
          expected: {
            heading: patient!.lname,
            panelTextIncludes: [
              "Family Care Team",
              "Alex Chen",
              "Casey Brooks",
              "Patient contact",
              "Caregiver",
              "Slice 201 family caregiver"
            ]
          },
          actual: {
            patient,
            careTeamPanelText
          },
          context: {
            canonicalId: careTeamContactAnchorPatientId,
            suite: "workflow-patient-care-team-contact",
            workflow: "patient-care-team-contact-modernized-surface"
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
      probe: "slice-201-patient-care-team-contact-cleanup",
      description: "Captures the Slice 201 cleanup state after restoring the original provider/contact care-team members.",
      expected: {
        restoredOriginal: original
      },
      actual: {
        patient,
        restored
      },
      context: {
        canonicalId: careTeamContactAnchorPatientId,
        suite: "workflow-patient-care-team-contact",
        workflow: "patient-care-team-contact-cleanup"
      }
    });
  });
});
