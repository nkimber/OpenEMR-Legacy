import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openEncounterDirect,
  openFeeSheetDirect,
  openProcedureResultsDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterDiagnosisAnchorPatientId = "MOD-PAT-0001";
const encounterDiagnosisAnchorFromDate = "2026-01-01";
const billingAnchorEncounter = 1000013;
const procedureAnchorEncounter = 1000011;
const billingDiagnosisCode = "E78.5";
const legacyBillingDiagnosisVisibleCode = "E78.";
const billingDiagnosisText = "Hyperlipidemia, unspecified";
const procedureDiagnosisCode = "E11.9";
const procedureDiagnosisText = "Type 2 diabetes mellitus without complications";

test.describe("encounter diagnosis coding readiness parity @slice71 @encounter-diagnoses @encounters", () => {
  test("stable encounter anchors expose diagnosis coding facts", async ({ target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDiagnosisAnchorPatientId);
    expect(patient).not.toBeNull();
    if (patient === null) {
      throw new Error(`Encounter diagnosis anchor patient ${encounterDiagnosisAnchorPatientId} was not found.`);
    }

    const encounter = await targetDb.getLatestEncounterForPatient(patient.pid);
    expect(encounter).not.toBeNull();
    if (encounter === null) {
      throw new Error(`Encounter diagnosis billing anchor encounter for ${encounterDiagnosisAnchorPatientId} was not found.`);
    }
    expect(encounter.encounter).toBe(billingAnchorEncounter);
    expect(encounter.reason).toContain(billingDiagnosisText);

    const billingLines = await targetDb.getBillingLinesForEncounter(patient.pid, encounter.encounter);
    expect(billingLines).toHaveLength(2);
    expect(billingLines.map((line) => line.justify)).toEqual([billingDiagnosisCode, billingDiagnosisCode]);
    expect(billingLines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ codeType: "CPT4", code: "99214", codeText: "Established patient office visit" }),
        expect.objectContaining({ codeType: "CPT4", code: "36415", codeText: "Routine venipuncture" })
      ])
    );

    const procedures = await targetDb.getProcedureResultsForEncounter(patient.pid, procedureAnchorEncounter);
    expect(procedures.orders).toHaveLength(1);
    expect(procedures.orders[0]).toMatchObject({
      procedureCode: "83036",
      procedureName: "Hemoglobin A1c",
      diagnosis: procedureDiagnosisCode
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-71-encounter-diagnoses-source",
      description: "Captures the Slice 71 encounter diagnosis source contract: billing encounter diagnosis, fee-sheet justifications, and procedure-order diagnosis anchors.",
      expected: {
        anchorCanonicalId: encounterDiagnosisAnchorPatientId,
        billingEncounter: billingAnchorEncounter,
        procedureEncounter: procedureAnchorEncounter,
        billingDiagnosis: {
          code: billingDiagnosisCode,
          description: billingDiagnosisText,
          billingLineCount: 2,
          supportingBillingCodes: ["CPT4 99214", "CPT4 36415"]
        },
        procedureDiagnosis: {
          code: procedureDiagnosisCode,
          description: procedureDiagnosisText,
          procedureOrderCount: 1,
          procedureCode: "83036",
          procedureName: "Hemoglobin A1c"
        }
      },
      actual: {
        patient,
        billingEncounter: encounter,
        billingLines,
        procedures,
        selectedProcedureOrder: procedures.orders[0]
      },
      context: {
        suite: "encounter-diagnoses",
        workflow: "encounter-diagnosis-source"
      }
    });
  });

  test("encounter diagnosis coding is reachable from the application surface", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDiagnosisAnchorPatientId);
    expect(patient).not.toBeNull();
    if (patient === null) {
      throw new Error(`Encounter diagnosis anchor patient ${encounterDiagnosisAnchorPatientId} was not found.`);
    }

    const billingEncounter = await targetDb.getLatestEncounterForPatient(patient.pid);
    expect(billingEncounter).not.toBeNull();
    if (billingEncounter === null) {
      throw new Error(`Encounter diagnosis billing anchor encounter for ${encounterDiagnosisAnchorPatientId} was not found.`);
    }
    const billingLines = await targetDb.getBillingLinesForEncounter(patient.pid, billingAnchorEncounter);
    const procedures = await targetDb.getProcedureResultsForEncounter(patient.pid, procedureAnchorEncounter);

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);

      await openEncounterDirect(page, target, patient.pid, billingAnchorEncounter);
      await expectRenderedText(page, billingDiagnosisText);

      await openFeeSheetDirect(page, target, patient.pid, billingAnchorEncounter);
      await expectRenderedText(page, "Selected Fee Sheet Codes and Charges");
      await expectRenderedText(page, legacyBillingDiagnosisVisibleCode);
      await expectRenderedText(page, "99214");
      await expectRenderedText(page, "36415");

      await openProcedureResultsDirect(page, target, patient.pid);
      await expectRenderedText(page, "Hemoglobin A1c");
      await expectRenderedText(page, "4548-4");
      await expectRenderedText(page, "5.7");
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-71-encounter-diagnoses-surface",
        description: "Captures the Slice 71 legacy application-surface evidence: encounter reason, Fee Sheet justification code, and Procedure Results A1c anchors render through OpenEMR.",
        expected: {
          anchorCanonicalId: encounterDiagnosisAnchorPatientId,
          billingEncounter: billingAnchorEncounter,
          procedureEncounter: procedureAnchorEncounter,
          renderedDiagnosisText: billingDiagnosisText,
          renderedBillingDiagnosisPrefix: legacyBillingDiagnosisVisibleCode,
          renderedBillingCodes: ["99214", "36415"],
          renderedProcedureAnchors: ["Hemoglobin A1c", "4548-4", "5.7"]
        },
        actual: {
          patient,
          billingEncounter,
          billingLines,
          procedures,
          legacySurface: {
            encounterPage: "patient encounter",
            feeSheetPage: "fee sheet",
            procedurePage: "procedure results",
            renderedDiagnosisText: billingDiagnosisText,
            renderedBillingDiagnosisPrefix: legacyBillingDiagnosisVisibleCode
          }
        },
        context: {
          suite: "encounter-diagnoses",
          workflow: "encounter-diagnosis-surface"
        }
      });
      return;
    }

    const billingDetailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${billingAnchorEncounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
    expect(billingDetailResponse.ok()).toBe(true);
    const billingDetailPayload = await billingDetailResponse.json();
    const billingDiagnosis = billingDetailPayload.diagnosisCodes.find(
      (diagnosis: { code: string }) => diagnosis.code === billingDiagnosisCode
    );
    expect(billingDiagnosis).toMatchObject({
      code: billingDiagnosisCode,
      description: billingDiagnosisText,
      billingLineCount: 2,
      procedureOrderCount: 0
    });
    expect(billingDiagnosis.sources).toEqual(expect.arrayContaining(["Encounter diagnosis", "Fee sheet justification"]));
    expect(billingDiagnosis.supportingBillingCodes).toEqual(expect.arrayContaining(["CPT4 99214", "CPT4 36415"]));

    const procedureDetailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${procedureAnchorEncounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
    expect(procedureDetailResponse.ok()).toBe(true);
    const procedureDetailPayload = await procedureDetailResponse.json();
    const procedureDiagnosis = procedureDetailPayload.diagnosisCodes.find(
      (diagnosis: { code: string }) => diagnosis.code === procedureDiagnosisCode
    );
    expect(procedureDiagnosis).toMatchObject({
      code: procedureDiagnosisCode,
      description: procedureDiagnosisText,
      procedureOrderCount: 1
    });
    expect(procedureDiagnosis.sources).toEqual(expect.arrayContaining(["Encounter diagnosis", "Procedure order diagnosis"]));

    await openAuthenticatedModernizedEncounters(page, target, patient.pubpid, encounterDiagnosisAnchorFromDate);

    const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
    await expect(encounterButton).toBeVisible();
    await encounterButton.click();

    const linkage = page.getByLabel("Encounter diagnosis coding linkage");
    await expect(linkage).toBeVisible();
    await expect(linkage).toContainText("Diagnosis Coding");
    await expect(linkage).toContainText(billingDiagnosisCode);
    await expect(linkage).toContainText(billingDiagnosisText);
    await expect(linkage).toContainText("Encounter diagnosis");
    await expect(linkage).toContainText("Fee sheet justification");
    await expect(linkage).toContainText("CPT4 99214");
    await expect(linkage).toContainText("CPT4 36415");
    await expect(linkage).toContainText("2 billing links");
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-71-encounter-diagnoses-surface",
      description: "Captures the Slice 71 modernized application-surface evidence: encounter detail API diagnosis-code rows and Encounters workspace Diagnosis Coding rendering anchors.",
      expected: {
        anchorCanonicalId: encounterDiagnosisAnchorPatientId,
        billingEncounter: billingAnchorEncounter,
        procedureEncounter: procedureAnchorEncounter,
        billingDiagnosis: {
          code: billingDiagnosisCode,
          description: billingDiagnosisText,
          sources: ["Encounter diagnosis", "Fee sheet justification"],
          supportingBillingCodes: ["CPT4 99214", "CPT4 36415"],
          billingLineCount: 2
        },
        procedureDiagnosis: {
          code: procedureDiagnosisCode,
          description: procedureDiagnosisText,
          sources: ["Encounter diagnosis", "Procedure order diagnosis"],
          procedureOrderCount: 1
        },
        uiPanelLabel: "Encounter diagnosis coding linkage",
        uiHeading: "Diagnosis Coding"
      },
      actual: {
        patient,
        billingEncounter,
        billingLines,
        procedures,
        apiBillingDiagnoses: billingDetailPayload.diagnosisCodes,
        apiProcedureDiagnoses: procedureDetailPayload.diagnosisCodes,
        selectedBillingDiagnosis: billingDiagnosis,
        selectedProcedureDiagnosis: procedureDiagnosis,
        modernizedSurface: {
          fromDate: encounterDiagnosisAnchorFromDate,
          selectedEncounterLabel: "Hyperlipidemia",
          panelLabel: "Encounter diagnosis coding linkage",
          renderedBillingDiagnosisCode: billingDiagnosisCode
        }
      },
      context: {
        suite: "encounter-diagnoses",
        workflow: "encounter-diagnosis-surface"
      }
    });
  });
});
