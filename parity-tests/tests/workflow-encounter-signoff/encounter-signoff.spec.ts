import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";

const signOffAnchorPatientId = "MOD-PAT-0002";
const signOffEncounterDate = "2026-06-18";

type QueryableDb = {
  queryRows<T extends Record<string, string>>(sql: string): Promise<T[]>;
};

type SignatureRow = {
  id: string;
  encounterId: string;
  tableName: string;
  signerUsername: string;
  signedAt: string;
  isLock: string;
  amendment: string;
  hash: string;
  signatureHash: string;
};

test.describe("encounter sign-off parity @slice77 @workflow-encounter-signoff @mutation", () => {
  test("creates, signs, renders, deletes, and removes encounter sign-off", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(signOffAnchorPatientId);
    expect(patient).not.toBeNull();
    if (patient === null) {
      throw new Error(`Encounter sign-off anchor patient ${signOffAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const suffix = workflowSuffix();
    const externalId = compactWorkflowId();
    const reason = `Parity Encounter Sign-Off ${suffix}`;
    const billingNote = `Encounter sign-off parity billing note ${suffix}.`;
    const signatureNote = `Parity encounter sign-off note ${suffix}.`;
    const encounterInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateTime: `${signOffEncounterDate} 10:15:00`,
      reason,
      facilityId: 10,
      facilityName: "OpenEMR Modernization Clinic",
      billingFacilityId: 10,
      sensitivity: "normal",
      referralSource: "Parity suite",
      externalId,
      posCode: 11,
      billingNote
    };
    const signatureInput = {
      signerUsername: "admin",
      signedAt: `${signOffEncounterDate} 10:20:00`,
      isLock: false,
      amendment: signatureNote
    };
    let encounterId: number | null = null;
    let signatureId: number | null = null;
    let deletedSignatureId: number | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-77-encounter-signoff-precondition",
      description: "Captures the Slice 77 encounter sign-off precondition: anchor patient, baseline workflow counts, and proposed temporary encounter plus admin signature payload.",
      expected: {
        anchorCanonicalId: signOffAnchorPatientId,
        create: {
          encounter: {
            date: signOffEncounterDate,
            facilityId: 10,
            billingFacilityId: 10,
            sensitivity: "normal",
            posCode: 11
          },
          signature: {
            tableName: "form_encounter",
            signerUsername: "admin",
            signedAt: `${signOffEncounterDate} 10:20`,
            isLock: false,
            amendment: signatureNote
          }
        },
        countChange: {
          encountersAfterCreate: beforeCounts.encounters + 1,
          encounterSignaturesAfterSign: beforeCounts.encounterSignatures + 1,
          encounterSignaturesAfterDelete: beforeCounts.encounterSignatures,
          encountersAfterCleanup: beforeCounts.encounters
        }
      },
      actual: {
        patient,
        beforeCounts,
        proposed: {
          encounter: encounterInput,
          signature: signatureInput
        }
      },
      context: {
        canonicalId: signOffAnchorPatientId,
        suite: "workflow-encounter-signoff",
        workflow: "encounter-signoff-precondition"
      }
    });

    try {
      encounterId = await workflow.createEncounter(encounterInput);

      const createdEncounter = await workflow.getEncounter(encounterId);
      expect(createdEncounter).toMatchObject({
        patientId: patient.pid,
        providerId: patient.providerId,
        date: signOffEncounterDate,
        reason,
        facilityId: 10,
        billingFacilityId: 10,
        billingNote
      });
      const afterEncounterCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-77-encounter-signoff-encounter-created",
        description: "Captures the temporary Slice 77 encounter immediately after create and before signature insertion.",
        expected: {
          counts: {
            encounters: beforeCounts.encounters + 1,
            encounterSignatures: beforeCounts.encounterSignatures
          },
          encounter: {
            patientId: patient.pid,
            providerId: patient.providerId,
            date: signOffEncounterDate,
            reason,
            facilityId: 10,
            billingFacilityId: 10,
            billingNote
          }
        },
        actual: {
          patient,
          beforeCounts,
          afterEncounterCounts,
          encounterId,
          encounterInput,
          createdEncounter
        },
        context: {
          canonicalId: signOffAnchorPatientId,
          suite: "workflow-encounter-signoff",
          workflow: "encounter-signoff-encounter-created"
        }
      });

      signatureId = await workflow.signEncounter(encounterId, signatureInput);

      const signature = await workflow.getEncounterSignature(signatureId);
      expect(signature).toMatchObject({
        tableName: "form_encounter",
        signerUsername: "admin",
        signedAt: `${signOffEncounterDate} 10:20`,
        isLock: false,
        amendment: signatureNote
      });
      expect(signature!.hash.length).toBeGreaterThanOrEqual(32);
      expect(signature!.signatureHash.length).toBeGreaterThanOrEqual(32);
      if (signature === null) {
        throw new Error(`Encounter signature ${signatureId} was not found after signing encounter ${encounterId}.`);
      }
      const signatureRows = await querySignaturesForEncounter(target.type, targetDb as QueryableDb, encounterId);
      expect(signatureRows).toHaveLength(1);
      expect(signatureRows[0]).toMatchObject({
        signerUsername: "admin",
        signedAt: `${signOffEncounterDate} 10:20`,
        isLock: "0",
        amendment: signatureNote
      });

      const afterSignCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterSignCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterSignCounts.encounterSignatures).toBe(beforeCounts.encounterSignatures + 1);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-77-encounter-signoff-signed",
        description: "Captures the temporary Slice 77 admin signature row, signature hashes, normalized signature query rows, and count increment after encounter sign-off.",
        expected: {
          counts: {
            encounters: beforeCounts.encounters + 1,
            encounterSignatures: beforeCounts.encounterSignatures + 1
          },
          signature: {
            tableName: "form_encounter",
            signerUsername: "admin",
            signedAt: `${signOffEncounterDate} 10:20`,
            isLock: false,
            amendment: signatureNote,
            minimumHashLength: 32,
            minimumSignatureHashLength: 32
          },
          signatureRows: [{
            signerUsername: "admin",
            signedAt: `${signOffEncounterDate} 10:20`,
            isLock: "0",
            amendment: signatureNote
          }]
        },
        actual: {
          patient,
          encounterId,
          createdEncounter,
          beforeCounts,
          afterSignCounts,
          signatureId,
          signature,
          signatureRows
        },
        context: {
          canonicalId: signOffAnchorPatientId,
          suite: "workflow-encounter-signoff",
          workflow: "encounter-signoff-signed"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient.pid);
        await expectRenderedText(page, patient.lname);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-77-encounter-signoff-surface",
          description: "Captures the Slice 77 legacy application-surface evidence after the signed temporary encounter remains reachable from the patient summary.",
          expected: {
            renderedPatientLastName: patient.lname,
            page: "patient summary"
          },
          actual: {
            patient,
            encounterId,
            signatureId,
            signature,
            signatureRows,
            legacySurface: {
              page: "patient summary",
              renderedPatientLastName: patient.lname
            }
          },
          context: {
            canonicalId: signOffAnchorPatientId,
            suite: "workflow-encounter-signoff",
            workflow: "encounter-signoff-surface"
          }
        });
      } else {
        await openAuthenticatedModernizedEncounters(page, target, patient.pubpid, signOffEncounterDate);

        const encounterButton = page.getByRole("button", { name: new RegExp(escapeRegex(reason), "i") }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const signOffPanel = page.getByRole("region", { name: "Encounter sign-off" });
        await expect(signOffPanel).toContainText("Signed");
        await expect(signOffPanel).toContainText("admin");
        await expect(signOffPanel).toContainText(signatureNote);
        await expect(signOffPanel.locator("code")).toContainText(signature.hash.slice(0, 12));
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-77-encounter-signoff-surface",
          description: "Captures the Slice 77 modernized application-surface evidence for the signed temporary encounter through the Encounters workspace sign-off region.",
          expected: {
            ui: {
              signOffRegion: "Encounter sign-off",
              status: "Signed",
              signerUsername: "admin",
              amendment: signatureNote,
              renderedHashPrefix: signature.hash.slice(0, 12)
            }
          },
          actual: {
            patient,
            encounterId,
            signatureId,
            signature,
            signatureRows,
            modernizedSurface: {
              fromDate: signOffEncounterDate,
              selectedEncounterLabel: reason,
              signOffRegion: "Encounter sign-off",
              renderedHashPrefix: signature.hash.slice(0, 12)
            }
          },
          context: {
            canonicalId: signOffAnchorPatientId,
            suite: "workflow-encounter-signoff",
            workflow: "encounter-signoff-surface"
          }
        });
      }

      deletedSignatureId = signatureId;
      await workflow.deleteEncounterSignature(signatureId);
      signatureId = null;
      const deletedSignature = await workflow.getEncounterSignature(deletedSignatureId);
      expect(deletedSignature).toBeNull();

      const afterSignatureDeleteCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterSignatureDeleteCounts.encounterSignatures).toBe(beforeCounts.encounterSignatures);
      const signatureRowsAfterDelete = await querySignaturesForEncounter(target.type, targetDb as QueryableDb, encounterId);
      expect(signatureRowsAfterDelete).toEqual([]);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-77-encounter-signoff-signature-deleted",
        description: "Captures the Slice 77 state after deleting the temporary encounter signature while the temporary encounter still exists.",
        expected: {
          counts: {
            encounters: beforeCounts.encounters + 1,
            encounterSignatures: beforeCounts.encounterSignatures
          },
          deletedSignature: null,
          signatureRowsAfterDelete: []
        },
        actual: {
          patient,
          encounterId,
          deletedSignatureId,
          deletedSignature,
          afterSignatureDeleteCounts,
          signatureRowsAfterDelete
        },
        context: {
          canonicalId: signOffAnchorPatientId,
          suite: "workflow-encounter-signoff",
          workflow: "encounter-signoff-signature-deleted"
        }
      });
    } finally {
      if (signatureId !== null) {
        await workflow.deleteEncounterSignature(signatureId);
      }
      if (encounterId !== null) {
        await workflow.deleteEncounter(encounterId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.encounterSignatures).toBe(beforeCounts.encounterSignatures);
    const deletedEncounter = encounterId !== null ? await workflow.getEncounter(encounterId) : null;
    const deletedSignature = deletedSignatureId !== null ? await workflow.getEncounterSignature(deletedSignatureId) : null;
    const finalSignatureRows = encounterId !== null
      ? await querySignaturesForEncounter(target.type, targetDb as QueryableDb, encounterId)
      : [];
    if (encounterId !== null) {
      expect(deletedEncounter).toBeNull();
    }
    if (deletedSignatureId !== null) {
      expect(deletedSignature).toBeNull();
    }
    expect(finalSignatureRows).toEqual([]);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-77-encounter-signoff-cleanup",
      description: "Captures the final Slice 77 cleanup state after deleting the temporary signature and temporary encounter.",
      expected: {
        counts: {
          encounters: beforeCounts.encounters,
          encounterSignatures: beforeCounts.encounterSignatures
        },
        deletedEncounter: encounterId === null ? null : { id: encounterId, row: null },
        deletedSignature: deletedSignatureId === null ? null : { id: deletedSignatureId, row: null },
        finalSignatureRows: []
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        encounterId,
        deletedSignatureId,
        deletedEncounter,
        deletedSignature,
        finalSignatureRows
      },
      context: {
        canonicalId: signOffAnchorPatientId,
        suite: "workflow-encounter-signoff",
        workflow: "encounter-signoff-cleanup"
      }
    });
  });
});

async function querySignaturesForEncounter(targetType: string, db: QueryableDb, encounterId: number) {
  if (targetType === "legacy-openemr") {
    return db.queryRows<SignatureRow>(`
SELECT es.id, es.tid AS encounterId, es.\`table\` AS tableName, u.username AS signerUsername,
  DATE_FORMAT(es.datetime, '%Y-%m-%d %H:%i') AS signedAt,
  CAST(es.is_lock AS CHAR) AS isLock,
  COALESCE(es.amendment, '') AS amendment,
  es.hash,
  es.signature_hash AS signatureHash
FROM esign_signatures es
INNER JOIN users u ON u.id = es.uid
WHERE es.tid = ${integer(encounterId)}
  AND es.\`table\` = 'form_encounter'
ORDER BY es.datetime DESC, es.id DESC;
`);
  }

  return db.queryRows<SignatureRow>(`
SELECT id, encounter AS "encounterId", table_name AS "tableName", signer_username AS "signerUsername",
  to_char(signed_at, 'YYYY-MM-DD HH24:MI') AS "signedAt",
  CASE WHEN is_lock THEN '1' ELSE '0' END AS "isLock",
  COALESCE(amendment, '') AS amendment,
  hash,
  signature_hash AS "signatureHash"
FROM encounter_signatures
WHERE encounter = ${integer(encounterId)}
ORDER BY signed_at DESC, id DESC;
`);
}

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function compactWorkflowId() {
  const timestamp = Date.now().toString(36).slice(-8);
  const random = Math.floor(Math.random() * 1296).toString(36).padStart(2, "0");
  return `PS${timestamp}${random}`.toUpperCase();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function integer(value: number) {
  if (!Number.isInteger(value)) {
    throw new Error(`Expected integer value, received ${value}`);
  }
  return String(value);
}
