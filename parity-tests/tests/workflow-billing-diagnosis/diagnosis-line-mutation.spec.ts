import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";
import { expectRenderedText, loginToLegacyOpenEmr, openEncounterDirect, openFeeSheetDirect } from "../../src/ui/legacyOpenEmr.js";

const diagnosisMutationAnchorPatientId = "MOD-PAT-0001";

test.describe("fee sheet diagnosis coding parity @slice44 @workflow-billing-diagnosis @mutation", () => {
  test("creates, renders, deactivates, and removes an ICD10 diagnosis line", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(diagnosisMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const diagnosisText = `Parity Diagnosis Line ${workflowSuffix()}`;
    let billingLineId: number | string | null = null;

    try {
      const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
      expect(encounter).not.toBeNull();

      billingLineId = await workflow.createBillingLine({
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
      });

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
      await expect(workflow.getBillingLine(billingLineId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
