import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const invalidUnitsAnchorPatientId = "MOD-PAT-0005";
const diagnosisPointer = "K21.9";
const validCptCode = "99214";
const validModifierText = "25";
const invalidUnitsIssue = "invalid-units";
const claimScrubBusinessDate = "2026-06-18";

type BillingLineLike = {
  billingDate?: string | null;
  codeType?: string | null;
  code?: string | null;
  modifier?: string | null;
  fee?: string | number | null;
  justify?: string | null;
  units?: string | number | null;
};

test.describe("claim invalid units parity @slice551 @workflow-claim-invalid-units @mutation @billing", () => {
  test("creates, flags, renders, and removes an invalid-units claim scrub report", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(invalidUnitsAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${invalidUnitsAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeClaims = await targetDb.getClaimsForPatient(patient.pid);
    const encounterInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateTime: `${claimScrubBusinessDate} 18:00:00`,
      reason: "Invalid units parity encounter",
      facilityId: 10,
      facilityName: "OpenEMR Modernization Clinic",
      billingFacilityId: 10,
      billingNote: "Created by the Slice 551 claim invalid units parity suite."
    };
    const createClaimInput = {
      patientId: patient.pid,
      encounter: 0,
      payerId: 9005,
      payerName: "Northstar HMO",
      payerType: 1,
      status: 1,
      billProcess: 1,
      billTime: `${claimScrubBusinessDate} 18:20:00`,
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
        probe: "slice-551-claim-invalid-units-precondition",
        description: "Captures the Slice 551 invalid-units anchor, baseline counts, proposed temporary encounter, valid diagnosis line, CPT4 line, and queued claim with zero CPT units.",
        expected: {
          patient: { pubpid: invalidUnitsAnchorPatientId },
          validModifierText,
          invalidUnitsIssue,
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
          canonicalId: invalidUnitsAnchorPatientId,
          suite: "workflow-claim-invalid-units",
          workflow: "claim-invalid-units-precondition"
        }
      });

      encounterId = await workflow.createEncounter(encounterInput);
      createClaimInput.encounter = encounterId;

      diagnosisLineId = await workflow.createBillingLine({
        patientId: patient.pid,
        providerId: patient.providerId,
        encounter: encounterId,
        dateTime: `${claimScrubBusinessDate} 18:02:00`,
        codeType: "ICD10",
        code: diagnosisPointer,
        modifier: "",
        codeText: "Gastro-esophageal reflux disease without esophagitis",
        fee: "0.00",
        units: 1,
        justify: diagnosisPointer
      });

      cptLineId = await workflow.createBillingLine({
        patientId: patient.pid,
        providerId: patient.providerId,
        encounter: encounterId,
        dateTime: `${claimScrubBusinessDate} 18:12:00`,
        codeType: "CPT4",
        code: validCptCode,
        modifier: validModifierText,
        codeText: "Invalid units parity charge",
        fee: "115.00",
        units: 0,
        justify: diagnosisPointer
      });

      claimId = await workflow.createClaimStatus(createClaimInput);
      const createdClaim = await workflow.getClaimStatus(claimId);
      expect(createdClaim).toMatchObject({
        patientId: patient.pid,
        encounter: encounterId,
        payerId: 9005,
        payerName: "Northstar HMO",
        status: 1,
        statusLabel: "Queued for billing",
        billProcess: 1,
        processFile: "",
        target: "HCFA",
        submittedClaim: ""
      });

      const linesWithValidClaimLines = await targetDb.getBillingLinesForEncounter(patient.pid, encounterId);
      expect(linesWithValidClaimLines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ codeType: "ICD10", code: diagnosisPointer }),
          expect.objectContaining({
            code: validCptCode,
            modifier: validModifierText,
            codeText: "Invalid units parity charge",
            fee: "115.00",
            justify: diagnosisPointer
          })
        ])
      );

      const expectedScrub = buildClaimScrubReport(claimId, encounterId, "Northstar HMO", 9005, patient.pubpid, linesWithValidClaimLines);
      expect(expectedScrub.report).toContain("SCRUB-FAIL");
      expect(expectedScrub.report).toContain(invalidUnitsIssue);
      expect(expectedScrub.report).not.toContain("missing-payer");
      expect(expectedScrub.report).not.toContain("invalid-fee");
      expect(expectedScrub.report).not.toContain("invalid-modifier");
      expect(expectedScrub.report).not.toContain("duplicate-modifier");
      expect(expectedScrub.report).not.toContain("modifier-count-exceeded");
      expect(expectedScrub.report).not.toContain("incompatible-modifier-combination");
      expect(expectedScrub.report).not.toContain("invalid-cpt-code");
      expect(expectedScrub.report).not.toContain("invalid-diagnosis-pointer");
      expect(expectedScrub.report).not.toContain("missing-diagnosis-code");

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient.pubpid);
        await expect(page.locator("body")).toContainText(`${invalidUnitsAnchorPatientId} / PID ${patient.pid}`);
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
          processTime: `${claimScrubBusinessDate} 13:05:00`,
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
        payerId: 9005,
        payerName: "Northstar HMO",
        status: 1,
        statusLabel: "Queued for billing",
        billProcess: 1,
        processTime: `${claimScrubBusinessDate} 13:05:00`,
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
        probe: "slice-551-claim-invalid-units-flagged",
        description: "Captures the temporary Slice 551 claim after invalid-units local claim scrubbing, including deterministic invalid-units report content, process-file metadata, and count stability.",
        expected: {
          claim: {
            patientId: patient.pid,
            encounter: encounterId,
            payerId: 9005,
            payerName: "Northstar HMO",
            status: 1,
            statusLabel: "Queued for billing",
            processTime: `${claimScrubBusinessDate} 13:05:00`,
            processFile: expectedScrub.processFile,
            target: "HCFA",
            submittedClaim: expectedScrub.report
          },
          counts: {
            encounters: beforeCounts.encounters + 1,
            claims: beforeCounts.claims + 1,
            billingLineItems: beforeCounts.billingLineItems + 2
          },
          scrub: { status: "FAIL", issues: [invalidUnitsIssue] }
        },
        actual: { patient, beforeCounts, afterScrubCounts, encounterId, claimId, diagnosisLineId, cptLineId, createdClaim, scrubbed, linesWithValidClaimLines },
        context: {
          canonicalId: invalidUnitsAnchorPatientId,
          encounter: encounterId,
          suite: "workflow-claim-invalid-units",
          workflow: "claim-invalid-units-flagged"
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
      probe: "slice-551-claim-invalid-units-cleanup",
      description: "Captures the final Slice 551 cleanup state for the temporary invalid-units claim, billing lines, and encounter.",
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
        canonicalId: invalidUnitsAnchorPatientId,
        encounter: encounterId,
        suite: "workflow-claim-invalid-units",
        workflow: "claim-invalid-units-cleanup"
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
  const futureServiceDates = Array.from(new Set(cptLines.map((line) => normalizeBillingDate(line.billingDate)).filter((billingDate) => Boolean(billingDate) && billingDate > claimScrubBusinessDate)));
  const allowedModifiers = new Set(["25", "59", "76", "77", "95"]);
  const modifierTokensByLine = cptLines.map((line) => parseClaimModifierTokens(line.modifier));
  const invalidModifiers = Array.from(new Set(modifierTokensByLine.flat().filter((modifier) => !allowedModifiers.has(modifier))));
  const duplicateModifiers = Array.from(new Set(modifierTokensByLine.flatMap((modifiers) => modifiers.filter((modifier, index) => modifiers.indexOf(modifier) !== index))));
  const incompatibleModifierCombinations = Array.from(new Set(modifierTokensByLine.flatMap((modifiers) => {
    const modifierSet = new Set(modifiers);
    return modifierSet.has("25") && modifierSet.has("59") ? ["25+59"] : [];
  })));
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

  if (payerId <= 0 || !payerName.trim()) issues.push("missing-payer");
  if (cptLines.length === 0) issues.push("missing-cpt-line");
  if (invalidCptCodes.length > 0) issues.push(`invalid-cpt-code:${invalidCptCodes.join(",")}`);
  if (futureServiceDates.length > 0) issues.push(`future-service-date:${futureServiceDates.join(",")}`);
  if (cptLines.some((line) => !line.justify?.trim())) issues.push("missing-diagnosis-pointer");
  if (diagnosisCodes.size === 0 && cptLines.some((line) => line.justify?.trim())) issues.push("missing-diagnosis-code");
  if (unsupportedDiagnosisPointers.length > 0) issues.push(`invalid-diagnosis-pointer:${unsupportedDiagnosisPointers.join(",")}`);
  if (invalidDiagnosisCodes.length > 0) issues.push(`invalid-diagnosis-code:${invalidDiagnosisCodes.join(",")}`);
  if (duplicateDiagnosisCodes.length > 0) issues.push(`duplicate-diagnosis-code:${duplicateDiagnosisCodes.join(",")}`);
  if (cptLines.some((line) => isInvalidClaimNumber(line.fee, 0))) issues.push("invalid-fee");
  if (cptLines.some((line) => isInvalidClaimNumber(line.units, 1))) issues.push("invalid-units");
  if (invalidModifiers.length > 0) issues.push(`invalid-modifier:${invalidModifiers.join(",")}`);
  if (duplicateModifiers.length > 0) issues.push(`duplicate-modifier:${duplicateModifiers.join(",")}`);
  if (incompatibleModifierCombinations.length > 0) issues.push(`incompatible-modifier-combination:${incompatibleModifierCombinations.join(",")}`);
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

function isInvalidClaimNumber(value: string | number | null | undefined, fallback: number) {
  const numberValue = Number(value ?? fallback);
  return !Number.isFinite(numberValue) || numberValue <= 0;
}

function parseClaimDiagnosisPointerTokens(justify: string | null | undefined) {
  return (justify || "").split(/[,\s]+/).map((value) => value.trim().toUpperCase()).filter(Boolean);
}

function isSupportedIcd10DiagnosisCode(code: string) {
  return /^[A-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/.test(code);
}

function normalizeBillingDate(value: string | null | undefined) {
  const trimmed = (value || "").trim();
  return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : "";
}
