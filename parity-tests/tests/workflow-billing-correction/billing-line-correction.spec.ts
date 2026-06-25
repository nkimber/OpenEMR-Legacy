import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";
import { expectRenderedText, loginToLegacyOpenEmr, openEncounterDirect, openFeeSheetDirect } from "../../src/ui/legacyOpenEmr.js";

const billingCorrectionAnchorPatientId = "MOD-PAT-0001";

test.describe("fee sheet billing correction parity @slice45 @workflow-billing-correction @mutation", () => {
  test("creates, corrects, renders, deactivates, and removes a CPT billing line", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(billingCorrectionAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const initialText = `Parity Correction CPT ${workflowSuffix()}`;
    const correctedText = `Parity Corrected CPT ${workflowSuffix()}`;
    const billingLineInput = {
      patientId: patient!.pid,
      providerId: patient!.providerId,
      encounter: encounter!.encounter,
      dateTime: "2026-06-18 10:20:00",
      codeType: "CPT4",
      code: "99213",
      codeText: initialText,
      fee: "125.00",
      units: 1,
      justify: "Z00.00"
    };
    const billingCorrectionInput = {
      codeText: correctedText,
      fee: "142.25",
      units: 3,
      justify: "E78.5"
    };
    let billingLineId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-45-billing-correction-precondition",
      description: "Captures the Slice 45 billing correction anchor patient, latest encounter, baseline workflow counts, proposed CPT billing-line payload, and planned correction before create.",
      expected: {
        patient: {
          pubpid: billingCorrectionAnchorPatientId
        },
        create: {
          codeType: "CPT4",
          code: "99213",
          fee: "125.00",
          units: 1,
          activity: 1,
          billed: 0,
          justify: "Z00.00"
        },
        correction: {
          codeText: correctedText,
          fee: "142.25",
          units: 3,
          justify: "E78.5"
        },
        countChange: {
          encountersAfterCreate: beforeCounts.encounters,
          billingLineItemsAfterCreate: beforeCounts.billingLineItems + 1,
          billingLineItemsAfterCorrection: beforeCounts.billingLineItems + 1,
          billingLineItemsAfterCleanup: beforeCounts.billingLineItems
        }
      },
      actual: {
        patient,
        encounter,
        beforeCounts,
        proposedBillingLine: billingLineInput,
        proposedCorrection: billingCorrectionInput
      },
      context: {
        canonicalId: billingCorrectionAnchorPatientId,
        suite: "workflow-billing-correction",
        workflow: "billing-line-correction"
      }
    });

    try {
      billingLineId = await workflow.createBillingLine(billingLineInput);

      const created = await workflow.getBillingLine(billingLineId);
      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        encounter: encounter!.encounter,
        codeType: "CPT4",
        code: "99213",
        codeText: initialText,
        fee: "125.00",
        justify: "Z00.00",
        units: 1,
        activity: 1,
        billed: 0
      });
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters);
      expect(afterCreateCounts.billingLineItems).toBe(beforeCounts.billingLineItems + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-45-billing-correction-created",
        description: "Captures the temporary Slice 45 original CPT billing row and billing-line count increment immediately after create.",
        expected: {
          billingLine: {
            patientId: patient!.pid,
            encounter: encounter!.encounter,
            codeType: "CPT4",
            code: "99213",
            codeText: initialText,
            fee: "125.00",
            units: 1,
            activity: 1,
            billed: 0,
            justify: "Z00.00"
          },
          counts: {
            encounters: beforeCounts.encounters,
            billingLineItems: beforeCounts.billingLineItems + 1
          }
        },
        actual: {
          patient,
          encounter,
          beforeCounts,
          afterCreateCounts,
          billingLineId,
          created
        },
        context: {
          canonicalId: billingCorrectionAnchorPatientId,
          suite: "workflow-billing-correction",
          workflow: "billing-line-correction-created"
        }
      });

      await workflow.updateBillingLine(billingLineId, billingCorrectionInput);

      const corrected = await workflow.getBillingLine(billingLineId);
      expect(corrected).toMatchObject({
        patientId: patient!.pid,
        encounter: encounter!.encounter,
        codeType: "CPT4",
        code: "99213",
        codeText: correctedText,
        fee: "142.25",
        justify: "E78.5",
        units: 3,
        activity: 1,
        billed: 0
      });

      const encounterLines = await targetDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
      expect(encounterLines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            codeType: "CPT4",
            code: "99213",
            codeText: correctedText,
            fee: expect.stringMatching(/^142\.25(?:0+)?$/),
            justify: "E78.5"
          })
        ])
      );

      const afterCorrectionCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCorrectionCounts.encounters).toBe(beforeCounts.encounters);
      expect(afterCorrectionCounts.billingLineItems).toBe(beforeCounts.billingLineItems + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-45-billing-correction-corrected",
        description: "Captures the temporary Slice 45 CPT billing row after code text, fee, units, and diagnosis justification are corrected.",
        expected: {
          billingLine: {
            patientId: patient!.pid,
            encounter: encounter!.encounter,
            codeType: "CPT4",
            code: "99213",
            codeText: correctedText,
            fee: "142.25",
            justify: "E78.5",
            units: 3,
            activity: 1,
            billed: 0
          },
          encounterProjection: {
            includesCodeType: "CPT4",
            includesCode: "99213",
            includesFee: "142.25",
            includesJustify: "E78.5"
          },
          counts: {
            encounters: beforeCounts.encounters,
            billingLineItems: beforeCounts.billingLineItems + 1
          }
        },
        actual: {
          patient,
          encounter,
          beforeCounts,
          afterCorrectionCounts,
          billingLineId,
          created,
          corrected,
          encounterLines,
          billingCorrectionInput
        },
        context: {
          canonicalId: billingCorrectionAnchorPatientId,
          suite: "workflow-billing-correction",
          workflow: "billing-line-correction-corrected"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
        await openFeeSheetDirect(page, target, patient!.pid, encounter!.encounter);
        await expectRenderedText(page, "99213");
        await expectRenderedText(page, correctedText);
      } else {
        await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText(correctedText);
        await expect(page.locator("body")).toContainText("99213");
        await expect(page.locator("body")).toContainText("CPT4");
        await expect(page.locator("body")).toContainText("Justify E78.5");
        await expect(page.locator("body")).toContainText("3 units");
        await expect(page.locator("body")).toContainText("$142.25");
      }

      await workflow.updateBillingLineStatus(billingLineId, 1, 0);
      const inactive = await workflow.getBillingLine(billingLineId);
      const inactiveLines = await targetDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-45-billing-correction-inactive",
        description: "Captures the corrected temporary Slice 45 CPT billing row after it is marked billed and inactive before hard-delete cleanup.",
        expected: {
          billingLine: {
            codeType: "CPT4",
            code: "99213",
            codeText: correctedText,
            fee: "142.25",
            billed: 1,
            activity: 0
          }
        },
        actual: {
          patient,
          encounter,
          billingLineId,
          corrected,
          inactive,
          inactiveLines
        },
        context: {
          canonicalId: billingCorrectionAnchorPatientId,
          suite: "workflow-billing-correction",
          workflow: "billing-line-correction-inactive"
        }
      });
      expect(inactive).toMatchObject({
        billed: 1,
        activity: 0
      });
    } finally {
      if (billingLineId !== null) {
        await workflow.deleteBillingLine(billingLineId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.billingLineItems).toBe(beforeCounts.billingLineItems);
    if (billingLineId !== null) {
      const deleted = await workflow.getBillingLine(billingLineId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-45-billing-correction-cleanup",
        description: "Captures the final Slice 45 hard-delete cleanup state for the temporary corrected CPT billing row.",
        expected: {
          counts: {
            encounters: beforeCounts.encounters,
            billingLineItems: beforeCounts.billingLineItems
          },
          deletedBillingLine: null
        },
        actual: {
          patient,
          encounter,
          beforeCounts,
          afterCleanupCounts,
          billingLineId,
          deleted
        },
        context: {
          canonicalId: billingCorrectionAnchorPatientId,
          suite: "workflow-billing-correction",
          workflow: "billing-line-correction-cleanup"
        }
      });
      expect(deleted).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
