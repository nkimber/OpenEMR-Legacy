import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";

const amendmentAnchorPatientId = "MOD-PAT-0002";
const amendmentEncounterDate = "2026-06-18";

type QueryableDb = {
  queryRows<T extends Record<string, string>>(sql: string): Promise<T[]>;
};

type AmendmentHistoryRow = {
  signatureId: string;
  encounterId: string;
  signerUsername: string;
  signedAt: string;
  isLock: string;
  amendment: string;
  hash: string;
  signatureHash: string;
};

type ModernizedEncounterDetail = {
  signatures: unknown[];
  amendmentHistory: Array<{
    signatureId: number;
    signerUsername: string;
    signedAt: string;
    isLock: boolean;
    amendment: string;
    hash: string;
    signatureHash: string;
  }>;
};

test.describe("encounter amendment history parity @slice190 @workflow-encounter-amendment-history @mutation", () => {
  test("records ordered amendment history from encounter signatures", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(amendmentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (patient === null) {
      throw new Error(`Encounter amendment history anchor patient ${amendmentAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const suffix = workflowSuffix();
    const externalId = compactWorkflowId();
    const reason = `Parity Encounter Amendment History ${suffix}`;
    const billingNote = `Encounter amendment history parity billing note ${suffix}.`;
    const intakeAmendment = `Initial signed amendment ${suffix}.`;
    const blankNote = "";
    const lockedAmendment = `Locked follow-up amendment ${suffix}.`;
    let encounterId: number | null = null;
    const signatureIds: number[] = [];
    const deletedSignatureIds: number[] = [];
    const encounterInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      dateTime: `${amendmentEncounterDate} 13:00:00`,
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
    const signatureInputs = [
      {
        signerUsername: "admin",
        signedAt: `${amendmentEncounterDate} 13:05:00`,
        isLock: false,
        amendment: intakeAmendment
      },
      {
        signerUsername: "gold-provider-02",
        signedAt: `${amendmentEncounterDate} 13:10:00`,
        isLock: false,
        amendment: blankNote
      },
      {
        signerUsername: "gold-provider-02",
        signedAt: `${amendmentEncounterDate} 13:15:00`,
        isLock: true,
        amendment: lockedAmendment
      }
    ];

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-190-encounter-amendment-history-precondition",
      description: "Captures the Slice 190 amendment-history precondition: anchor patient, baseline workflow counts, proposed temporary encounter, and ordered signature inputs including the blank note that should be filtered from amendment history.",
      expected: {
        anchorCanonicalId: amendmentAnchorPatientId,
        create: {
          encounter: {
            date: amendmentEncounterDate,
            facilityId: 10,
            billingFacilityId: 10,
            sensitivity: "normal",
            posCode: 11
          },
          signatures: {
            total: 3,
            nonblankAmendments: 2,
            blankAmendments: 1,
            expectedHistoryOrder: [lockedAmendment, intakeAmendment]
          }
        },
        countChange: {
          encountersAfterCreate: beforeCounts.encounters + 1,
          encounterSignaturesAfterSign: beforeCounts.encounterSignatures + 3,
          encountersAfterCleanup: beforeCounts.encounters,
          encounterSignaturesAfterCleanup: beforeCounts.encounterSignatures
        }
      },
      actual: {
        patient,
        beforeCounts,
        proposed: {
          encounter: encounterInput,
          signatures: signatureInputs
        }
      },
      context: {
        canonicalId: amendmentAnchorPatientId,
        suite: "workflow-encounter-amendment-history",
        workflow: "encounter-amendment-history-precondition"
      }
    });

    try {
      encounterId = await workflow.createEncounter(encounterInput);
      const createdEncounter = await workflow.getEncounter(encounterId);
      const afterEncounterCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-190-encounter-amendment-history-encounter-created",
        description: "Captures the temporary Slice 190 encounter after creation and before signature rows are inserted.",
        expected: {
          counts: {
            encounters: beforeCounts.encounters + 1,
            encounterSignatures: beforeCounts.encounterSignatures
          },
          encounter: {
            patientId: patient.pid,
            providerId: patient.providerId,
            date: amendmentEncounterDate,
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
          canonicalId: amendmentAnchorPatientId,
          suite: "workflow-encounter-amendment-history",
          workflow: "encounter-amendment-history-encounter-created"
        }
      });

      for (const signatureInput of signatureInputs) {
        signatureIds.push(await workflow.signEncounter(encounterId, signatureInput));
      }

      const amendmentRows = await queryAmendmentHistory(target.type, targetDb as QueryableDb, encounterId);
      expect(amendmentRows).toHaveLength(2);
      expect(amendmentRows.map((row) => row.amendment)).toEqual([lockedAmendment, intakeAmendment]);
      expect(amendmentRows.map((row) => row.signerUsername)).toEqual(["gold-provider-02", "admin"]);
      expect(amendmentRows.map((row) => row.isLock)).toEqual(["1", "0"]);
      expect(amendmentRows.every((row) => row.hash.length >= 32)).toBe(true);
      expect(amendmentRows.every((row) => row.signatureHash.length >= 32)).toBe(true);

      const afterSignCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterSignCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterSignCounts.encounterSignatures).toBe(beforeCounts.encounterSignatures + 3);
      const signatureRows = await querySignaturesForEncounter(target.type, targetDb as QueryableDb, encounterId);
      expect(signatureRows).toHaveLength(3);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-190-encounter-amendment-history-signed",
        description: "Captures all temporary Slice 190 signature rows plus normalized amendment-history rows, proving that the blank note is stored but filtered from amendment history.",
        expected: {
          counts: {
            encounters: beforeCounts.encounters + 1,
            encounterSignatures: beforeCounts.encounterSignatures + 3
          },
          signatureRows: {
            total: 3,
            blankAmendments: 1
          },
          amendmentHistory: {
            total: 2,
            amendments: [lockedAmendment, intakeAmendment],
            signerUsernames: ["gold-provider-02", "admin"],
            isLock: ["1", "0"],
            minimumHashLength: 32,
            minimumSignatureHashLength: 32
          }
        },
        actual: {
          patient,
          encounterId,
          signatureIds: [...signatureIds],
          beforeCounts,
          afterSignCounts,
          signatureRows,
          amendmentRows
        },
        context: {
          canonicalId: amendmentAnchorPatientId,
          suite: "workflow-encounter-amendment-history",
          workflow: "encounter-amendment-history-signed"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient.pid);
        await expectRenderedText(page, patient.lname);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-190-encounter-amendment-history-legacy-surface",
          description: "Captures the Slice 190 legacy application-surface evidence that the temporary encounter remains reachable from the patient summary while database amendment history carries the parity assertion.",
          expected: {
            renderedPatientLastName: patient.lname,
            page: "patient summary",
            amendmentHistory: {
              total: 2,
              amendments: [lockedAmendment, intakeAmendment]
            }
          },
          actual: {
            patient,
            encounterId,
            signatureIds: [...signatureIds],
            signatureRows,
            amendmentRows,
            legacySurface: {
              page: "patient summary",
              renderedPatientLastName: patient.lname
            }
          },
          context: {
            canonicalId: amendmentAnchorPatientId,
            suite: "workflow-encounter-amendment-history",
            workflow: "encounter-amendment-history-legacy-surface"
          }
        });
      } else {
        const apiDetail = await getModernizedEncounterDetail(page, target.apiBaseUrl, encounterId);
        expect(apiDetail.signatures).toHaveLength(3);
        expect(apiDetail.amendmentHistory).toHaveLength(2);
        expect(apiDetail.amendmentHistory.map((item) => item.amendment)).toEqual([
          lockedAmendment,
          intakeAmendment
        ]);
        expect(apiDetail.amendmentHistory.map((item) => item.isLock)).toEqual([true, false]);

        await openAuthenticatedModernizedEncounters(page, target, patient!.pubpid, amendmentEncounterDate);

        const encounterButton = page.getByRole("button", { name: new RegExp(escapeRegex(reason), "i") }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const amendmentPanel = page.getByRole("region", { name: "Encounter amendment history" });
        await expect(amendmentPanel).toContainText("2 amendments");
        await expect(amendmentPanel).toContainText("Locked");
        const amendmentCards = amendmentPanel.locator(".encounter-amendment-card");
        await expect(amendmentCards).toHaveCount(2);
        await expect(amendmentCards.nth(0)).toContainText("Locked amendment");
        await expect(amendmentCards.nth(0)).toContainText("gold-provider-02");
        await expect(amendmentCards.nth(0)).toContainText(lockedAmendment);
        await expect(amendmentCards.nth(1)).toContainText("Signed amendment");
        await expect(amendmentCards.nth(1)).toContainText("admin");
        await expect(amendmentCards.nth(1)).toContainText(intakeAmendment);
        await expect(amendmentPanel).not.toContainText("13:10");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-190-encounter-amendment-history-modernized-surface",
          description: "Captures the Slice 190 modernized API and UI amendment-history surface, including the two rendered amendment cards and the blank-note exclusion.",
          expected: {
            api: {
              signatures: 3,
              amendmentHistory: {
                total: 2,
                amendments: [lockedAmendment, intakeAmendment],
                isLock: [true, false]
              }
            },
            ui: {
              region: "Encounter amendment history",
              badge: "2 amendments",
              cards: [
                { label: "Locked amendment", signerUsername: "gold-provider-02", amendment: lockedAmendment },
                { label: "Signed amendment", signerUsername: "admin", amendment: intakeAmendment }
              ],
              excludedBlankTimestamp: "13:10"
            }
          },
          actual: {
            patient,
            encounterId,
            signatureIds: [...signatureIds],
            signatureRows,
            amendmentRows,
            apiDetail,
            modernizedSurface: {
              fromDate: amendmentEncounterDate,
              selectedEncounterLabel: reason,
              region: "Encounter amendment history",
              renderedCardCount: 2
            }
          },
          context: {
            canonicalId: amendmentAnchorPatientId,
            suite: "workflow-encounter-amendment-history",
            workflow: "encounter-amendment-history-modernized-surface"
          }
        });
      }

      while (signatureIds.length > 0) {
        const signatureId = signatureIds.pop()!;
        deletedSignatureIds.push(signatureId);
        await workflow.deleteEncounterSignature(signatureId);
        await expect(workflow.getEncounterSignature(signatureId)).resolves.toBeNull();
      }

      const afterSignatureDeleteCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterSignatureDeleteCounts.encounterSignatures).toBe(beforeCounts.encounterSignatures);
      expect(await queryAmendmentHistory(target.type, targetDb as QueryableDb, encounterId)).toEqual([]);
      const signatureRowsAfterDelete = await querySignaturesForEncounter(target.type, targetDb as QueryableDb, encounterId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-190-encounter-amendment-history-signatures-deleted",
        description: "Captures the Slice 190 state after deleting the three temporary signature rows while the temporary encounter still exists.",
        expected: {
          counts: {
            encounters: beforeCounts.encounters + 1,
            encounterSignatures: beforeCounts.encounterSignatures
          },
          amendmentRowsAfterDelete: [],
          signatureRowsAfterDelete: []
        },
        actual: {
          patient,
          encounterId,
          deletedSignatureIds: [...deletedSignatureIds],
          afterSignatureDeleteCounts,
          amendmentRowsAfterDelete: [],
          signatureRowsAfterDelete
        },
        context: {
          canonicalId: amendmentAnchorPatientId,
          suite: "workflow-encounter-amendment-history",
          workflow: "encounter-amendment-history-signatures-deleted"
        }
      });
    } finally {
      while (signatureIds.length > 0) {
        const signatureId = signatureIds.pop()!;
        deletedSignatureIds.push(signatureId);
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
    const finalAmendmentRows = encounterId !== null
      ? await queryAmendmentHistory(target.type, targetDb as QueryableDb, encounterId)
      : [];
    const finalSignatureRows = encounterId !== null
      ? await querySignaturesForEncounter(target.type, targetDb as QueryableDb, encounterId)
      : [];
    if (encounterId !== null) {
      expect(deletedEncounter).toBeNull();
      expect(finalAmendmentRows).toEqual([]);
    }
    expect(finalSignatureRows).toEqual([]);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-190-encounter-amendment-history-cleanup",
      description: "Captures the final Slice 190 cleanup state after deleting all temporary signatures and the temporary encounter.",
      expected: {
        counts: {
          encounters: beforeCounts.encounters,
          encounterSignatures: beforeCounts.encounterSignatures
        },
        deletedEncounter: encounterId === null ? null : { id: encounterId, row: null },
        finalAmendmentRows: [],
        finalSignatureRows: []
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        encounterId,
        deletedSignatureIds: [...deletedSignatureIds],
        deletedEncounter,
        finalAmendmentRows,
        finalSignatureRows
      },
      context: {
        canonicalId: amendmentAnchorPatientId,
        suite: "workflow-encounter-amendment-history",
        workflow: "encounter-amendment-history-cleanup"
      }
    });
  });
});

async function getModernizedEncounterDetail(page: { request: { post: Function; get: Function } }, apiBaseUrl: string, encounterId: number) {
  const loginResponse = await page.request.post(`${apiBaseUrl}/api/auth/login`, {
    data: {
      username: "admin",
      password: "pass"
    }
  });
  expect(loginResponse.ok()).toBe(true);
  const login = (await loginResponse.json()) as { sessionId?: string };
  expect(login.sessionId).toBeTruthy();

  const detailResponse = await page.request.get(`${apiBaseUrl}/api/encounters/${encodeURIComponent(String(encounterId))}`, {
    headers: {
      "X-OpenEMR-Session": login.sessionId!
    }
  });
  expect(detailResponse.ok()).toBe(true);
  return (await detailResponse.json()) as ModernizedEncounterDetail;
}

async function queryAmendmentHistory(targetType: string, db: QueryableDb, encounterId: number) {
  if (targetType === "legacy-openemr") {
    return db.queryRows<AmendmentHistoryRow>(`
SELECT es.id AS signatureId, es.tid AS encounterId, u.username AS signerUsername,
  DATE_FORMAT(es.datetime, '%Y-%m-%d %H:%i') AS signedAt,
  CAST(es.is_lock AS CHAR) AS isLock,
  COALESCE(es.amendment, '') AS amendment,
  es.hash,
  es.signature_hash AS signatureHash
FROM esign_signatures es
INNER JOIN users u ON u.id = es.uid
WHERE es.tid = ${integer(encounterId)}
  AND es.\`table\` = 'form_encounter'
  AND COALESCE(es.amendment, '') <> ''
ORDER BY es.datetime DESC, es.id DESC;
`);
  }

  return db.queryRows<AmendmentHistoryRow>(`
SELECT id AS "signatureId", encounter AS "encounterId", signer_username AS "signerUsername",
  to_char(signed_at, 'YYYY-MM-DD HH24:MI') AS "signedAt",
  CASE WHEN is_lock THEN '1' ELSE '0' END AS "isLock",
  COALESCE(amendment, '') AS amendment,
  hash,
  signature_hash AS "signatureHash"
FROM encounter_signatures
WHERE encounter = ${integer(encounterId)}
  AND COALESCE(amendment, '') <> ''
ORDER BY signed_at DESC, id DESC;
`);
}

async function querySignaturesForEncounter(targetType: string, db: QueryableDb, encounterId: number) {
  if (targetType === "legacy-openemr") {
    return db.queryRows<AmendmentHistoryRow>(`
SELECT es.id AS signatureId, es.tid AS encounterId, u.username AS signerUsername,
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

  return db.queryRows<AmendmentHistoryRow>(`
SELECT id AS "signatureId", encounter AS "encounterId", signer_username AS "signerUsername",
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
  return `AH${timestamp}${random}`.toUpperCase();
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
