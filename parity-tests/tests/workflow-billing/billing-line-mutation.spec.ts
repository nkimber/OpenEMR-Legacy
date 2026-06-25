import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";
import { expectRenderedText, loginToLegacyOpenEmr, openEncounterDirect, openFeeSheetDirect } from "../../src/ui/legacyOpenEmr.js";

const billingMutationAnchorPatientId = "MOD-PAT-0001";

test.describe("billing line mutation parity @slice16 @workflow-billing @mutation", () => {
  test("creates, renders, marks billed, deactivates, and removes a CPT billing line", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(billingMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const codeText = `Parity Billing Line ${workflowSuffix()}`;
    const billingLineInput = {
      patientId: patient!.pid,
      providerId: patient!.providerId,
      encounter: encounter!.encounter,
      dateTime: "2026-06-18 11:10:00",
      codeType: "CPT4",
      code: "99213",
      codeText,
      fee: "125.00",
      units: 1,
      justify: "Z00.00"
    };
    let billingLineId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-16-billing-mutation-precondition",
      description: "Captures the Slice 16 billing mutation anchor patient, latest encounter, workflow counts before mutation, and proposed CPT billing-line payload.",
      expected: {
        patient: {
          pubpid: billingMutationAnchorPatientId
        },
        create: {
          codeType: "CPT4",
          code: "99213",
          fee: "125.00",
          units: 1,
          activity: 1,
          billed: 0,
          justify: "Z00.00"
        }
      },
      actual: {
        patient,
        encounter,
        beforeCounts,
        proposed: billingLineInput
      },
      context: {
        canonicalId: billingMutationAnchorPatientId,
        suite: "workflow-billing",
        workflow: "billing-line-mutation"
      }
    });

    try {
      billingLineId = await workflow.createBillingLine(billingLineInput);

      const created = await workflow.getBillingLine(billingLineId);
      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-16-billing-mutation-created",
        description: "Captures the temporary CPT billing-line database row immediately after Slice 16 creates it, including the billing-line count increment.",
        expected: {
          billingLine: {
            patientId: patient!.pid,
            encounter: encounter!.encounter,
            codeType: "CPT4",
            code: "99213",
            codeText,
            fee: "125.00",
            units: 1,
            activity: 1,
            billed: 0,
            justify: "Z00.00"
          },
          counts: {
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
          canonicalId: billingMutationAnchorPatientId,
          suite: "workflow-billing",
          workflow: "billing-line-mutation-created"
        }
      });

      expect(created).toMatchObject({
        patientId: patient!.pid,
        encounter: encounter!.encounter,
        codeType: "CPT4",
        code: "99213",
        codeText,
        fee: "125.00",
        units: 1,
        activity: 1,
        billed: 0
      });

      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters);
      expect(afterCreateCounts.billingLineItems).toBe(beforeCounts.billingLineItems + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
        await openFeeSheetDirect(page, target, patient!.pid, encounter!.encounter);
        await expectRenderedText(page, "99213");
        await expectRenderedText(page, codeText);
      } else {
        await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText(codeText);
        await expect(page.locator("body")).toContainText("99213");
        await expect(page.locator("body")).toContainText("1 unit");
        await expect(page.locator("body")).toContainText("Unbilled");
      }

      await workflow.updateBillingLineStatus(billingLineId, 1, 0);
      const inactive = await workflow.getBillingLine(billingLineId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-16-billing-mutation-inactive",
        description: "Captures the temporary CPT billing-line database row after Slice 16 marks it billed and inactive before cleanup.",
        expected: {
          billingLine: {
            codeText,
            billed: 1,
            activity: 0
          }
        },
        actual: {
          patient,
          encounter,
          billingLineId,
          created,
          inactive
        },
        context: {
          canonicalId: billingMutationAnchorPatientId,
          suite: "workflow-billing",
          workflow: "billing-line-mutation-inactive"
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
    const deleted = billingLineId !== null ? await workflow.getBillingLine(billingLineId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-16-billing-mutation-cleanup",
      description: "Captures the Slice 16 cleanup state after hard-deleting the temporary CPT billing-line row.",
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
        canonicalId: billingMutationAnchorPatientId,
        suite: "workflow-billing",
        workflow: "billing-line-mutation-cleanup"
      }
    });

    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.billingLineItems).toBe(beforeCounts.billingLineItems);
    if (billingLineId !== null) {
      expect(deleted).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
