import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDemographicsEditDirect,
  openPatientSummaryDirect
} from "../../src/ui/legacyOpenEmr.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const deceasedStatusAnchorPatientId = "MOD-PAT-0010";

type PatientChartDeceasedStatus = {
  pubpid: string;
  deceasedDate?: string | null;
  deceasedReason?: string | null;
};

test.describe("patient deceased status parity @slice193 @workflow-patient-deceased-status @mutation @patients", () => {
  test("updates, renders, and restores patient deceased date and reason", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(deceasedStatusAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientDeceasedStatus(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient deceased-status record.");
    }

    const updated = {
      ...original,
      deceasedDate: "2026-06-21",
      deceasedReason: "Slice 193 parity deceased-status readiness"
    };

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-193-patient-deceased-status-precondition",
      description: "Captures the Slice 193 deceased-status mutation precondition: anchor patient, original values, and proposed temporary deceased date/reason.",
      expected: {
        anchorCanonicalId: deceasedStatusAnchorPatientId,
        update: {
          deceasedDate: updated.deceasedDate,
          deceasedReason: updated.deceasedReason
        },
        cleanup: "Restore the original deceased date and reason after verification."
      },
      actual: {
        patient,
        original,
        updated
      },
      context: {
        canonicalId: deceasedStatusAnchorPatientId,
        suite: "workflow-patient-deceased-status",
        workflow: "patient-deceased-status-precondition"
      }
    });

    try {
      await workflow.updatePatientDeceasedStatus(updated);

      const actual = await workflow.getPatientDeceasedStatus(patient!.pid);
      expect(actual).toEqual(updated);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-193-patient-deceased-status-updated",
        description: "Captures the database/read-model state after applying the temporary Slice 193 deceased date and reason.",
        expected: {
          deceasedDate: updated.deceasedDate,
          deceasedReason: updated.deceasedReason
        },
        actual: {
          patient,
          original,
          updated,
          actual
        },
        context: {
          canonicalId: deceasedStatusAnchorPatientId,
          suite: "workflow-patient-deceased-status",
          workflow: "patient-deceased-status-updated"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, patient!.lname);
        await openPatientDemographicsEditDirect(page, target, patient!.pid);
        await expectRenderedText(page, updated.deceasedDate);
        await expectRenderedText(page, updated.deceasedReason);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-193-patient-deceased-status-legacy-surface",
          description: "Captures the Slice 193 legacy UI evidence that the temporary deceased date and reason render in OpenEMR demographics edit.",
          expected: {
            patientLastNameVisible: patient!.lname,
            deceasedDate: updated.deceasedDate,
            deceasedReason: updated.deceasedReason
          },
          actual: {
            patient,
            updated,
            surface: {
              patientSummaryReached: true,
              demographicsEditReached: true,
              renderedFields: {
                lastName: patient!.lname,
                deceasedDate: updated.deceasedDate,
                deceasedReason: updated.deceasedReason
              }
            }
          },
          context: {
            canonicalId: deceasedStatusAnchorPatientId,
            suite: "workflow-patient-deceased-status",
            workflow: "patient-deceased-status-legacy-surface"
          }
        });
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const chartResponse = await page.request.get(
          `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
          { headers }
        );
        expect(chartResponse.ok()).toBeTruthy();
        const chart = (await chartResponse.json()) as PatientChartDeceasedStatus;
        expect(chart).toMatchObject({
          pubpid: patient!.pubpid,
          deceasedDate: updated.deceasedDate,
          deceasedReason: updated.deceasedReason
        });
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-193-patient-deceased-status-modernized-api",
          description: "Captures the Slice 193 modernized patient chart API response after applying the temporary deceased date and reason.",
          expected: {
            pubpid: patient!.pubpid,
            deceasedDate: updated.deceasedDate,
            deceasedReason: updated.deceasedReason
          },
          actual: {
            status: chartResponse.status(),
            chart
          },
          context: {
            canonicalId: deceasedStatusAnchorPatientId,
            suite: "workflow-patient-deceased-status",
            workflow: "patient-deceased-status-modernized-api"
          }
        });

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Deceased Status");
        await expect(page.locator("body")).toContainText("Deceased");
        await expect(page.locator("body")).toContainText(updated.deceasedDate);
        await expect(page.locator("body")).toContainText(updated.deceasedReason);
        const deceasedPanelText = await page.getByText("Deceased Status").locator("..").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-193-patient-deceased-status-modernized-surface",
          description: "Captures the Slice 193 modernized Patient/Client deceased-status panel rendering after the temporary update.",
          expected: {
            heading: patient!.lname,
            panelTextIncludes: ["Deceased Status", "Deceased", updated.deceasedDate, updated.deceasedReason]
          },
          actual: {
            patient,
            deceasedPanelText
          },
          context: {
            canonicalId: deceasedStatusAnchorPatientId,
            suite: "workflow-patient-deceased-status",
            workflow: "patient-deceased-status-modernized-surface"
          }
        });
      }
    } finally {
      await workflow.updatePatientDeceasedStatus(original);
    }

    const restored = await workflow.getPatientDeceasedStatus(patient!.pid);
    expect(restored).toEqual(original);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-193-patient-deceased-status-cleanup",
      description: "Captures the Slice 193 cleanup state after restoring the original deceased date and reason.",
      expected: {
        restoredOriginal: original
      },
      actual: {
        patient,
        restored
      },
      context: {
        canonicalId: deceasedStatusAnchorPatientId,
        suite: "workflow-patient-deceased-status",
        workflow: "patient-deceased-status-cleanup"
      }
    });
  });
});
