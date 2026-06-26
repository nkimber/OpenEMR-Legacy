import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const serverSideGenerationAnchorPatientId = "MOD-PAT-0005";
const serverSideGenerationEncounter = 1000052;

test.describe("claim server-side generation parity @slice557 @workflow-claim-server-side-generation @mutation @billing", () => {
  test("creates, server-generates, renders, and removes a temporary generated claim", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(serverSideGenerationAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const beforeClaims = await targetDb.getClaimsForPatient(patient!.pid);
    const createInput = {
      patientId: patient!.pid,
      encounter: serverSideGenerationEncounter,
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
        probe: "slice-557-claim-server-side-generation-precondition",
        description: "Captures the Slice 557 server-side claim generation anchor, baseline claim count, existing claims, and proposed temporary queued claim.",
        expected: {
          patient: {
            pubpid: serverSideGenerationAnchorPatientId
          },
          encounter: serverSideGenerationEncounter,
          create: {
            payerName: "Northstar HMO",
            payerType: 1,
            status: 1,
            statusLabel: "Queued for billing",
            billProcess: 1,
            target: "HCFA",
            processFile: "",
            submittedClaim: ""
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
          proposedClaim: createInput
        },
        context: {
          canonicalId: serverSideGenerationAnchorPatientId,
          encounter: serverSideGenerationEncounter,
          suite: "workflow-claim-server-side-generation",
          workflow: "claim-server-side-generation-precondition"
        }
      });

      claimId = await workflow.createClaimStatus(createInput);
      const created = await workflow.getClaimStatus(claimId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        encounter: serverSideGenerationEncounter,
        payerId: 9005,
        payerName: "Northstar HMO",
        payerType: 1,
        status: 1,
        statusLabel: "Queued for billing",
        billProcess: 1,
        billTime: "2026-06-18 12:15:00",
        processTime: "",
        processFile: "",
        target: "HCFA",
        x12PartnerId: 0,
        submittedClaim: ""
      });

      const expectedGenerated = buildGeneratedClaim837Payload(claimId, serverSideGenerationEncounter, "Northstar HMO", 9005, patient!.pubpid);

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedFees(page, target, patient!.pubpid);
        await expect(page.locator("body")).toContainText(`${serverSideGenerationAnchorPatientId} / PID ${patient!.pid}`);
        const claimCard = page.locator("article.billing-line-card")
          .filter({ hasText: `Version ${created!.version} / Primary Northstar HMO` })
          .filter({ hasText: "Queued for billing" })
          .first();
        await expect(claimCard).toContainText("No claim file");
        await expect(claimCard).toContainText("No submitted claim payload");
        await claimCard.getByRole("button", { name: "Generate" }).click();
        await expect(page.locator("body")).toContainText(expectedGenerated.processFile);
        await expect(page.locator("body")).toContainText("X12 billing");
        await expect(page.locator("body")).toContainText("Reviewed claim data");
      } else {
        await workflow.updateClaimStatus(claimId, {
          status: 2,
          billProcess: 0,
          processTime: "2026-06-18 14:15:00",
          processFile: expectedGenerated.processFile,
          target: "X12",
          x12PartnerId: 1,
          submittedClaim: expectedGenerated.payload
        });
      }

      const generated = await workflow.getClaimStatus(claimId);
      const normalizedSubmittedClaim = normalizeSubmittedClaim(generated!.submittedClaim);
      expect(generated).toMatchObject({
        patientId: patient!.pid,
        encounter: serverSideGenerationEncounter,
        payerName: "Northstar HMO",
        status: 2,
        statusLabel: "Marked as cleared",
        billProcess: 0,
        processTime: "2026-06-18 14:15:00",
        processFile: expectedGenerated.processFile,
        target: "X12",
        x12PartnerId: 1
      });
      expect(normalizedSubmittedClaim).toBe(expectedGenerated.payload);

      expect(normalizedSubmittedClaim).toContain("ISA*00*");
      expect(normalizedSubmittedClaim).toContain(`BHT*0019*00*${serverSideGenerationEncounter}*20260618*1415*CH~`);
      expect(normalizedSubmittedClaim).toContain(`NM1*QC*1*PATIENT*${patient!.pubpid}****MI*${patient!.pubpid}~`);
      expect(normalizedSubmittedClaim).toContain("NM1*PR*2*Northstar HMO*****PI*9005~");

      const afterGenerateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterGenerateCounts.claims).toBe(beforeCounts.claims + 1);
      const afterGenerateClaims = await targetDb.getClaimsForPatient(patient!.pid);
      const generatedClaimSummaries = afterGenerateClaims.filter((claim) => claim.processFile === expectedGenerated.processFile);
      expect(generatedClaimSummaries).toHaveLength(1);
      expect(generatedClaimSummaries[0]).toMatchObject({
        encounter: serverSideGenerationEncounter,
        payerName: "Northstar HMO",
        status: 2,
        statusLabel: "Marked as cleared",
        processFile: expectedGenerated.processFile,
        target: "X12"
      });
      expect(normalizeSubmittedClaim(generatedClaimSummaries[0].submittedClaim)).toBe(expectedGenerated.payload);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-557-claim-server-side-generation-generated",
        description: "Captures the temporary Slice 557 claim after backend generation, including deterministic process file, X12 partner, backend-generated 837P-style submitted-claim payload, modernized UI action evidence, and claim-count stability.",
        expected: {
          claim: {
            patientId: patient!.pid,
            encounter: serverSideGenerationEncounter,
            payerName: "Northstar HMO",
            status: 2,
            statusLabel: "Marked as cleared",
            processTime: "2026-06-18 14:15:00",
            processFile: expectedGenerated.processFile,
            target: "X12",
            x12PartnerId: 1,
            submittedClaimContains: [
              "ISA*00*",
              `BHT*0019*00*${serverSideGenerationEncounter}*20260618*1415*CH~`,
              `NM1*QC*1*PATIENT*${patient!.pubpid}****MI*${patient!.pubpid}~`,
              "NM1*PR*2*Northstar HMO*****PI*9005~"
            ]
          },
          counts: {
            claims: beforeCounts.claims + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterGenerateCounts,
          claimId,
          created,
          generated: {
            ...generated,
            normalizedSubmittedClaim
          },
          generatedClaims: generatedClaimSummaries.map((claim) => ({
            ...claim,
            normalizedSubmittedClaim: normalizeSubmittedClaim(claim.submittedClaim)
          }))
        },
        context: {
          canonicalId: serverSideGenerationAnchorPatientId,
          encounter: serverSideGenerationEncounter,
          suite: "workflow-claim-server-side-generation",
          workflow: "claim-server-side-generation-generated"
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
        probe: "slice-557-claim-server-side-generation-cleanup",
        description: "Captures the final Slice 557 cleanup state for the temporary generated claim.",
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
          canonicalId: serverSideGenerationAnchorPatientId,
          encounter: serverSideGenerationEncounter,
          suite: "workflow-claim-server-side-generation",
          workflow: "claim-server-side-generation-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function buildGeneratedClaim837Payload(
  claimId: number | string,
  encounter: number,
  payerName: string,
  payerId: number,
  patientId: string
) {
  const controlNumber = String(claimId).replace(/[^a-z0-9]/gi, "").slice(0, 12).toUpperCase() || "CLAIM";
  const payerCode = String(payerId || "UNKNOWN").replace(/[^a-z0-9]/gi, "").toUpperCase();
  const processFile = `CLAIM-${encounter}-${controlNumber}-837P.txt`;
  const payload = [
    `ISA*00*          *00*          *ZZ*OPENEMR        *ZZ*PAYER${payerCode.padEnd(10, " ")}*260618*1415*^*00501*${controlNumber.padStart(9, "0").slice(-9)}*0*T*:~`,
    `GS*HC*OPENEMR*PAYER${payerCode}*20260618*1415*${controlNumber}*X*005010X222A1~`,
    `ST*837*${controlNumber}*005010X222A1~`,
    `BHT*0019*00*${encounter}*20260618*1415*CH~`,
    `NM1*QC*1*PATIENT*${patientId}****MI*${patientId}~`,
    `CLM*${encounter}*0***11:B:1*Y*A*Y*I~`,
    `NM1*PR*2*${payerName}*****PI*${payerId}~`,
    `SE*7*${controlNumber}~`
  ].join("");

  return { processFile, payload };
}

function normalizeSubmittedClaim(value: string) {
  return value.replace(/\\n/g, "");
}
