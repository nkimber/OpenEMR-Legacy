import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const duplicateDiagnosisCodeAnchorPatientId = "MOD-PAT-0005";
const duplicateDiagnosisCode = "K21.9";

type BillingLineLike = {
  codeType?: string | null;
  code?: string | null;
  modifier?: string | null;
  fee?: string | number | null;
  justify?: string | null;
  units?: string | number | null;
};

test.describe("claim duplicate diagnosis code parity @slice544 @workflow-claim-duplicate-diagnosis-code @mutation @billing", () => {
  test("creates, flags, renders, and removes a duplicate-diagnosis-code claim scrub report", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(duplicateDiagnosisCodeAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${duplicateDiagnosisCodeAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeClaims = await targetDb.getClaimsForPatient(patient.pid);
    const encounterInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateTime: "2026-06-18 16:00:00",
      reason: "Duplicate diagnosis code parity encounter",
      facilityId: 10,
      facilityName: "OpenEMR Modernization Clinic",
      billingFacilityId: 10,
      billingNote: "Created by the Slice 544 claim duplicate diagnosis code parity suite."
    };
    const createClaimInput = {
      patientId: patient.pid,
      encounter: 0,
      payerId: 9005,
      payerName: "Northstar HMO",
      payerType: 1,
      status: 1,
      billProcess: 1,
      billTime: "2026-06-18 16:10:00",
      processFile: "",
      target: "HCFA",
      x12PartnerId: 0,
      submittedClaim: ""
    };
    let encounterId: number | null = null;
    let firstDiagnosisLineId: number | string | null = null;
    let secondDiagnosisLineId: number | string | null = null;
    let cptLineId: number | string | null = null;
    let claimId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-544-claim-duplicate-diagnosis-code-precondition",
        description: "Captures the Slice 544 duplicate diagnosis-code anchor, baseline counts, proposed temporary encounter, duplicate ICD10 diagnosis lines, valid CPT pointer, and queued claim.",
        expected: {
          patient: { pubpid: duplicateDiagnosisCodeAnchorPatientId },
          duplicateDiagnosisCode,
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
          canonicalId: duplicateDiagnosisCodeAnchorPatientId,
          suite: "workflow-claim-duplicate-diagnosis-code",
          workflow: "claim-duplicate-diagnosis-code-precondition"
        }
      });

      encounterId = await workflow.createEncounter(encounterInput);
      createClaimInput.encounter = encounterId;

      firstDiagnosisLineId = await workflow.createBillingLine({
        patientId: patient.pid,
        providerId: patient.providerId,
        encounter: encounterId,
        dateTime: "2026-06-18 16:02:00",
        codeType: "ICD10",
        code: duplicateDiagnosisCode,
        modifier: "",
        codeText: "Gastro-esophageal reflux disease without esophagitis",
        fee: "0.00",
        units: 1,
        justify: duplicateDiagnosisCode
      });

      secondDiagnosisLineId = await workflow.createBillingLine({
        patientId: patient.pid,
        providerId: patient.providerId,
        encounter: encounterId,
        dateTime: "2026-06-18 16:03:00",
        codeType: "ICD10",
        code: duplicateDiagnosisCode,
        modifier: "",
        codeText: "Duplicate GERD diagnosis parity row",
        fee: "0.00",
        units: 1,
        justify: duplicateDiagnosisCode
      });

      cptLineId = await workflow.createBillingLine({
        patientId: patient.pid,
        providerId: patient.providerId,
        encounter: encounterId,
        dateTime: "2026-06-18 16:12:00",
        codeType: "CPT4",
        code: "99214",
        modifier: "25",
        codeText: "Duplicate diagnosis code parity charge",
        fee: "115.00",
        units: 1,
        justify: duplicateDiagnosisCode
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

      const linesWithDuplicateDiagnosisCode = await targetDb.getBillingLinesForEncounter(patient.pid, encounterId);
      expect(linesWithDuplicateDiagnosisCode.filter((line) => line.codeType === "ICD10" && line.code === duplicateDiagnosisCode)).toHaveLength(2);
      expect(linesWithDuplicateDiagnosisCode).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "99214",
            modifier: "25",
            codeText: "Duplicate diagnosis code parity charge",
            fee: "115.00",
            justify: duplicateDiagnosisCode
          })
        ])
      );

      const expectedScrub = buildClaimScrubReport(
        claimId,
        encounterId,
        "Northstar HMO",
        9005,
        patient.pubpid,
        linesWithDuplicateDiagnosisCode
      );
      expect(expectedScrub.report).toContain("SCRUB-FAIL");
      expect(expectedScrub.report).toContain(`duplicate-diagnosis-code:${duplicateDiagnosisCode}`);
      expect(expectedScrub.report).not.toContain("invalid-diagnosis-pointer");
      expect(expectedScrub.report).not.toContain("missing-diagnosis-code");
      expect(expectedScrub.report).not.toContain("duplicate-diagnosis-pointer");

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient.pubpid);
        await expect(page.locator("body")).toContainText(`${duplicateDiagnosisCodeAnchorPatientId} / PID ${patient.pid}`);
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
      expect(afterScrubCounts.billingLineItems).toBe(beforeCounts.billingLineItems + 3);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-544-claim-duplicate-diagnosis-code-flagged",
        description: "Captures the temporary Slice 544 claim after duplicate-diagnosis-code local claim scrubbing, including deterministic duplicate-diagnosis-code report content, process-file metadata, and count stability.",
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
            status: "FAIL",
            issues: [`duplicate-diagnosis-code:${duplicateDiagnosisCode}`]
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterScrubCounts,
          encounterId,
          claimId,
          firstDiagnosisLineId,
          secondDiagnosisLineId,
          cptLineId,
          createdClaim,
          scrubbed,
          linesWithDuplicateDiagnosisCode
        },
        context: {
          canonicalId: duplicateDiagnosisCodeAnchorPatientId,
          encounter: encounterId,
          suite: "workflow-claim-duplicate-diagnosis-code",
          workflow: "claim-duplicate-diagnosis-code-flagged"
        }
      });
    } finally {
      if (claimId !== null) await workflow.deleteClaimStatus(claimId);
      if (cptLineId !== null) await workflow.deleteBillingLine(cptLineId);
      if (secondDiagnosisLineId !== null) await workflow.deleteBillingLine(secondDiagnosisLineId);
      if (firstDiagnosisLineId !== null) await workflow.deleteBillingLine(firstDiagnosisLineId);
      if (encounterId !== null) await workflow.deleteEncounter(encounterId);
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.claims).toBe(beforeCounts.claims);
    expect(afterCleanupCounts.billingLineItems).toBe(beforeCounts.billingLineItems);
    const afterCleanupClaim = claimId !== null ? await workflow.getClaimStatus(claimId) : null;
    const afterCleanupCptLine = cptLineId !== null ? await workflow.getBillingLine(cptLineId) : null;
    const afterCleanupFirstDiagnosisLine = firstDiagnosisLineId !== null ? await workflow.getBillingLine(firstDiagnosisLineId) : null;
    const afterCleanupSecondDiagnosisLine = secondDiagnosisLineId !== null ? await workflow.getBillingLine(secondDiagnosisLineId) : null;
    const afterCleanupEncounter = encounterId !== null ? await workflow.getEncounter(encounterId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-544-claim-duplicate-diagnosis-code-cleanup",
      description: "Captures the final Slice 544 cleanup state for the temporary duplicate-diagnosis-code claim, billing lines, and encounter.",
      expected: {
        counts: {
          encounters: beforeCounts.encounters,
          claims: beforeCounts.claims,
          billingLineItems: beforeCounts.billingLineItems
        },
        deletedClaim: null,
        deletedCptLine: null,
        deletedFirstDiagnosisLine: null,
        deletedSecondDiagnosisLine: null,
        deletedEncounter: null
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        encounterId,
        claimId,
        cptLineId,
        firstDiagnosisLineId,
        secondDiagnosisLineId,
        afterCleanupClaim,
        afterCleanupCptLine,
        afterCleanupFirstDiagnosisLine,
        afterCleanupSecondDiagnosisLine,
        afterCleanupEncounter
      },
      context: {
        canonicalId: duplicateDiagnosisCodeAnchorPatientId,
        encounter: encounterId,
        suite: "workflow-claim-duplicate-diagnosis-code",
        workflow: "claim-duplicate-diagnosis-code-cleanup"
      }
    });
    expect(afterCleanupClaim).toBeNull();
    expect(afterCleanupCptLine).toBeNull();
    expect(afterCleanupFirstDiagnosisLine).toBeNull();
    expect(afterCleanupSecondDiagnosisLine).toBeNull();
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
  const duplicateDiagnosisCodes = Array.from(new Set(diagnosisCodeValues.filter((diagnosisCode, index) => diagnosisCodeValues.indexOf(diagnosisCode) !== index)));
  const diagnosisCodes = new Set(diagnosisCodeValues);
  const unsupportedDiagnosisPointers = diagnosisCodes.size === 0
    ? []
    : Array.from(new Set(diagnosisPointerTokensByLine.flat().filter((pointer) => Boolean(pointer) && !diagnosisCodes.has(pointer))));
  const issues: string[] = [];

  if (payerId <= 0 || !payerName) issues.push("missing-payer");
  if (cptLines.length === 0) issues.push("missing-cpt-line");
  if (cptLines.some((line) => !line.justify?.trim())) issues.push("missing-diagnosis-pointer");
  if (diagnosisCodes.size === 0 && cptLines.some((line) => line.justify?.trim())) issues.push("missing-diagnosis-code");
  if (unsupportedDiagnosisPointers.length > 0) issues.push(`invalid-diagnosis-pointer:${unsupportedDiagnosisPointers.join(",")}`);
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
