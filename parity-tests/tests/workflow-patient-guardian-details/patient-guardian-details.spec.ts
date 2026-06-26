import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDemographicsEditDirect,
  openPatientSummaryDirect
} from "../../src/ui/legacyOpenEmr.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const guardianDetailsAnchorPatientId = "MOD-PAT-0010";

type PatientChartGuardianDetails = {
  pubpid: string;
  motherName?: string | null;
  guardianName?: string | null;
  guardianRelationship?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  guardianSex?: string | null;
  guardianAddress?: string | null;
  guardianCity?: string | null;
  guardianState?: string | null;
  guardianPostalCode?: string | null;
  guardianCountry?: string | null;
  guardianWorkPhone?: string | null;
};

test.describe("patient guardian demographic/address parity @slice195 @workflow-patient-guardian-details @mutation @patients", () => {
  test("updates, renders, and restores patient guardian demographic and address fields", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(guardianDetailsAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientGuardianContact(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient guardian-details record.");
    }

    const updated = {
      ...original,
      motherName: "Slice 195 Mother Detail",
      guardianName: "Slice 195 Guardian Detail",
      guardianRelationship: "guardian",
      guardianPhone: "(619) 555-1950",
      guardianEmail: "slice195.guardian@example.test",
      guardianSex: "Female",
      guardianAddress: "195 Guardian Way",
      guardianCity: "Chula Vista",
      guardianState: "California",
      guardianPostalCode: "91910",
      guardianCountry: "USA",
      guardianWorkPhone: "(619) 555-1951"
    };

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-195-patient-guardian-details-precondition",
      description: "Captures the Slice 195 guardian demographic/address mutation precondition: anchor patient, original guardian details, and proposed temporary update.",
      expected: {
        anchorCanonicalId: guardianDetailsAnchorPatientId,
        update: {
          motherName: updated.motherName,
          guardianName: updated.guardianName,
          guardianRelationship: updated.guardianRelationship,
          guardianPhone: updated.guardianPhone,
          guardianEmail: updated.guardianEmail,
          guardianSex: updated.guardianSex,
          guardianAddress: updated.guardianAddress,
          guardianCity: updated.guardianCity,
          guardianState: updated.guardianState,
          guardianPostalCode: updated.guardianPostalCode,
          guardianCountry: updated.guardianCountry,
          guardianWorkPhone: updated.guardianWorkPhone
        },
        cleanup: "Restore the original guardian demographic and address fields after verification."
      },
      actual: {
        patient,
        original,
        updated
      },
      context: {
        canonicalId: guardianDetailsAnchorPatientId,
        suite: "workflow-patient-guardian-details",
        workflow: "patient-guardian-details-precondition"
      }
    });

    try {
      await workflow.updatePatientGuardianContact(updated);

      const actual = await workflow.getPatientGuardianContact(patient!.pid);
      expect(actual).toEqual(updated);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-195-patient-guardian-details-updated",
        description: "Captures the database/read-model state after applying the temporary Slice 195 guardian demographic and address update.",
        expected: {
          motherName: updated.motherName,
          guardianName: updated.guardianName,
          guardianRelationship: updated.guardianRelationship,
          guardianPhone: updated.guardianPhone,
          guardianEmail: updated.guardianEmail,
          guardianSex: updated.guardianSex,
          guardianAddress: updated.guardianAddress,
          guardianCity: updated.guardianCity,
          guardianState: updated.guardianState,
          guardianPostalCode: updated.guardianPostalCode,
          guardianCountry: updated.guardianCountry,
          guardianWorkPhone: updated.guardianWorkPhone
        },
        actual: {
          patient,
          original,
          updated,
          actual
        },
        context: {
          canonicalId: guardianDetailsAnchorPatientId,
          suite: "workflow-patient-guardian-details",
          workflow: "patient-guardian-details-updated"
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
        await expectRenderedText(page, "Female");
        await expectRenderedText(page, updated.guardianAddress);
        await expectRenderedText(page, updated.guardianCity);
        await expectRenderedText(page, updated.guardianState);
        await expectRenderedText(page, updated.guardianPostalCode);
        await expectRenderedText(page, updated.guardianCountry);
        await expectRenderedText(page, updated.guardianPhone);
        await expectRenderedText(page, updated.guardianWorkPhone);
        await expectRenderedText(page, updated.guardianEmail);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-195-patient-guardian-details-legacy-surface",
          description: "Captures the Slice 195 legacy UI evidence that OpenEMR demographics edit renders the temporary guardian demographic/address values.",
          expected: {
            patientLastNameVisible: patient!.lname,
            motherName: updated.motherName,
            guardianName: updated.guardianName,
            guardianRelationshipLabel: "Guardian",
            guardianSex: "Female",
            guardianAddress: updated.guardianAddress,
            guardianCity: updated.guardianCity,
            guardianState: updated.guardianState,
            guardianPostalCode: updated.guardianPostalCode,
            guardianCountry: updated.guardianCountry,
            guardianPhone: updated.guardianPhone,
            guardianWorkPhone: updated.guardianWorkPhone,
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
                guardianSex: "Female",
                guardianAddress: updated.guardianAddress,
                guardianCity: updated.guardianCity,
                guardianState: updated.guardianState,
                guardianPostalCode: updated.guardianPostalCode,
                guardianCountry: updated.guardianCountry,
                guardianPhone: updated.guardianPhone,
                guardianWorkPhone: updated.guardianWorkPhone,
                guardianEmail: updated.guardianEmail
              }
            }
          },
          context: {
            canonicalId: guardianDetailsAnchorPatientId,
            suite: "workflow-patient-guardian-details",
            workflow: "patient-guardian-details-legacy-surface"
          }
        });
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const chartResponse = await page.request.get(
          `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
          { headers }
        );
        expect(chartResponse.ok()).toBeTruthy();
        const chart = (await chartResponse.json()) as PatientChartGuardianDetails;
        expect(chart).toMatchObject({
          pubpid: patient!.pubpid,
          motherName: updated.motherName,
          guardianName: updated.guardianName,
          guardianRelationship: updated.guardianRelationship,
          guardianPhone: updated.guardianPhone,
          guardianEmail: updated.guardianEmail,
          guardianSex: updated.guardianSex,
          guardianAddress: updated.guardianAddress,
          guardianCity: updated.guardianCity,
          guardianState: updated.guardianState,
          guardianPostalCode: updated.guardianPostalCode,
          guardianCountry: updated.guardianCountry,
          guardianWorkPhone: updated.guardianWorkPhone
        });
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-195-patient-guardian-details-modernized-api",
          description: "Captures the Slice 195 modernized patient chart API response after applying the temporary guardian demographic/address update.",
          expected: {
            pubpid: patient!.pubpid,
            motherName: updated.motherName,
            guardianName: updated.guardianName,
            guardianRelationship: updated.guardianRelationship,
            guardianPhone: updated.guardianPhone,
            guardianEmail: updated.guardianEmail,
            guardianSex: updated.guardianSex,
            guardianAddress: updated.guardianAddress,
            guardianCity: updated.guardianCity,
            guardianState: updated.guardianState,
            guardianPostalCode: updated.guardianPostalCode,
            guardianCountry: updated.guardianCountry,
            guardianWorkPhone: updated.guardianWorkPhone
          },
          actual: {
            status: chartResponse.status(),
            chart
          },
          context: {
            canonicalId: guardianDetailsAnchorPatientId,
            suite: "workflow-patient-guardian-details",
            workflow: "patient-guardian-details-modernized-api"
          }
        });

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Guardian Contact");
        await expect(page.locator("body")).toContainText(updated.motherName);
        await expect(page.locator("body")).toContainText(updated.guardianName);
        await expect(page.locator("body")).toContainText("Guardian");
        await expect(page.locator("body")).toContainText("Female");
        await expect(page.locator("body")).toContainText(updated.guardianAddress);
        await expect(page.locator("body")).toContainText(updated.guardianCity);
        await expect(page.locator("body")).toContainText(updated.guardianState);
        await expect(page.locator("body")).toContainText(updated.guardianPostalCode);
        await expect(page.locator("body")).toContainText(updated.guardianCountry);
        await expect(page.locator("body")).toContainText(updated.guardianPhone);
        await expect(page.locator("body")).toContainText(updated.guardianWorkPhone);
        await expect(page.locator("body")).toContainText(updated.guardianEmail);
        const guardianPanelText = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-195-patient-guardian-details-modernized-surface",
          description: "Captures the Slice 195 modernized Patient/Client Guardian Contact panel rendering after the temporary demographic/address update.",
          expected: {
            heading: patient!.lname,
            panelTextIncludes: [
              "Guardian Contact",
              updated.motherName,
              updated.guardianName,
              "Guardian",
              "Female",
              updated.guardianAddress,
              updated.guardianCity,
              updated.guardianState,
              updated.guardianPostalCode,
              updated.guardianCountry,
              updated.guardianPhone,
              updated.guardianWorkPhone,
              updated.guardianEmail
            ]
          },
          actual: {
            patient,
            guardianPanelText
          },
          context: {
            canonicalId: guardianDetailsAnchorPatientId,
            suite: "workflow-patient-guardian-details",
            workflow: "patient-guardian-details-modernized-surface"
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
      probe: "slice-195-patient-guardian-details-cleanup",
      description: "Captures the Slice 195 cleanup state after restoring the original guardian demographic and address values.",
      expected: {
        restoredOriginal: original
      },
      actual: {
        patient,
        restored
      },
      context: {
        canonicalId: guardianDetailsAnchorPatientId,
        suite: "workflow-patient-guardian-details",
        workflow: "patient-guardian-details-cleanup"
      }
    });
  });
});
