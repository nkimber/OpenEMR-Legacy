import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
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
  }, testInfo) => {
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

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-194-patient-guardian-contact-precondition",
      description: "Captures the Slice 194 guardian-contact mutation precondition: anchor patient, original mother/guardian contact values, and proposed temporary update.",
      expected: {
        anchorCanonicalId: guardianContactAnchorPatientId,
        update: {
          motherName: updated.motherName,
          guardianName: updated.guardianName,
          guardianRelationship: updated.guardianRelationship,
          guardianPhone: updated.guardianPhone,
          guardianEmail: updated.guardianEmail
        },
        cleanup: "Restore the original mother and guardian contact fields after verification."
      },
      actual: {
        patient,
        original,
        updated
      },
      context: {
        canonicalId: guardianContactAnchorPatientId,
        suite: "workflow-patient-guardian-contact",
        workflow: "patient-guardian-contact-precondition"
      }
    });

    try {
      await workflow.updatePatientGuardianContact(updated);

      const actual = await workflow.getPatientGuardianContact(patient!.pid);
      expect(actual).toEqual(updated);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-194-patient-guardian-contact-updated",
        description: "Captures the database/read-model state after applying the temporary Slice 194 mother and guardian contact update.",
        expected: {
          motherName: updated.motherName,
          guardianName: updated.guardianName,
          guardianRelationship: updated.guardianRelationship,
          guardianPhone: updated.guardianPhone,
          guardianEmail: updated.guardianEmail
        },
        actual: {
          patient,
          original,
          updated,
          actual
        },
        context: {
          canonicalId: guardianContactAnchorPatientId,
          suite: "workflow-patient-guardian-contact",
          workflow: "patient-guardian-contact-updated"
        }
      });

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
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-194-patient-guardian-contact-legacy-surface",
          description: "Captures the Slice 194 legacy UI evidence that OpenEMR demographics edit renders the temporary mother and guardian contact values.",
          expected: {
            patientLastNameVisible: patient!.lname,
            motherName: updated.motherName,
            guardianName: updated.guardianName,
            guardianRelationshipLabel: "Guardian",
            guardianPhone: updated.guardianPhone,
            guardianEmail: updated.guardianEmail
          },
          actual: {
            patient,
            updated,
            surface: {
              patientSummaryReached: true,
              demographicsEditReached: true,
              renderedFields: {
                lastName: patient!.lname,
                motherName: updated.motherName,
                guardianName: updated.guardianName,
                guardianRelationship: "Guardian",
                guardianPhone: updated.guardianPhone,
                guardianEmail: updated.guardianEmail
              }
            }
          },
          context: {
            canonicalId: guardianContactAnchorPatientId,
            suite: "workflow-patient-guardian-contact",
            workflow: "patient-guardian-contact-legacy-surface"
          }
        });
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
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-194-patient-guardian-contact-modernized-api",
          description: "Captures the Slice 194 modernized patient chart API response after applying the temporary mother and guardian contact update.",
          expected: {
            pubpid: patient!.pubpid,
            motherName: updated.motherName,
            guardianName: updated.guardianName,
            guardianRelationship: updated.guardianRelationship,
            guardianPhone: updated.guardianPhone,
            guardianEmail: updated.guardianEmail
          },
          actual: {
            status: chartResponse.status(),
            chart
          },
          context: {
            canonicalId: guardianContactAnchorPatientId,
            suite: "workflow-patient-guardian-contact",
            workflow: "patient-guardian-contact-modernized-api"
          }
        });

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Guardian Contact");
        await expect(page.locator("body")).toContainText(updated.motherName);
        await expect(page.locator("body")).toContainText(updated.guardianName);
        await expect(page.locator("body")).toContainText("Guardian");
        await expect(page.locator("body")).toContainText(updated.guardianPhone);
        await expect(page.locator("body")).toContainText(updated.guardianEmail);
        const guardianPanelText = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-194-patient-guardian-contact-modernized-surface",
          description: "Captures the Slice 194 modernized Patient/Client Guardian Contact panel rendering after the temporary update.",
          expected: {
            heading: patient!.lname,
            panelTextIncludes: [
              "Guardian Contact",
              updated.motherName,
              updated.guardianName,
              "Guardian",
              updated.guardianPhone,
              updated.guardianEmail
            ]
          },
          actual: {
            patient,
            guardianPanelText
          },
          context: {
            canonicalId: guardianContactAnchorPatientId,
            suite: "workflow-patient-guardian-contact",
            workflow: "patient-guardian-contact-modernized-surface"
          }
        });
      }
    } finally {
      await workflow.updatePatientGuardianContact(original);
    }

    const restored = await workflow.getPatientGuardianContact(patient!.pid);
    expect(restored).toEqual(original);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-194-patient-guardian-contact-cleanup",
      description: "Captures the Slice 194 cleanup state after restoring the original mother and guardian contact values.",
      expected: {
        restoredOriginal: original
      },
      actual: {
        patient,
        restored
      },
      context: {
        canonicalId: guardianContactAnchorPatientId,
        suite: "workflow-patient-guardian-contact",
        workflow: "patient-guardian-contact-cleanup"
      }
    });
  });
});
