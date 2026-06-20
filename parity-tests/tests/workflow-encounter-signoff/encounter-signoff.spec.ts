import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";

const signOffAnchorPatientId = "MOD-PAT-0002";
const signOffEncounterDate = "2026-06-18";

test.describe("encounter sign-off parity @slice77 @workflow-encounter-signoff @mutation", () => {
  test("creates, signs, renders, deletes, and removes encounter sign-off", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(signOffAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const externalId = compactWorkflowId();
    const reason = `Parity Encounter Sign-Off ${suffix}`;
    const billingNote = `Encounter sign-off parity billing note ${suffix}.`;
    const signatureNote = `Parity encounter sign-off note ${suffix}.`;
    let encounterId: number | null = null;
    let signatureId: number | null = null;
    let deletedSignatureId: number | null = null;

    try {
      encounterId = await workflow.createEncounter({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        dateTime: `${signOffEncounterDate} 10:15:00`,
        reason,
        facilityId: 10,
        facilityName: "OpenEMR Modernization Clinic",
        billingFacilityId: 10,
        sensitivity: "normal",
        referralSource: "Parity suite",
        externalId,
        posCode: 11,
        billingNote
      });

      const createdEncounter = await workflow.getEncounter(encounterId);
      expect(createdEncounter).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        date: signOffEncounterDate,
        reason,
        facilityId: 10,
        billingFacilityId: 10,
        billingNote
      });

      signatureId = await workflow.signEncounter(encounterId, {
        signerUsername: "admin",
        signedAt: `${signOffEncounterDate} 10:20:00`,
        isLock: false,
        amendment: signatureNote
      });

      const signature = await workflow.getEncounterSignature(signatureId);
      expect(signature).toMatchObject({
        tableName: "form_encounter",
        signerUsername: "admin",
        signedAt: `${signOffEncounterDate} 10:20`,
        isLock: false,
        amendment: signatureNote
      });
      expect(signature!.hash.length).toBeGreaterThanOrEqual(32);
      expect(signature!.signatureHash.length).toBeGreaterThanOrEqual(32);

      const afterSignCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterSignCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterSignCounts.encounterSignatures).toBe(beforeCounts.encounterSignatures + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, patient!.lname);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Encounters" }).click();
        await expect(page.getByRole("heading", { name: "Encounters" })).toBeVisible();
        await page.getByLabel("Encounter patient ID").fill(patient!.pubpid);
        await page.getByLabel("Encounter from date").fill(signOffEncounterDate);

        const encounterButton = page.getByRole("button", { name: new RegExp(escapeRegex(reason), "i") }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const signOffPanel = page.getByRole("region", { name: "Encounter sign-off" });
        await expect(signOffPanel).toContainText("Signed");
        await expect(signOffPanel).toContainText("admin");
        await expect(signOffPanel).toContainText(signatureNote);
        await expect(signOffPanel.locator("code")).toContainText(signature!.hash.slice(0, 12));
      }

      deletedSignatureId = signatureId;
      await workflow.deleteEncounterSignature(signatureId);
      signatureId = null;
      await expect(workflow.getEncounterSignature(deletedSignatureId)).resolves.toBeNull();

      const afterSignatureDeleteCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterSignatureDeleteCounts.encounterSignatures).toBe(beforeCounts.encounterSignatures);
    } finally {
      if (signatureId !== null) {
        await workflow.deleteEncounterSignature(signatureId);
      }
      if (encounterId !== null) {
        await workflow.deleteEncounter(encounterId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.encounterSignatures).toBe(beforeCounts.encounterSignatures);
    if (encounterId !== null) {
      await expect(workflow.getEncounter(encounterId)).resolves.toBeNull();
    }
    if (deletedSignatureId !== null) {
      await expect(workflow.getEncounterSignature(deletedSignatureId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function compactWorkflowId() {
  const timestamp = Date.now().toString(36).slice(-8);
  const random = Math.floor(Math.random() * 1296).toString(36).padStart(2, "0");
  return `PS${timestamp}${random}`.toUpperCase();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
