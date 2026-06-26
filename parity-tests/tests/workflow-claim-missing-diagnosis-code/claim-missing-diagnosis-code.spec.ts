import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const claimMissingDiagnosisAnchorPatientId = "MOD-PAT-0005";
const diagnosisPointer = "K21.9";

type BillingLineLike = {
  codeType?: string | null;
  code?: string | null;
  modifier?: string | null;
  fee?: string | number | null;
  justify?: string | null;
  units?: string | number | null;
};

test.describe("claim missing diagnosis code parity @slice540 @workflow-claim-missing-diagnosis-code @mutation @billing", () => {
  test("creates, flags, renders, and removes a missing-diagnosis-code claim scrub report", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(claimMissingDiagnosisAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${claimMissingDiagnosisAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeClaims = await targetDb.getClaimsForPatient(patient.pid);
    const encounterInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateTime: "2026-06-18 13:00:00",
      reason: "Missing diagnosis code parity encounter",
      facilityId: 10,
      facilityName: "OpenEMR Modernization Clinic",
      billingFacilityId: 10,
      billingNote: "Created by the Slice 540 claim missing diagnosis code parity suite."
    };
    const createClaimInput = {
      patientId: patient.pid,
      encounter: 0,
      payerId: 9005,
      payerName: "Northstar HMO",
      payerType: 1,
      status: 1,
      billProcess: 1,
      billTime: "2026-06-18 13:00:00",
      processFile: "",
      target: "HCFA",
      x12PartnerId: 0,
      submittedClaim: ""
    };
    let encounterId: number | null = null;
    let cptLineId: number | string | null = null;
    let claimId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-540-claim-missing-diagnosis-code-precondition",
        description: "Captures the Slice 540 missing-diagnosis-code scrub anchor, baseline counts, empty temporary encounter billing lines, and proposed CPT line plus queued claim without an encounter ICD10 diagnosis row.",
        expected: {
          patient: {
            pubpid: claimMissingDiagnosisAnchorPatientId
          },
          diagnosisPointer,
          diagnosisLineCount: 0,
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
          proposedEncounter: encounterInput,
          proposedClaim: createClaimInput
        },
        context: {
          canonicalId: claimMissingDiagnosisAnchorPatientId,
          suite: "workflow-claim-missing-diagnosis-code",
          workflow: "claim-missing-diagnosis-code-precondition"
        }
      });

      encounterId = await workflow.createEncounter(encounterInput);
      createClaimInput.encounter = encounterId;
      const beforeLines = await targetDb.getBillingLinesForEncounter(patient.pid, encounterId);
      expect(beforeLines.filter((line) => (line.codeType || "").toUpperCase() === "ICD10")).toHaveLength(0);

      cptLineId = await workflow.createBillingLine({
        patientId: patient.pid,
        providerId: patient.providerId,
        encounter: encounterId,
        dateTime: "2026-06-18 13:30:00",
        codeType: "CPT4",
        code: "99214",
        modifier: "25",
        codeText: "Missing diagnosis code parity charge",
        fee: "115.00",
        units: 1,
        justify: diagnosisPointer
      });

      claimId = await workflow.createClaimStatus(createClaimInput);
      const createdClaim = await workflow.getClaimStatus(claimId);
      expect(createdClaim).toMatchObject({
        patientId: patient.pid,
        encounter: encounterId,
        payerName: "Northstar HMO",
        status: 1,
        statusLabel: "Queued for billing",
        billProcess: 1,
        processFile: "",
        target: "HCFA",
        submittedClaim: ""
      });

      const linesWithoutDiagnosis = await targetDb.getBillingLinesForEncounter(patient.pid, encounterId);
      expect(linesWithoutDiagnosis.filter((line) => (line.codeType || "").toUpperCase() === "ICD10")).toHaveLength(0);
      expect(linesWithoutDiagnosis).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "99214",
            modifier: "25",
            codeText: "Missing diagnosis code parity charge",
            fee: "115.00",
            justify: diagnosisPointer
          })
        ])
      );
      const expectedScrub = buildClaimScrubReport(
        claimId,
        encounterId,
        "Northstar HMO",
        9005,
        patient.pubpid,
        linesWithoutDiagnosis
      );
      expect(expectedScrub.report).toContain("SCRUB-FAIL");
      expect(expectedScrub.report).toContain("missing-diagnosis-code");
      expect(expectedScrub.report).not.toContain("missing-diagnosis-pointer");
      expect(expectedScrub.report).not.toContain("invalid-diagnosis-pointer");

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient.pubpid);
        await expect(page.locator("body")).toContainText(`${claimMissingDiagnosisAnchorPatientId} / PID ${patient.pid}`);
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
        encounter: encounterId,
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
      expect(scrubbed!.submittedClaim).toContain("missing-diagnosis-code");

      const afterScrubCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterScrubCounts.claims).toBe(beforeCounts.claims + 1);
      expect(afterScrubCounts.billingLineItems).toBe(beforeCounts.billingLineItems + 1);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-540-claim-missing-diagnosis-code-flagged",
        description: "Captures the temporary Slice 540 claim after diagnosis-code-aware local claim scrubbing, including deterministic missing-diagnosis-code scrub report content, process-file metadata, and count stability.",
        expected: {
          claim: {
            patientId: patient.pid,
            encounter: encounterId,
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
            issues: ["missing-diagnosis-code"]
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterScrubCounts,
          claimId,
          encounterId,
          cptLineId,
          createdClaim,
          scrubbed,
          linesWithoutDiagnosis
        },
        context: {
          canonicalId: claimMissingDiagnosisAnchorPatientId,
          encounter: encounterId,
          suite: "workflow-claim-missing-diagnosis-code",
          workflow: "claim-missing-diagnosis-code-flagged"
        }
      });
    } finally {
      if (claimId !== null) {
        await workflow.deleteClaimStatus(claimId);
      }
      if (cptLineId !== null) {
        await workflow.deleteBillingLine(cptLineId);
      }
      if (encounterId !== null) {
        await workflow.deleteEncounter(encounterId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.claims).toBe(beforeCounts.claims);
    expect(afterCleanupCounts.billingLineItems).toBe(beforeCounts.billingLineItems);
    const afterCleanupClaim = claimId !== null ? await workflow.getClaimStatus(claimId) : null;
    const afterCleanupCptLine = cptLineId !== null ? await workflow.getBillingLine(cptLineId) : null;
    const afterCleanupEncounter = encounterId !== null ? await workflow.getEncounter(encounterId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-540-claim-missing-diagnosis-code-cleanup",
      description: "Captures the final Slice 540 cleanup state for the temporary missing-diagnosis-code claim and billing line.",
      expected: {
        counts: {
          claims: beforeCounts.claims,
          billingLineItems: beforeCounts.billingLineItems
        },
        deletedClaim: null,
        deletedCptLine: null,
        deletedEncounter: null
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        claimId,
        encounterId,
        cptLineId,
        afterCleanupClaim,
        afterCleanupCptLine,
        afterCleanupEncounter
      },
      context: {
        canonicalId: claimMissingDiagnosisAnchorPatientId,
        encounter: encounterId,
        suite: "workflow-claim-missing-diagnosis-code",
        workflow: "claim-missing-diagnosis-code-cleanup"
      }
    });
    expect(afterCleanupClaim).toBeNull();
    expect(afterCleanupCptLine).toBeNull();
    expect(afterCleanupEncounter).toBeNull();
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
  const allowedModifiers = new Set(["25", "59", "76", "77", "95"]);
  const modifierTokensByLine = cptLines.map((line) => parseClaimModifierTokens(line.modifier));
  const invalidModifiers = Array.from(
    new Set(modifierTokensByLine.flat().filter((modifier) => !allowedModifiers.has(modifier)))
  );
  const duplicateModifiers = Array.from(
    new Set(
      modifierTokensByLine.flatMap((modifiers) =>
        modifiers.filter((modifier, index) => modifiers.indexOf(modifier) !== index)
      )
    )
  );
  const modifierCountIssues = Array.from(
    new Set(modifierTokensByLine.map((modifiers) => modifiers.length).filter((count) => count > 4))
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
  if (diagnosisCodes.size === 0 && cptLines.some((line) => line.justify?.trim())) {
    issues.push("missing-diagnosis-code");
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
  if (duplicateModifiers.length > 0) {
    issues.push(`duplicate-modifier:${duplicateModifiers.join(",")}`);
  }
  if (modifierCountIssues.length > 0) {
    issues.push(`modifier-count-exceeded:${modifierCountIssues.join(",")}`);
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

function parseClaimModifierTokens(modifier: string | null | undefined) {
  const value = (modifier || "").trim().toUpperCase();
  if (/^[A-Z0-9]+$/.test(value) && value.length > 2 && value.length % 2 === 0) {
    return value.match(/.{1,2}/g) || [];
  }

  return value
    .split(/[,\s]+/)
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
}
