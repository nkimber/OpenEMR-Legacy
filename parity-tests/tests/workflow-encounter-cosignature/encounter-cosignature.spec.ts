import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";

const coSignatureAnchorPatientId = "MOD-PAT-0002";
const coSignatureEncounterDate = "2026-06-18";

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

test.describe("encounter co-signature parity @slice121 @workflow-encounter-cosignature @mutation", () => {
  test("records, renders, orders, deletes, and cleans up multiple encounter signatures", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(coSignatureAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const externalId = compactWorkflowId();
    const reason = `Parity Encounter Co-Signature ${suffix}`;
    const billingNote = `Encounter co-signature parity billing note ${suffix}.`;
    const primaryNote = `Primary encounter attestation ${suffix}.`;
    const coSignerNote = `Co-signature review ${suffix}.`;
    let encounterId: number | null = null;
    const signatureIds: number[] = [];

    try {
      encounterId = await workflow.createEncounter({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        dateTime: `${coSignatureEncounterDate} 11:15:00`,
        reason,
        facilityId: 10,
        facilityName: "OpenEMR Modernization Clinic",
        billingFacilityId: 10,
        sensitivity: "normal",
        referralSource: "Parity suite",
        externalId,
        posCode: 11,
        billingNote
      });

      signatureIds.push(await workflow.signEncounter(encounterId, {
        signerUsername: "admin",
        signedAt: `${coSignatureEncounterDate} 11:20:00`,
        isLock: false,
        amendment: primaryNote
      }));

      signatureIds.push(await workflow.signEncounter(encounterId, {
        signerUsername: "gold-provider-02",
        signedAt: `${coSignatureEncounterDate} 11:25:00`,
        isLock: true,
        amendment: coSignerNote
      }));

      const primarySignature = await workflow.getEncounterSignature(signatureIds[0]);
      const coSignature = await workflow.getEncounterSignature(signatureIds[1]);
      expect(primarySignature).toMatchObject({
        tableName: "form_encounter",
        signerUsername: "admin",
        signedAt: `${coSignatureEncounterDate} 11:20`,
        isLock: false,
        amendment: primaryNote
      });
      expect(coSignature).toMatchObject({
        tableName: "form_encounter",
        signerUsername: "gold-provider-02",
        signedAt: `${coSignatureEncounterDate} 11:25`,
        isLock: true,
        amendment: coSignerNote
      });

      const signatureRows = await querySignaturesForEncounter(target.type, targetDb as QueryableDb, encounterId);
      expect(signatureRows).toHaveLength(2);
      expect(signatureRows.map((signature) => signature.signerUsername)).toEqual(["gold-provider-02", "admin"]);
      expect(signatureRows.map((signature) => signature.amendment)).toEqual([coSignerNote, primaryNote]);
      expect(signatureRows.map((signature) => signature.isLock)).toEqual(["1", "0"]);
      expect(signatureRows.every((signature) => signature.hash.length >= 32)).toBe(true);
      expect(signatureRows.every((signature) => signature.signatureHash.length >= 32)).toBe(true);

      const afterSignCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterSignCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterSignCounts.encounterSignatures).toBe(beforeCounts.encounterSignatures + 2);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, patient!.lname);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Encounters" }).click();
        await expect(page.getByRole("heading", { name: "Encounters" })).toBeVisible();
        await page.getByLabel("Encounter patient ID").fill(patient!.pubpid);
        await page.getByLabel("Encounter from date").fill(coSignatureEncounterDate);

        const encounterButton = page.getByRole("button", { name: new RegExp(escapeRegex(reason), "i") }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const signOffPanel = page.getByRole("region", { name: "Encounter sign-off" });
        await expect(signOffPanel).toContainText("2 signatures");
        const signatureCards = signOffPanel.locator(".encounter-signature-card");
        await expect(signatureCards).toHaveCount(2);
        await expect(signatureCards.nth(0)).toContainText("Locked");
        await expect(signatureCards.nth(0)).toContainText("gold-provider-02");
        await expect(signatureCards.nth(0)).toContainText(coSignerNote);
        await expect(signatureCards.nth(1)).toContainText("Signed");
        await expect(signatureCards.nth(1)).toContainText("admin");
        await expect(signatureCards.nth(1)).toContainText(primaryNote);
      }

      while (signatureIds.length > 0) {
        const signatureId = signatureIds.pop()!;
        await workflow.deleteEncounterSignature(signatureId);
        await expect(workflow.getEncounterSignature(signatureId)).resolves.toBeNull();
      }

      const afterSignatureDeleteCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterSignatureDeleteCounts.encounterSignatures).toBe(beforeCounts.encounterSignatures);
    } finally {
      while (signatureIds.length > 0) {
        await workflow.deleteEncounterSignature(signatureIds.pop()!);
      }
      if (encounterId !== null) {
        await workflow.deleteEncounter(encounterId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.encounterSignatures).toBe(beforeCounts.encounterSignatures);
    if (encounterId !== null) {
      await expect(workflow.getEncounter(encounterId)).resolves.toBeNull();
      await expect(querySignaturesForEncounter(target.type, targetDb as QueryableDb, encounterId)).resolves.toEqual([]);
    }
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
  return `CS${timestamp}${random}`.toUpperCase();
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
