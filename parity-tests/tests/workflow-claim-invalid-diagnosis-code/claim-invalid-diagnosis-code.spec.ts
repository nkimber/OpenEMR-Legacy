import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const invalidDiagnosisAnchorPatientId = "MOD-PAT-0005";
const invalidDiagnosisCode = "BADCODE";
const validCptCode = "99214";

type BillingLineLike = {
  codeType?: string | null;
  code?: string | null;
  modifier?: string | null;
  fee?: string | number | null;
  justify?: string | null;
  units?: string | number | null;
};

test.describe("claim invalid diagnosis code parity @slice546 @workflow-claim-invalid-diagnosis-code @mutation @billing", () => {
  test("creates, flags, renders, and removes an invalid-diagnosis-code claim scrub report", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(invalidDiagnosisAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${invalidDiagnosisAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeClaims = await targetDb.getClaimsForPatient(patient.pid);
    const encounterInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateTime: "2026-06-18 17:00:00",
      reason: "Invalid diagnosis code parity encounter",
      facilityId: 10,
      facilityName: "OpenEMR Modernization Clinic",
      billingFacilityId: 10,
      billingNote: "Created by the Slice 546 claim invalid diagnosis code parity suite."
    };
    const createClaimInput = {
      patientId: patient.pid,
      encounter: 0,
      payerId: 9005,
      payerName: "Northstar HMO",
      payerType: 1,
      status: 1,
      billProcess: 1,
      billTime: "2026-06-18 17:10:00",
      processFile: "",
      target: "HCFA",
      x12PartnerId: 0,
      submittedClaim: ""
    };
    let encounterId: number | null = null;
    let diagnosisLineId: number | string | null = null;
    let cptLineId: number | string | null = null;
    let claimId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-546-claim-invalid-diagnosis-code-precondition",
        description: "Captures the Slice 546 invalid diagnosis-code anchor, baseline counts, proposed temporary encounter, malformed ICD10 line, valid CPT4 line, and queued claim.",
        expected: {
          patient: { pubpid: invalidDiagnosisAnchorPatientId },
          invalidDiagnosisCode,
          countChange: {
            encountersAfterCreate: beforeCounts.encounters + 1,
            claimsAfterCreate: beforeCounts.claims + 1,
            billingLinesAfterCreate: beforeCounts.billingLineItems + 2,
            encountersAfterCleanup: beforeCounts.encounters,
            claimsAfterCleanup: beforeCounts.claims,
            billingLinesAfterCleanup: beforeCounts.billingLineItems
          }
        },
        actual: { patient, beforeCounts, beforeClaims, proposedEncounter: encounterInput, proposedClaim: createClaimInput },
        context: {
          canonicalId: invalidDiagnosisAnchorPatientId,
          suite: "workflow-claim-invalid-diagnosis-code",
          workflow: "claim-invalid-diagnosis-code-precondition"
        }
      });

      encounterId = await workflow.createEncounter(encounterInput);
      createClaimInput.encounter = encounterId;

      diagnosisLineId = await workflow.createBillingLine({
        patientId: patient.pid,
        providerId: patient.providerId,
        encounter: encounterId,
        dateTime: "2026-06-18 17:02:00",
        codeType: "ICD10",
        code: invalidDiagnosisCode,
        modifier: "",
        codeText: "Invalid diagnosis code parity diagnosis",
        fee: "0.00",
        units: 1,
        justify: invalidDiagnosisCode
      });

      cptLineId = await workflow.createBillingLine({
        patientId: patient.pid,
        providerId: patient.providerId,
        encounter: encounterId,
        dateTime: "2026-06-18 17:12:00",
        codeType: "CPT4",
        code: validCptCode,
        modifier: "25",
        codeText: "Established patient office visit",
        fee: "115.00",
        units: 1,
        justify: invalidDiagnosisCode
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

      const linesWithInvalidDiagnosis = await targetDb.getBillingLinesForEncounter(patient.pid, encounterId);
      expect(linesWithInvalidDiagnosis).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ codeType: "ICD10", code: invalidDiagnosisCode }),
          expect.objectContaining({
            code: validCptCode,
            modifier: "25",
            codeText: "Established patient office visit",
            fee: "115.00",
            justify: invalidDiagnosisCode
          })
        ])
      );

      const expectedScrub = buildClaimScrubReport(claimId, encounterId, "Northstar HMO", 9005, patient.pubpid, linesWithInvalidDiagnosis);
      expect(expectedScrub.report).toContain("SCRUB-FAIL");
      expect(expectedScrub.report).toContain(`invalid-diagnosis-code:${invalidDiagnosisCode}`);
      expect(expectedScrub.report).not.toContain("invalid-diagnosis-pointer");
      expect(expectedScrub.report).not.toContain("missing-diagnosis-code");
      expect(expectedScrub.report).not.toContain("invalid-cpt-code");

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient.pubpid);
        await expect(page.locator("body")).toContainText(`${invalidDiagnosisAnchorPatientId} / PID ${patient.pid}`);
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

      const afterScrubCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterScrubCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterScrubCounts.claims).toBe(beforeCounts.claims + 1);
      expect(afterScrubCounts.billingLineItems).toBe(beforeCounts.billingLineItems + 2);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-546-claim-invalid-diagnosis-code-flagged",
        description: "Captures the temporary Slice 546 claim after invalid-diagnosis-code local claim scrubbing, including deterministic invalid-diagnosis-code report content, process-file metadata, and count stability.",
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
            billingLineItems: beforeCounts.billingLineItems + 2
          },
          scrub: { status: "FAIL", issues: [`invalid-diagnosis-code:${invalidDiagnosisCode}`] }
        },
        actual: { patient, beforeCounts, afterScrubCounts, encounterId, claimId, diagnosisLineId, cptLineId, createdClaim, scrubbed, linesWithInvalidDiagnosis },
        context: {
          canonicalId: invalidDiagnosisAnchorPatientId,
          encounter: encounterId,
          suite: "workflow-claim-invalid-diagnosis-code",
          workflow: "claim-invalid-diagnosis-code-flagged"
        }
      });
    } finally {
      if (claimId !== null) await workflow.deleteClaimStatus(claimId);
      if (cptLineId !== null) await workflow.deleteBillingLine(cptLineId);
      if (diagnosisLineId !== null) await workflow.deleteBillingLine(diagnosisLineId);
      if (encounterId !== null) await workflow.deleteEncounter(encounterId);
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.claims).toBe(beforeCounts.claims);
    expect(afterCleanupCounts.billingLineItems).toBe(beforeCounts.billingLineItems);
    const afterCleanupClaim = claimId !== null ? await workflow.getClaimStatus(claimId) : null;
    const afterCleanupCptLine = cptLineId !== null ? await workflow.getBillingLine(cptLineId) : null;
    const afterCleanupDiagnosisLine = diagnosisLineId !== null ? await workflow.getBillingLine(diagnosisLineId) : null;
    const afterCleanupEncounter = encounterId !== null ? await workflow.getEncounter(encounterId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-546-claim-invalid-diagnosis-code-cleanup",
      description: "Captures the final Slice 546 cleanup state for the temporary invalid-diagnosis-code claim, billing lines, and encounter.",
      expected: {
        counts: { encounters: beforeCounts.encounters, claims: beforeCounts.claims, billingLineItems: beforeCounts.billingLineItems },
        deletedClaim: null,
        deletedCptLine: null,
        deletedDiagnosisLine: null,
        deletedEncounter: null
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        encounterId,
        claimId,
        cptLineId,
        diagnosisLineId,
        afterCleanupClaim,
        afterCleanupCptLine,
        afterCleanupDiagnosisLine,
        afterCleanupEncounter
      },
      context: {
        canonicalId: invalidDiagnosisAnchorPatientId,
        encounter: encounterId,
        suite: "workflow-claim-invalid-diagnosis-code",
        workflow: "claim-invalid-diagnosis-code-cleanup"
      }
    });
    expect(afterCleanupClaim).toBeNull();
    expect(afterCleanupCptLine).toBeNull();
    expect(afterCleanupDiagnosisLine).toBeNull();
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
  const invalidCptCodes = Array.from(new Set(cptLines.map((line) => (line.code || "").trim().toUpperCase()).filter((code) => !/^\d{5}$/.test(code))));
  const allowedModifiers = new Set(["25", "59", "76", "77", "95"]);
  const modifierTokensByLine = cptLines.map((line) => parseClaimModifierTokens(line.modifier));
  const invalidModifiers = Array.from(new Set(modifierTokensByLine.flat().filter((modifier) => !allowedModifiers.has(modifier))));
  const duplicateModifiers = Array.from(new Set(modifierTokensByLine.flatMap((modifiers) => modifiers.filter((modifier, index) => modifiers.indexOf(modifier) !== index))));
  const modifierCountIssues = Array.from(new Set(modifierTokensByLine.map((modifiers) => modifiers.length).filter((count) => count > 4)));
  const diagnosisPointerTokensByLine = cptLines.map((line) => parseClaimDiagnosisPointerTokens(line.justify));
  const duplicateDiagnosisPointers = Array.from(new Set(diagnosisPointerTokensByLine.flatMap((pointers) => pointers.filter((pointer, index) => pointers.indexOf(pointer) !== index))));
  const diagnosisPointerCountIssues = Array.from(new Set(diagnosisPointerTokensByLine.map((pointers) => pointers.length).filter((count) => count > 4)));
  const diagnosisPointers = Array.from(new Set(diagnosisPointerTokensByLine.flat()));
  const diagnosisCodeValues = encounterLines
    .filter((line) => (line.codeType || "").toUpperCase() === "ICD10")
    .map((line) => (line.code || "").trim().toUpperCase())
    .filter(Boolean);
  const invalidDiagnosisCodes = Array.from(new Set(diagnosisCodeValues.filter((diagnosisCode) => !isSupportedIcd10DiagnosisCode(diagnosisCode))));
  const duplicateDiagnosisCodes = Array.from(new Set(diagnosisCodeValues.filter((diagnosisCode, index) => diagnosisCodeValues.indexOf(diagnosisCode) !== index)));
  const diagnosisCodes = new Set(diagnosisCodeValues);
  const unsupportedDiagnosisPointers = diagnosisCodes.size === 0
    ? []
    : Array.from(new Set(diagnosisPointerTokensByLine.flat().filter((pointer) => Boolean(pointer) && !diagnosisCodes.has(pointer))));
  const issues: string[] = [];

  if (payerId <= 0 || !payerName) issues.push("missing-payer");
  if (cptLines.length === 0) issues.push("missing-cpt-line");
  if (invalidCptCodes.length > 0) issues.push(`invalid-cpt-code:${invalidCptCodes.join(",")}`);
  if (cptLines.some((line) => !line.justify?.trim())) issues.push("missing-diagnosis-pointer");
  if (diagnosisCodes.size === 0 && cptLines.some((line) => line.justify?.trim())) issues.push("missing-diagnosis-code");
  if (unsupportedDiagnosisPointers.length > 0) issues.push(`invalid-diagnosis-pointer:${unsupportedDiagnosisPointers.join(",")}`);
  if (invalidDiagnosisCodes.length > 0) issues.push(`invalid-diagnosis-code:${invalidDiagnosisCodes.join(",")}`);
  if (duplicateDiagnosisCodes.length > 0) issues.push(`duplicate-diagnosis-code:${duplicateDiagnosisCodes.join(",")}`);
  if (cptLines.some((line) => Number(line.fee ?? 0) <= 0)) issues.push("invalid-fee");
  if (cptLines.some((line) => Number(line.units ?? 1) <= 0)) issues.push("invalid-units");
  if (invalidModifiers.length > 0) issues.push(`invalid-modifier:${invalidModifiers.join(",")}`);
  if (duplicateModifiers.length > 0) issues.push(`duplicate-modifier:${duplicateModifiers.join(",")}`);
  if (modifierCountIssues.length > 0) issues.push(`modifier-count-exceeded:${modifierCountIssues.join(",")}`);
  if (diagnosisPointerCountIssues.length > 0) issues.push(`diagnosis-pointer-count-exceeded:${diagnosisPointerCountIssues.join(",")}`);
  if (duplicateDiagnosisPointers.length > 0) issues.push(`duplicate-diagnosis-pointer:${duplicateDiagnosisPointers.join(",")}`);

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

  return value.split(/[,\s]+/).map((value) => value.trim().toUpperCase()).filter(Boolean);
}

function parseClaimDiagnosisPointerTokens(justify: string | null | undefined) {
  return (justify || "").split(/[,\s]+/).map((value) => value.trim().toUpperCase()).filter(Boolean);
}

function isSupportedIcd10DiagnosisCode(code: string) {
  return /^[A-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/.test(code);
}
