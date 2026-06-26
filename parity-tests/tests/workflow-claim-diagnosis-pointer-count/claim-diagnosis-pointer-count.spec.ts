import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const diagnosisPointerCountAnchorPatientId = "MOD-PAT-0005";
const diagnosisPointerLimit = 4;
const excessiveDiagnosisPointers = ["K21.9", "E11.9", "I10", "J45.909", "M54.50"];
const excessiveDiagnosisPointerText = excessiveDiagnosisPointers.join(",");
const excessiveDiagnosisPointerCount = excessiveDiagnosisPointers.length;

type BillingLineLike = {
  codeType?: string | null;
  code?: string | null;
  modifier?: string | null;
  fee?: string | number | null;
  justify?: string | null;
  units?: string | number | null;
};

test.describe("claim diagnosis pointer count parity @slice542 @workflow-claim-diagnosis-pointer-count @mutation @billing", () => {
  test("creates, flags, renders, and removes a too-many-diagnosis-pointers claim scrub report", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(diagnosisPointerCountAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${diagnosisPointerCountAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeClaims = await targetDb.getClaimsForPatient(patient.pid);
    const encounterInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateTime: "2026-06-18 15:00:00",
      reason: "Diagnosis pointer count parity encounter",
      facilityId: 10,
      facilityName: "OpenEMR Modernization Clinic",
      billingFacilityId: 10,
      billingNote: "Created by the Slice 542 claim diagnosis pointer count parity suite."
    };
    const createClaimInput = {
      patientId: patient.pid,
      encounter: 0,
      payerId: 9005,
      payerName: "Northstar HMO",
      payerType: 1,
      status: 1,
      billProcess: 1,
      billTime: "2026-06-18 15:10:00",
      processFile: "",
      target: "HCFA",
      x12PartnerId: 0,
      submittedClaim: ""
    };
    let encounterId: number | null = null;
    const diagnosisLineIds: Array<number | string> = [];
    let cptLineId: number | string | null = null;
    let claimId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-542-claim-diagnosis-pointer-count-precondition",
        description: "Captures the Slice 542 diagnosis-pointer-count anchor, baseline counts, proposed temporary encounter, five ICD10 diagnosis lines, excessive-pointer CPT line, and queued claim.",
        expected: {
          patient: {
            pubpid: diagnosisPointerCountAnchorPatientId
          },
          diagnosisPointerLimit,
          excessiveDiagnosisPointerText,
          excessiveDiagnosisPointerCount,
          countChange: {
            encountersAfterCreate: beforeCounts.encounters + 1,
            claimsAfterCreate: beforeCounts.claims + 1,
            billingLinesAfterCreate: beforeCounts.billingLineItems + 6,
            encountersAfterCleanup: beforeCounts.encounters,
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
          canonicalId: diagnosisPointerCountAnchorPatientId,
          suite: "workflow-claim-diagnosis-pointer-count",
          workflow: "claim-diagnosis-pointer-count-precondition"
        }
      });

      encounterId = await workflow.createEncounter(encounterInput);
      createClaimInput.encounter = encounterId;

      for (const [index, diagnosisPointer] of excessiveDiagnosisPointers.entries()) {
        const diagnosisLineId = await workflow.createBillingLine({
          patientId: patient.pid,
          providerId: patient.providerId,
          encounter: encounterId,
          dateTime: `2026-06-18 15:0${index}:00`,
          codeType: "ICD10",
          code: diagnosisPointer,
          modifier: "",
          codeText: `Diagnosis pointer count parity diagnosis ${index + 1}`,
          fee: "0.00",
          units: 1,
          justify: diagnosisPointer
        });
        diagnosisLineIds.push(diagnosisLineId);
      }

      cptLineId = await workflow.createBillingLine({
        patientId: patient.pid,
        providerId: patient.providerId,
        encounter: encounterId,
        dateTime: "2026-06-18 15:12:00",
        codeType: "CPT4",
        code: "99214",
        modifier: "25",
        codeText: "Too many diagnosis pointers parity charge",
        fee: "115.00",
        units: 1,
        justify: excessiveDiagnosisPointerText
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

      const linesWithExcessiveDiagnosisPointers = await targetDb.getBillingLinesForEncounter(patient.pid, encounterId);
      for (const diagnosisPointer of excessiveDiagnosisPointers) {
        expect(linesWithExcessiveDiagnosisPointers).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              codeType: "ICD10",
              code: diagnosisPointer
            })
          ])
        );
      }
      expect(linesWithExcessiveDiagnosisPointers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "99214",
            modifier: "25",
            codeText: "Too many diagnosis pointers parity charge",
            fee: "115.00",
            justify: excessiveDiagnosisPointerText
          })
        ])
      );

      const expectedScrub = buildClaimScrubReport(
        claimId,
        encounterId,
        "Northstar HMO",
        9005,
        patient.pubpid,
        linesWithExcessiveDiagnosisPointers
      );
      expect(expectedScrub.report).toContain("SCRUB-FAIL");
      expect(expectedScrub.report).toContain(`diagnosis-pointer-count-exceeded:${excessiveDiagnosisPointerCount}`);
      expect(expectedScrub.report).not.toContain("invalid-diagnosis-pointer");
      expect(expectedScrub.report).not.toContain("missing-diagnosis-code");

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient.pubpid);
        await expect(page.locator("body")).toContainText(`${diagnosisPointerCountAnchorPatientId} / PID ${patient.pid}`);
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
      expect(scrubbed!.submittedClaim).toContain(`diagnosis-pointer-count-exceeded:${excessiveDiagnosisPointerCount}`);

      const afterScrubCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterScrubCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterScrubCounts.claims).toBe(beforeCounts.claims + 1);
      expect(afterScrubCounts.billingLineItems).toBe(beforeCounts.billingLineItems + 6);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-542-claim-diagnosis-pointer-count-flagged",
        description: "Captures the temporary Slice 542 claim after diagnosis-pointer-count local claim scrubbing, including deterministic diagnosis-pointer-count-exceeded report content, process-file metadata, and count stability.",
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
            encounters: beforeCounts.encounters + 1,
            claims: beforeCounts.claims + 1,
            billingLineItems: beforeCounts.billingLineItems + 6
          },
          scrub: {
            status: "FAIL",
            issues: [`diagnosis-pointer-count-exceeded:${excessiveDiagnosisPointerCount}`]
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterScrubCounts,
          encounterId,
          claimId,
          diagnosisLineIds,
          cptLineId,
          createdClaim,
          scrubbed,
          linesWithExcessiveDiagnosisPointers
        },
        context: {
          canonicalId: diagnosisPointerCountAnchorPatientId,
          encounter: encounterId,
          suite: "workflow-claim-diagnosis-pointer-count",
          workflow: "claim-diagnosis-pointer-count-flagged"
        }
      });
    } finally {
      if (claimId !== null) {
        await workflow.deleteClaimStatus(claimId);
      }
      if (cptLineId !== null) {
        await workflow.deleteBillingLine(cptLineId);
      }
      for (const diagnosisLineId of diagnosisLineIds.reverse()) {
        await workflow.deleteBillingLine(diagnosisLineId);
      }
      if (encounterId !== null) {
        await workflow.deleteEncounter(encounterId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.claims).toBe(beforeCounts.claims);
    expect(afterCleanupCounts.billingLineItems).toBe(beforeCounts.billingLineItems);
    const afterCleanupClaim = claimId !== null ? await workflow.getClaimStatus(claimId) : null;
    const afterCleanupCptLine = cptLineId !== null ? await workflow.getBillingLine(cptLineId) : null;
    const afterCleanupDiagnosisLines = await Promise.all(diagnosisLineIds.map((lineId) => workflow.getBillingLine(lineId)));
    const afterCleanupEncounter = encounterId !== null ? await workflow.getEncounter(encounterId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-542-claim-diagnosis-pointer-count-cleanup",
      description: "Captures the final Slice 542 cleanup state for the temporary excessive-diagnosis-pointer claim, billing lines, and encounter.",
      expected: {
        counts: {
          encounters: beforeCounts.encounters,
          claims: beforeCounts.claims,
          billingLineItems: beforeCounts.billingLineItems
        },
        deletedClaim: null,
        deletedCptLine: null,
        deletedDiagnosisLines: excessiveDiagnosisPointers.map(() => null),
        deletedEncounter: null
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        encounterId,
        claimId,
        cptLineId,
        diagnosisLineIds,
        afterCleanupClaim,
        afterCleanupCptLine,
        afterCleanupDiagnosisLines,
        afterCleanupEncounter
      },
      context: {
        canonicalId: diagnosisPointerCountAnchorPatientId,
        encounter: encounterId,
        suite: "workflow-claim-diagnosis-pointer-count",
        workflow: "claim-diagnosis-pointer-count-cleanup"
      }
    });
    expect(afterCleanupClaim).toBeNull();
    expect(afterCleanupCptLine).toBeNull();
    expect(afterCleanupDiagnosisLines).toEqual(excessiveDiagnosisPointers.map(() => null));
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
  const diagnosisPointerTokensByLine = cptLines.map((line) => parseClaimDiagnosisPointerTokens(line.justify));
  const diagnosisPointerCountIssues = Array.from(
    new Set(diagnosisPointerTokensByLine.map((pointers) => pointers.length).filter((count) => count > diagnosisPointerLimit))
  );
  const diagnosisPointers = Array.from(new Set(diagnosisPointerTokensByLine.flat()));
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
        diagnosisPointerTokensByLine
          .flat()
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
  if (diagnosisPointerCountIssues.length > 0) {
    issues.push(`diagnosis-pointer-count-exceeded:${diagnosisPointerCountIssues.join(",")}`);
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

function parseClaimDiagnosisPointerTokens(justify: string | null | undefined) {
  return (justify || "")
    .split(/[,\s]+/)
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
}
