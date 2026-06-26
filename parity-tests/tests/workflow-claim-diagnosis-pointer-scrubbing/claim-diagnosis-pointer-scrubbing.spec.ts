import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const claimDiagnosisPointerAnchorPatientId = "MOD-PAT-0005";
const claimDiagnosisPointerEncounter = 1000052;
const validDiagnosisPointer = "K21.9";
const invalidDiagnosisPointer = "Q99.99";

type BillingLineLike = {
  codeType?: string | null;
  code?: string | null;
  modifier?: string | null;
  fee?: string | number | null;
  justify?: string | null;
  units?: string | number | null;
};

test.describe("claim diagnosis-pointer scrubbing parity @slice537 @workflow-claim-diagnosis-pointer-scrubbing @mutation @billing", () => {
  test("creates, flags, renders, and removes an invalid-diagnosis-pointer claim scrub report", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(claimDiagnosisPointerAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${claimDiagnosisPointerAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeClaims = await targetDb.getClaimsForPatient(patient.pid);
    const beforeLines = await targetDb.getBillingLinesForEncounter(patient.pid, claimDiagnosisPointerEncounter);
    const createClaimInput = {
      patientId: patient.pid,
      encounter: claimDiagnosisPointerEncounter,
      payerId: 9005,
      payerName: "Northstar HMO",
      payerType: 1,
      status: 1,
      billProcess: 1,
      billTime: "2026-06-18 12:35:00",
      processFile: "",
      target: "HCFA",
      x12PartnerId: 0,
      submittedClaim: ""
    };
    let diagnosisLineId: number | string | null = null;
    let cptLineId: number | string | null = null;
    let claimId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-537-claim-diagnosis-pointer-scrubbing-precondition",
        description: "Captures the Slice 537 claim diagnosis-pointer anchor, baseline claim/line counts, existing encounter billing lines, and proposed temporary diagnosis plus invalid-pointer CPT line and queued claim.",
        expected: {
          patient: {
            pubpid: claimDiagnosisPointerAnchorPatientId
          },
          encounter: claimDiagnosisPointerEncounter,
          validDiagnosisPointer,
          invalidDiagnosisPointer,
          countChange: {
            claimsAfterCreate: beforeCounts.claims + 1,
            billingLinesAfterCreate: beforeCounts.billingLineItems + 2,
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
          canonicalId: claimDiagnosisPointerAnchorPatientId,
          encounter: claimDiagnosisPointerEncounter,
          suite: "workflow-claim-diagnosis-pointer-scrubbing",
          workflow: "claim-diagnosis-pointer-scrubbing-precondition"
        }
      });

      diagnosisLineId = await workflow.createBillingLine({
        patientId: patient.pid,
        providerId: patient.providerId,
        encounter: claimDiagnosisPointerEncounter,
        dateTime: "2026-06-18 13:00:00",
        codeType: "ICD10",
        code: validDiagnosisPointer,
        modifier: "",
        codeText: "Gastro-esophageal reflux disease without esophagitis",
        fee: "0.00",
        units: 1,
        justify: validDiagnosisPointer
      });

      cptLineId = await workflow.createBillingLine({
        patientId: patient.pid,
        providerId: patient.providerId,
        encounter: claimDiagnosisPointerEncounter,
        dateTime: "2026-06-18 13:12:00",
        codeType: "CPT4",
        code: "99214",
        modifier: "25",
        codeText: "Unsupported diagnosis pointer parity charge",
        fee: "115.00",
        units: 1,
        justify: invalidDiagnosisPointer
      });

      claimId = await workflow.createClaimStatus(createClaimInput);
      const createdClaim = await workflow.getClaimStatus(claimId);
      expect(createdClaim).toMatchObject({
        patientId: patient.pid,
        encounter: claimDiagnosisPointerEncounter,
        payerName: "Northstar HMO",
        status: 1,
        statusLabel: "Queued for billing",
        billProcess: 1,
        processFile: "",
        target: "HCFA",
        submittedClaim: ""
      });

      const linesWithInvalidDiagnosisPointer = await targetDb.getBillingLinesForEncounter(patient.pid, claimDiagnosisPointerEncounter);
      expect(linesWithInvalidDiagnosisPointer).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            codeType: "ICD10",
            code: validDiagnosisPointer,
            justify: validDiagnosisPointer
          }),
          expect.objectContaining({
            code: "99214",
            modifier: "25",
            codeText: "Unsupported diagnosis pointer parity charge",
            fee: "115.00",
            justify: invalidDiagnosisPointer
          })
        ])
      );
      const expectedScrub = buildClaimScrubReport(
        claimId,
        claimDiagnosisPointerEncounter,
        "Northstar HMO",
        9005,
        patient.pubpid,
        linesWithInvalidDiagnosisPointer
      );
      expect(expectedScrub.report).toContain("SCRUB-FAIL");
      expect(expectedScrub.report).toContain(`invalid-diagnosis-pointer:${invalidDiagnosisPointer}`);

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient.pubpid);
        await expect(page.locator("body")).toContainText(`${claimDiagnosisPointerAnchorPatientId} / PID ${patient.pid}`);
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
        encounter: claimDiagnosisPointerEncounter,
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
      expect(scrubbed!.submittedClaim).toContain(`invalid-diagnosis-pointer:${invalidDiagnosisPointer}`);

      const afterScrubCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterScrubCounts.claims).toBe(beforeCounts.claims + 1);
      expect(afterScrubCounts.billingLineItems).toBe(beforeCounts.billingLineItems + 2);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-537-claim-diagnosis-pointer-scrubbing-flagged",
        description: "Captures the temporary Slice 537 claim after diagnosis-pointer-aware local claim scrubbing, including deterministic invalid-diagnosis-pointer scrub report content, process-file metadata, and count stability.",
        expected: {
          claim: {
            patientId: patient.pid,
            encounter: claimDiagnosisPointerEncounter,
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
            billingLineItems: beforeCounts.billingLineItems + 2
          },
          scrub: {
            status: "FAIL",
            issues: [`invalid-diagnosis-pointer:${invalidDiagnosisPointer}`]
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterScrubCounts,
          claimId,
          diagnosisLineId,
          cptLineId,
          createdClaim,
          scrubbed,
          linesWithInvalidDiagnosisPointer
        },
        context: {
          canonicalId: claimDiagnosisPointerAnchorPatientId,
          encounter: claimDiagnosisPointerEncounter,
          suite: "workflow-claim-diagnosis-pointer-scrubbing",
          workflow: "claim-diagnosis-pointer-scrubbing-flagged"
        }
      });
    } finally {
      if (claimId !== null) {
        await workflow.deleteClaimStatus(claimId);
      }
      if (cptLineId !== null) {
        await workflow.deleteBillingLine(cptLineId);
      }
      if (diagnosisLineId !== null) {
        await workflow.deleteBillingLine(diagnosisLineId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.claims).toBe(beforeCounts.claims);
    expect(afterCleanupCounts.billingLineItems).toBe(beforeCounts.billingLineItems);
    const afterCleanupClaim = claimId !== null ? await workflow.getClaimStatus(claimId) : null;
    const afterCleanupDiagnosisLine = diagnosisLineId !== null ? await workflow.getBillingLine(diagnosisLineId) : null;
    const afterCleanupCptLine = cptLineId !== null ? await workflow.getBillingLine(cptLineId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-537-claim-diagnosis-pointer-scrubbing-cleanup",
      description: "Captures the final Slice 537 cleanup state for the temporary invalid-diagnosis-pointer claim and billing lines.",
      expected: {
        counts: {
          claims: beforeCounts.claims,
          billingLineItems: beforeCounts.billingLineItems
        },
        deletedClaim: null,
        deletedDiagnosisLine: null,
        deletedCptLine: null
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        claimId,
        diagnosisLineId,
        cptLineId,
        afterCleanupClaim,
        afterCleanupDiagnosisLine,
        afterCleanupCptLine
      },
      context: {
        canonicalId: claimDiagnosisPointerAnchorPatientId,
        encounter: claimDiagnosisPointerEncounter,
        suite: "workflow-claim-diagnosis-pointer-scrubbing",
        workflow: "claim-diagnosis-pointer-scrubbing-cleanup"
      }
    });
    expect(afterCleanupClaim).toBeNull();
    expect(afterCleanupDiagnosisLine).toBeNull();
    expect(afterCleanupCptLine).toBeNull();
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
  const diagnosisCodes = new Set(
    encounterLines
      .filter((line) => (line.codeType || "").toUpperCase() === "ICD10")
      .map((line) => (line.code || "").trim().toUpperCase())
      .filter(Boolean)
  );
  const unsupportedDiagnosisPointers = diagnosisCodes.size === 0
    ? []
    : Array.from(
      new Set(
        cptLines
          .map((line) => (line.justify || "").trim().toUpperCase())
          .filter((pointer) => Boolean(pointer) && !diagnosisCodes.has(pointer))
      )
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
  if (unsupportedDiagnosisPointers.length > 0) {
    issues.push(`invalid-diagnosis-pointer:${unsupportedDiagnosisPointers.join(",")}`);
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
