import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openEncounterDirect } from "../../src/ui/legacyOpenEmr.js";
import {
  getModernizedAdminSessionHeaders,
  openAuthenticatedModernizedEncounters
} from "../../src/ui/modernizedOpenEmr.js";

const encounterProtectionPatientId = "MOD-PAT-0001";
const encounterProtectionFromDate = "2026-01-01";

test.describe("encounter protection parity @slice168 @encounter-protection", () => {
  test("requires an active session before encounter details are visible", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterProtectionPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    const clinical = await targetDb.getEncounterClinicalDetail(patient!.pid, encounter!.encounter);
    expect(clinical).not.toBeNull();

    if (target.type === "legacy-openemr") {
      await page.goto(
        `${target.publicUrl}/interface/patient_file/encounter/encounter_top.php?set_pid=${patient!.pid}&set_encounter=${encounter!.encounter}`
      );
      await expect(page.locator("body")).not.toContainText(clinical!.reason);

      await loginToLegacyOpenEmr(page, target);
      await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
      await expectRenderedText(page, new RegExp(escapeRegex(encounterTopic(clinical!.reason)), "i"));
      await expectRenderedText(page, "SOAP");
      await expectRenderedText(page, "Vitals");
      return;
    }

    const unauthenticatedSearch = await page.request.get(
      `${target.apiBaseUrl}/api/encounters?patientId=${encodeURIComponent(patient!.pubpid)}&from=${encounterProtectionFromDate}&limit=5`
    );
    expect(unauthenticatedSearch.status()).toBe(401);
    const unauthenticatedSearchBody = await unauthenticatedSearch.json();
    expect(unauthenticatedSearchBody).toMatchObject({
      authenticated: false,
      sessionSource: "modernized-openemr"
    });

    const unauthenticatedCreate = await page.request.post(`${target.apiBaseUrl}/api/encounters`, {
      data: {
        patientId: patient!.pubpid,
        dateTime: "2026-06-18 10:00:00",
        reason: "Blocked Protection Encounter",
        facilityId: null,
        billingFacilityId: null
      }
    });
    expect(unauthenticatedCreate.status()).toBe(401);

    const headers = await getModernizedAdminSessionHeaders(page, target);
    const authenticatedSearch = await page.request.get(
      `${target.apiBaseUrl}/api/encounters?patientId=${encodeURIComponent(patient!.pubpid)}&from=${encounterProtectionFromDate}&limit=5`,
      { headers }
    );
    expect(authenticatedSearch.ok()).toBeTruthy();
    const search = await authenticatedSearch.json();
    expect(
      search.encounters.some(
        (item: { encounter: number; patientId: string; reason?: string | null }) =>
          item.encounter === encounter!.encounter &&
          item.patientId === patient!.pubpid &&
          item.reason === clinical!.reason
      )
    ).toBe(true);

    const authenticatedDetail = await page.request.get(
      `${target.apiBaseUrl}/api/encounters/${encodeURIComponent(String(encounter!.encounter))}`,
      { headers }
    );
    expect(authenticatedDetail.ok()).toBeTruthy();
    const detail = await authenticatedDetail.json();
    expect(detail).toMatchObject({
      encounter: encounter!.encounter,
      patientId: patient!.pubpid,
      legacyPid: patient!.pid,
      reason: clinical!.reason
    });
    expect(detail.vitals).toBeTruthy();
    expect(detail.soapNote).toBeTruthy();

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Encounters" }).click();
    await expect(page.getByRole("heading", { name: "Encounters", exact: true })).toBeVisible();
    await expect(page.locator("body")).toContainText("Sign in to load encounters");
    await expect(page.locator(".appointment-list")).not.toContainText(clinical!.reason);
    await expect(page.locator(".appointment-detail-panel")).not.toContainText(clinical!.reason);
    await expect(page.getByLabel("Encounter patient ID")).toBeDisabled();
    await expect(page.getByLabel("Encounter from date")).toBeDisabled();
    await expect(page.locator('form[aria-label="Create encounter"]').getByRole("button", { name: "Create" })).toBeDisabled();

    await openAuthenticatedModernizedEncounters(page, target, patient!.pubpid, encounterProtectionFromDate);
    const encounterButton = page.getByRole("button", { name: new RegExp(escapeRegex(encounterTopic(clinical!.reason)), "i") }).first();
    await expect(encounterButton).toBeVisible();
    await encounterButton.click();

    await expect(page.getByRole("heading", { name: clinical!.reason })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(`PID ${patient!.pid}`);
    await expect(page.locator("body")).toContainText("SOAP Note");
    await expect(page.locator("body")).toContainText("Vitals");
  });
});

function encounterTopic(reason: string) {
  return reason.replace(/^Follow-up for\s+/i, "").replace(/^Comprehensive\s+/i, "");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
