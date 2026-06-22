import { test, expect } from "../../src/fixtures/parityTest.js";
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
  }) => {
    const patient = await targetDb.findPatientByCanonicalId(amendmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const externalId = compactWorkflowId();
    const reason = `Parity Encounter Amendment History ${suffix}`;
    const billingNote = `Encounter amendment history parity billing note ${suffix}.`;
    const intakeAmendment = `Initial signed amendment ${suffix}.`;
    const blankNote = "";
    const lockedAmendment = `Locked follow-up amendment ${suffix}.`;
    let encounterId: number | null = null;
    const signatureIds: number[] = [];

    try {
      encounterId = await workflow.createEncounter({
        patientId: patient!.pid,
        providerId: patient!.providerId,
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
      });

      signatureIds.push(await workflow.signEncounter(encounterId, {
        signerUsername: "admin",
        signedAt: `${amendmentEncounterDate} 13:05:00`,
        isLock: false,
        amendment: intakeAmendment
      }));
      signatureIds.push(await workflow.signEncounter(encounterId, {
        signerUsername: "gold-provider-02",
        signedAt: `${amendmentEncounterDate} 13:10:00`,
        isLock: false,
        amendment: blankNote
      }));
      signatureIds.push(await workflow.signEncounter(encounterId, {
        signerUsername: "gold-provider-02",
        signedAt: `${amendmentEncounterDate} 13:15:00`,
        isLock: true,
        amendment: lockedAmendment
      }));

      const amendmentRows = await queryAmendmentHistory(target.type, targetDb as QueryableDb, encounterId);
      expect(amendmentRows).toHaveLength(2);
      expect(amendmentRows.map((row) => row.amendment)).toEqual([lockedAmendment, intakeAmendment]);
      expect(amendmentRows.map((row) => row.signerUsername)).toEqual(["gold-provider-02", "admin"]);
      expect(amendmentRows.map((row) => row.isLock)).toEqual(["1", "0"]);
      expect(amendmentRows.every((row) => row.hash.length >= 32)).toBe(true);
      expect(amendmentRows.every((row) => row.signatureHash.length >= 32)).toBe(true);

      const afterSignCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterSignCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterSignCounts.encounterSignatures).toBe(beforeCounts.encounterSignatures + 3);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);
        await expectRenderedText(page, patient!.lname);
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
      }

      while (signatureIds.length > 0) {
        const signatureId = signatureIds.pop()!;
        await workflow.deleteEncounterSignature(signatureId);
        await expect(workflow.getEncounterSignature(signatureId)).resolves.toBeNull();
      }

      const afterSignatureDeleteCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterSignatureDeleteCounts.encounterSignatures).toBe(beforeCounts.encounterSignatures);
      expect(await queryAmendmentHistory(target.type, targetDb as QueryableDb, encounterId)).toEqual([]);
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
      await expect(queryAmendmentHistory(target.type, targetDb as QueryableDb, encounterId)).resolves.toEqual([]);
    }
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
