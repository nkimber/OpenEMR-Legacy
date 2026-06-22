import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import { expectRenderedText, loginToLegacyOpenEmr, openEncounterDirect } from "../../src/ui/legacyOpenEmr.js";

const encounterAnchorPatientId = "MOD-PAT-0001";
const encounterAnchorFromDate = "2026-01-01";

test.describe("encounter clinical detail parity @slice3 @encounters", () => {
  test("stable encounter anchor has SOAP and vitals facts", async ({ targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();
    const clinical = await targetDb.getEncounterClinicalDetail(patient!.pid, encounter!.encounter);
    expect(clinical).not.toBeNull();

    expect(clinical!.patientId).toBe(patient!.pid);
    expect(clinical!.encounter).toBe(encounter!.encounter);
    expect(clinical!.assessment).toContain("monitored during visit");
    expect(clinical!.bloodPressure).toMatch(/^\d+\/\d+$/);
    expect(clinical!.reason).toBeTruthy();
  });

  test("encounter SOAP and vitals are visible in the application UI", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterAnchorPatientId);
    expect(patient).not.toBeNull();
    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();
    const clinical = await targetDb.getEncounterClinicalDetail(patient!.pid, encounter!.encounter);
    expect(clinical).not.toBeNull();

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);

      await expectRenderedText(page, new RegExp(escapeRegex(encounterTopic(clinical!.reason)), "i"));
      await expectRenderedText(page, "SOAP");
      await expectRenderedText(page, "Vitals");
      await expectRenderedText(page, /Blood Pressure/i);
      await expectRenderedText(page, /Assessment:/i);
      return;
    }

    await openAuthenticatedModernizedEncounters(page, target, patient!.pubpid, encounterAnchorFromDate);

    const encounterButton = page.getByRole("button", { name: new RegExp(escapeRegex(encounterTopic(clinical!.reason)), "i") }).first();
    await expect(encounterButton).toBeVisible();
    await encounterButton.click();

    await expect(page.getByRole("heading", { name: clinical!.reason })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(`PID ${patient!.pid}`);
    await expect(page.locator("body")).toContainText("SOAP Note");
    await expect(page.locator("body")).toContainText("Vitals");
    await expect(page.locator("body")).toContainText("Blood Pressure");
    await expect(page.locator("body")).toContainText("Assessment:");
    await expect(page.locator("body")).toContainText(clinical!.bloodPressure);
    await expect(page.locator("body")).toContainText(clinical!.assessment);
  });
});

function encounterTopic(reason: string) {
  return reason.replace(/^Follow-up for\s+/i, "").replace(/^Comprehensive\s+/i, "");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
