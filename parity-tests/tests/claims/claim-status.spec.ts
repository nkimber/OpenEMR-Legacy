import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const claimStatusAnchorPatientId = "MOD-PAT-0005";
const claimStatusAnchorEncounter = 1000052;

test.describe("claim status parity @slice47 @claims @billing", () => {
  test("stable billing anchor has seeded claim status history", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(claimStatusAnchorPatientId);
    expect(patient).not.toBeNull();

    const claims = await targetDb.getClaimsForPatient(patient!.pid);
    const encounterClaims = await targetDb.getClaimsForEncounter(patient!.pid, claimStatusAnchorEncounter);
    expect(claims.length).toBeGreaterThanOrEqual(3);

    const queuedClaim = claims.find((claim) => claim.statusLabel === "Queued for billing" && claim.billProcess === 1);
    const generatedClaim = claims.find((claim) => claim.processFile.match(/^CLAIM-\d+-837P\.txt$/));
    const clearedClaim = claims.find(
      (claim) => claim.statusLabel === "Marked as cleared" && claim.processFile === "" && claim.billProcess === 0
    );

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-47-claim-status-anchor",
      description: "Verifies the Slice 47 billing anchor patient and seeded claim status database facts before application rendering.",
      expected: {
        patient: {
          pubpid: claimStatusAnchorPatientId
        },
        claims: {
          minimumCount: 3,
          anchorEncounter: claimStatusAnchorEncounter,
          queued: {
            payerName: "Northstar HMO",
            payerType: 1,
            version: 1,
            statusLabel: "Queued for billing",
            billProcess: 1,
            target: "HCFA"
          },
          generated: {
            payerName: "Northstar HMO",
            version: 1,
            statusLabel: "Marked as cleared",
            target: "X12",
            processFilePattern: "CLAIM-*-837P.txt"
          },
          cleared: {
            payerName: "Northstar HMO",
            version: 1,
            statusLabel: "Marked as cleared",
            billProcess: 0,
            processFile: "",
            target: "HCFA"
          }
        }
      },
      actual: {
        patient,
        claims,
        encounterClaims,
        selected: {
          queuedClaim,
          generatedClaim,
          clearedClaim
        }
      },
      context: {
        canonicalId: claimStatusAnchorPatientId,
        suite: "claims",
        workflow: "claim-status-readiness"
      }
    });

    expect(queuedClaim).toMatchObject({
      patientId: patient!.pid,
      version: 1,
      payerName: "Northstar HMO",
      payerType: 1,
      statusLabel: "Queued for billing",
      target: "HCFA"
    });
    expect(generatedClaim).toMatchObject({
      patientId: patient!.pid,
      version: 1,
      payerName: "Northstar HMO",
      statusLabel: "Marked as cleared",
      target: "X12"
    });
    expect(clearedClaim).toMatchObject({
      patientId: patient!.pid,
      version: 1,
      payerName: "Northstar HMO",
      statusLabel: "Marked as cleared",
      target: "HCFA"
    });

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-47-claim-status-render-precondition",
      description: "Captures the exact queued, generated, and cleared claim rows used by the Slice 47 Fees claim-status rendering assertions.",
      expected: {
        visibleText: [
          "Claims",
          "Claim Status",
          "Queued for billing",
          "Marked as cleared",
          "Northstar HMO",
          generatedClaim!.processFile
        ]
      },
      actual: {
        patient,
        selected: {
          queuedClaim,
          generatedClaim,
          clearedClaim
        },
        encounterClaims
      },
      context: {
        canonicalId: claimStatusAnchorPatientId,
        suite: "claims",
        workflow: "claim-status-rendering"
      }
    });

    if (target.type === "legacy-openemr") {
      return;
    }

    await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText("Claims");
    await expect(page.locator("body")).toContainText("Claim Status");
    await expect(page.locator("body")).toContainText("Queued for billing");
    await expect(page.locator("body")).toContainText("Marked as cleared");
    await expect(page.locator("body")).toContainText("Northstar HMO");
    await expect(page.locator("body")).toContainText(generatedClaim!.processFile);
  });
});
