import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const serverSideClearingAnchorPatientId = "MOD-PAT-0005";
const serverSideClearingEncounter = 1000052;

test.describe("claim server-side clearing parity @slice560 @workflow-claim-server-side-clearing @mutation @billing", () => {
  test("creates, server-clears, renders, and removes a temporary claim", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(serverSideClearingAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeClaims = await targetDb.getClaimsForPatient(patient!.pid);
    const originalProcessFile = `CLAIM-${serverSideClearingEncounter}-CLEAR-SEED-835.txt`;
    const clearedPayload = `Cleared claim ${serverSideClearingEncounter}`;
    const createInput = {
      patientId: patient!.pid,
      encounter: serverSideClearingEncounter,
      payerId: 9005,
      payerName: "Northstar HMO",
      payerType: 1,
      status: 7,
      billProcess: 0,
      billTime: "2026-06-18 12:15:00",
      processTime: "2026-06-18 15:20:00",
      processFile: originalProcessFile,
      target: "X12",
      x12PartnerId: 1,
      submittedClaim: ""
    };
    const clearedInput = {
      status: 3,
      billProcess: 0,
      processFile: "",
      target: "HCFA",
      x12PartnerId: 0,
      submittedClaim: clearedPayload
    };
    let claimId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-560-claim-server-side-clearing-precondition",
        description: "Captures the Slice 560 server-side claim-clearing anchor, baseline claim state, and proposed temporary denied claim before clearing.",
        expected: {
          patient: {
            pubpid: serverSideClearingAnchorPatientId
          },
          encounter: serverSideClearingEncounter,
          create: {
            payerName: "Northstar HMO",
            status: 7,
            statusLabel: "Denied",
            billProcess: 0,
            target: "X12",
            processFile: originalProcessFile,
            submittedClaim: ""
          },
          clear: {
            status: 3,
            statusLabel: "Marked as cleared",
            billProcess: 0,
            processTime: "",
            processFile: "",
            target: "HCFA",
            x12PartnerId: 0,
            submittedClaim: clearedPayload
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
          proposedClear: clearedInput
        },
        context: {
          canonicalId: serverSideClearingAnchorPatientId,
          encounter: serverSideClearingEncounter,
          suite: "workflow-claim-server-side-clearing",
          workflow: "claim-server-side-clearing-precondition"
        }
      });

      claimId = await workflow.createClaimStatus(createInput);
      const created = await workflow.getClaimStatus(claimId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        encounter: serverSideClearingEncounter,
        payerId: 9005,
        payerName: "Northstar HMO",
        payerType: 1,
        status: 7,
        statusLabel: "Denied",
        billProcess: 0,
        processTime: "2026-06-18 15:20:00",
        processFile: originalProcessFile,
        target: "X12",
        x12PartnerId: 1,
        submittedClaim: ""
      });
      expect(created!.version).toBeGreaterThan(1);

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient!.pubpid);
        await expect(page.locator("body")).toContainText(`${serverSideClearingAnchorPatientId} / PID ${patient!.pid}`);
        const claimCard = page.locator("article.billing-line-card")
          .filter({ hasText: `Version ${created!.version} / Primary Northstar HMO` })
          .filter({ hasText: "Denied" })
          .first();
        await expect(claimCard).toContainText(originalProcessFile);
        await expect(claimCard.getByRole("button", { name: "Clear" })).toBeEnabled();
        await claimCard.getByRole("button", { name: "Clear" }).click();
        await expect(page.locator("body")).toContainText("Marked as cleared");
        await expect(page.locator("body")).toContainText("HCFA billing");
        await expect(page.locator("body")).toContainText("No claim file");
        await expect(page.locator("body")).toContainText("Reviewed claim data");
      } else {
        await workflow.updateClaimStatus(claimId, clearedInput);
      }

      const cleared = await workflow.getClaimStatus(claimId);
      expect(cleared).toMatchObject({
        patientId: patient!.pid,
        encounter: serverSideClearingEncounter,
        payerName: "Northstar HMO",
        status: 3,
        statusLabel: "Marked as cleared",
        billProcess: 0,
        processTime: "",
        processFile: "",
        target: "HCFA",
        x12PartnerId: 0,
        submittedClaim: clearedPayload
      });

      const afterClearedCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterClearedCounts.claims).toBe(beforeCounts.claims + 1);
      const afterClearedClaims = await targetDb.getClaimsForPatient(patient!.pid);
      expect(afterClearedClaims).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            encounter: serverSideClearingEncounter,
            payerName: "Northstar HMO",
            status: 3,
            statusLabel: "Marked as cleared",
            billProcess: 0,
            processFile: "",
            target: "HCFA",
            submittedClaim: clearedPayload
          })
        ])
      );

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-560-claim-server-side-clearing-cleared",
        description: "Captures the temporary Slice 560 claim after backend clearing, including HCFA target metadata, cleared status, backend fallback payload, modernized UI action evidence, and stable temporary claim count.",
        expected: {
          claim: {
            patientId: patient!.pid,
            encounter: serverSideClearingEncounter,
            payerName: "Northstar HMO",
            status: 3,
            statusLabel: "Marked as cleared",
            billProcess: 0,
            processTime: "",
            processFile: "",
            target: "HCFA",
            x12PartnerId: 0,
            submittedClaim: clearedPayload
          },
          counts: {
            claims: beforeCounts.claims + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterClearedCounts,
          beforeClaimsCount: beforeClaims.length,
          clearedClaims: afterClearedClaims.filter((claim) => claim.encounter === serverSideClearingEncounter && claim.submittedClaim === clearedPayload),
          claimId,
          created,
          cleared
        },
        context: {
          canonicalId: serverSideClearingAnchorPatientId,
          encounter: serverSideClearingEncounter,
          suite: "workflow-claim-server-side-clearing",
          workflow: "claim-server-side-clearing-cleared"
        }
      });
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
        probe: "slice-560-claim-server-side-clearing-cleanup",
        description: "Captures the final Slice 560 hard-delete cleanup state for the temporary cleared claim row.",
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
          canonicalId: serverSideClearingAnchorPatientId,
          encounter: serverSideClearingEncounter,
          suite: "workflow-claim-server-side-clearing",
          workflow: "claim-server-side-clearing-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});
