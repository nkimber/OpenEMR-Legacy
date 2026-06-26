import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDemographicsEditDirect,
  openPatientSummaryDirect
} from "../../src/ui/legacyOpenEmr.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const socialDetailsAnchorPatientId = "MOD-PAT-0010";

type PatientChartSocialDetails = {
  pubpid: string;
  race?: string | null;
  ethnicity?: string | null;
  interpreter?: string | null;
  familySize?: string | null;
  monthlyIncome?: string | null;
  homeless?: string | null;
  financialReviewDate?: string | null;
};

test.describe("patient social detail parity @slice196 @workflow-patient-social-details @mutation @patients", () => {
  test("updates, renders, and restores patient social and demographic detail fields", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(socialDetailsAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientDemographics(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient demographics record.");
    }

    const updated = {
      ...original,
      race: "Asian",
      ethnicity: "Hispanic or Latino",
      interpreter: "Slice 196 interpreter requested",
      familySize: "4",
      monthlyIncome: "4196",
      homeless: "YES",
      financialReviewDate: "2026-02-15"
    };

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-196-patient-social-details-precondition",
      description: "Captures the Slice 196 social-detail mutation precondition: anchor patient, original demographics values, and proposed temporary social-detail update.",
      expected: {
        anchorCanonicalId: socialDetailsAnchorPatientId,
        update: {
          race: updated.race,
          ethnicity: updated.ethnicity,
          interpreter: updated.interpreter,
          familySize: updated.familySize,
          monthlyIncome: updated.monthlyIncome,
          homeless: updated.homeless,
          financialReviewDate: updated.financialReviewDate
        },
        cleanup: "Restore the original demographic and social-detail values after verification."
      },
      actual: {
        patient,
        original,
        updated
      },
      context: {
        canonicalId: socialDetailsAnchorPatientId,
        suite: "workflow-patient-social-details",
        workflow: "patient-social-details-precondition"
      }
    });

    try {
      await workflow.updatePatientDemographics(updated);

      const actual = await workflow.getPatientDemographics(patient!.pid);
      expect(actual).toEqual(updated);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-196-patient-social-details-updated",
        description: "Captures the database/read-model state after applying the temporary Slice 196 social-detail update.",
        expected: {
          race: updated.race,
          ethnicity: updated.ethnicity,
          interpreter: updated.interpreter,
          familySize: updated.familySize,
          monthlyIncome: updated.monthlyIncome,
          homeless: updated.homeless,
          financialReviewDate: updated.financialReviewDate
        },
        actual: {
          patient,
          original,
          updated,
          actual
        },
        context: {
          canonicalId: socialDetailsAnchorPatientId,
          suite: "workflow-patient-social-details",
          workflow: "patient-social-details-updated"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, patient!.lname);
        await openPatientDemographicsEditDirect(page, target, patient!.pid);
        await expectRenderedText(page, updated.race);
        await expectRenderedText(page, updated.ethnicity);
        await expectRenderedText(page, updated.interpreter);
        await expectRenderedText(page, updated.familySize);
        await expectRenderedText(page, updated.monthlyIncome);
        await expectRenderedText(page, /Yes|YES/);
        await expectRenderedText(page, updated.financialReviewDate);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-196-patient-social-details-legacy-surface",
          description: "Captures the Slice 196 legacy UI evidence that OpenEMR demographics edit renders the temporary social-detail values.",
          expected: {
            patientLastNameVisible: patient!.lname,
            race: updated.race,
            ethnicity: updated.ethnicity,
            interpreter: updated.interpreter,
            familySize: updated.familySize,
            monthlyIncome: updated.monthlyIncome,
            homelessLabel: "Yes",
            financialReviewDate: updated.financialReviewDate
          },
          actual: {
            patient,
            updated,
            surface: {
              patientSummaryReached: true,
              demographicsEditReached: true,
              renderedFields: {
                lastName: patient!.lname,
                race: updated.race,
                ethnicity: updated.ethnicity,
                interpreter: updated.interpreter,
                familySize: updated.familySize,
                monthlyIncome: updated.monthlyIncome,
                homeless: "Yes",
                financialReviewDate: updated.financialReviewDate
              }
            }
          },
          context: {
            canonicalId: socialDetailsAnchorPatientId,
            suite: "workflow-patient-social-details",
            workflow: "patient-social-details-legacy-surface"
          }
        });
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const chartResponse = await page.request.get(
          `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
          { headers }
        );
        expect(chartResponse.ok()).toBeTruthy();
        const chart = (await chartResponse.json()) as PatientChartSocialDetails;
        expect(chart).toMatchObject({
          pubpid: patient!.pubpid,
          race: updated.race,
          ethnicity: updated.ethnicity,
          interpreter: updated.interpreter,
          familySize: updated.familySize,
          monthlyIncome: updated.monthlyIncome,
          homeless: updated.homeless,
          financialReviewDate: updated.financialReviewDate
        });
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-196-patient-social-details-modernized-api",
          description: "Captures the Slice 196 modernized patient chart API response after applying the temporary social-detail update.",
          expected: {
            pubpid: patient!.pubpid,
            race: updated.race,
            ethnicity: updated.ethnicity,
            interpreter: updated.interpreter,
            familySize: updated.familySize,
            monthlyIncome: updated.monthlyIncome,
            homeless: updated.homeless,
            financialReviewDate: updated.financialReviewDate
          },
          actual: {
            status: chartResponse.status(),
            chart
          },
          context: {
            canonicalId: socialDetailsAnchorPatientId,
            suite: "workflow-patient-social-details",
            workflow: "patient-social-details-modernized-api"
          }
        });

        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
        await expect(page.locator("body")).toContainText("Demographics");
        await expect(page.locator("body")).toContainText(updated.race);
        await expect(page.locator("body")).toContainText(updated.ethnicity);
        await expect(page.locator("body")).toContainText(updated.interpreter);
        await expect(page.locator("body")).toContainText("Family size");
        await expect(page.locator("body")).toContainText(updated.familySize);
        await expect(page.locator("body")).toContainText("Monthly income");
        await expect(page.locator("body")).toContainText(updated.monthlyIncome);
        await expect(page.locator("body")).toContainText("Homeless");
        await expect(page.locator("body")).toContainText("Yes");
        await expect(page.locator("body")).toContainText(updated.financialReviewDate);
        const demographicsPanelText = await page.locator("body").innerText();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-196-patient-social-details-modernized-surface",
          description: "Captures the Slice 196 modernized Patient/Client demographics rendering after the temporary social-detail update.",
          expected: {
            heading: patient!.lname,
            panelTextIncludes: [
              "Demographics",
              updated.race,
              updated.ethnicity,
              updated.interpreter,
              "Family size",
              updated.familySize,
              "Monthly income",
              updated.monthlyIncome,
              "Homeless",
              "Yes",
              updated.financialReviewDate
            ]
          },
          actual: {
            patient,
            demographicsPanelText
          },
          context: {
            canonicalId: socialDetailsAnchorPatientId,
            suite: "workflow-patient-social-details",
            workflow: "patient-social-details-modernized-surface"
          }
        });
      }
    } finally {
      await workflow.updatePatientDemographics(original);
    }

    const restored = await workflow.getPatientDemographics(patient!.pid);
    expect(restored).toEqual(original);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-196-patient-social-details-cleanup",
      description: "Captures the Slice 196 cleanup state after restoring the original demographics and social-detail values.",
      expected: {
        restoredOriginal: original
      },
      actual: {
        patient,
        restored
      },
      context: {
        canonicalId: socialDetailsAnchorPatientId,
        suite: "workflow-patient-social-details",
        workflow: "patient-social-details-cleanup"
      }
    });
  });
});
