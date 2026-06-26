import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDemographicsEditDirect,
  openPatientSummaryDirect
} from "../../src/ui/legacyOpenEmr.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const providerAssignmentAnchorPatientId = "MOD-PAT-0010";
const targetProviderId = 103;
const targetProviderName = "Alex Chen";

type PatientChartProviderAssignment = {
  pubpid: string;
  providerId?: number | null;
  primaryProviderName?: string | null;
};

test.describe("patient provider assignment parity @slice198 @workflow-patient-provider-assignment @mutation @patients", () => {
  test("updates, renders, and restores patient primary provider assignment", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(providerAssignmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientProviderAssignment(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient provider assignment.");
    }

    const updated = {
      ...original,
      providerId: targetProviderId,
      providerName: targetProviderName
    };

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-198-patient-provider-assignment-precondition",
      description: "Captures the Slice 198 provider-assignment mutation precondition: anchor patient, original primary provider assignment, and proposed temporary provider update.",
      expected: {
        anchorCanonicalId: providerAssignmentAnchorPatientId,
        update: {
          providerId: targetProviderId,
          providerName: targetProviderName
        },
        cleanup: "Restore the original primary provider assignment after verification."
      },
      actual: {
        patient,
        original,
        updated
      },
      context: {
        canonicalId: providerAssignmentAnchorPatientId,
        suite: "workflow-patient-provider-assignment",
        workflow: "patient-provider-assignment-precondition"
      }
    });

    try {
      await workflow.updatePatientProviderAssignment(updated);

      const actual = await workflow.getPatientProviderAssignment(patient!.pid);
      expect(actual).toEqual(updated);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-198-patient-provider-assignment-updated",
        description: "Captures the database/read-model state after applying the temporary Slice 198 primary-provider assignment update.",
        expected: {
          providerId: targetProviderId,
          providerName: targetProviderName
        },
        actual: {
          patient,
          original,
          updated,
          actual
        },
        context: {
          canonicalId: providerAssignmentAnchorPatientId,
          suite: "workflow-patient-provider-assignment",
          workflow: "patient-provider-assignment-updated"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, patient!.lname);
        await openPatientDemographicsEditDirect(page, target, patient!.pid);
        await expectRenderedText(page, patient!.pubpid);
        await expectRenderedText(page, targetProviderName);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-198-patient-provider-assignment-legacy-surface",
          description: "Captures the Slice 198 legacy UI evidence that OpenEMR demographics edit renders the temporary primary provider assignment.",
          expected: {
            patientLastNameVisible: patient!.lname,
            patientPubpidVisible: patient!.pubpid,
            providerName: targetProviderName
          },
          actual: {
            patient,
            updated,
            surface: {
              patientSummaryReached: true,
              demographicsEditReached: true,
              renderedFields: {
                lastName: patient!.lname,
                pubpid: patient!.pubpid,
                providerName: targetProviderName
              }
            }
          },
          context: {
            canonicalId: providerAssignmentAnchorPatientId,
            suite: "workflow-patient-provider-assignment",
            workflow: "patient-provider-assignment-legacy-surface"
          }
        });
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const chartResponse = await page.request.get(
          `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
          { headers }
        );
        expect(chartResponse.ok()).toBeTruthy();
        const chart = (await chartResponse.json()) as PatientChartProviderAssignment;
        expect(chart).toMatchObject({
          pubpid: patient!.pubpid,
          providerId: targetProviderId,
          primaryProviderName: targetProviderName
        });
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-198-patient-provider-assignment-modernized-api",
          description: "Captures the Slice 198 modernized patient chart API response after applying the temporary primary-provider assignment update.",
          expected: {
            pubpid: patient!.pubpid,
            providerId: targetProviderId,
            primaryProviderName: targetProviderName
          },
          actual: {
            status: chartResponse.status(),
            chart
          },
          context: {
            canonicalId: providerAssignmentAnchorPatientId,
            suite: "workflow-patient-provider-assignment",
            workflow: "patient-provider-assignment-modernized-api"
          }
        });

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Primary Provider");
        await expect(page.locator("body")).toContainText(targetProviderName);
        await expect(page.locator("body")).toContainText(String(targetProviderId));
        const providerPanelText = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-198-patient-provider-assignment-modernized-surface",
          description: "Captures the Slice 198 modernized Patient/Client primary-provider rendering after the temporary provider assignment update.",
          expected: {
            heading: patient!.lname,
            panelTextIncludes: [
              "Primary Provider",
              targetProviderName,
              String(targetProviderId)
            ]
          },
          actual: {
            patient,
            providerPanelText
          },
          context: {
            canonicalId: providerAssignmentAnchorPatientId,
            suite: "workflow-patient-provider-assignment",
            workflow: "patient-provider-assignment-modernized-surface"
          }
        });
      }
    } finally {
      await workflow.updatePatientProviderAssignment(original);
    }

    const restored = await workflow.getPatientProviderAssignment(patient!.pid);
    expect(restored).toEqual(original);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-198-patient-provider-assignment-cleanup",
      description: "Captures the Slice 198 cleanup state after restoring the original primary-provider assignment.",
      expected: {
        restoredOriginal: original
      },
      actual: {
        patient,
        restored
      },
      context: {
        canonicalId: providerAssignmentAnchorPatientId,
        suite: "workflow-patient-provider-assignment",
        workflow: "patient-provider-assignment-cleanup"
      }
    });
  });
});
