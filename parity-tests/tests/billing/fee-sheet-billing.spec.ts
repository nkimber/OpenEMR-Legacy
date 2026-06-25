import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openEncounterDirect,
  openFeeSheetDirect
} from "../../src/ui/legacyOpenEmr.js";

const billingAnchorPatientId = "MOD-PAT-0001";

test.describe("fee sheet billing parity @slice7 @billing", () => {
  test("stable billing anchor has seeded CPT fee sheet lines", async ({ target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(billingAnchorPatientId);
    const encounter = patient ? await targetDb.getLatestEncounterForPatient(patient.pid) : null;
    const billingLines = patient && encounter ? await targetDb.getBillingLinesForEncounter(patient.pid, encounter.encounter) : [];
    const officeVisit = billingLines.find(
      (line) =>
        line.codeType === "CPT4" &&
        line.code === "99214" &&
        line.codeText === "Established patient office visit" &&
        line.justify === "E78.5"
    ) ?? null;
    const venipuncture = billingLines.find(
      (line) => line.codeType === "CPT4" && line.code === "36415" && line.codeText === "Routine venipuncture"
    ) ?? null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-7-fee-sheet-billing-anchor",
      description: "Verifies the Slice 7 billing anchor patient, latest encounter, and seeded CPT fee-sheet line database facts.",
      expected: {
        patient: {
          pubpid: billingAnchorPatientId
        },
        encounter: {
          latest: true
        },
        billingLines: {
          minimumCount: 2,
          officeVisit: {
            codeType: "CPT4",
            code: "99214",
            codeText: "Established patient office visit",
            justify: "E78.5"
          },
          venipuncture: {
            codeType: "CPT4",
            code: "36415",
            codeText: "Routine venipuncture"
          }
        }
      },
      actual: {
        patient,
        encounter,
        billingLines,
        selected: {
          officeVisit,
          venipuncture
        }
      },
      context: {
        canonicalId: billingAnchorPatientId,
        suite: "billing",
        workflow: "fee-sheet-billing"
      }
    });

    expect(patient).not.toBeNull();
    expect(encounter).not.toBeNull();
    expect(billingLines.length).toBeGreaterThanOrEqual(2);
    expect(officeVisit).not.toBeNull();
    expect(venipuncture).not.toBeNull();
  });

  test("seeded fee sheet billing codes are visible in the application UI", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(billingAnchorPatientId);
    const encounter = patient ? await targetDb.getLatestEncounterForPatient(patient.pid) : null;
    const billingLines = patient && encounter ? await targetDb.getBillingLinesForEncounter(patient.pid, encounter.encounter) : [];
    const officeVisit = billingLines.find((line) => line.code === "99214") ?? billingLines[0] ?? null;
    const venipuncture = billingLines.find((line) => line.code === "36415") ?? billingLines[1] ?? null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-7-fee-sheet-billing-ui-precondition",
      description: "Captures the patient, encounter, and fee-sheet billing rows used before steering the Slice 7 billing UI parity flow.",
      expected: {
        patient: {
          pubpid: billingAnchorPatientId
        },
        billingLines: {
          minimumCount: 2,
          requiredCodes: ["99214", "36415"]
        }
      },
      actual: {
        patient,
        encounter,
        billingLines,
        selected: {
          officeVisit,
          venipuncture
        }
      },
      context: {
        canonicalId: billingAnchorPatientId,
        suite: "billing",
        workflow: "fee-sheet-billing-ui"
      }
    });

    expect(patient).not.toBeNull();
    expect(encounter).not.toBeNull();
    expect(billingLines.length).toBeGreaterThanOrEqual(2);
    expect(officeVisit).not.toBeNull();
    expect(venipuncture).not.toBeNull();

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
      await openFeeSheetDirect(page, target, patient!.pid, encounter!.encounter);

      await expectRenderedText(page, "Selected Fee Sheet Codes and Charges");
      await expectRenderedText(page, officeVisit!.code);
      await expectRenderedText(page, officeVisit!.codeText);
      await expectRenderedText(page, venipuncture!.code);
      await expectRenderedText(page, venipuncture!.codeText);
      return;
    }

    await openAuthenticatedModernizedFees(page, target, patient!.pubpid);

    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText("Selected Fee Sheet Codes and Charges");
    await expect(page.locator("body")).toContainText(`Encounter ${encounter!.encounter}`);
    await expect(page.locator("body")).toContainText(officeVisit!.code);
    await expect(page.locator("body")).toContainText(officeVisit!.codeText);
    await expect(page.locator("body")).toContainText(venipuncture!.code);
    await expect(page.locator("body")).toContainText(venipuncture!.codeText);
  });
});
