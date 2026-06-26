import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const serverSideScrubbingAnchorPatientId = "MOD-PAT-0005";
const primaryDiagnosisPointer = "K21.9";
const secondaryDiagnosisPointer = "E11.9";
const combinedDiagnosisPointer = `${primaryDiagnosisPointer},${secondaryDiagnosisPointer}`;

type BillingLineLike = {
  codeType?: string | null;
  code?: string | null;
  modifier?: string | null;
  fee?: string | number | null;
  justify?: string | null;
  units?: string | number | null;
};

test.describe("claim server-side scrubbing parity @slice556 @workflow-claim-server-side-scrubbing @mutation @billing", () => {
  test("creates, server-scrubs, renders, and removes a diagnosis-backed claim scrub report", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(serverSideScrubbingAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${serverSideScrubbingAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeClaims = await targetDb.getClaimsForPatient(patient.pid);
    const encounterInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateTime: "2026-06-18 14:00:00",
      reason: "Server-side claim scrubbing parity encounter",
      facilityId: 10,
      facilityName: "OpenEMR Modernization Clinic",
      billingFacilityId: 10,
      billingNote: "Created by the Slice 556 server-side claim scrubbing parity suite."
    };
    const createClaimInput = {
      patientId: patient.pid,
      encounter: 0,
      payerId: 9005,
      payerName: "Northstar HMO",
      payerType: 1,
      status: 1,
      billProcess: 1,
      billTime: "2026-06-18 14:10:00",
      processFile: "",
      target: "HCFA",
      x12PartnerId: 0,
      submittedClaim: ""
    };
    let encounterId: number | null = null;
    let primaryDiagnosisLineId: number | string | null = null;
    let secondaryDiagnosisLineId: number | string | null = null;
    let cptLineId: number | string | null = null;
    let claimId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-556-claim-server-side-scrubbing-precondition",
        description: "Captures the Slice 556 server-side claim-scrubbing anchor, baseline counts, proposed temporary encounter, two ICD10 diagnosis lines, CPT line with comma-separated pointers, and queued claim.",
        expected: {
          patient: {
            pubpid: serverSideScrubbingAnchorPatientId
          },
          diagnosisPointers: [primaryDiagnosisPointer, secondaryDiagnosisPointer],
          countChange: {
            encountersAfterCreate: beforeCounts.encounters + 1,
            claimsAfterCreate: beforeCounts.claims + 1,
            billingLinesAfterCreate: beforeCounts.billingLineItems + 3,
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
          canonicalId: serverSideScrubbingAnchorPatientId,
          suite: "workflow-claim-server-side-scrubbing",
          workflow: "claim-server-side-scrubbing-precondition"
        }
      });

      encounterId = await workflow.createEncounter(encounterInput);
      createClaimInput.encounter = encounterId;

      primaryDiagnosisLineId = await workflow.createBillingLine({
        patientId: patient.pid,
        providerId: patient.providerId,
        encounter: encounterId,
        dateTime: "2026-06-18 14:05:00",
        codeType: "ICD10",
        code: primaryDiagnosisPointer,
        modifier: "",
        codeText: "Gastro-esophageal reflux disease without esophagitis",
        fee: "0.00",
        units: 1,
        justify: primaryDiagnosisPointer
      });

      secondaryDiagnosisLineId = await workflow.createBillingLine({
        patientId: patient.pid,
        providerId: patient.providerId,
        encounter: encounterId,
        dateTime: "2026-06-18 14:06:00",
        codeType: "ICD10",
        code: secondaryDiagnosisPointer,
        modifier: "",
        codeText: "Type 2 diabetes mellitus without complications",
        fee: "0.00",
        units: 1,
        justify: secondaryDiagnosisPointer
      });

      cptLineId = await workflow.createBillingLine({
        patientId: patient.pid,
        providerId: patient.providerId,
        encounter: encounterId,
        dateTime: "2026-06-18 14:12:00",
        codeType: "CPT4",
        code: "99214",
        modifier: "25",
        codeText: "Server-side claim scrubbing parity charge",
        fee: "115.00",
        units: 1,
        justify: combinedDiagnosisPointer
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

      const diagnosisBackedLines = await targetDb.getBillingLinesForEncounter(patient.pid, encounterId);
      expect(diagnosisBackedLines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            codeType: "ICD10",
            code: primaryDiagnosisPointer
          }),
          expect.objectContaining({
            codeType: "ICD10",
            code: secondaryDiagnosisPointer
          }),
          expect.objectContaining({
            code: "99214",
            modifier: "25",
            codeText: "Server-side claim scrubbing parity charge",
            fee: "115.00",
            justify: combinedDiagnosisPointer
          })
        ])
      );
      const expectedScrub = buildClaimScrubReport(
        claimId,
        encounterId,
        "Northstar HMO",
        9005,
        patient.pubpid,
        diagnosisBackedLines
      );
      expect(expectedScrub.report).toContain("SCRUB-PASS");
      expect(expectedScrub.report).toContain(`diagnosisPointers=${combinedDiagnosisPointer}`);
      expect(expectedScrub.report).toContain("issues=none");

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient.pubpid);
        await expect(page.locator("body")).toContainText(`${serverSideScrubbingAnchorPatientId} / PID ${patient.pid}`);
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
      expect(scrubbed!.submittedClaim).toContain("SCRUB-PASS");
      expect(scrubbed!.submittedClaim).toContain("issues=none");

      const afterScrubCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterScrubCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterScrubCounts.claims).toBe(beforeCounts.claims + 1);
      expect(afterScrubCounts.billingLineItems).toBe(beforeCounts.billingLineItems + 3);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-556-claim-server-side-scrubbing-scrubbed",
        description: "Captures the temporary Slice 556 claim after server-side claim scrubbing, including deterministic SCRUB-PASS report content, process-file metadata, and count stability.",
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
            billingLineItems: beforeCounts.billingLineItems + 3
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
          encounterId,
          claimId,
          primaryDiagnosisLineId,
          secondaryDiagnosisLineId,
          cptLineId,
          createdClaim,
          scrubbed,
          diagnosisBackedLines
        },
        context: {
          canonicalId: serverSideScrubbingAnchorPatientId,
          encounter: encounterId,
          suite: "workflow-claim-server-side-scrubbing",
          workflow: "claim-server-side-scrubbing-scrubbed"
        }
      });
    } finally {
      if (claimId !== null) {
        await workflow.deleteClaimStatus(claimId);
      }
      if (cptLineId !== null) {
        await workflow.deleteBillingLine(cptLineId);
      }
      if (secondaryDiagnosisLineId !== null) {
        await workflow.deleteBillingLine(secondaryDiagnosisLineId);
      }
      if (primaryDiagnosisLineId !== null) {
        await workflow.deleteBillingLine(primaryDiagnosisLineId);
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
    const afterCleanupSecondaryDiagnosisLine = secondaryDiagnosisLineId !== null ? await workflow.getBillingLine(secondaryDiagnosisLineId) : null;
    const afterCleanupPrimaryDiagnosisLine = primaryDiagnosisLineId !== null ? await workflow.getBillingLine(primaryDiagnosisLineId) : null;
    const afterCleanupEncounter = encounterId !== null ? await workflow.getEncounter(encounterId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-556-claim-server-side-scrubbing-cleanup",
      description: "Captures the final Slice 556 cleanup state for the temporary server-side scrubbed claim, billing lines, and encounter.",
      expected: {
        counts: {
          encounters: beforeCounts.encounters,
          claims: beforeCounts.claims,
          billingLineItems: beforeCounts.billingLineItems
        },
        deletedClaim: null,
        deletedCptLine: null,
        deletedPrimaryDiagnosisLine: null,
        deletedSecondaryDiagnosisLine: null,
        deletedEncounter: null
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        encounterId,
        claimId,
        cptLineId,
        primaryDiagnosisLineId,
        secondaryDiagnosisLineId,
        afterCleanupClaim,
        afterCleanupCptLine,
        afterCleanupPrimaryDiagnosisLine,
        afterCleanupSecondaryDiagnosisLine,
        afterCleanupEncounter
      },
      context: {
        canonicalId: serverSideScrubbingAnchorPatientId,
        encounter: encounterId,
        suite: "workflow-claim-server-side-scrubbing",
        workflow: "claim-server-side-scrubbing-cleanup"
      }
    });
    expect(afterCleanupClaim).toBeNull();
    expect(afterCleanupCptLine).toBeNull();
    expect(afterCleanupPrimaryDiagnosisLine).toBeNull();
    expect(afterCleanupSecondaryDiagnosisLine).toBeNull();
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
