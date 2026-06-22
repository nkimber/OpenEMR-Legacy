import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const claimStatusAnchorPatientId = "MOD-PAT-0005";

test.describe("claim status parity @slice47 @claims @billing", () => {
  test("stable billing anchor has seeded claim status history", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(claimStatusAnchorPatientId);
    expect(patient).not.toBeNull();

    const claims = await targetDb.getClaimsForPatient(patient!.pid);
    expect(claims.length).toBeGreaterThanOrEqual(3);

    const queuedClaim = claims.find((claim) => claim.statusLabel === "Queued for billing" && claim.billProcess === 1);
    const generatedClaim = claims.find((claim) => claim.processFile.match(/^CLAIM-\d+-837P\.txt$/));
    const clearedClaim = claims.find(
      (claim) => claim.statusLabel === "Marked as cleared" && claim.processFile === "" && claim.billProcess === 0
    );

    expect(queuedClaim).toMatchObject({
      patientId: patient!.pid,
      version: 1,
      payerName: "Northstar HMO",
      payerType: 1,
      statusLabel: "Queued for billing",
      target: "HCFA"
    });
    expect(generatedClaim).toMatchObject({
      patientId: patient!.pid,
      version: 1,
      payerName: "Northstar HMO",
      statusLabel: "Marked as cleared",
      target: "X12"
    });
    expect(clearedClaim).toMatchObject({
      patientId: patient!.pid,
      version: 1,
      payerName: "Northstar HMO",
      statusLabel: "Marked as cleared",
      target: "HCFA"
    });

    if (target.type === "legacy-openemr") {
      return;
    }

    await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText("Claims");
    await expect(page.locator("body")).toContainText("Claim Status");
    await expect(page.locator("body")).toContainText("Queued for billing");
    await expect(page.locator("body")).toContainText("Marked as cleared");
    await expect(page.locator("body")).toContainText("Northstar HMO");
    await expect(page.locator("body")).toContainText(generatedClaim!.processFile);
  });
});
