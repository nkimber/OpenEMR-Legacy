import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientImmunizationsDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedClinicalLists } from "../../src/ui/modernizedOpenEmr.js";

const immunizationMutationAnchorPatientId = "MOD-PAT-0007";

test.describe("immunization mutation parity @slice30 @workflow-immunizations @mutation", () => {
  test("creates, renders, marks entered in error, and removes an immunization", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(immunizationMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const vaccine = "Influenza, seasonal, injectable";
    const lotNumber = `MUT-IMM-${suffix}`;
    let immunizationId: number | string | null = null;

    try {
      immunizationId = await workflow.createImmunization({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        encounter: 0,
        administeredAt: "2026-09-10 10:30:00",
        immunizationId: 30,
        cvxCode: "141",
        vaccine,
        manufacturer: "Sanofi Pasteur",
        lotNumber,
        administeredBy: "admin",
        educationDate: "2026-09-10",
        visDate: "2026-08-01",
        amountAdministered: 0.5,
        amountAdministeredUnit: "mL",
        expirationDate: "2027-06-30",
        route: "intramuscular",
        administrationSite: "left deltoid",
        completionStatus: "completed",
        informationSource: "new_immunization_record",
        note: "Created by the parity immunization mutation suite."
      });

      const created = await workflow.getImmunization(immunizationId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        immunizationId: 30,
        cvxCode: "141",
        vaccine,
        administeredDate: "2026-09-10",
        manufacturer: "Sanofi Pasteur",
        lotNumber,
        route: "intramuscular",
        administrationSite: "left deltoid",
        completionStatus: "completed",
        informationSource: "new_immunization_record",
        addedErroneously: 0
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.immunizations).toBe(beforeCounts.immunizations + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientImmunizationsDirect(page, target, patient!.pid);
        await expectRenderedText(page, vaccine);
        await expectRenderedText(page, lotNumber);
      } else {
        await openAuthenticatedModernizedClinicalLists(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText(vaccine);
        await expect(page.locator("body")).toContainText(`CVX 141 / completed / intramuscular`);
        await expect(page.locator("body")).toContainText(`Sanofi Pasteur / Lot ${lotNumber} / left deltoid`);
      }

      const errorNote = "Marked entered in error by the parity immunization mutation suite.";
      await workflow.markImmunizationEnteredInError(immunizationId, errorNote);
      const enteredInError = await workflow.getImmunization(immunizationId);
      expect(enteredInError).toMatchObject({
        addedErroneously: 1,
        note: errorNote
      });

      const afterErrorCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterErrorCounts.immunizations).toBe(beforeCounts.immunizations);
    } finally {
      if (immunizationId !== null) {
        await workflow.deleteImmunization(immunizationId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.immunizations).toBe(beforeCounts.immunizations);
    if (immunizationId !== null) {
      await expect(workflow.getImmunization(immunizationId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
