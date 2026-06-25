import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";
import { expectRenderedText, loginToLegacyOpenEmr, openEncounterDirect, openFeeSheetDirect } from "../../src/ui/legacyOpenEmr.js";

const billingModifierAnchorPatientId = "MOD-PAT-0001";

test.describe("fee sheet billing modifier parity @slice46 @workflow-billing-modifier @mutation", () => {
  test("creates, modifies, renders, deactivates, and removes a CPT billing line", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(billingModifierAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const initialText = `Parity Modifier CPT ${workflowSuffix()}`;
    const modifiedText = `Parity Modified CPT ${workflowSuffix()}`;
    const billingLineInput = {
      patientId: patient!.pid,
      providerId: patient!.providerId,
      encounter: encounter!.encounter,
      dateTime: "2026-06-18 10:35:00",
      codeType: "CPT4",
      code: "99213",
      modifier: "",
      codeText: initialText,
      fee: "125.00",
      units: 1,
      justify: "Z00.00"
    };
    const modifierUpdateInput = {
      codeText: modifiedText,
      modifier: "25",
      fee: "142.25",
      units: 2,
      justify: "E78.5"
    };
    let billingLineId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-46-billing-modifier-precondition",
      description: "Captures the Slice 46 billing modifier anchor patient, latest encounter, baseline workflow counts, proposed CPT billing-line payload, and planned modifier update before create.",
      expected: {
        patient: {
          pubpid: billingModifierAnchorPatientId
        },
        create: {
          codeType: "CPT4",
          code: "99213",
          modifier: "",
          fee: "125.00",
          units: 1,
          activity: 1,
          billed: 0,
          justify: "Z00.00"
        },
        modifierUpdate: {
          codeText: modifiedText,
          modifier: "25",
          fee: "142.25",
          units: 2,
          justify: "E78.5"
        },
        countChange: {
          encountersAfterCreate: beforeCounts.encounters,
          billingLineItemsAfterCreate: beforeCounts.billingLineItems + 1,
          billingLineItemsAfterModifierUpdate: beforeCounts.billingLineItems + 1,
          billingLineItemsAfterCleanup: beforeCounts.billingLineItems
        }
      },
      actual: {
        patient,
        encounter,
        beforeCounts,
        proposedBillingLine: billingLineInput,
        proposedModifierUpdate: modifierUpdateInput
      },
      context: {
        canonicalId: billingModifierAnchorPatientId,
        suite: "workflow-billing-modifier",
        workflow: "billing-line-modifier"
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
        modifier: "",
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
        probe: "slice-46-billing-modifier-created",
        description: "Captures the temporary Slice 46 original CPT billing row with blank modifier and billing-line count increment immediately after create.",
        expected: {
          billingLine: {
            patientId: patient!.pid,
            encounter: encounter!.encounter,
            codeType: "CPT4",
            code: "99213",
            modifier: "",
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
          canonicalId: billingModifierAnchorPatientId,
          suite: "workflow-billing-modifier",
          workflow: "billing-line-modifier-created"
        }
      });

      await workflow.updateBillingLine(billingLineId, modifierUpdateInput);

      const modified = await workflow.getBillingLine(billingLineId);
      expect(modified).toMatchObject({
        patientId: patient!.pid,
        encounter: encounter!.encounter,
        codeType: "CPT4",
        code: "99213",
        modifier: "25",
        codeText: modifiedText,
        fee: "142.25",
        justify: "E78.5",
        units: 2,
        activity: 1,
        billed: 0
      });

      const encounterLines = await targetDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
      expect(encounterLines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            codeType: "CPT4",
            code: "99213",
            modifier: "25",
            codeText: modifiedText,
            fee: expect.stringMatching(/^142\.25(?:0+)?$/),
            justify: "E78.5"
          })
        ])
      );

      const afterModificationCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterModificationCounts.encounters).toBe(beforeCounts.encounters);
      expect(afterModificationCounts.billingLineItems).toBe(beforeCounts.billingLineItems + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-46-billing-modifier-modified",
        description: "Captures the temporary Slice 46 CPT billing row after modifier, code text, fee, units, and diagnosis justification are updated.",
        expected: {
          billingLine: {
            patientId: patient!.pid,
            encounter: encounter!.encounter,
            codeType: "CPT4",
            code: "99213",
            modifier: "25",
            codeText: modifiedText,
            fee: "142.25",
            justify: "E78.5",
            units: 2,
            activity: 1,
            billed: 0
          },
          encounterProjection: {
            includesCodeType: "CPT4",
            includesCode: "99213",
            includesModifier: "25",
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
          afterModificationCounts,
          billingLineId,
          created,
          modified,
          encounterLines,
          modifierUpdateInput
        },
        context: {
          canonicalId: billingModifierAnchorPatientId,
          suite: "workflow-billing-modifier",
          workflow: "billing-line-modifier-modified"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
        await openFeeSheetDirect(page, target, patient!.pid, encounter!.encounter);
        await expectRenderedText(page, "99213");
        await expectRenderedText(page, "25");
        await expectRenderedText(page, modifiedText);
      } else {
        await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText(modifiedText);
        await expect(page.locator("body")).toContainText("99213:25");
        await expect(page.locator("body")).toContainText("Modifier 25");
        await expect(page.locator("body")).toContainText("Justify E78.5");
        await expect(page.locator("body")).toContainText("2 units");
        await expect(page.locator("body")).toContainText("$142.25");
      }

      await workflow.updateBillingLineStatus(billingLineId, 1, 0);
      const inactive = await workflow.getBillingLine(billingLineId);
      const inactiveLines = await targetDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-46-billing-modifier-inactive",
        description: "Captures the modified temporary Slice 46 CPT billing row after it is marked billed and inactive before hard-delete cleanup.",
        expected: {
          billingLine: {
            codeType: "CPT4",
            code: "99213",
            modifier: "25",
            codeText: modifiedText,
            fee: "142.25",
            billed: 1,
            activity: 0
          }
        },
        actual: {
          patient,
          encounter,
          billingLineId,
          modified,
          inactive,
          inactiveLines
        },
        context: {
          canonicalId: billingModifierAnchorPatientId,
          suite: "workflow-billing-modifier",
          workflow: "billing-line-modifier-inactive"
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
        probe: "slice-46-billing-modifier-cleanup",
        description: "Captures the final Slice 46 hard-delete cleanup state for the temporary modified CPT billing row.",
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
          canonicalId: billingModifierAnchorPatientId,
          suite: "workflow-billing-modifier",
          workflow: "billing-line-modifier-cleanup"
        }
      });
      expect(deleted).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
