import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const claimResubmissionAnchorPatientId = "MOD-PAT-0005";
const claimResubmissionEncounter = 1000052;

test.describe("claim resubmission parity @slice534 @workflow-claim-resubmission @mutation @billing", () => {
  test("creates, resubmits, renders, and removes a temporary denied claim", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(claimResubmissionAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeClaims = await targetDb.getClaimsForPatient(patient!.pid);
    const createInput = {
      patientId: patient!.pid,
      encounter: claimResubmissionEncounter,
      payerId: 9005,
      payerName: "Northstar HMO",
      payerType: 1,
      status: 7,
      billProcess: 0,
      billTime: "2026-06-18 12:15:00",
      processTime: "2026-06-18 15:20:00",
      processFile: `CLAIM-${claimResubmissionEncounter}-DENIAL-RESUBMIT-SEED-835.txt`,
      target: "X12",
      x12PartnerId: 1,
      submittedClaim: "Denied claim awaiting parity resubmission"
    };
    let claimId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-534-claim-resubmission-precondition",
        description: "Captures the Slice 534 claim-resubmission anchor, baseline claim count, existing claims, and proposed temporary denied claim.",
        expected: {
          patient: {
            pubpid: claimResubmissionAnchorPatientId
          },
          encounter: claimResubmissionEncounter,
          deniedClaim: {
            payerName: "Northstar HMO",
            status: 7,
            statusLabel: "Denied",
            billProcess: 0,
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
          proposedClaim: createInput
        },
        context: {
          canonicalId: claimResubmissionAnchorPatientId,
          encounter: claimResubmissionEncounter,
          suite: "workflow-claim-resubmission",
          workflow: "claim-resubmission-precondition"
        }
      });

      claimId = await workflow.createClaimStatus(createInput);
      const created = await workflow.getClaimStatus(claimId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        encounter: claimResubmissionEncounter,
        payerId: 9005,
        payerName: "Northstar HMO",
        payerType: 1,
        status: 7,
        statusLabel: "Denied",
        billProcess: 0,
        target: "X12",
        x12PartnerId: 1,
        submittedClaim: "Denied claim awaiting parity resubmission"
      });

      const expectedResubmission = buildClaimResubmissionPayload(
        claimId,
        claimResubmissionEncounter,
        "Northstar HMO",
        9005,
        patient!.pubpid,
        created!.statusLabel
      );

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient!.pubpid);
        await expect(page.locator("body")).toContainText(`${claimResubmissionAnchorPatientId} / PID ${patient!.pid}`);
        const claimCard = page.locator("article.billing-line-card")
          .filter({ hasText: `Version ${created!.version} / Primary Northstar HMO` })
          .filter({ hasText: "Denied" })
          .first();
        await expect(claimCard).toContainText("Denied");
        await expect(claimCard.getByRole("button", { name: "Resubmit" })).toBeEnabled();
        await claimCard.getByRole("button", { name: "Resubmit" }).click();
        await expect(page.locator("body")).toContainText(expectedResubmission.processFile);
        await expect(page.locator("body")).toContainText("Queued for billing");
        await expect(page.locator("body")).toContainText("Reviewed claim data");
      } else {
        await workflow.updateClaimStatus(claimId, {
          status: 1,
          billProcess: 1,
          processTime: "2026-06-18 17:10:00",
          processFile: expectedResubmission.processFile,
          target: "X12",
          x12PartnerId: 1,
          submittedClaim: expectedResubmission.payload
        });
      }

      const resubmitted = await workflow.getClaimStatus(claimId);
      expect(resubmitted).toMatchObject({
        patientId: patient!.pid,
        encounter: claimResubmissionEncounter,
        payerName: "Northstar HMO",
        status: 1,
        statusLabel: "Queued for billing",
        billProcess: 1,
        processTime: "2026-06-18 17:10:00",
        processFile: expectedResubmission.processFile,
        target: "X12",
        x12PartnerId: 1,
        submittedClaim: expectedResubmission.payload
      });
      expect(resubmitted!.submittedClaim).toContain("RESUBMIT");
      expect(resubmitted!.submittedClaim).toContain("sourceStatus=Denied");
      expect(resubmitted!.submittedClaim).toContain("reason=corrected-and-requeued");

      const afterResubmitCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterResubmitCounts.claims).toBe(beforeCounts.claims + 1);
      const afterResubmitClaims = await targetDb.getClaimsForPatient(patient!.pid);
      const resubmittedClaims = afterResubmitClaims.filter((claim) => claim.processFile === expectedResubmission.processFile);
      expect(resubmittedClaims).toHaveLength(1);
      expect(resubmittedClaims[0]).toMatchObject({
        encounter: claimResubmissionEncounter,
        payerName: "Northstar HMO",
        status: 1,
        statusLabel: "Queued for billing",
        billProcess: 1,
        processFile: expectedResubmission.processFile,
        target: "X12",
        submittedClaim: expectedResubmission.payload
      });

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-534-claim-resubmission-resubmitted",
        description: "Captures the temporary Slice 534 claim after resubmission, including queued status, X12 target metadata, deterministic resubmission payload, modernized UI action evidence, and claim-count stability.",
        expected: {
          claim: {
            patientId: patient!.pid,
            encounter: claimResubmissionEncounter,
            payerName: "Northstar HMO",
            status: 1,
            statusLabel: "Queued for billing",
            billProcess: 1,
            processTime: "2026-06-18 17:10:00",
            processFile: expectedResubmission.processFile,
            target: "X12",
            x12PartnerId: 1,
            submittedClaim: expectedResubmission.payload
          },
          counts: {
            claims: beforeCounts.claims + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterResubmitCounts,
          claimId,
          created,
          resubmitted,
          resubmittedClaims
        },
        context: {
          canonicalId: claimResubmissionAnchorPatientId,
          encounter: claimResubmissionEncounter,
          suite: "workflow-claim-resubmission",
          workflow: "claim-resubmission-resubmitted"
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
        probe: "slice-534-claim-resubmission-cleanup",
        description: "Captures the final Slice 534 cleanup state for the temporary resubmitted claim.",
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
          canonicalId: claimResubmissionAnchorPatientId,
          encounter: claimResubmissionEncounter,
          suite: "workflow-claim-resubmission",
          workflow: "claim-resubmission-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function buildClaimResubmissionPayload(
  claimId: number | string,
  encounter: number,
  payerName: string,
  payerId: number,
  patientId: string,
  sourceStatus: string
) {
  const controlNumber = String(claimId).replace(/[^a-z0-9]/gi, "").slice(0, 12).toUpperCase() || "CLAIM";
  const processFile = `CLAIM-${encounter}-${controlNumber}-RESUBMIT.txt`;
  const payload = [
    "RESUBMIT",
    `claim=${controlNumber}`,
    `patient=${patientId}`,
    `encounter=${encounter}`,
    `payer=${payerName || payerId}`,
    `sourceStatus=${sourceStatus}`,
    "target=X12",
    "reason=corrected-and-requeued"
  ].join("|");

  return { processFile, payload };
}
