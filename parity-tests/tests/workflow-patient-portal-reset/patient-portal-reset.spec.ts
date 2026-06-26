import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDemographicsEditDirect
} from "../../src/ui/legacyOpenEmr.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const portalResetAnchorPatientId = "MOD-PAT-0004";

type PatientChartPortalReset = {
  pubpid: string;
  portalAccount?: {
    passwordStatus?: number | null;
    passwordStatusLabel: string;
    oneTimeLinkPending: boolean;
    resetStatusLabel: string;
  } | null;
};

test.describe("patient portal reset parity @slice205 @workflow-patient-portal-reset @mutation @patients", () => {
  test("issues, renders, and clears patient portal one-time reset state", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(portalResetAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientPortalAccountResetState(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient portal account reset state.");
    }

    expect(original).toMatchObject({
      passwordStatus: 1,
      passwordStatusLabel: "Patient-managed password",
      oneTimeLinkPending: false,
      resetStatusLabel: "No reset pending"
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-205-patient-portal-reset-precondition",
      description: "Captures the Slice 205 portal-reset precondition: anchor patient and original patient-managed password state.",
      expected: {
        anchorCanonicalId: portalResetAnchorPatientId,
        originalResetState: {
          passwordStatus: 1,
          passwordStatusLabel: "Patient-managed password",
          oneTimeLinkPending: false,
          resetStatusLabel: "No reset pending"
        }
      },
      actual: {
        patient,
        original
      },
      context: {
        canonicalId: portalResetAnchorPatientId,
        suite: "workflow-patient-portal-reset",
        workflow: "patient-portal-reset-precondition"
      }
    });

    const issued = {
      ...original,
      passwordStatus: 0,
      passwordStatusLabel: "Temporary password issued",
      oneTimeLinkPending: true,
      resetStatusLabel: "One-time reset pending"
    };
    const cleared = {
      ...original,
      passwordStatus: 1,
      passwordStatusLabel: "Patient-managed password",
      oneTimeLinkPending: false,
      resetStatusLabel: "No reset pending"
    };

    try {
      await workflow.updatePatientPortalAccountResetState(issued);
      const issuedActual = await workflow.getPatientPortalAccountResetState(patient!.pid);
      expect(issuedActual).toEqual(issued);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-205-patient-portal-reset-issued",
        description: "Captures the temporary Slice 205 one-time reset state immediately after issuing the reset.",
        expected: {
          issued
        },
        actual: {
          patient,
          original,
          issuedActual
        },
        context: {
          canonicalId: portalResetAnchorPatientId,
          suite: "workflow-patient-portal-reset",
          workflow: "patient-portal-reset-issued"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientDemographicsEditDirect(page, target, patient!.pid);
        await expectRenderedText(page, patient!.pubpid);
        await expectRenderedText(page, "mod-pat-0004@example.test");
        const legacyDemographicsText = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-205-patient-portal-reset-legacy-issued-surface",
          description: "Captures the Slice 205 legacy demographics edit evidence after issuing the temporary portal reset.",
          expected: {
            pubpid: patient!.pubpid,
            cmsPortalLogin: "mod-pat-0004@example.test",
            issued
          },
          actual: {
            patient,
            issuedActual,
            legacyDemographicsText
          },
          context: {
            canonicalId: portalResetAnchorPatientId,
            suite: "workflow-patient-portal-reset",
            workflow: "patient-portal-reset-legacy-issued-surface"
          }
        });
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const issuedChartResponse = await page.request.get(
          `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
          { headers }
        );
        expect(issuedChartResponse.ok()).toBeTruthy();
        const issuedChart = (await issuedChartResponse.json()) as PatientChartPortalReset;
        expect(issuedChart.portalAccount).toMatchObject({
          passwordStatus: 0,
          passwordStatusLabel: "Temporary password issued",
          oneTimeLinkPending: true,
          resetStatusLabel: "One-time reset pending"
        });
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-205-patient-portal-reset-modernized-issued-api",
          description: "Captures the Slice 205 modernized patient chart API response after issuing the temporary portal reset.",
          expected: {
            pubpid: patient!.pubpid,
            portalAccount: {
              passwordStatus: 0,
              passwordStatusLabel: "Temporary password issued",
              oneTimeLinkPending: true,
              resetStatusLabel: "One-time reset pending"
            }
          },
          actual: {
            status: issuedChartResponse.status(),
            issuedChart
          },
          context: {
            canonicalId: portalResetAnchorPatientId,
            suite: "workflow-patient-portal-reset",
            workflow: "patient-portal-reset-modernized-issued-api"
          }
        });

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Portal Account");
        await expect(page.locator("body")).toContainText("Temporary password issued");
        await expect(page.locator("body")).toContainText("One-time reset pending");
        await expect(page.getByRole("button", { name: "Clear portal reset" })).toBeVisible();
        const issuedPatientChartText = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-205-patient-portal-reset-modernized-issued-surface",
          description: "Captures the Slice 205 modernized Patient/Client Portal Account rendering after issuing the temporary portal reset.",
          expected: {
            visibleFields: [
              "Portal Account",
              "Temporary password issued",
              "One-time reset pending",
              "Clear portal reset"
            ]
          },
          actual: {
            patient,
            issuedActual,
            issuedPatientChartText
          },
          context: {
            canonicalId: portalResetAnchorPatientId,
            suite: "workflow-patient-portal-reset",
            workflow: "patient-portal-reset-modernized-issued-surface"
          }
        });
      }

      await workflow.updatePatientPortalAccountResetState(cleared);
      const clearedActual = await workflow.getPatientPortalAccountResetState(patient!.pid);
      expect(clearedActual).toEqual(cleared);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-205-patient-portal-reset-cleared",
        description: "Captures the Slice 205 portal reset state immediately after clearing the temporary one-time reset.",
        expected: {
          cleared
        },
        actual: {
          patient,
          issued,
          clearedActual
        },
        context: {
          canonicalId: portalResetAnchorPatientId,
          suite: "workflow-patient-portal-reset",
          workflow: "patient-portal-reset-cleared"
        }
      });

      if (target.type !== "legacy-openemr") {
        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.locator("body")).toContainText("Patient-managed password");
        await expect(page.locator("body")).toContainText("No reset pending");
        await expect(page.getByRole("button", { name: "Issue portal reset" })).toBeVisible();
        const clearedPatientChartText = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-205-patient-portal-reset-modernized-cleared-surface",
          description: "Captures the Slice 205 modernized Patient/Client Portal Account rendering after clearing the temporary portal reset.",
          expected: {
            visibleFields: [
              "Patient-managed password",
              "No reset pending",
              "Issue portal reset"
            ]
          },
          actual: {
            patient,
            clearedActual,
            clearedPatientChartText
          },
          context: {
            canonicalId: portalResetAnchorPatientId,
            suite: "workflow-patient-portal-reset",
            workflow: "patient-portal-reset-modernized-cleared-surface"
          }
        });
      }
    } finally {
      await workflow.updatePatientPortalAccountResetState(original);
    }

    const restored = await workflow.getPatientPortalAccountResetState(patient!.pid);
    expect(restored).toEqual(original);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-205-patient-portal-reset-cleanup",
      description: "Captures the Slice 205 cleanup state after restoring the original patient-managed portal password state.",
      expected: {
        restoredOriginal: original
      },
      actual: {
        patient,
        restored
      },
      context: {
        canonicalId: portalResetAnchorPatientId,
        suite: "workflow-patient-portal-reset",
        workflow: "patient-portal-reset-cleanup"
      }
    });
  });
});
