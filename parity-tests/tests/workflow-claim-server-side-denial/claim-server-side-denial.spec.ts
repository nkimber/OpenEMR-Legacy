import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const serverSideDenialAnchorPatientId = "MOD-PAT-0005";
const serverSideDenialEncounter = 1000052;

test.describe("claim server-side denial parity @slice559 @workflow-claim-server-side-denial @mutation @billing", () => {
  test("creates, server-denies, renders, and removes a temporary claim denial", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(serverSideDenialAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeClaims = await targetDb.getClaimsForPatient(patient!.pid);
    const deniedPayload = `Denied claim ${serverSideDenialEncounter}`;
    const denialProcessFile = `CLAIM-${serverSideDenialEncounter}-DENIAL-SERVER-SIDE-835.txt`;
    const createInput = {
      patientId: patient!.pid,
      encounter: serverSideDenialEncounter,
      payerId: 9005,
      payerName: "Northstar HMO",
      payerType: 1,
      status: 1,
      billProcess: 1,
      billTime: "2026-06-18 12:15:00",
      processFile: denialProcessFile,
      target: "HCFA",
      x12PartnerId: 0,
      submittedClaim: ""
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
        probe: "slice-559-claim-server-side-denial-precondition",
        description: "Captures the Slice 559 server-side claim-denial anchor, baseline claim state, and proposed temporary queued claim before denial.",
        expected: {
          patient: {
            pubpid: serverSideDenialAnchorPatientId
          },
          encounter: serverSideDenialEncounter,
          create: {
            payerName: "Northstar HMO",
            payerType: 1,
            status: 1,
            statusLabel: "Queued for billing",
            billProcess: 1,
            target: "HCFA",
            processFile: denialProcessFile,
            submittedClaim: ""
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
          canonicalId: serverSideDenialAnchorPatientId,
          encounter: serverSideDenialEncounter,
          suite: "workflow-claim-server-side-denial",
          workflow: "claim-server-side-denial-precondition"
        }
      });

      claimId = await workflow.createClaimStatus(createInput);
      const created = await workflow.getClaimStatus(claimId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        encounter: serverSideDenialEncounter,
        payerId: 9005,
        payerName: "Northstar HMO",
        payerType: 1,
        status: 1,
        statusLabel: "Queued for billing",
        billProcess: 1,
        billTime: "2026-06-18 12:15:00",
        processTime: "",
        processFile: denialProcessFile,
        target: "HCFA",
        x12PartnerId: 0,
        submittedClaim: ""
      });
      expect(created!.version).toBeGreaterThan(1);

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient!.pubpid);
        await expect(page.locator("body")).toContainText(`${serverSideDenialAnchorPatientId} / PID ${patient!.pid}`);
        const claimCard = page.locator("article.billing-line-card")
          .filter({ hasText: `Version ${created!.version} / Primary Northstar HMO` })
          .filter({ hasText: "Queued for billing" })
          .first();
        await expect(claimCard).toContainText(denialProcessFile);
        await expect(claimCard.getByRole("button", { name: "Deny" })).toBeEnabled();
        await claimCard.getByRole("button", { name: "Deny" }).click();
        await expect(page.locator("body")).toContainText("Denied");
        await expect(page.locator("body")).toContainText("X12 billing");
        await expect(page.locator("body")).toContainText(denialProcessFile);
        await expect(page.locator("body")).toContainText("Reviewed claim data");
      } else {
        await workflow.updateClaimStatus(claimId, deniedInput);
      }

      const denied = await workflow.getClaimStatus(claimId);
      expect(denied).toMatchObject({
        patientId: patient!.pid,
        encounter: serverSideDenialEncounter,
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
            encounter: serverSideDenialEncounter,
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
        probe: "slice-559-claim-server-side-denial-denied",
        description: "Captures the temporary Slice 559 claim after backend denial, including status 7, X12 response file, backend-generated payload, modernized UI action evidence, and stable temporary claim count.",
        expected: {
          claim: {
            patientId: patient!.pid,
            encounter: serverSideDenialEncounter,
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
          canonicalId: serverSideDenialAnchorPatientId,
          encounter: serverSideDenialEncounter,
          suite: "workflow-claim-server-side-denial",
          workflow: "claim-server-side-denial-denied"
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
        probe: "slice-559-claim-server-side-denial-cleanup",
        description: "Captures the final Slice 559 hard-delete cleanup state for the temporary denied claim row.",
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
          canonicalId: serverSideDenialAnchorPatientId,
          encounter: serverSideDenialEncounter,
          suite: "workflow-claim-server-side-denial",
          workflow: "claim-server-side-denial-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});
