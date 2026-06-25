import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openEncounterDirect,
  openFeeSheetDirect
} from "../../src/ui/legacyOpenEmr.js";

const encounterBillingAnchorPatientId = "MOD-PAT-0001";
const encounterBillingAnchorFromDate = "2026-01-01";
const officeVisitCode = "99214";
const officeVisitText = "Established patient office visit";
const venipunctureCode = "36415";
const venipunctureText = "Routine venipuncture";

test.describe("encounter billing linkage readiness parity @slice68 @encounter-billing @billing", () => {
  test("stable encounter anchor exposes linked fee-sheet billing facts", async ({ target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterBillingAnchorPatientId);
    expect(patient).not.toBeNull();
    if (patient === null) {
      throw new Error(`Encounter billing anchor patient ${encounterBillingAnchorPatientId} was not found.`);
    }

    const encounter = await targetDb.getLatestEncounterForPatient(patient.pid);
    expect(encounter).not.toBeNull();
    if (encounter === null) {
      throw new Error(`Encounter billing anchor encounter for ${encounterBillingAnchorPatientId} was not found.`);
    }
    expect(encounter.encounter).toBe(1000013);

    const billingLines = await targetDb.getBillingLinesForEncounter(patient.pid, encounter.encounter);
    expect(billingLines).toHaveLength(2);

    const officeVisit = billingLines.find((line) => line.code === officeVisitCode);
    const venipuncture = billingLines.find((line) => line.code === venipunctureCode);

    expect(officeVisit).toMatchObject({
      codeType: "CPT4",
      code: officeVisitCode,
      codeText: officeVisitText,
      justify: "E78.5"
    });
    expect(Number(officeVisit!.fee)).toBe(168);

    expect(venipuncture).toMatchObject({
      codeType: "CPT4",
      code: venipunctureCode,
      codeText: venipunctureText,
      justify: "E78.5"
    });
    expect(Number(venipuncture!.fee)).toBe(18);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-68-encounter-billing-source",
      description: "Captures the Slice 68 encounter billing source contract: anchor patient, encounter 1000013, and the two linked CPT fee-sheet billing rows.",
      expected: {
        anchorCanonicalId: encounterBillingAnchorPatientId,
        encounter: 1000013,
        billingLineCount: 2,
        totalFee: 186,
        requiredCodes: [officeVisitCode, venipunctureCode],
        requiredJustification: "E78.5"
      },
      actual: {
        patient,
        encounter,
        billingLines,
        selectedBillingLines: {
          officeVisit,
          venipuncture
        },
        totalFee: billingLines.reduce((sum, line) => sum + Number(line.fee), 0)
      },
      context: {
        suite: "encounter-billing",
        workflow: "encounter-billing-source"
      }
    });
  });

  test("encounter-linked fee-sheet lines are reachable from the application surface", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterBillingAnchorPatientId);
    expect(patient).not.toBeNull();
    if (patient === null) {
      throw new Error(`Encounter billing anchor patient ${encounterBillingAnchorPatientId} was not found.`);
    }
    const encounter = await targetDb.getLatestEncounterForPatient(patient.pid);
    expect(encounter).not.toBeNull();
    if (encounter === null) {
      throw new Error(`Encounter billing anchor encounter for ${encounterBillingAnchorPatientId} was not found.`);
    }
    const billingLines = await targetDb.getBillingLinesForEncounter(patient.pid, encounter.encounter);

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openEncounterDirect(page, target, patient.pid, encounter.encounter);
      await openFeeSheetDirect(page, target, patient.pid, encounter.encounter);

      await expectRenderedText(page, "Selected Fee Sheet Codes and Charges");
      await expectRenderedText(page, officeVisitCode);
      await expectRenderedText(page, officeVisitText);
      await expectRenderedText(page, venipunctureCode);
      await expectRenderedText(page, venipunctureText);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-68-encounter-billing-surface",
        description: "Captures the Slice 68 legacy application-surface evidence: encounter Fee Sheet renders both linked CPT billing lines and the selected-charges heading.",
        expected: {
          anchorCanonicalId: encounterBillingAnchorPatientId,
          encounter: 1000013,
          feeSheetHeading: "Selected Fee Sheet Codes and Charges",
          renderedCodes: [officeVisitCode, venipunctureCode],
          renderedDescriptions: [officeVisitText, venipunctureText],
          totalFee: 186,
          justification: "E78.5"
        },
        actual: {
          patient,
          encounter,
          billingLines,
          legacySurface: {
            page: "fee sheet",
            renderedHeading: "Selected Fee Sheet Codes and Charges",
            renderedCodes: [officeVisitCode, venipunctureCode]
          }
        },
        context: {
          suite: "encounter-billing",
          workflow: "encounter-billing-surface"
        }
      });
      return;
    }

    const detailResponse = await page.request.get(`${target.apiBaseUrl}/api/encounters/${encounter.encounter}`, { headers: await getModernizedAdminSessionHeaders(page, target) });
    expect(detailResponse.ok()).toBe(true);
    const detailPayload = await detailResponse.json();
    expect(detailPayload.billingLineCount).toBe(2);
    expect(detailPayload.billingLines).toHaveLength(2);
    expect(detailPayload.billingLines.map((line: { code: string }) => line.code).sort()).toEqual([
      venipunctureCode,
      officeVisitCode
    ]);

    await openAuthenticatedModernizedEncounters(page, target, patient.pubpid, encounterBillingAnchorFromDate);

    const encounterButton = page.getByRole("button", { name: /Hyperlipidemia/i }).first();
    await expect(encounterButton).toBeVisible();
    await encounterButton.click();

    const linkage = page.getByLabel("Encounter billing linkage");
    await expect(linkage).toBeVisible();
    await expect(linkage).toContainText("Fee Sheet Linkage");
    await expect(linkage).toContainText("$186.00");
    await expect(linkage).toContainText(officeVisitCode);
    await expect(linkage).toContainText(officeVisitText);
    await expect(linkage).toContainText("$168.00");
    await expect(linkage).toContainText(venipunctureCode);
    await expect(linkage).toContainText(venipunctureText);
    await expect(linkage).toContainText("$18.00");
    await expect(linkage).toContainText("Justification E78.5");
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-68-encounter-billing-surface",
      description: "Captures the Slice 68 modernized application-surface evidence: encounter detail API billing rows and Encounters workspace Fee Sheet Linkage rendering anchors.",
      expected: {
        anchorCanonicalId: encounterBillingAnchorPatientId,
        encounter: 1000013,
        apiBillingLineCount: 2,
        apiBillingCodes: [venipunctureCode, officeVisitCode],
        uiPanelLabel: "Encounter billing linkage",
        uiHeading: "Fee Sheet Linkage",
        displayedTotal: "$186.00",
        displayedFees: ["$168.00", "$18.00"],
        displayedJustification: "Justification E78.5"
      },
      actual: {
        patient,
        encounter,
        billingLines,
        apiBillingLines: detailPayload.billingLines,
        modernizedSurface: {
          fromDate: encounterBillingAnchorFromDate,
          selectedEncounterLabel: "Hyperlipidemia",
          panelLabel: "Encounter billing linkage",
          renderedCodes: [officeVisitCode, venipunctureCode]
        }
      },
      context: {
        suite: "encounter-billing",
        workflow: "encounter-billing-surface"
      }
    });
  });
});
