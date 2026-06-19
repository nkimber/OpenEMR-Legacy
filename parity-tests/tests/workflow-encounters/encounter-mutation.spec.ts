import { test, expect } from "../../src/fixtures/parityTest.js";
import { loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";

const encounterAnchorPatientId = "MOD-PAT-0002";

test.describe("encounter mutation parity @slice12 @workflow-encounters @mutation", () => {
  test("creates, updates, renders, and removes an encounter with vitals and SOAP details", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const reason = `Parity Encounter ${workflowSuffix()}`;
    let encounterId: number | null = null;
    let vitalsId: number | null = null;
    let soapId: number | null = null;

    try {
      encounterId = await workflow.createEncounter({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        dateTime: "2026-06-18 10:00:00",
        reason,
        facilityId: 10,
        facilityName: "OpenEMR Modernization Clinic",
        billingFacilityId: 10,
        billingNote: "Created by the parity encounter mutation suite."
      });

      const createdEncounter = await workflow.getEncounter(encounterId);
      expect(createdEncounter).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        date: "2026-06-18",
        reason,
        facilityId: 10,
        billingFacilityId: 10
      });

      vitalsId = await workflow.createVitals({
        patientId: patient!.pid,
        encounter: createdEncounter!.encounter,
        dateTime: "2026-06-18 10:05:00",
        bps: "128",
        bpd: "76",
        weight: 186,
        height: 70,
        pulse: 72,
        oxygenSaturation: 98,
        note: "Parity vitals detail."
      });

      const vitals = await workflow.getVitals(vitalsId);
      expect(vitals).toMatchObject({
        patientId: patient!.pid,
        bps: "128",
        bpd: "76",
        weight: 186,
        height: 70,
        pulse: 72,
        oxygenSaturation: 98,
        note: "Parity vitals detail."
      });

      soapId = await workflow.createSoapNote({
        patientId: patient!.pid,
        encounter: createdEncounter!.encounter,
        dateTime: "2026-06-18 10:10:00",
        subjective: "Patient reports parity workflow symptoms are stable.",
        objective: "Vitals reviewed during parity workflow.",
        assessment: "Stable parity workflow condition.",
        plan: "Continue parity workflow validation."
      });

      const soap = await workflow.getSoapNote(soapId);
      expect(soap).toMatchObject({
        patientId: patient!.pid,
        subjective: "Patient reports parity workflow symptoms are stable.",
        objective: "Vitals reviewed during parity workflow.",
        assessment: "Stable parity workflow condition.",
        plan: "Continue parity workflow validation."
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterCreateCounts.vitals).toBe(beforeCounts.vitals + 1);
      expect(afterCreateCounts.clinicalNotes).toBe(beforeCounts.clinicalNotes + 1);

      const updatedReason = `${reason} Updated`;
      const updatedBillingNote = "Updated by the parity encounter mutation suite.";
      await workflow.updateEncounterReason(encounterId, updatedReason, updatedBillingNote);
      const updatedEncounter = await workflow.getEncounter(encounterId);
      expect(updatedEncounter).toMatchObject({
        reason: updatedReason,
        billingNote: updatedBillingNote
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
        await expect(page.getByRole("heading", { name: updatedReason })).toBeVisible();
        await expect(page.locator("body")).toContainText(updatedBillingNote);
        await expect(page.locator("body")).toContainText("128/76");
        await expect(page.locator("body")).toContainText("Stable parity workflow condition.");
      }
    } finally {
      if (soapId !== null) {
        await workflow.deleteSoapNote(soapId);
      }
      if (vitalsId !== null) {
        await workflow.deleteVitals(vitalsId);
      }
      if (encounterId !== null) {
        await workflow.deleteEncounter(encounterId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.vitals).toBe(beforeCounts.vitals);
    expect(afterCleanupCounts.clinicalNotes).toBe(beforeCounts.clinicalNotes);
    if (encounterId !== null) {
      await expect(workflow.getEncounter(encounterId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
