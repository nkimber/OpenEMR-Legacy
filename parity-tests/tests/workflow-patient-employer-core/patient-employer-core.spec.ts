import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDemographicsEditDirect,
  openPatientSummaryDirect
} from "../../src/ui/legacyOpenEmr.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const employerAnchorPatientId = "MOD-PAT-0010";

type PatientChartEmployer = {
  pubpid: string;
  employerName?: string | null;
  employerStreet?: string | null;
  employerCity?: string | null;
  employerState?: string | null;
  employerPostalCode?: string | null;
  employerCountry?: string | null;
};

test.describe("patient employer core parity @slice197 @workflow-patient-employer-core @mutation @patients", () => {
  test("updates, renders, and restores patient employer details", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(employerAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientEmployer(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient employer record.");
    }

    const updated = {
      ...original,
      employerName: "Slice 197 Employer",
      employerStreet: "197 Employer Plaza",
      employerCity: "San Diego",
      employerState: "CA",
      employerPostalCode: "92197",
      employerCountry: "USA"
    };

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-197-patient-employer-core-precondition",
      description: "Captures the Slice 197 employer mutation precondition: anchor patient, original employer values, and proposed temporary employer identity/address update.",
      expected: {
        anchorCanonicalId: employerAnchorPatientId,
        update: {
          employerName: updated.employerName,
          employerStreet: updated.employerStreet,
          employerCity: updated.employerCity,
          employerState: updated.employerState,
          employerPostalCode: updated.employerPostalCode,
          employerCountry: updated.employerCountry
        },
        cleanup: "Restore the original employer identity and address values after verification."
      },
      actual: {
        patient,
        original,
        updated
      },
      context: {
        canonicalId: employerAnchorPatientId,
        suite: "workflow-patient-employer-core",
        workflow: "patient-employer-core-precondition"
      }
    });

    try {
      await workflow.updatePatientEmployer(updated);

      const actual = await workflow.getPatientEmployer(patient!.pid);
      expect(actual).toEqual(updated);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-197-patient-employer-core-updated",
        description: "Captures the database/read-model state after applying the temporary Slice 197 employer identity/address update.",
        expected: {
          employerName: updated.employerName,
          employerStreet: updated.employerStreet,
          employerCity: updated.employerCity,
          employerState: updated.employerState,
          employerPostalCode: updated.employerPostalCode,
          employerCountry: updated.employerCountry
        },
        actual: {
          patient,
          original,
          updated,
          actual
        },
        context: {
          canonicalId: employerAnchorPatientId,
          suite: "workflow-patient-employer-core",
          workflow: "patient-employer-core-updated"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, patient!.lname);
        await openPatientDemographicsEditDirect(page, target, patient!.pid);
        await expectRenderedText(page, updated.employerName);
        await expectRenderedText(page, updated.employerStreet);
        await expectRenderedText(page, updated.employerCity);
        await expectRenderedText(page, /California|CA/);
        await expectRenderedText(page, updated.employerPostalCode);
        await expectRenderedText(page, updated.employerCountry);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-197-patient-employer-core-legacy-surface",
          description: "Captures the Slice 197 legacy UI evidence that OpenEMR demographics edit renders the temporary employer identity/address values.",
          expected: {
            patientLastNameVisible: patient!.lname,
            employerName: updated.employerName,
            employerStreet: updated.employerStreet,
            employerCity: updated.employerCity,
            employerStateLabel: "California",
            employerPostalCode: updated.employerPostalCode,
            employerCountry: updated.employerCountry
          },
          actual: {
            patient,
            updated,
            surface: {
              patientSummaryReached: true,
              demographicsEditReached: true,
              renderedFields: {
                lastName: patient!.lname,
                employerName: updated.employerName,
                employerStreet: updated.employerStreet,
                employerCity: updated.employerCity,
                employerState: "California",
                employerPostalCode: updated.employerPostalCode,
                employerCountry: updated.employerCountry
              }
            }
          },
          context: {
            canonicalId: employerAnchorPatientId,
            suite: "workflow-patient-employer-core",
            workflow: "patient-employer-core-legacy-surface"
          }
        });
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const chartResponse = await page.request.get(
          `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
          { headers }
        );
        expect(chartResponse.ok()).toBeTruthy();
        const chart = (await chartResponse.json()) as PatientChartEmployer;
        expect(chart).toMatchObject({
          pubpid: patient!.pubpid,
          employerName: updated.employerName,
          employerStreet: updated.employerStreet,
          employerCity: updated.employerCity,
          employerState: updated.employerState,
          employerPostalCode: updated.employerPostalCode,
          employerCountry: updated.employerCountry
        });
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-197-patient-employer-core-modernized-api",
          description: "Captures the Slice 197 modernized patient chart API response after applying the temporary employer identity/address update.",
          expected: {
            pubpid: patient!.pubpid,
            employerName: updated.employerName,
            employerStreet: updated.employerStreet,
            employerCity: updated.employerCity,
            employerState: updated.employerState,
            employerPostalCode: updated.employerPostalCode,
            employerCountry: updated.employerCountry
          },
          actual: {
            status: chartResponse.status(),
            chart
          },
          context: {
            canonicalId: employerAnchorPatientId,
            suite: "workflow-patient-employer-core",
            workflow: "patient-employer-core-modernized-api"
          }
        });

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Employer");
        await expect(page.locator("body")).toContainText(updated.employerName);
        await expect(page.locator("body")).toContainText(updated.employerStreet);
        await expect(page.locator("body")).toContainText(updated.employerCity);
        await expect(page.locator("body")).toContainText(updated.employerState);
        await expect(page.locator("body")).toContainText(updated.employerPostalCode);
        await expect(page.locator("body")).toContainText(updated.employerCountry);
        const employerPanelText = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-197-patient-employer-core-modernized-surface",
          description: "Captures the Slice 197 modernized Patient/Client employer rendering after the temporary employer identity/address update.",
          expected: {
            heading: patient!.lname,
            panelTextIncludes: [
              "Employer",
              updated.employerName,
              updated.employerStreet,
              updated.employerCity,
              updated.employerState,
              updated.employerPostalCode,
              updated.employerCountry
            ]
          },
          actual: {
            patient,
            employerPanelText
          },
          context: {
            canonicalId: employerAnchorPatientId,
            suite: "workflow-patient-employer-core",
            workflow: "patient-employer-core-modernized-surface"
          }
        });
      }
    } finally {
      await workflow.updatePatientEmployer(original);
    }

    const restored = await workflow.getPatientEmployer(patient!.pid);
    expect(restored).toEqual(original);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-197-patient-employer-core-cleanup",
      description: "Captures the Slice 197 cleanup state after restoring the original employer identity/address values.",
      expected: {
        restoredOriginal: original
      },
      actual: {
        patient,
        restored
      },
      context: {
        canonicalId: employerAnchorPatientId,
        suite: "workflow-patient-employer-core",
        workflow: "patient-employer-core-cleanup"
      }
    });
  });
});
