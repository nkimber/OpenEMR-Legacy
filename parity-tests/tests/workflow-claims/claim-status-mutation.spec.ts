import { test, expect } from "../../src/fixtures/parityTest.js";

const claimMutationAnchorPatientId = "MOD-PAT-0005";
const claimMutationEncounter = 1000052;

test.describe("claim status mutation parity @slice57 @workflow-claims @mutation @billing", () => {
  test("creates, generates, clears, renders, and removes a temporary claim", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(claimMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeClaims = await targetDb.getClaimsForPatient(patient!.pid);
    const processFile = `CLAIM-${claimMutationEncounter}-PARITY-${Math.floor(Math.random() * 100000)}-837P.txt`;
    const queuedPayload = `Parity queued claim ${Date.now()}`;
    const generatedPayload = `Generated parity claim ${Date.now()}`;
    let claimId: number | string | null = null;

    try {
      claimId = await workflow.createClaimStatus({
        patientId: patient!.pid,
        encounter: claimMutationEncounter,
        payerId: 9005,
        payerName: "Northstar HMO",
        payerType: 1,
        status: 1,
        billProcess: 1,
        billTime: "2026-06-18 12:15:00",
        processFile: "",
        target: "HCFA",
        x12PartnerId: 0,
        submittedClaim: queuedPayload
      });

      const created = await workflow.getClaimStatus(claimId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        encounter: claimMutationEncounter,
        payerId: 9005,
        payerName: "Northstar HMO",
        payerType: 1,
        status: 1,
        statusLabel: "Queued for billing",
        billProcess: 1,
        billTime: "2026-06-18 12:15:00",
        processTime: "",
        processFile: "",
        target: "HCFA",
        x12PartnerId: 0,
        submittedClaim: queuedPayload
      });
      expect(created!.version).toBeGreaterThan(1);

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.claims).toBe(beforeCounts.claims + 1);
      const afterCreateClaims = await targetDb.getClaimsForPatient(patient!.pid);
      expect(afterCreateClaims.length).toBe(beforeClaims.length + 1);

      if (target.type !== "legacy-openemr") {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Fees" }).click();
        await expect(page.getByRole("heading", { name: "Fees" })).toBeVisible();
        await page.getByLabel("Fees patient ID").fill(patient!.pubpid);

        await expect(page.locator("body")).toContainText("Claim Status");
        await expect(page.locator("body")).toContainText("Queued for billing");
        await expect(page.locator("body")).toContainText("Northstar HMO");
        await expect(page.locator("body")).toContainText("HCFA billing");
        await expect(page.locator("body")).toContainText(`Version ${created!.version}`);
      }

      await workflow.updateClaimStatus(claimId, {
        status: 2,
        billProcess: 0,
        processTime: "2026-06-18 14:15:00",
        processFile,
        target: "X12",
        x12PartnerId: 1,
        submittedClaim: generatedPayload
      });

      const generated = await workflow.getClaimStatus(claimId);
      expect(generated).toMatchObject({
        status: 2,
        statusLabel: "Marked as cleared",
        billProcess: 0,
        processTime: "2026-06-18 14:15:00",
        processFile,
        target: "X12",
        x12PartnerId: 1,
        submittedClaim: generatedPayload
      });

      if (target.type !== "legacy-openemr") {
        await page.getByLabel("Fees patient ID").fill("");
        await page.getByLabel("Fees patient ID").fill(patient!.pubpid);
        await expect(page.locator("body")).toContainText("Marked as cleared");
        await expect(page.locator("body")).toContainText("X12 billing");
        await expect(page.locator("body")).toContainText(processFile);
      }

      await workflow.updateClaimStatus(claimId, {
        status: 3,
        billProcess: 0,
        processFile: "",
        target: "HCFA",
        x12PartnerId: 0,
        submittedClaim: "Cleared parity claim"
      });

      const cleared = await workflow.getClaimStatus(claimId);
      expect(cleared).toMatchObject({
        status: 3,
        statusLabel: "Marked as cleared",
        billProcess: 0,
        processTime: "",
        processFile: "",
        target: "HCFA",
        x12PartnerId: 0,
        submittedClaim: "Cleared parity claim"
      });

      if (target.type !== "legacy-openemr") {
        await page.getByLabel("Fees patient ID").fill("");
        await page.getByLabel("Fees patient ID").fill(patient!.pubpid);
        await expect(page.locator("body")).toContainText("Marked as cleared");
        await expect(page.locator("body")).toContainText("HCFA billing");
        await expect(page.locator("body")).toContainText("No claim file");
      }
    } finally {
      if (claimId !== null) {
        await workflow.deleteClaimStatus(claimId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.claims).toBe(beforeCounts.claims);
    if (claimId !== null) {
      await expect(workflow.getClaimStatus(claimId)).resolves.toBeNull();
    }
  });
});
