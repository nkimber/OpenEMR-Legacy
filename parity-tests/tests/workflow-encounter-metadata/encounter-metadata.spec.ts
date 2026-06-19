import { test, expect } from "../../src/fixtures/parityTest.js";
import { loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";

const encounterMetadataAnchorPatientId = "MOD-PAT-0002";

test.describe("encounter metadata mutation parity @slice35 @workflow-encounter-metadata @mutation", () => {
  test("creates, renders, updates, and removes encounter metadata", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterMetadataAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const reason = `Parity Metadata ${suffix}`;
    const createdMetadata = {
      sensitivity: "normal",
      referralSource: "self",
      externalId: `EXT-${suffix}`,
      posCode: 11
    };
    const updatedReason = `${reason} Updated`;
    const updatedBillingNote = "Updated by the parity encounter metadata suite.";
    const updatedMetadata = {
      sensitivity: "high",
      referralSource: "physician",
      externalId: `UPD-${suffix}`,
      posCode: 22
    };
    let encounterId: number | null = null;

    try {
      encounterId = await workflow.createEncounter({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        dateTime: "2026-06-18 11:00:00",
        reason,
        facilityId: 10,
        facilityName: "OpenEMR Modernization Clinic",
        billingFacilityId: 10,
        ...createdMetadata,
        billingNote: "Created by the parity encounter metadata suite."
      });

      const createdEncounter = await workflow.getEncounter(encounterId);
      expect(createdEncounter).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        date: "2026-06-18",
        reason,
        facilityId: 10,
        billingFacilityId: 10,
        ...createdMetadata
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters + 1);

      await workflow.updateEncounterReason(encounterId, updatedReason, updatedBillingNote, updatedMetadata);
      const updatedEncounter = await workflow.getEncounter(encounterId);
      expect(updatedEncounter).toMatchObject({
        reason: updatedReason,
        billingNote: updatedBillingNote,
        ...updatedMetadata
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expect(page.locator("body")).toContainText(patient!.lname);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Encounters" }).click();
        await expect(page.getByRole("heading", { name: "Encounters" })).toBeVisible();
        await page.getByLabel("Encounter patient ID").fill(patient!.pubpid);
        await page.getByLabel("Encounter from date").fill("2026-06-18");

        const encounterButton = page.getByRole("button", { name: new RegExp(escapeRegex(updatedReason), "i") }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const detailPanel = page.getByLabel("Encounter detail");
        await expect(page.getByRole("heading", { name: updatedReason })).toBeVisible();
        await expect(detailPanel).toContainText(updatedBillingNote);
        await expect(detailPanel).toContainText("High");
        await expect(detailPanel).toContainText(updatedMetadata.referralSource);
        await expect(detailPanel).toContainText(updatedMetadata.externalId);
        await expect(detailPanel).toContainText(String(updatedMetadata.posCode));
      }
    } finally {
      if (encounterId !== null) {
        await workflow.deleteEncounter(encounterId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    if (encounterId !== null) {
      await expect(workflow.getEncounter(encounterId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now().toString(36).slice(-5)}${Math.floor(Math.random() * 1000)}`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
