import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const claimDenialAnchorPatientId = "MOD-PAT-0005";
const claimDenialEncounter = 1000052;

test.describe("claim denial parity @slice529 @workflow-claim-denials @mutation @billing", () => {
  test("creates, denies, renders, and removes a temporary claim denial", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(claimDenialAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeClaims = await targetDb.getClaimsForPatient(patient!.pid);
    const queuedPayload = `Parity denial queued claim ${Date.now()}`;
    const deniedPayload = `Denied parity claim ${Date.now()}`;
    const denialProcessFile = `CLAIM-${claimDenialEncounter}-DENIAL-${Math.floor(Math.random() * 100000)}-835.txt`;
    const createInput = {
      patientId: patient!.pid,
      encounter: claimDenialEncounter,
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
    const deniedInput = {
      status: 7,
      billProcess: 0,
      processTime: "2026-06-18 15:20:00",
      processFile: denialProcessFile,
      target: "X12",
      x12PartnerId: 1,
      submittedClaim: deniedPayload
    };
    let claimId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-529-claim-denial-precondition",
        description: "Captures the Slice 529 claim-denial anchor, baseline claim state, and proposed temporary queued claim payload before denial.",
        expected: {
          patient: {
            pubpid: claimDenialAnchorPatientId
          },
          encounter: claimDenialEncounter,
          create: {
            payerName: "Northstar HMO",
            payerType: 1,
            status: 1,
            statusLabel: "Queued for billing",
            billProcess: 1,
            target: "HCFA"
          },
          denial: {
            status: 7,
            statusLabel: "Denied",
            billProcess: 0,
            processTime: "2026-06-18 15:20:00",
            processFile: denialProcessFile,
            target: "X12",
            x12PartnerId: 1
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
          proposedClaim: createInput,
          proposedDenial: deniedInput
        },
        context: {
          canonicalId: claimDenialAnchorPatientId,
          encounter: claimDenialEncounter,
          suite: "workflow-claim-denials",
          workflow: "claim-denial-precondition"
        }
      });

      claimId = await workflow.createClaimStatus(createInput);
      const created = await workflow.getClaimStatus(claimId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        encounter: claimDenialEncounter,
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

      await workflow.updateClaimStatus(claimId, deniedInput);
      const denied = await workflow.getClaimStatus(claimId);
      expect(denied).toMatchObject({
        patientId: patient!.pid,
        encounter: claimDenialEncounter,
        payerName: "Northstar HMO",
        status: 7,
        statusLabel: "Denied",
        billProcess: 0,
        processTime: "2026-06-18 15:20:00",
        processFile: denialProcessFile,
        target: "X12",
        x12PartnerId: 1,
        submittedClaim: deniedPayload
      });

      const afterDeniedCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterDeniedCounts.claims).toBe(beforeCounts.claims + 1);
      const afterDeniedClaims = await targetDb.getClaimsForPatient(patient!.pid);
      expect(afterDeniedClaims).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            encounter: claimDenialEncounter,
            payerName: "Northstar HMO",
            status: 7,
            statusLabel: "Denied",
            billProcess: 0,
            processFile: denialProcessFile,
            target: "X12",
            submittedClaim: deniedPayload
          })
        ])
      );

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-529-claim-denial-denied",
        description: "Captures the temporary Slice 529 claim after denial, including status 7, X12 response file, payload, and stable temporary claim count.",
        expected: {
          claim: {
            patientId: patient!.pid,
            encounter: claimDenialEncounter,
            payerName: "Northstar HMO",
            status: 7,
            statusLabel: "Denied",
            billProcess: 0,
            processTime: "2026-06-18 15:20:00",
            processFile: denialProcessFile,
            target: "X12",
            x12PartnerId: 1,
            submittedClaim: deniedPayload
          },
          counts: {
            claims: beforeCounts.claims + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterDeniedCounts,
          beforeClaimsCount: beforeClaims.length,
          deniedClaims: afterDeniedClaims.filter((claim) => claim.processFile === denialProcessFile),
          claimId,
          created,
          denied
        },
        context: {
          canonicalId: claimDenialAnchorPatientId,
          encounter: claimDenialEncounter,
          suite: "workflow-claim-denials",
          workflow: "claim-denial-denied"
        }
      });

      if (target.type !== "legacy-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

        await expect(page.locator("body")).toContainText("Claim Status");
        await expect(page.locator("body")).toContainText("Denied");
        await expect(page.locator("body")).toContainText("Northstar HMO");
        await expect(page.locator("body")).toContainText("X12 billing");
        await expect(page.locator("body")).toContainText(denialProcessFile);
        await expect(page.getByRole("button", { name: "Deny" }).first()).toBeVisible();
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
        probe: "slice-529-claim-denial-cleanup",
        description: "Captures the final Slice 529 hard-delete cleanup state for the temporary denied claim row.",
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
          canonicalId: claimDenialAnchorPatientId,
          encounter: claimDenialEncounter,
          suite: "workflow-claim-denials",
          workflow: "claim-denial-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});
