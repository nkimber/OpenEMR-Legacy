import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openEncounterDirect,
  openFeeSheetDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterBillingMutationAnchorPatientId = "MOD-PAT-0001";
const encounterBillingMutationAnchorFromDate = "2026-01-01";
const encounterBillingMutationCode = "99499";
const encounterBillingMutationFee = "42.00";
const encounterBillingMutationJustify = "E78.5";
const legacyEncounterBillingMutationJustifyVisible = "E78.";

test.describe("encounter billing linkage mutation parity @slice72 @workflow-encounter-billing @mutation", () => {
  test("created billing lines appear through encounter-linked surfaces and clean up", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterBillingMutationAnchorPatientId);
    expect(patient).not.toBeNull();
    if (patient === null) {
      throw new Error(`Encounter billing mutation anchor patient ${encounterBillingMutationAnchorPatientId} was not found.`);
    }

    const encounter = await targetDb.getLatestEncounterForPatient(patient.pid);
    expect(encounter).not.toBeNull();
    if (encounter === null) {
      throw new Error(`Encounter billing mutation anchor encounter for ${encounterBillingMutationAnchorPatientId} was not found.`);
    }
    expect(encounter.encounter).toBe(1000013);

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const beforeLines = await targetDb.getBillingLinesForEncounter(patient.pid, encounter.encounter);
    const codeText = `Parity Encounter Billing ${workflowSuffix()}`;
    const billingLineInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      encounter: encounter.encounter,
      dateTime: "2026-06-18 11:35:00",
      codeType: "CPT4",
      code: encounterBillingMutationCode,
      codeText,
      fee: encounterBillingMutationFee,
      units: 1,
      justify: encounterBillingMutationJustify
    };
    let billingLineId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-72-encounter-billing-mutation-precondition",
      description: "Captures the Slice 72 encounter billing mutation precondition: anchor patient, billing encounter, baseline billing lines/counts, and proposed encounter-linked CPT payload.",
      expected: {
        anchorCanonicalId: encounterBillingMutationAnchorPatientId,
        encounter: 1000013,
        create: {
          codeType: "CPT4",
          code: encounterBillingMutationCode,
          fee: encounterBillingMutationFee,
          units: 1,
          activity: 1,
          billed: 0,
          justify: encounterBillingMutationJustify
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
        canonicalId: encounterBillingMutationAnchorPatientId,
        suite: "workflow-encounter-billing",
        workflow: "encounter-billing-mutation-precondition"
      }
    });

    try {
      billingLineId = await workflow.createBillingLine(billingLineInput);

      const created = await workflow.getBillingLine(billingLineId);
      expect(created).toMatchObject({
        patientId: patient.pid,
        encounter: encounter.encounter,
        codeType: "CPT4",
        code: encounterBillingMutationCode,
        codeText,
        fee: encounterBillingMutationFee,
        justify: encounterBillingMutationJustify,
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
            codeType: "CPT4",
            code: encounterBillingMutationCode,
            codeText,
            fee: expect.stringMatching(/^42\.00(?:0+)?$/),
            justify: encounterBillingMutationJustify
          })
        ])
      );
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-72-encounter-billing-mutation-created",
        description: "Captures the temporary Slice 72 encounter-linked CPT billing row, encounter billing projection, and count increment immediately after create.",
        expected: {
          billingLine: {
            patientId: patient.pid,
            encounter: encounter.encounter,
            codeType: "CPT4",
            code: encounterBillingMutationCode,
            codeText,
            fee: encounterBillingMutationFee,
            units: 1,
            activity: 1,
            billed: 0,
            justify: encounterBillingMutationJustify
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
          canonicalId: encounterBillingMutationAnchorPatientId,
          suite: "workflow-encounter-billing",
          workflow: "encounter-billing-mutation-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openEncounterDirect(page, target, patient.pid, encounter.encounter);
        await openFeeSheetDirect(page, target, patient.pid, encounter.encounter);
        await expectRenderedText(page, "Selected Fee Sheet Codes and Charges");
        await expectRenderedText(page, encounterBillingMutationCode);
        await expectRenderedText(page, codeText);
        await expectRenderedText(page, legacyEncounterBillingMutationJustifyVisible);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-72-encounter-billing-mutation-surface",
          description: "Captures the Slice 72 legacy application-surface evidence for the temporary encounter-linked billing row after it renders on the Fee Sheet.",
          expected: {
            renderedPage: "Selected Fee Sheet Codes and Charges",
            renderedCode: encounterBillingMutationCode,
            renderedCodeText: codeText,
            renderedJustificationPrefix: legacyEncounterBillingMutationJustifyVisible
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
              renderedCode: encounterBillingMutationCode,
              renderedCodeText: codeText,
              renderedJustificationPrefix: legacyEncounterBillingMutationJustifyVisible
            }
          },
          context: {
            canonicalId: encounterBillingMutationAnchorPatientId,
            suite: "workflow-encounter-billing",
            workflow: "encounter-billing-mutation-surface"
          }
        });
      } else {
        const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounter.encounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
        expect(detailResponse.ok()).toBe(true);
        const detailPayload = await detailResponse.json();
        expect(detailPayload.billingLineCount).toBe(beforeLines.length + 1);
        expect(detailPayload.billingLines).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: String(billingLineId),
              code: encounterBillingMutationCode,
              codeText,
              fee: Number(encounterBillingMutationFee),
              justify: encounterBillingMutationJustify
            })
          ])
        );

        const diagnosis = detailPayload.diagnosisCodes.find(
          (item: { code: string }) => item.code === encounterBillingMutationJustify
        );
        expect(diagnosis).toBeTruthy();
        expect(diagnosis.supportingBillingCodes).toEqual(expect.arrayContaining([`CPT4 ${encounterBillingMutationCode}`]));

        await openAuthenticatedModernizedEncounters(page, target, patient.pubpid, encounterBillingMutationAnchorFromDate);

        const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
        await expect(encounterButton).toBeVisible();
        await encounterButton.click();

        const billingLinkage = page.getByLabel("Encounter billing linkage");
        await expect(billingLinkage).toBeVisible();
        await expect(billingLinkage).toContainText(encounterBillingMutationCode);
        await expect(billingLinkage).toContainText(codeText);
        await expect(billingLinkage).toContainText("$42.00");
        await expect(billingLinkage).toContainText(`Justification ${encounterBillingMutationJustify}`);

        const diagnosisLinkage = page.getByLabel("Encounter diagnosis coding linkage");
        await expect(diagnosisLinkage).toContainText(`CPT4 ${encounterBillingMutationCode}`);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-72-encounter-billing-mutation-surface",
          description: "Captures the Slice 72 modernized application-surface evidence for the temporary encounter-linked billing row through encounter detail API and Encounters workspace panels.",
          expected: {
            api: {
              billingLineCount: beforeLines.length + 1,
              code: encounterBillingMutationCode,
              codeText,
              fee: Number(encounterBillingMutationFee),
              justify: encounterBillingMutationJustify,
              supportingBillingCode: `CPT4 ${encounterBillingMutationCode}`
            },
            ui: {
              billingPanel: "Encounter billing linkage",
              diagnosisPanel: "Encounter diagnosis coding linkage",
              renderedFee: "$42.00",
              renderedJustification: `Justification ${encounterBillingMutationJustify}`
            }
          },
          actual: {
            patient,
            encounter,
            billingLineId,
            created,
            afterCreateLines,
            apiBillingLines: detailPayload.billingLines,
            apiDiagnosisCodes: detailPayload.diagnosisCodes,
            selectedDiagnosis: diagnosis,
            modernizedSurface: {
              fromDate: encounterBillingMutationAnchorFromDate,
              selectedEncounterLabel: "Hyperlipidemia",
              billingPanel: "Encounter billing linkage",
              diagnosisPanel: "Encounter diagnosis coding linkage"
            }
          },
          context: {
            canonicalId: encounterBillingMutationAnchorPatientId,
            suite: "workflow-encounter-billing",
            workflow: "encounter-billing-mutation-surface"
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
        probe: "slice-72-encounter-billing-mutation-inactive",
        description: "Captures the temporary Slice 72 encounter-linked CPT billing row after it is marked billed/inactive and removed from active encounter billing projections.",
        expected: {
          billingLine: {
            code: encounterBillingMutationCode,
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
          canonicalId: encounterBillingMutationAnchorPatientId,
          suite: "workflow-encounter-billing",
          workflow: "encounter-billing-mutation-inactive"
        }
      });

      if (target.type === "modernized-openemr") {
        const inactiveDetailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounter.encounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
        expect(inactiveDetailResponse.ok()).toBe(true);
        const inactiveDetail = await inactiveDetailResponse.json();
        expect(inactiveDetail.billingLineCount).toBe(beforeLines.length);
        expect(inactiveDetail.billingLines.map((line: { id: string }) => line.id)).not.toContain(String(billingLineId));
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
        probe: "slice-72-encounter-billing-mutation-cleanup",
        description: "Captures the final Slice 72 hard-delete cleanup state for the temporary encounter-linked CPT billing row.",
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
          canonicalId: encounterBillingMutationAnchorPatientId,
          suite: "workflow-encounter-billing",
          workflow: "encounter-billing-mutation-cleanup"
        }
      });
      expect(deleted).toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
