import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";

const encounterClaimAnchorPatientId = "MOD-PAT-0001";
const encounterClaimAnchorFromDate = "2026-01-01";
const anchorEncounter = 1000013;
const anchorClaimId = "CLAIM-1000013-1";
const anchorPayerName = "Acme Health";

test.describe("encounter claim linkage readiness parity @slice69 @encounter-claims @claims", () => {
  test("stable encounter anchor exposes linked claim facts", async ({ target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterClaimAnchorPatientId);
    expect(patient).not.toBeNull();
    if (patient === null) {
      throw new Error(`Encounter claim anchor patient ${encounterClaimAnchorPatientId} was not found.`);
    }

    const encounter = await targetDb.getLatestEncounterForPatient(patient.pid);
    expect(encounter).not.toBeNull();
    if (encounter === null) {
      throw new Error(`Encounter claim anchor encounter for ${encounterClaimAnchorPatientId} was not found.`);
    }
    expect(encounter.encounter).toBe(anchorEncounter);

    const claims = await targetDb.getClaimsForEncounter(patient.pid, encounter.encounter);
    expect(claims).toHaveLength(1);

    expect(claims[0]).toMatchObject({
      patientId: patient.pid,
      encounter: anchorEncounter,
      version: 1,
      payerName: anchorPayerName,
      payerType: 1,
      status: 3,
      statusLabel: "Marked as cleared",
      billProcess: 0,
      target: "HCFA"
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-69-encounter-claims-source",
      description: "Captures the Slice 69 encounter claim source contract: anchor patient, encounter 1000013, and the single cleared HCFA claim row.",
      expected: {
        anchorCanonicalId: encounterClaimAnchorPatientId,
        encounter: anchorEncounter,
        claimCount: 1,
        claimId: anchorClaimId,
        payerName: anchorPayerName,
        status: 3,
        statusLabel: "Marked as cleared",
        target: "HCFA"
      },
      actual: {
        patient,
        encounter,
        claims,
        selectedClaim: claims[0]
      },
      context: {
        suite: "encounter-claims",
        workflow: "encounter-claim-source"
      }
    });
  });

  test("encounter-linked claim is reachable from the modernized encounter surface", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterClaimAnchorPatientId);
    expect(patient).not.toBeNull();
    if (patient === null) {
      throw new Error(`Encounter claim anchor patient ${encounterClaimAnchorPatientId} was not found.`);
    }

    const encounter = await targetDb.getLatestEncounterForPatient(patient.pid);
    expect(encounter).not.toBeNull();
    if (encounter === null) {
      throw new Error(`Encounter claim anchor encounter for ${encounterClaimAnchorPatientId} was not found.`);
    }
    const claims = await targetDb.getClaimsForEncounter(patient.pid, encounter.encounter);

    if (target.type === "legacy-openemr") {
      expect(claims).toHaveLength(1);
      expect(claims[0].payerName).toBe(anchorPayerName);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-69-encounter-claims-surface",
        description: "Captures the Slice 69 legacy reachability evidence: the encounter-linked claim remains available through normalized legacy database probes for comparison with the modernized encounter surface.",
        expected: {
          anchorCanonicalId: encounterClaimAnchorPatientId,
          encounter: anchorEncounter,
          claimCount: 1,
          claimId: anchorClaimId,
          payerName: anchorPayerName,
          statusLabel: "Marked as cleared",
          target: "HCFA",
          legacySurfaceMode: "normalized database reachability"
        },
        actual: {
          patient,
          encounter,
          claims,
          legacySurface: {
            mode: "database-probe",
            renderedUiAssertions: 0,
            selectedClaimPayer: claims[0].payerName
          }
        },
        context: {
          suite: "encounter-claims",
          workflow: "encounter-claim-surface"
        }
      });
      return;
    }

    const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounter.encounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
    expect(detailResponse.ok()).toBe(true);
    const detailPayload = await detailResponse.json();
    expect(detailPayload.claims).toHaveLength(1);
    expect(detailPayload.claims[0]).toMatchObject({
      id: anchorClaimId,
      version: 1,
      payerName: anchorPayerName,
      payerType: 1,
      status: 3,
      statusLabel: "Marked as cleared",
      billProcess: 0,
      target: "HCFA"
    });

    await openAuthenticatedModernizedEncounters(page, target, patient.pubpid, encounterClaimAnchorFromDate);

    const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
    await expect(encounterButton).toBeVisible();
    await encounterButton.click();

    const linkage = page.getByLabel("Encounter claim linkage");
    await expect(linkage).toBeVisible();
    await expect(linkage).toContainText("Claim Linkage");
    await expect(linkage).toContainText(anchorPayerName);
    await expect(linkage).toContainText("Marked as cleared");
    await expect(linkage).toContainText("Version 1 / HCFA");
    await expect(linkage).toContainText("Status 3");
    await expect(linkage).toContainText(anchorClaimId);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-69-encounter-claims-surface",
      description: "Captures the Slice 69 modernized application-surface evidence: encounter detail API claim rows and Encounters workspace Claim Linkage rendering anchors.",
      expected: {
        anchorCanonicalId: encounterClaimAnchorPatientId,
        encounter: anchorEncounter,
        apiClaimCount: 1,
        claimId: anchorClaimId,
        payerName: anchorPayerName,
        uiPanelLabel: "Encounter claim linkage",
        uiHeading: "Claim Linkage",
        displayedStatus: "Marked as cleared",
        displayedVersionTarget: "Version 1 / HCFA",
        displayedStatusCode: "Status 3"
      },
      actual: {
        patient,
        encounter,
        claims,
        apiClaims: detailPayload.claims,
        modernizedSurface: {
          fromDate: encounterClaimAnchorFromDate,
          selectedEncounterLabel: "Hyperlipidemia",
          panelLabel: "Encounter claim linkage",
          renderedClaimId: anchorClaimId
        }
      },
      context: {
        suite: "encounter-claims",
        workflow: "encounter-claim-surface"
      }
    });
  });
});
