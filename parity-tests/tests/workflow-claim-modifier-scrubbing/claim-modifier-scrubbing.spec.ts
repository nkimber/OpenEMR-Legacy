import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const claimModifierScrubbingAnchorPatientId = "MOD-PAT-0005";
const claimModifierScrubbingEncounter = 1000052;
const invalidModifier = "ZZ";

type BillingLineLike = {
  codeType?: string | null;
  code?: string | null;
  modifier?: string | null;
  fee?: string | number | null;
  justify?: string | null;
  units?: string | number | null;
};

test.describe("claim modifier scrubbing parity @slice536 @workflow-claim-modifier-scrubbing @mutation @billing", () => {
  test("creates, flags, renders, and removes an invalid-modifier claim scrub report", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(claimModifierScrubbingAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${claimModifierScrubbingAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeClaims = await targetDb.getClaimsForPatient(patient.pid);
    const beforeLines = await targetDb.getBillingLinesForEncounter(patient.pid, claimModifierScrubbingEncounter);
    const createClaimInput = {
      patientId: patient.pid,
      encounter: claimModifierScrubbingEncounter,
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
    let billingLineId: number | string | null = null;
    let claimId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-536-claim-modifier-scrubbing-precondition",
        description: "Captures the Slice 536 claim modifier-scrubbing anchor, baseline claim/line counts, existing encounter billing lines, and proposed temporary invalid-modifier CPT line plus queued claim.",
        expected: {
          patient: {
            pubpid: claimModifierScrubbingAnchorPatientId
          },
          encounter: claimModifierScrubbingEncounter,
          invalidModifier,
          countChange: {
            claimsAfterCreate: beforeCounts.claims + 1,
            billingLinesAfterCreate: beforeCounts.billingLineItems + 1,
            claimsAfterCleanup: beforeCounts.claims,
            billingLinesAfterCleanup: beforeCounts.billingLineItems
          }
        },
        actual: {
          patient,
          beforeCounts,
          beforeClaims,
          beforeLines,
          proposedClaim: createClaimInput
        },
        context: {
          canonicalId: claimModifierScrubbingAnchorPatientId,
          encounter: claimModifierScrubbingEncounter,
          suite: "workflow-claim-modifier-scrubbing",
          workflow: "claim-modifier-scrubbing-precondition"
        }
      });

      billingLineId = await workflow.createBillingLine({
        patientId: patient.pid,
        providerId: patient.providerId,
        encounter: claimModifierScrubbingEncounter,
        dateTime: "2026-06-18 13:10:00",
        codeType: "CPT4",
        code: "99214",
        modifier: invalidModifier,
        codeText: "Unsupported modifier parity charge",
        fee: "115.00",
        units: 1,
        justify: "K21.9"
      });

      claimId = await workflow.createClaimStatus(createClaimInput);
      const createdClaim = await workflow.getClaimStatus(claimId);
      expect(createdClaim).toMatchObject({
        patientId: patient.pid,
        encounter: claimModifierScrubbingEncounter,
        payerName: "Northstar HMO",
        status: 1,
        statusLabel: "Queued for billing",
        billProcess: 1,
        processFile: "",
        target: "HCFA",
        submittedClaim: ""
      });

      const linesWithInvalidModifier = await targetDb.getBillingLinesForEncounter(patient.pid, claimModifierScrubbingEncounter);
      expect(linesWithInvalidModifier).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "99214",
            modifier: invalidModifier,
            codeText: "Unsupported modifier parity charge",
            fee: "115.00",
            justify: "K21.9"
          })
        ])
      );
      const expectedScrub = buildClaimScrubReport(
        claimId,
        claimModifierScrubbingEncounter,
        "Northstar HMO",
        9005,
        patient.pubpid,
        linesWithInvalidModifier
      );
      expect(expectedScrub.report).toContain("SCRUB-FAIL");
      expect(expectedScrub.report).toContain(`invalid-modifier:${invalidModifier}`);

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient.pubpid);
        await expect(page.locator("body")).toContainText(`${claimModifierScrubbingAnchorPatientId} / PID ${patient.pid}`);
        const claimCard = page.locator("article.billing-line-card")
          .filter({ hasText: `Version ${createdClaim!.version} / Primary Northstar HMO` })
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
        patientId: patient.pid,
        encounter: claimModifierScrubbingEncounter,
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
      expect(scrubbed!.submittedClaim).toContain("SCRUB-FAIL");
      expect(scrubbed!.submittedClaim).toContain(`invalid-modifier:${invalidModifier}`);

      const afterScrubCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterScrubCounts.claims).toBe(beforeCounts.claims + 1);
      expect(afterScrubCounts.billingLineItems).toBe(beforeCounts.billingLineItems + 1);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-536-claim-modifier-scrubbing-flagged",
        description: "Captures the temporary Slice 536 claim after modifier-aware local claim scrubbing, including deterministic invalid-modifier scrub report content, process-file metadata, and count stability.",
        expected: {
          claim: {
            patientId: patient.pid,
            encounter: claimModifierScrubbingEncounter,
            payerName: "Northstar HMO",
            status: 1,
            statusLabel: "Queued for billing",
            processTime: "2026-06-18 13:05:00",
            processFile: expectedScrub.processFile,
            target: "HCFA",
            submittedClaim: expectedScrub.report
          },
          counts: {
            claims: beforeCounts.claims + 1,
            billingLineItems: beforeCounts.billingLineItems + 1
          },
          scrub: {
            status: "FAIL",
            issues: [`invalid-modifier:${invalidModifier}`]
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterScrubCounts,
          claimId,
          billingLineId,
          createdClaim,
          scrubbed,
          linesWithInvalidModifier
        },
        context: {
          canonicalId: claimModifierScrubbingAnchorPatientId,
          encounter: claimModifierScrubbingEncounter,
          suite: "workflow-claim-modifier-scrubbing",
          workflow: "claim-modifier-scrubbing-flagged"
        }
      });
    } finally {
      if (claimId !== null) {
        await workflow.deleteClaimStatus(claimId);
      }
      if (billingLineId !== null) {
        await workflow.deleteBillingLine(billingLineId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.claims).toBe(beforeCounts.claims);
    expect(afterCleanupCounts.billingLineItems).toBe(beforeCounts.billingLineItems);
    const afterCleanupClaim = claimId !== null ? await workflow.getClaimStatus(claimId) : null;
    const afterCleanupLine = billingLineId !== null ? await workflow.getBillingLine(billingLineId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-536-claim-modifier-scrubbing-cleanup",
      description: "Captures the final Slice 536 cleanup state for the temporary invalid-modifier claim and billing line.",
      expected: {
        counts: {
          claims: beforeCounts.claims,
          billingLineItems: beforeCounts.billingLineItems
        },
        deletedClaim: null,
        deletedBillingLine: null
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        claimId,
        billingLineId,
        afterCleanupClaim,
        afterCleanupLine
      },
      context: {
        canonicalId: claimModifierScrubbingAnchorPatientId,
        encounter: claimModifierScrubbingEncounter,
        suite: "workflow-claim-modifier-scrubbing",
        workflow: "claim-modifier-scrubbing-cleanup"
      }
    });
    expect(afterCleanupClaim).toBeNull();
    expect(afterCleanupLine).toBeNull();
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
  const allowedModifiers = new Set(["", "25", "59", "76", "77", "95"]);
  const invalidModifiers = Array.from(
    new Set(
      cptLines
        .map((line) => (line.modifier || "").trim().toUpperCase())
        .filter((modifier) => !allowedModifiers.has(modifier))
    )
  );
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
  if (invalidModifiers.length > 0) {
    issues.push(`invalid-modifier:${invalidModifiers.join(",")}`);
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
