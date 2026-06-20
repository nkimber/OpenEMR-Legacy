import { test, expect } from "../../src/fixtures/parityTest.js";

const encounterClaimAnchorPatientId = "MOD-PAT-0001";
const encounterClaimAnchorFromDate = "2026-01-01";
const anchorEncounter = 1000013;
const anchorClaimId = "CLAIM-1000013-1";
const anchorPayerName = "Acme Health";

test.describe("encounter claim linkage readiness parity @slice69 @encounter-claims @claims", () => {
  test("stable encounter anchor exposes linked claim facts", async ({ targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterClaimAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();
    expect(encounter!.encounter).toBe(anchorEncounter);

    const claims = await targetDb.getClaimsForEncounter(patient!.pid, encounter!.encounter);
    expect(claims).toHaveLength(1);

    expect(claims[0]).toMatchObject({
      patientId: patient!.pid,
      encounter: anchorEncounter,
      version: 1,
      payerName: anchorPayerName,
      payerType: 1,
      status: 3,
      statusLabel: "Marked as cleared",
      billProcess: 0,
      target: "HCFA"
    });
  });

  test("encounter-linked claim is reachable from the modernized encounter surface", async ({
    page,
    target,
    targetDb
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterClaimAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    if (target.type === "legacy-openemr") {
      const claims = await targetDb.getClaimsForEncounter(patient!.pid, encounter!.encounter);
      expect(claims).toHaveLength(1);
      expect(claims[0].payerName).toBe(anchorPayerName);
      return;
    }

    const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounter!.encounter}`);
    expect(detailResponse.ok()).toBe(true);
    const detailPayload = await detailResponse.json();
    expect(detailPayload.claims).toHaveLength(1);
    expect(detailPayload.claims[0]).toMatchObject({
      id: anchorClaimId,
      version: 1,
      payerName: anchorPayerName,
      payerType: 1,
      status: 3,
      statusLabel: "Marked as cleared",
      billProcess: 0,
      target: "HCFA"
    });

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Encounters" }).click();
    await expect(page.getByRole("heading", { name: "Encounters" })).toBeVisible();

    await page.getByLabel("Encounter patient ID").fill(patient!.pubpid);
    await page.getByLabel("Encounter from date").fill(encounterClaimAnchorFromDate);

    const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
    await expect(encounterButton).toBeVisible();
    await encounterButton.click();

    const linkage = page.getByLabel("Encounter claim linkage");
    await expect(linkage).toBeVisible();
    await expect(linkage).toContainText("Claim Linkage");
    await expect(linkage).toContainText(anchorPayerName);
    await expect(linkage).toContainText("Marked as cleared");
    await expect(linkage).toContainText("Version 1 / HCFA");
    await expect(linkage).toContainText("Status 3");
    await expect(linkage).toContainText(anchorClaimId);
  });
});
