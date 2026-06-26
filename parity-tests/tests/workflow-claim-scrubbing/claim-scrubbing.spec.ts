import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const claimScrubbingAnchorPatientId = "MOD-PAT-0005";
const claimScrubbingEncounter = 1000052;

type BillingLineLike = {
  codeType?: string | null;
  code?: string | null;
  fee?: string | number | null;
  justify?: string | null;
  units?: string | number | null;
};

test.describe("claim scrubbing parity @slice533 @workflow-claim-scrubbing @mutation @billing", () => {
  test("creates, scrubs, renders, and removes a temporary claim scrub report", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(claimScrubbingAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeClaims = await targetDb.getClaimsForPatient(patient!.pid);
    const billingLines = await targetDb.getBillingLinesForEncounter(patient!.pid, claimScrubbingEncounter);
    const createInput = {
      patientId: patient!.pid,
      encounter: claimScrubbingEncounter,
      payerId: 9005,
      payerName: "Northstar HMO",
      payerType: 1,
      status: 1,
      billProcess: 1,
      billTime: "2026-06-18 12:15:00",
      processFile: "",
      target: "HCFA",
      x12PartnerId: 0,
      submittedClaim: ""
    };
    let claimId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-533-claim-scrubbing-precondition",
        description: "Captures the Slice 533 claim-scrubbing anchor, baseline claim count, existing encounter billing lines, and proposed temporary queued claim.",
        expected: {
          patient: {
            pubpid: claimScrubbingAnchorPatientId
          },
          encounter: claimScrubbingEncounter,
          scrubInputs: {
            payerName: "Northstar HMO",
            minimumCptLines: 1,
            diagnosisPointersRequired: true,
            positiveFeesRequired: true,
            positiveUnitsRequired: true
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
          billingLines,
          proposedClaim: createInput
        },
        context: {
          canonicalId: claimScrubbingAnchorPatientId,
          encounter: claimScrubbingEncounter,
          suite: "workflow-claim-scrubbing",
          workflow: "claim-scrubbing-precondition"
        }
      });

      claimId = await workflow.createClaimStatus(createInput);
      const created = await workflow.getClaimStatus(claimId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        encounter: claimScrubbingEncounter,
        payerName: "Northstar HMO",
        status: 1,
        statusLabel: "Queued for billing",
        billProcess: 1,
        processFile: "",
        target: "HCFA",
        submittedClaim: ""
      });

      const expectedScrub = buildClaimScrubReport(claimId, claimScrubbingEncounter, "Northstar HMO", 9005, patient!.pubpid, billingLines);

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient!.pubpid);
        await expect(page.locator("body")).toContainText(`${claimScrubbingAnchorPatientId} / PID ${patient!.pid}`);
        const claimCard = page.locator("article.billing-line-card")
          .filter({ hasText: `Version ${created!.version} / Primary Northstar HMO` })
          .filter({ hasText: "Queued for billing" })
          .first();
        await expect(claimCard).toContainText("No claim file");
        await claimCard.getByRole("button", { name: "Scrub" }).click();
        await expect(page.locator("body")).toContainText(expectedScrub.processFile);
        await expect(page.locator("body")).toContainText("Reviewed claim data");
      } else {
        await workflow.updateClaimStatus(claimId, {
          status: 1,
          billProcess: 1,
          processTime: "2026-06-18 13:05:00",
          processFile: expectedScrub.processFile,
          target: "HCFA",
          x12PartnerId: 0,
          submittedClaim: expectedScrub.report
        });
      }

      const scrubbed = await workflow.getClaimStatus(claimId);
      expect(scrubbed).toMatchObject({
        patientId: patient!.pid,
        encounter: claimScrubbingEncounter,
        payerName: "Northstar HMO",
        status: 1,
        statusLabel: "Queued for billing",
        billProcess: 1,
        processTime: "2026-06-18 13:05:00",
        processFile: expectedScrub.processFile,
        target: "HCFA",
        x12PartnerId: 0,
        submittedClaim: expectedScrub.report
      });
      expect(scrubbed!.submittedClaim).toContain("SCRUB-PASS");
      expect(scrubbed!.submittedClaim).toContain("issues=none");
      expect(scrubbed!.submittedClaim).toContain("diagnosisPointers=K21.9");

      const afterScrubCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterScrubCounts.claims).toBe(beforeCounts.claims + 1);
      const afterScrubClaims = await targetDb.getClaimsForPatient(patient!.pid);
      expect(afterScrubClaims).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            encounter: claimScrubbingEncounter,
            payerName: "Northstar HMO",
            status: 1,
            statusLabel: "Queued for billing",
            billProcess: 1,
            processFile: expectedScrub.processFile,
            target: "HCFA",
            submittedClaim: expectedScrub.report
          })
        ])
      );

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-533-claim-scrubbing-scrubbed",
        description: "Captures the temporary Slice 533 claim after local claim scrubbing, including deterministic scrub report content, process-file metadata, modernized UI action evidence, and claim-count stability.",
        expected: {
          claim: {
            patientId: patient!.pid,
            encounter: claimScrubbingEncounter,
            payerName: "Northstar HMO",
            status: 1,
            statusLabel: "Queued for billing",
            processTime: "2026-06-18 13:05:00",
            processFile: expectedScrub.processFile,
            target: "HCFA",
            submittedClaim: expectedScrub.report
          },
          counts: {
            claims: beforeCounts.claims + 1
          },
          scrub: {
            status: "PASS",
            issues: []
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterScrubCounts,
          claimId,
          created,
          scrubbed,
          scrubbedClaims: afterScrubClaims.filter((claim) => claim.processFile === expectedScrub.processFile)
        },
        context: {
          canonicalId: claimScrubbingAnchorPatientId,
          encounter: claimScrubbingEncounter,
          suite: "workflow-claim-scrubbing",
          workflow: "claim-scrubbing-scrubbed"
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
        probe: "slice-533-claim-scrubbing-cleanup",
        description: "Captures the final Slice 533 cleanup state for the temporary scrubbed claim.",
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
          canonicalId: claimScrubbingAnchorPatientId,
          encounter: claimScrubbingEncounter,
          suite: "workflow-claim-scrubbing",
          workflow: "claim-scrubbing-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function buildClaimScrubReport(
  claimId: number | string,
  encounter: number,
  payerName: string,
  payerId: number,
  patientId: string,
  encounterLines: BillingLineLike[]
) {
  const controlNumber = String(claimId).replace(/[^a-z0-9]/gi, "").slice(0, 12).toUpperCase() || "CLAIM";
  const cptLines = encounterLines.filter((line) => (line.codeType || "").toUpperCase() === "CPT4");
  const diagnosisPointers = Array.from(
    new Set(cptLines.map((line) => line.justify?.trim()).filter((value): value is string => Boolean(value)))
  );
  const issues: string[] = [];

  if (payerId <= 0 || !payerName) {
    issues.push("missing-payer");
  }
  if (cptLines.length === 0) {
    issues.push("missing-cpt-line");
  }
  if (cptLines.some((line) => !line.justify?.trim())) {
    issues.push("missing-diagnosis-pointer");
  }
  if (cptLines.some((line) => Number(line.fee ?? 0) <= 0)) {
    issues.push("invalid-fee");
  }
  if (cptLines.some((line) => Number(line.units ?? 1) <= 0)) {
    issues.push("invalid-units");
  }

  const status = issues.length === 0 ? "PASS" : "FAIL";
  const processFile = `CLAIM-${encounter}-${controlNumber}-SCRUB.txt`;
  const report = [
    `SCRUB-${status}`,
    `claim=${controlNumber}`,
    `patient=${patientId}`,
    `encounter=${encounter}`,
    `payer=${payerName || payerId}`,
    `cptCount=${cptLines.length}`,
    `diagnosisPointers=${diagnosisPointers.join(",") || "none"}`,
    `issues=${issues.join(",") || "none"}`
  ].join("|");

  return { processFile, report, status, issues };
}
