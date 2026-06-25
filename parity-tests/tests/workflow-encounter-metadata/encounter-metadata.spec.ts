import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";

const encounterMetadataAnchorPatientId = "MOD-PAT-0002";

test.describe("encounter metadata mutation parity @slice35 @workflow-encounter-metadata @mutation", () => {
  test("creates, renders, updates, and removes encounter metadata", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterMetadataAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const reason = `Parity Metadata ${suffix}`;
    const createdMetadata = {
      sensitivity: "normal",
      referralSource: "self",
      externalId: `EXT-${suffix}`,
      posCode: 11
    };
    const updatedReason = `${reason} Updated`;
    const updatedBillingNote = "Updated by the parity encounter metadata suite.";
    const updatedMetadata = {
      sensitivity: "high",
      referralSource: "physician",
      externalId: `UPD-${suffix}`,
      posCode: 22
    };
    const encounterInput = {
      patientId: patient!.pid,
      providerId: patient!.providerId,
      dateTime: "2026-06-18 11:00:00",
      reason,
      facilityId: 10,
      facilityName: "OpenEMR Modernization Clinic",
      billingFacilityId: 10,
      ...createdMetadata,
      billingNote: "Created by the parity encounter metadata suite."
    };
    let encounterId: number | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-35-encounter-metadata-precondition",
        description: "Captures the Slice 35 encounter metadata mutation anchor patient, baseline counts, and proposed temporary encounter metadata payload before create.",
        expected: {
          patient: {
            pubpid: encounterMetadataAnchorPatientId,
            displayName: "Vega, Marisol"
          },
          create: {
            date: "2026-06-18",
            facilityId: 10,
            billingFacilityId: 10,
            sensitivity: "normal",
            referralSource: "self",
            externalIdPrefix: "EXT-",
            posCode: 11
          },
          update: {
            sensitivity: "high",
            referralSource: "physician",
            externalIdPrefix: "UPD-",
            posCode: 22,
            billingNote: updatedBillingNote
          },
          countChange: {
            encounters: beforeCounts.encounters + 1,
            cleanupEncounters: beforeCounts.encounters
          }
        },
        actual: {
          patient,
          beforeCounts,
          proposedEncounter: encounterInput,
          updatedReason,
          updatedMetadata,
          updatedBillingNote
        },
        context: {
          canonicalId: encounterMetadataAnchorPatientId,
          suite: "workflow-encounter-metadata",
          workflow: "encounter-metadata-mutation"
        }
      });

      encounterId = await workflow.createEncounter(encounterInput);

      const createdEncounter = await workflow.getEncounter(encounterId);
      expect(createdEncounter).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        date: "2026-06-18",
        reason,
        facilityId: 10,
        billingFacilityId: 10,
        ...createdMetadata
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-35-encounter-metadata-created",
        description: "Captures the temporary Slice 35 encounter row and encounter-count increment immediately after create.",
        expected: {
          encounter: {
            patientId: patient!.pid,
            providerId: patient!.providerId,
            date: "2026-06-18",
            reason,
            facilityId: 10,
            billingFacilityId: 10,
            ...createdMetadata
          },
          counts: {
            encounters: beforeCounts.encounters + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          encounterId,
          createdEncounter
        },
        context: {
          canonicalId: encounterMetadataAnchorPatientId,
          suite: "workflow-encounter-metadata",
          workflow: "encounter-metadata-mutation-created"
        }
      });
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters + 1);

      await workflow.updateEncounterReason(encounterId, updatedReason, updatedBillingNote, updatedMetadata);
      const updatedEncounter = await workflow.getEncounter(encounterId);
      expect(updatedEncounter).toMatchObject({
        reason: updatedReason,
        billingNote: updatedBillingNote,
        ...updatedMetadata
      });

      const afterUpdateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-35-encounter-metadata-updated",
        description: "Captures the temporary Slice 35 encounter row after reason, billing note, sensitivity, referral, external ID, and POS metadata update.",
        expected: {
          encounter: {
            reason: updatedReason,
            billingNote: updatedBillingNote,
            ...updatedMetadata
          },
          counts: {
            encounters: beforeCounts.encounters + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterUpdateCounts,
          encounterId,
          createdEncounter,
          updatedEncounter
        },
        context: {
          canonicalId: encounterMetadataAnchorPatientId,
          suite: "workflow-encounter-metadata",
          workflow: "encounter-metadata-mutation-updated"
        }
      });
      expect(afterUpdateCounts.encounters).toBe(beforeCounts.encounters + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expect(page.locator("body")).toContainText(patient!.lname);
      } else {
        await openAuthenticatedModernizedEncounters(page, target, patient!.pubpid, "2026-06-18");

        const encounterButton = page.getByRole("button", { name: new RegExp(escapeRegex(updatedReason), "i") }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const detailPanel = page.getByLabel("Encounter detail");
        await expect(page.getByRole("heading", { name: updatedReason })).toBeVisible();
        await expect(detailPanel).toContainText(updatedBillingNote);
        await expect(detailPanel).toContainText("High");
        await expect(detailPanel).toContainText(updatedMetadata.referralSource);
        await expect(detailPanel).toContainText(updatedMetadata.externalId);
        await expect(detailPanel).toContainText(String(updatedMetadata.posCode));
      }
    } finally {
      if (encounterId !== null) {
        await workflow.deleteEncounter(encounterId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    if (encounterId !== null) {
      const afterCleanup = await workflow.getEncounter(encounterId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-35-encounter-metadata-cleanup",
        description: "Captures the final Slice 35 hard-delete cleanup state for the temporary encounter metadata row.",
        expected: {
          counts: {
            encounters: beforeCounts.encounters
          },
          deletedEncounter: null
        },
        actual: {
          patient,
          beforeCounts,
          afterCleanupCounts,
          encounterId,
          afterCleanup
        },
        context: {
          canonicalId: encounterMetadataAnchorPatientId,
          suite: "workflow-encounter-metadata",
          workflow: "encounter-metadata-mutation-cleanup"
        }
      });
      expect(afterCleanup).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now().toString(36).slice(-5)}${Math.floor(Math.random() * 1000)}`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
