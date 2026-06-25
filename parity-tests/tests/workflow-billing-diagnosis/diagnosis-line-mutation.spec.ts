import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";
import { expectRenderedText, loginToLegacyOpenEmr, openEncounterDirect, openFeeSheetDirect } from "../../src/ui/legacyOpenEmr.js";

const diagnosisMutationAnchorPatientId = "MOD-PAT-0001";

test.describe("fee sheet diagnosis coding parity @slice44 @workflow-billing-diagnosis @mutation", () => {
  test("creates, renders, deactivates, and removes an ICD10 diagnosis line", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(diagnosisMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const diagnosisText = `Parity Diagnosis Line ${workflowSuffix()}`;
    const billingLineInput = {
      patientId: patient!.pid,
      providerId: patient!.providerId,
      encounter: encounter!.encounter,
      dateTime: "2026-06-18 11:15:00",
      codeType: "ICD10",
      code: "R73.03",
      codeText: diagnosisText,
      fee: "0.00",
      units: 1,
      justify: "R73.03"
    };
    let billingLineId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-44-billing-diagnosis-precondition",
      description: "Captures the Slice 44 billing diagnosis anchor patient, latest encounter, baseline workflow counts, and proposed ICD10 diagnosis-line payload before create.",
      expected: {
        patient: {
          pubpid: diagnosisMutationAnchorPatientId
        },
        create: {
          codeType: "ICD10",
          code: "R73.03",
          fee: "0.00",
          units: 1,
          activity: 1,
          billed: 0,
          justify: "R73.03"
        },
        countChange: {
          encountersAfterCreate: beforeCounts.encounters,
          billingLineItemsAfterCreate: beforeCounts.billingLineItems + 1,
          encountersAfterCleanup: beforeCounts.encounters,
          billingLineItemsAfterCleanup: beforeCounts.billingLineItems
        }
      },
      actual: {
        patient,
        encounter,
        beforeCounts,
        proposedBillingLine: billingLineInput
      },
      context: {
        canonicalId: diagnosisMutationAnchorPatientId,
        suite: "workflow-billing-diagnosis",
        workflow: "billing-diagnosis-mutation"
      }
    });

    try {
      billingLineId = await workflow.createBillingLine(billingLineInput);

      const created = await workflow.getBillingLine(billingLineId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        encounter: encounter!.encounter,
        codeType: "ICD10",
        code: "R73.03",
        codeText: diagnosisText,
        fee: "0.00",
        units: 1,
        activity: 1,
        billed: 0
      });

      const encounterLines = await targetDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
      expect(encounterLines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            codeType: "ICD10",
            code: "R73.03",
            codeText: diagnosisText,
            fee: expect.stringMatching(/^0(\.00)?$/),
            justify: "R73.03"
          })
        ])
      );

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters);
      expect(afterCreateCounts.billingLineItems).toBe(beforeCounts.billingLineItems + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-44-billing-diagnosis-created",
        description: "Captures the temporary Slice 44 ICD10 diagnosis billing row, encounter fee-sheet projection, and billing-line count increment immediately after create.",
        expected: {
          billingLine: {
            patientId: patient!.pid,
            encounter: encounter!.encounter,
            codeType: "ICD10",
            code: "R73.03",
            codeText: diagnosisText,
            fee: "0.00",
            units: 1,
            activity: 1,
            billed: 0,
            justify: "R73.03"
          },
          encounterProjection: {
            includesCodeType: "ICD10",
            includesCode: "R73.03",
            includesJustify: "R73.03"
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
          created,
          encounterLines
        },
        context: {
          canonicalId: diagnosisMutationAnchorPatientId,
          suite: "workflow-billing-diagnosis",
          workflow: "billing-diagnosis-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
        await openFeeSheetDirect(page, target, patient!.pid, encounter!.encounter);
        await expectRenderedText(page, "R73.03");
        await expectRenderedText(page, diagnosisText);
      } else {
        await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText(diagnosisText);
        await expect(page.locator("body")).toContainText("R73.03");
        await expect(page.locator("body")).toContainText("ICD10");
        await expect(page.locator("body")).toContainText("$0.00");
      }

      await workflow.updateBillingLineStatus(billingLineId, 1, 0);
      const inactive = await workflow.getBillingLine(billingLineId);
      const inactiveLines = await targetDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-44-billing-diagnosis-inactive",
        description: "Captures the temporary Slice 44 ICD10 diagnosis row after it is marked billed and inactive before hard-delete cleanup.",
        expected: {
          billingLine: {
            codeType: "ICD10",
            code: "R73.03",
            codeText: diagnosisText,
            billed: 1,
            activity: 0
          }
        },
        actual: {
          patient,
          encounter,
          billingLineId,
          created,
          inactive,
          inactiveLines
        },
        context: {
          canonicalId: diagnosisMutationAnchorPatientId,
          suite: "workflow-billing-diagnosis",
          workflow: "billing-diagnosis-inactive"
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
        probe: "slice-44-billing-diagnosis-cleanup",
        description: "Captures the final Slice 44 hard-delete cleanup state for the temporary ICD10 diagnosis billing row.",
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
          canonicalId: diagnosisMutationAnchorPatientId,
          suite: "workflow-billing-diagnosis",
          workflow: "billing-diagnosis-cleanup"
        }
      });
      expect(deleted).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
