import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openEncounterDirect,
  openFeeSheetDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterFeeSheetAnchorPatientId = "MOD-PAT-0001";
const encounterFeeSheetAnchorFromDate = "2026-01-01";
const encounterFeeSheetCptCode = "99499";
const encounterFeeSheetCptFee = "42.00";
const encounterFeeSheetCptJustify = "E78.5";
const encounterFeeSheetDiagnosisCode = "R73.03";

test.describe("encounter fee sheet entry parity @slice74 @workflow-encounter-fee-sheet @mutation", () => {
  test("adds CPT and ICD10 fee-sheet rows from the encounter workflow and cleans up", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterFeeSheetAnchorPatientId);
    expect(patient).not.toBeNull();
    if (patient === null) {
      throw new Error(`Encounter fee-sheet entry anchor patient ${encounterFeeSheetAnchorPatientId} was not found.`);
    }

    const encounter = await targetDb.getLatestEncounterForPatient(patient.pid);
    expect(encounter).not.toBeNull();
    if (encounter === null) {
      throw new Error(`Encounter fee-sheet entry anchor encounter for ${encounterFeeSheetAnchorPatientId} was not found.`);
    }
    expect(encounter.encounter).toBe(1000013);

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeLines = await targetDb.getBillingLinesForEncounter(patient.pid, encounter.encounter);
    const suffix = workflowSuffix();
    const cptText = `Parity Encounter Fee Sheet CPT ${suffix}`;
    const diagnosisText = `Parity Encounter Fee Sheet Diagnosis ${suffix}`;
    const cptLineInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      encounter: encounter.encounter,
      dateTime: "2026-06-18 12:05:00",
      codeType: "CPT4",
      code: encounterFeeSheetCptCode,
      codeText: cptText,
      fee: encounterFeeSheetCptFee,
      units: 1,
      justify: encounterFeeSheetCptJustify
    };
    const diagnosisLineInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      encounter: encounter.encounter,
      dateTime: "2026-06-18 12:06:00",
      codeType: "ICD10",
      code: encounterFeeSheetDiagnosisCode,
      codeText: diagnosisText,
      fee: "0.00",
      units: 1,
      justify: encounterFeeSheetDiagnosisCode
    };
    const billingLineIds: Array<number | string> = [];

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-74-encounter-fee-sheet-entry-precondition",
      description: "Captures the Slice 74 encounter fee-sheet entry precondition: anchor patient, encounter, baseline active billing rows/counts, and proposed CPT plus ICD10 fee-sheet rows.",
      expected: {
        anchorCanonicalId: encounterFeeSheetAnchorPatientId,
        encounter: 1000013,
        create: {
          cpt: {
            codeType: "CPT4",
            code: encounterFeeSheetCptCode,
            fee: encounterFeeSheetCptFee,
            units: 1,
            activity: 1,
            billed: 0,
            justify: encounterFeeSheetCptJustify
          },
          diagnosis: {
            codeType: "ICD10",
            code: encounterFeeSheetDiagnosisCode,
            fee: "0.00",
            units: 1,
            activity: 1,
            billed: 0,
            justify: encounterFeeSheetDiagnosisCode
          }
        },
        countChange: {
          encountersAfterCreate: beforeCounts.encounters,
          billingLineItemsAfterCreate: beforeCounts.billingLineItems + 2,
          encounterBillingLinesAfterCreate: beforeLines.length + 2,
          encounterBillingLinesAfterInactive: beforeLines.length,
          billingLineItemsAfterCleanup: beforeCounts.billingLineItems
        }
      },
      actual: {
        patient,
        encounter,
        beforeCounts,
        beforeLines,
        proposedBillingLines: {
          cpt: cptLineInput,
          diagnosis: diagnosisLineInput
        }
      },
      context: {
        canonicalId: encounterFeeSheetAnchorPatientId,
        suite: "workflow-encounter-fee-sheet",
        workflow: "encounter-fee-sheet-entry-precondition"
      }
    });

    try {
      if (target.type === "legacy-openemr") {
        const cptLineId = await workflow.createBillingLine(cptLineInput);
        billingLineIds.push(cptLineId);

        const diagnosisLineId = await workflow.createBillingLine(diagnosisLineInput);
        billingLineIds.push(diagnosisLineId);

        await loginToLegacyOpenEmr(page, target);
        await openEncounterDirect(page, target, patient.pid, encounter.encounter);
        await openFeeSheetDirect(page, target, patient.pid, encounter.encounter);
        await expectRenderedText(page, "Selected Fee Sheet Codes and Charges");
        await expectRenderedText(page, encounterFeeSheetCptCode);
        await expectRenderedText(page, cptText);
        await expectRenderedText(page, encounterFeeSheetDiagnosisCode);
        await expectRenderedText(page, diagnosisText);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-74-encounter-fee-sheet-entry-surface",
          description: "Captures the Slice 74 legacy application-surface evidence for the temporary CPT and ICD10 fee-sheet rows after they render on the Fee Sheet.",
          expected: {
            renderedPage: "Selected Fee Sheet Codes and Charges",
            renderedCodes: [encounterFeeSheetCptCode, encounterFeeSheetDiagnosisCode],
            renderedTexts: [cptText, diagnosisText]
          },
          actual: {
            patient,
            encounter,
            billingLineIds: [...billingLineIds],
            proposedBillingLines: {
              cpt: cptLineInput,
              diagnosis: diagnosisLineInput
            },
            legacySurface: {
              encounterPage: "patient encounter",
              feeSheetPage: "fee sheet",
              renderedCptCode: encounterFeeSheetCptCode,
              renderedCptText: cptText,
              renderedDiagnosisCode: encounterFeeSheetDiagnosisCode,
              renderedDiagnosisText: diagnosisText
            }
          },
          context: {
            canonicalId: encounterFeeSheetAnchorPatientId,
            suite: "workflow-encounter-fee-sheet",
            workflow: "encounter-fee-sheet-entry-surface"
          }
        });
      } else {
        await openAuthenticatedModernizedEncounters(page, target, patient.pubpid, encounterFeeSheetAnchorFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const feeSheetEntry = page.getByLabel("Encounter fee sheet entry");
        await expect(feeSheetEntry).toBeVisible();

        await page.getByLabel("Encounter fee sheet code type").selectOption("CPT4");
        await page.getByLabel("Encounter fee sheet date").fill("2026-06-18");
        await page.getByLabel("Encounter fee sheet code", { exact: true }).fill(encounterFeeSheetCptCode);
        await page.getByLabel("Encounter fee sheet modifier").fill("25");
        await page.getByLabel("Encounter fee sheet description").fill(cptText);
        await page.getByLabel("Encounter fee sheet fee").fill(encounterFeeSheetCptFee);
        await page.getByLabel("Encounter fee sheet units").fill("1");
        await page.getByLabel("Encounter fee sheet justification").fill(encounterFeeSheetCptJustify);
        await page.getByRole("button", { name: /Add Line/i }).click();

        const billingLinkage = page.getByLabel("Encounter billing linkage");
        await expect(billingLinkage).toContainText(cptText);
        await expect(billingLinkage).toContainText(encounterFeeSheetCptCode);
        await expect(billingLinkage).toContainText("$42.00");
        await expect(billingLinkage).toContainText(`Justification ${encounterFeeSheetCptJustify}`);

        await page.getByLabel("Encounter fee sheet code type").selectOption("ICD10");
        await page.getByLabel("Encounter fee sheet date").fill("2026-06-18");
        await page.getByLabel("Encounter fee sheet code", { exact: true }).fill(encounterFeeSheetDiagnosisCode);
        await page.getByLabel("Encounter fee sheet description").fill(diagnosisText);
        await page.getByLabel("Encounter fee sheet fee").fill("0.00");
        await page.getByLabel("Encounter fee sheet units").fill("1");
        await page.getByLabel("Encounter fee sheet justification").fill(encounterFeeSheetDiagnosisCode);
        await page.getByRole("button", { name: /Add Line/i }).click();

        await expect(billingLinkage).toContainText(diagnosisText);
        await expect(billingLinkage).toContainText(encounterFeeSheetDiagnosisCode);

        const diagnosisLinkage = page.getByLabel("Encounter diagnosis coding linkage");
        await expect(diagnosisLinkage).toContainText(encounterFeeSheetDiagnosisCode);
        await expect(diagnosisLinkage).toContainText(diagnosisText);
        await expect(diagnosisLinkage).toContainText("Fee sheet diagnosis line");
        await expect(diagnosisLinkage).toContainText("Fee sheet justification");
        await expect(diagnosisLinkage).toContainText(`CPT4 ${encounterFeeSheetCptCode}`);
        const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounter.encounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
        expect(detailResponse.ok()).toBe(true);
        const detailPayload = await detailResponse.json();
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-74-encounter-fee-sheet-entry-surface",
          description: "Captures the Slice 74 modernized application-surface evidence for the temporary CPT and ICD10 fee-sheet rows through encounter detail API and Encounters workspace panels.",
          expected: {
            api: {
              billingLineCount: beforeLines.length + 2,
              cptCode: encounterFeeSheetCptCode,
              diagnosisCode: encounterFeeSheetDiagnosisCode,
              supportingBillingCode: `CPT4 ${encounterFeeSheetCptCode}`
            },
            ui: {
              feeSheetEntryPanel: "Encounter fee sheet entry",
              billingPanel: "Encounter billing linkage",
              diagnosisPanel: "Encounter diagnosis coding linkage",
              renderedTexts: [cptText, diagnosisText]
            }
          },
          actual: {
            patient,
            encounter,
            apiBillingLines: detailPayload.billingLines,
            apiDiagnosisCodes: detailPayload.diagnosisCodes,
            modernizedSurface: {
              fromDate: encounterFeeSheetAnchorFromDate,
              selectedEncounterLabel: "Hyperlipidemia",
              feeSheetEntryPanel: "Encounter fee sheet entry",
              billingPanel: "Encounter billing linkage",
              diagnosisPanel: "Encounter diagnosis coding linkage"
            }
          },
          context: {
            canonicalId: encounterFeeSheetAnchorPatientId,
            suite: "workflow-encounter-fee-sheet",
            workflow: "encounter-fee-sheet-entry-surface"
          }
        });
      }

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters);
      expect(afterCreateCounts.billingLineItems).toBe(beforeCounts.billingLineItems + 2);

      const afterCreateLines = await targetDb.getBillingLinesForEncounter(patient.pid, encounter.encounter);
      const cptLine = afterCreateLines.find((line) => line.codeText === cptText);
      const diagnosisLine = afterCreateLines.find((line) => line.codeText === diagnosisText);
      expect(cptLine).toMatchObject({
        codeType: "CPT4",
        code: encounterFeeSheetCptCode,
        codeText: cptText,
        justify: encounterFeeSheetCptJustify
      });
      expect(diagnosisLine).toMatchObject({
        codeType: "ICD10",
        code: encounterFeeSheetDiagnosisCode,
        codeText: diagnosisText,
        justify: encounterFeeSheetDiagnosisCode
      });

      for (const line of [cptLine, diagnosisLine]) {
        if (line && !billingLineIds.map(String).includes(String(line.id))) {
          billingLineIds.push(line.id);
        }
      }

      expect(billingLineIds).toHaveLength(2);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-74-encounter-fee-sheet-entry-created",
        description: "Captures the temporary Slice 74 CPT and ICD10 fee-sheet rows, encounter billing projection, and billing-line count increment immediately after create.",
        expected: {
          billingLines: {
            cpt: {
              codeType: "CPT4",
              code: encounterFeeSheetCptCode,
              codeText: cptText,
              fee: encounterFeeSheetCptFee,
              justify: encounterFeeSheetCptJustify
            },
            diagnosis: {
              codeType: "ICD10",
              code: encounterFeeSheetDiagnosisCode,
              codeText: diagnosisText,
              fee: "0.00",
              justify: encounterFeeSheetDiagnosisCode
            }
          },
          counts: {
            encounters: beforeCounts.encounters,
            billingLineItems: beforeCounts.billingLineItems + 2,
            encounterBillingLines: beforeLines.length + 2
          }
        },
        actual: {
          patient,
          encounter,
          beforeCounts,
          afterCreateCounts,
          beforeLines,
          afterCreateLines,
          billingLineIds: [...billingLineIds],
          cptLine,
          diagnosisLine
        },
        context: {
          canonicalId: encounterFeeSheetAnchorPatientId,
          suite: "workflow-encounter-fee-sheet",
          workflow: "encounter-fee-sheet-entry-created"
        }
      });

      const inactiveBillingLines: Array<unknown> = [];
      for (const billingLineId of billingLineIds) {
        await workflow.updateBillingLineStatus(billingLineId, 1, 0);
        const inactive = await workflow.getBillingLine(billingLineId);
        inactiveBillingLines.push(inactive);
        expect(inactive).toMatchObject({
          billed: 1,
          activity: 0
        });
      }

      const inactiveLines = await targetDb.getBillingLinesForEncounter(patient.pid, encounter.encounter);
      expect(inactiveLines).toHaveLength(beforeLines.length);
      expect(inactiveLines.map((line) => line.id)).not.toEqual(expect.arrayContaining(billingLineIds.map(String)));
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-74-encounter-fee-sheet-entry-inactive",
        description: "Captures the temporary Slice 74 CPT and ICD10 fee-sheet rows after they are marked billed/inactive and removed from active encounter billing projections.",
        expected: {
          billingLineIds: billingLineIds.map(String),
          billed: 1,
          activity: 0,
          encounterProjection: {
            activeLineCount: beforeLines.length
          }
        },
        actual: {
          patient,
          encounter,
          billingLineIds: [...billingLineIds],
          inactiveBillingLines,
          inactiveLines
        },
        context: {
          canonicalId: encounterFeeSheetAnchorPatientId,
          suite: "workflow-encounter-fee-sheet",
          workflow: "encounter-fee-sheet-entry-inactive"
        }
      });

      if (target.type === "modernized-openemr") {
        const inactiveDetailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounter.encounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
        expect(inactiveDetailResponse.ok()).toBe(true);
        const inactiveDetail = await inactiveDetailResponse.json();
        expect(inactiveDetail.billingLineCount).toBe(beforeLines.length);
        expect(inactiveDetail.billingLines.map((line: { id: string }) => line.id)).not.toEqual(
          expect.arrayContaining(billingLineIds.map(String))
        );
        expect(inactiveDetail.diagnosisCodes.map((item: { code: string }) => item.code)).not.toContain(
          encounterFeeSheetDiagnosisCode
        );
      }
    } finally {
      for (const billingLineId of billingLineIds) {
        await workflow.deleteBillingLine(billingLineId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.billingLineItems).toBe(beforeCounts.billingLineItems);
    const deletedBillingLines: Array<{ id: number | string; row: unknown }> = [];
    for (const billingLineId of billingLineIds) {
      const deleted = await workflow.getBillingLine(billingLineId);
      deletedBillingLines.push({ id: billingLineId, row: deleted });
      expect(deleted).toBeNull();
    }
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-74-encounter-fee-sheet-entry-cleanup",
      description: "Captures the final Slice 74 hard-delete cleanup state for the temporary CPT and ICD10 encounter fee-sheet rows.",
      expected: {
        counts: {
          encounters: beforeCounts.encounters,
          billingLineItems: beforeCounts.billingLineItems
        },
        deletedBillingLines: billingLineIds.map((id) => ({ id, row: null }))
      },
      actual: {
        patient,
        encounter,
        beforeCounts,
        afterCleanupCounts,
        billingLineIds: [...billingLineIds],
        deletedBillingLines
      },
      context: {
        canonicalId: encounterFeeSheetAnchorPatientId,
        suite: "workflow-encounter-fee-sheet",
        workflow: "encounter-fee-sheet-entry-cleanup"
      }
    });
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
