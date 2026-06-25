import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openEncounterDirect,
  openFeeSheetDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterDiagnosisMutationAnchorPatientId = "MOD-PAT-0001";
const encounterDiagnosisMutationAnchorFromDate = "2026-01-01";
const encounterDiagnosisMutationCode = "R73.03";
const encounterDiagnosisMutationTextPrefix = "Parity Encounter Diagnosis";
const encounterDiagnosisMutationJustify = "R73.03";

test.describe("encounter diagnosis coding mutation parity @slice73 @workflow-encounter-diagnoses @mutation", () => {
  test("created ICD10 billing diagnoses appear through encounter diagnosis coding and clean up", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterDiagnosisMutationAnchorPatientId);
    expect(patient).not.toBeNull();
    if (patient === null) {
      throw new Error(`Encounter diagnosis mutation anchor patient ${encounterDiagnosisMutationAnchorPatientId} was not found.`);
    }

    const encounter = await targetDb.getLatestEncounterForPatient(patient.pid);
    expect(encounter).not.toBeNull();
    if (encounter === null) {
      throw new Error(`Encounter diagnosis mutation anchor encounter for ${encounterDiagnosisMutationAnchorPatientId} was not found.`);
    }
    expect(encounter.encounter).toBe(1000013);

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeLines = await targetDb.getBillingLinesForEncounter(patient.pid, encounter.encounter);
    const codeText = `${encounterDiagnosisMutationTextPrefix} ${workflowSuffix()}`;
    const billingLineInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      encounter: encounter.encounter,
      dateTime: "2026-06-18 11:45:00",
      codeType: "ICD10",
      code: encounterDiagnosisMutationCode,
      codeText,
      fee: "0.00",
      units: 1,
      justify: encounterDiagnosisMutationJustify
    };
    let billingLineId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-73-encounter-diagnosis-mutation-precondition",
      description: "Captures the Slice 73 encounter diagnosis mutation precondition: anchor patient, encounter, baseline billing lines/counts, and proposed encounter-linked ICD10 diagnosis payload.",
      expected: {
        anchorCanonicalId: encounterDiagnosisMutationAnchorPatientId,
        encounter: 1000013,
        create: {
          codeType: "ICD10",
          code: encounterDiagnosisMutationCode,
          fee: "0.00",
          units: 1,
          activity: 1,
          billed: 0,
          justify: encounterDiagnosisMutationJustify
        },
        countChange: {
          encountersAfterCreate: beforeCounts.encounters,
          billingLineItemsAfterCreate: beforeCounts.billingLineItems + 1,
          encounterBillingLinesAfterCreate: beforeLines.length + 1,
          encounterBillingLinesAfterInactive: beforeLines.length,
          billingLineItemsAfterCleanup: beforeCounts.billingLineItems
        }
      },
      actual: {
        patient,
        encounter,
        beforeCounts,
        beforeLines,
        proposedBillingLine: billingLineInput
      },
      context: {
        canonicalId: encounterDiagnosisMutationAnchorPatientId,
        suite: "workflow-encounter-diagnoses",
        workflow: "encounter-diagnosis-mutation-precondition"
      }
    });

    try {
      billingLineId = await workflow.createBillingLine(billingLineInput);

      const created = await workflow.getBillingLine(billingLineId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        encounter: encounter.encounter,
        codeType: "ICD10",
        code: encounterDiagnosisMutationCode,
        codeText,
        fee: "0.00",
        justify: encounterDiagnosisMutationJustify,
        units: 1,
        activity: 1,
        billed: 0
      });

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters);
      expect(afterCreateCounts.billingLineItems).toBe(beforeCounts.billingLineItems + 1);

      const afterCreateLines = await targetDb.getBillingLinesForEncounter(patient.pid, encounter.encounter);
      expect(afterCreateLines).toHaveLength(beforeLines.length + 1);
      expect(afterCreateLines).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: String(billingLineId),
            codeType: "ICD10",
            code: encounterDiagnosisMutationCode,
            codeText,
            fee: expect.stringMatching(/^0(\.00)?$/),
            justify: encounterDiagnosisMutationJustify
          })
        ])
      );
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-73-encounter-diagnosis-mutation-created",
        description: "Captures the temporary Slice 73 encounter-linked ICD10 diagnosis row, encounter billing projection, and billing-line count increment immediately after create.",
        expected: {
          billingLine: {
            patientId: patient.pid,
            encounter: encounter.encounter,
            codeType: "ICD10",
            code: encounterDiagnosisMutationCode,
            codeText,
            fee: "0.00",
            units: 1,
            activity: 1,
            billed: 0,
            justify: encounterDiagnosisMutationJustify
          },
          encounterProjection: {
            includesCodeType: "ICD10",
            includesCode: encounterDiagnosisMutationCode,
            includesJustify: encounterDiagnosisMutationJustify
          },
          counts: {
            encounters: beforeCounts.encounters,
            billingLineItems: beforeCounts.billingLineItems + 1,
            encounterBillingLines: beforeLines.length + 1
          }
        },
        actual: {
          patient,
          encounter,
          beforeCounts,
          afterCreateCounts,
          beforeLines,
          afterCreateLines,
          billingLineId,
          created
        },
        context: {
          canonicalId: encounterDiagnosisMutationAnchorPatientId,
          suite: "workflow-encounter-diagnoses",
          workflow: "encounter-diagnosis-mutation-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openEncounterDirect(page, target, patient.pid, encounter.encounter);
        await openFeeSheetDirect(page, target, patient.pid, encounter.encounter);
        await expectRenderedText(page, "Selected Fee Sheet Codes and Charges");
        await expectRenderedText(page, encounterDiagnosisMutationCode);
        await expectRenderedText(page, codeText);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-73-encounter-diagnosis-mutation-surface",
          description: "Captures the Slice 73 legacy application-surface evidence for the temporary encounter-linked ICD10 diagnosis row after it renders on the Fee Sheet.",
          expected: {
            renderedPage: "Selected Fee Sheet Codes and Charges",
            renderedCode: encounterDiagnosisMutationCode,
            renderedCodeText: codeText
          },
          actual: {
            patient,
            encounter,
            billingLineId,
            created,
            afterCreateLines,
            legacySurface: {
              encounterPage: "patient encounter",
              feeSheetPage: "fee sheet",
              renderedCode: encounterDiagnosisMutationCode,
              renderedCodeText: codeText
            }
          },
          context: {
            canonicalId: encounterDiagnosisMutationAnchorPatientId,
            suite: "workflow-encounter-diagnoses",
            workflow: "encounter-diagnosis-mutation-surface"
          }
        });
      } else {
        const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounter.encounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
        expect(detailResponse.ok()).toBe(true);
        const detailPayload = await detailResponse.json();
        const diagnosis = detailPayload.diagnosisCodes.find(
          (item: { code: string }) => item.code === encounterDiagnosisMutationCode
        );
        expect(diagnosis).toMatchObject({
          code: encounterDiagnosisMutationCode,
          description: codeText,
          billingLineCount: 2,
          procedureOrderCount: 0
        });
        expect(diagnosis.sources).toEqual(
          expect.arrayContaining(["Fee sheet diagnosis line", "Fee sheet justification"])
        );
        expect(diagnosis.supportingBillingCodes).toEqual(
          expect.arrayContaining([`ICD10 ${encounterDiagnosisMutationCode}`])
        );

        await openAuthenticatedModernizedEncounters(page, target, patient.pubpid, encounterDiagnosisMutationAnchorFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const diagnosisLinkage = page.getByLabel("Encounter diagnosis coding linkage");
        await expect(diagnosisLinkage).toBeVisible();
        await expect(diagnosisLinkage).toContainText(encounterDiagnosisMutationCode);
        await expect(diagnosisLinkage).toContainText(codeText);
        await expect(diagnosisLinkage).toContainText("Fee sheet diagnosis line");
        await expect(diagnosisLinkage).toContainText("Fee sheet justification");
        await expect(diagnosisLinkage).toContainText(`ICD10 ${encounterDiagnosisMutationCode}`);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-73-encounter-diagnosis-mutation-surface",
          description: "Captures the Slice 73 modernized application-surface evidence for the temporary ICD10 diagnosis row through encounter detail API and Encounters workspace diagnosis-coding panel.",
          expected: {
            api: {
              code: encounterDiagnosisMutationCode,
              description: codeText,
              billingLineCount: 2,
              procedureOrderCount: 0,
              sources: ["Fee sheet diagnosis line", "Fee sheet justification"],
              supportingBillingCode: `ICD10 ${encounterDiagnosisMutationCode}`
            },
            ui: {
              diagnosisPanel: "Encounter diagnosis coding linkage",
              renderedCode: encounterDiagnosisMutationCode,
              renderedCodeText: codeText,
              renderedSources: ["Fee sheet diagnosis line", "Fee sheet justification"]
            }
          },
          actual: {
            patient,
            encounter,
            billingLineId,
            created,
            afterCreateLines,
            apiDiagnosisCodes: detailPayload.diagnosisCodes,
            selectedDiagnosis: diagnosis,
            modernizedSurface: {
              fromDate: encounterDiagnosisMutationAnchorFromDate,
              selectedEncounterLabel: "Hyperlipidemia",
              diagnosisPanel: "Encounter diagnosis coding linkage"
            }
          },
          context: {
            canonicalId: encounterDiagnosisMutationAnchorPatientId,
            suite: "workflow-encounter-diagnoses",
            workflow: "encounter-diagnosis-mutation-surface"
          }
        });
      }

      await workflow.updateBillingLineStatus(billingLineId, 1, 0);
      const inactive = await workflow.getBillingLine(billingLineId);
      expect(inactive).toMatchObject({
        billed: 1,
        activity: 0
      });

      const inactiveLines = await targetDb.getBillingLinesForEncounter(patient.pid, encounter.encounter);
      expect(inactiveLines.map((line) => line.id)).not.toContain(String(billingLineId));
      expect(inactiveLines).toHaveLength(beforeLines.length);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-73-encounter-diagnosis-mutation-inactive",
        description: "Captures the temporary Slice 73 ICD10 diagnosis row after it is marked billed/inactive and removed from active encounter billing/diagnosis projections.",
        expected: {
          billingLine: {
            codeType: "ICD10",
            code: encounterDiagnosisMutationCode,
            codeText,
            billed: 1,
            activity: 0
          },
          encounterProjection: {
            excludesBillingLineId: String(billingLineId),
            activeLineCount: beforeLines.length
          }
        },
        actual: {
          patient,
          encounter,
          billingLineId,
          created,
          inactive,
          inactiveLines
        },
        context: {
          canonicalId: encounterDiagnosisMutationAnchorPatientId,
          suite: "workflow-encounter-diagnoses",
          workflow: "encounter-diagnosis-mutation-inactive"
        }
      });

      if (target.type === "modernized-openemr") {
        const inactiveDetailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounter.encounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
        expect(inactiveDetailResponse.ok()).toBe(true);
        const inactiveDetail = await inactiveDetailResponse.json();
        expect(inactiveDetail.diagnosisCodes.map((item: { code: string }) => item.code)).not.toContain(
          encounterDiagnosisMutationCode
        );
      }
    } finally {
      if (billingLineId !== null) {
        await workflow.deleteBillingLine(billingLineId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.billingLineItems).toBe(beforeCounts.billingLineItems);
    if (billingLineId !== null) {
      const deleted = await workflow.getBillingLine(billingLineId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-73-encounter-diagnosis-mutation-cleanup",
        description: "Captures the final Slice 73 hard-delete cleanup state for the temporary encounter-linked ICD10 diagnosis billing row.",
        expected: {
          counts: {
            encounters: beforeCounts.encounters,
            billingLineItems: beforeCounts.billingLineItems
          },
          deletedBillingLine: null
        },
        actual: {
          patient,
          encounter,
          beforeCounts,
          afterCleanupCounts,
          billingLineId,
          deleted
        },
        context: {
          canonicalId: encounterDiagnosisMutationAnchorPatientId,
          suite: "workflow-encounter-diagnoses",
          workflow: "encounter-diagnosis-mutation-cleanup"
        }
      });
      expect(deleted).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
