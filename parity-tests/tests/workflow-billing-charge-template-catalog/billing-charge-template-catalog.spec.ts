import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const billingTemplateCatalogAnchorPatientId = "MOD-PAT-0001";
const templateCode = "99214";
const templateModifier = "25";
const templateDescription = "Complex established patient follow-up";
const templateFee = "210.00";
const templateUnits = 2;
const templateJustify = "K21.9";

test.describe("fee sheet charge template catalog parity @slice535 @workflow-billing-charge-template-catalog @mutation", () => {
  test("applies a complex follow-up template and saves the generated CPT line", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(billingTemplateCatalogAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${billingTemplateCatalogAnchorPatientId} was not found.`);
    }

    const encounter = await targetDb.getLatestEncounterForPatient(patient.pid);
    expect(encounter).not.toBeNull();
    if (!encounter) {
      throw new Error(`No billing encounter was found for ${billingTemplateCatalogAnchorPatientId}.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeLines = await targetDb.getBillingLinesForEncounter(patient.pid, encounter.encounter);
    const beforeLineIds = new Set(beforeLines.map((line) => line.id));
    let billingLineId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-535-billing-charge-template-catalog-precondition",
      description: "Captures the Slice 535 billing charge-template catalog anchor patient, target encounter, existing fee-sheet rows, and expected complex follow-up template payload.",
      expected: {
        patient: {
          pubpid: billingTemplateCatalogAnchorPatientId
        },
        template: {
          codeType: "CPT4",
          code: templateCode,
          modifier: templateModifier,
          codeText: templateDescription,
          fee: templateFee,
          units: templateUnits,
          justify: templateJustify,
          activity: 1,
          billed: 0
        }
      },
      actual: {
        patient,
        encounter,
        beforeCounts,
        beforeLines
      },
      context: {
        canonicalId: billingTemplateCatalogAnchorPatientId,
        suite: "workflow-billing-charge-template-catalog",
        workflow: "billing-charge-template-catalog"
      }
    });

    try {
      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient.pubpid);
        await expect(page.locator("body")).toContainText(patient.pubpid);

        await page.getByLabel("New billing encounter").fill(String(encounter.encounter));
        await page.getByLabel("New billing CPT code").fill("00000");
        await page.getByLabel("New billing description").fill("Catalog placeholder");
        await page.getByLabel("New billing fee").fill("9.99");
        await page.getByLabel("New billing modifier").fill("AA");
        await page.getByLabel("New billing units").fill("4");
        await page.getByLabel("New billing justification").fill("R00.0");
        await page.getByRole("button", { name: "Complex follow-up" }).click();

        await expect(page.getByLabel("New billing CPT code")).toHaveValue(templateCode);
        await expect(page.getByLabel("New billing description")).toHaveValue(templateDescription);
        await expect(page.getByLabel("New billing fee")).toHaveValue(templateFee);
        await expect(page.getByLabel("New billing modifier")).toHaveValue(templateModifier);
        await expect(page.getByLabel("New billing units")).toHaveValue(String(templateUnits));
        await expect(page.getByLabel("New billing justification")).toHaveValue(templateJustify);
        await expect(page.locator("body")).toContainText("Complex follow-up template applied");

        await page.getByRole("button", { name: "Save CPT" }).click();
        await expect(page.locator("body")).toContainText("Billing line saved");
        await expect
          .poll(async () => {
            const lines = await targetDb.getBillingLinesForEncounter(patient.pid, encounter.encounter);
            return lines.find((line) =>
              !beforeLineIds.has(line.id)
              && line.code === templateCode
              && line.modifier === templateModifier
              && line.codeText === templateDescription
              && line.fee === templateFee
            )?.id ?? null;
          }, { timeout: 10000 })
          .not.toBeNull();

        const afterLines = await targetDb.getBillingLinesForEncounter(patient.pid, encounter.encounter);
        billingLineId = afterLines.find((line) =>
          !beforeLineIds.has(line.id)
          && line.code === templateCode
          && line.modifier === templateModifier
          && line.codeText === templateDescription
          && line.fee === templateFee
        )?.id ?? null;
      } else {
        billingLineId = await workflow.createBillingLine({
          patientId: patient.pid,
          providerId: patient.providerId,
          encounter: encounter.encounter,
          dateTime: "2026-06-18 11:45:00",
          codeType: "CPT4",
          code: templateCode,
          modifier: templateModifier,
          codeText: templateDescription,
          fee: templateFee,
          units: templateUnits,
          justify: templateJustify
        });
      }

      if (billingLineId === null) {
        throw new Error("Billing charge-template catalog workflow did not create a billing line.");
      }

      const billingLine = await workflow.getBillingLine(billingLineId);
      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      const afterLines = await targetDb.getBillingLinesForEncounter(patient.pid, encounter.encounter);

      expect(billingLine).toMatchObject({
        patientId: patient.pid,
        encounter: encounter.encounter,
        codeType: "CPT4",
        code: templateCode,
        modifier: templateModifier,
        codeText: templateDescription,
        fee: templateFee,
        units: templateUnits,
        justify: templateJustify,
        activity: 1,
        billed: 0
      });
      expect(afterCreateCounts.billingLineItems).toBe(beforeCounts.billingLineItems + 1);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-535-billing-charge-template-catalog-result",
        description: "Captures the fee-sheet row created from the Slice 535 complex follow-up template and the incremented billing-line count.",
        expected: {
          billingLine: {
            patientId: patient.pid,
            encounter: encounter.encounter,
            codeType: "CPT4",
            code: templateCode,
            modifier: templateModifier,
            codeText: templateDescription,
            fee: templateFee,
            units: templateUnits,
            justify: templateJustify,
            activity: 1,
            billed: 0
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
          beforeLines,
          afterLines,
          billingLineId,
          billingLine
        },
        context: {
          canonicalId: billingTemplateCatalogAnchorPatientId,
          suite: "workflow-billing-charge-template-catalog",
          workflow: "billing-charge-template-catalog-result"
        }
      });
    } finally {
      if (billingLineId !== null) {
        await workflow.deleteBillingLine(billingLineId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const deletedBillingLine = billingLineId !== null ? await workflow.getBillingLine(billingLineId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-535-billing-charge-template-catalog-cleanup",
      description: "Captures the Slice 535 cleanup state after deleting the temporary complex-template billing line.",
      expected: {
        counts: {
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
        deletedBillingLine
      },
      context: {
        canonicalId: billingTemplateCatalogAnchorPatientId,
        suite: "workflow-billing-charge-template-catalog",
        workflow: "billing-charge-template-catalog-cleanup"
      }
    });

    expect(afterCleanupCounts.billingLineItems).toBe(beforeCounts.billingLineItems);
    if (billingLineId !== null) {
      expect(deletedBillingLine).toBeNull();
    }
  });
});
