import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const claimMutationAnchorPatientId = "MOD-PAT-0005";
const claimMutationEncounter = 1000052;

test.describe("claim status mutation parity @slice57 @workflow-claims @mutation @billing", () => {
  test("creates, generates, clears, renders, and removes a temporary claim", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(claimMutationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeClaims = await targetDb.getClaimsForPatient(patient!.pid);
    const processFile = `CLAIM-${claimMutationEncounter}-PARITY-${Math.floor(Math.random() * 100000)}-837P.txt`;
    const queuedPayload = `Parity queued claim ${Date.now()}`;
    const generatedPayload = `Generated parity claim ${Date.now()}`;
    const createInput = {
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
    };
    const generatedInput = {
      status: 2,
      billProcess: 0,
      processTime: "2026-06-18 14:15:00",
      processFile,
      target: "X12",
      x12PartnerId: 1,
      submittedClaim: generatedPayload
    };
    const clearedInput = {
      status: 3,
      billProcess: 0,
      processFile: "",
      target: "HCFA",
      x12PartnerId: 0,
      submittedClaim: "Cleared parity claim"
    };
    let claimId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-57-claim-status-mutation-precondition",
        description: "Captures the Slice 57 claim status anchor patient, baseline claim count, existing claims, and proposed temporary queued claim payload.",
        expected: {
          patient: {
            pubpid: claimMutationAnchorPatientId
          },
          encounter: claimMutationEncounter,
          create: {
            payerName: "Northstar HMO",
            payerType: 1,
            status: 1,
            statusLabel: "Queued for billing",
            billProcess: 1,
            target: "HCFA",
            processFile: "",
            x12PartnerId: 0
          },
          countChange: {
            claimsAfterCreate: beforeCounts.claims + 1,
            claimsAfterCleanup: beforeCounts.claims
          }
        },
        actual: {
          patient,
          beforeCounts,
          beforeClaims,
          proposedClaim: createInput
        },
        context: {
          canonicalId: claimMutationAnchorPatientId,
          encounter: claimMutationEncounter,
          suite: "workflow-claims",
          workflow: "claim-status-mutation"
        }
      });

      claimId = await workflow.createClaimStatus(createInput);

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-57-claim-status-mutation-created",
        description: "Captures the temporary Slice 57 claim after queued create, including versioned queued HCFA status and claim-count increment.",
        expected: {
          claim: {
            patientId: patient!.pid,
            encounter: claimMutationEncounter,
            payerName: "Northstar HMO",
            status: 1,
            statusLabel: "Queued for billing",
            billProcess: 1,
            billTime: "2026-06-18 12:15:00",
            processTime: "",
            processFile: "",
            target: "HCFA",
            x12PartnerId: 0,
            submittedClaim: queuedPayload,
            versionGreaterThan: 1
          },
          counts: {
            claims: beforeCounts.claims + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          beforeClaimsCount: beforeClaims.length,
          afterCreateClaims: afterCreateClaims.filter((claim) => claim.submittedClaim === queuedPayload),
          claimId,
          created
        },
        context: {
          canonicalId: claimMutationAnchorPatientId,
          encounter: claimMutationEncounter,
          suite: "workflow-claims",
          workflow: "claim-status-created"
        }
      });

      if (target.type !== "legacy-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText("Claim Status");
        await expect(page.locator("body")).toContainText("Queued for billing");
        await expect(page.locator("body")).toContainText("Northstar HMO");
        await expect(page.locator("body")).toContainText("HCFA billing");
        await expect(page.locator("body")).toContainText(`Version ${created!.version}`);
      }

      await workflow.updateClaimStatus(claimId, generatedInput);

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
      const afterGeneratedClaims = await targetDb.getClaimsForPatient(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-57-claim-status-mutation-generated",
        description: "Captures the temporary Slice 57 claim after generated X12/file update while preserving the single temporary claim row.",
        expected: {
          claim: {
            status: 2,
            statusLabel: "Marked as cleared",
            billProcess: 0,
            processTime: "2026-06-18 14:15:00",
            processFile,
            target: "X12",
            x12PartnerId: 1,
            submittedClaim: generatedPayload
          },
          counts: {
            claims: beforeCounts.claims + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          claimId,
          generated,
          generatedInput,
          afterGeneratedClaims: afterGeneratedClaims.filter((claim) => claim.processFile === processFile)
        },
        context: {
          canonicalId: claimMutationAnchorPatientId,
          encounter: claimMutationEncounter,
          suite: "workflow-claims",
          workflow: "claim-status-generated"
        }
      });

      if (target.type !== "legacy-openemr") {
        await page.getByLabel("Fees patient ID").fill("");
        await page.getByLabel("Fees patient ID").fill(patient!.pubpid);
        await expect(page.locator("body")).toContainText("Marked as cleared");
        await expect(page.locator("body")).toContainText("X12 billing");
        await expect(page.locator("body")).toContainText(processFile);
      }

      await workflow.updateClaimStatus(claimId, clearedInput);

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
      const afterClearedClaims = await targetDb.getClaimsForPatient(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-57-claim-status-mutation-cleared",
        description: "Captures the temporary Slice 57 claim after cleared HCFA/no-file update while preserving the temporary claim count.",
        expected: {
          claim: {
            status: 3,
            statusLabel: "Marked as cleared",
            billProcess: 0,
            processTime: "",
            processFile: "",
            target: "HCFA",
            x12PartnerId: 0,
            submittedClaim: "Cleared parity claim"
          },
          counts: {
            claims: beforeCounts.claims + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          claimId,
          cleared,
          clearedInput,
          afterClearedClaims: afterClearedClaims.filter((claim) => claim.submittedClaim === "Cleared parity claim")
        },
        context: {
          canonicalId: claimMutationAnchorPatientId,
          encounter: claimMutationEncounter,
          suite: "workflow-claims",
          workflow: "claim-status-cleared"
        }
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
      const afterCleanup = await workflow.getClaimStatus(claimId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-57-claim-status-mutation-cleanup",
        description: "Captures the final Slice 57 hard-delete cleanup state for the temporary claim status row.",
        expected: {
          counts: {
            claims: beforeCounts.claims
          },
          deletedClaim: null
        },
        actual: {
          patient,
          beforeCounts,
          afterCleanupCounts,
          claimId,
          afterCleanup
        },
        context: {
          canonicalId: claimMutationAnchorPatientId,
          encounter: claimMutationEncounter,
          suite: "workflow-claims",
          workflow: "claim-status-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});
