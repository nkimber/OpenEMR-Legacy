import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientImmunizationsDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedClinicalLists } from "../../src/ui/modernizedOpenEmr.js";

const immunizationAnchorPatientId = "MOD-PAT-0007";

test.describe("immunizations parity @slice29 @immunizations", () => {
  test("stable pediatric anchor has rich immunization history", async ({ target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(immunizationAnchorPatientId);
    expect(patient).not.toBeNull();

    const immunizations = await targetDb.getPatientImmunizationsForPatient(patient!.pid);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-29-immunization-history-anchor",
      description: "Verifies the Slice 29 pediatric immunization anchor patient and normalized vaccine history facts.",
      expected: {
        patient: {
          pubpid: immunizationAnchorPatientId,
          displayName: "Rivera, Mateo",
          cohort: "pediatrics"
        },
        immunizations: {
          minimumCount: 8,
          lotNumberPrefix: "LOT-",
          includesAdministeredInYear: "2026",
          anchors: [
            {
              vaccine: "Influenza, seasonal, injectable",
              cvxCode: "141",
              manufacturer: "Sanofi Pasteur",
              administeredDate: "2026-01-15"
            },
            {
              vaccine: "Hep A, ped/adol, 2 dose",
              cvxCode: "83",
              manufacturer: "GlaxoSmithKline",
              lotNumber: "LOT-100007-09",
              administeredDate: "2026-03-26"
            }
          ]
        }
      },
      actual: {
        patient,
        immunizations
      },
      context: {
        canonicalId: immunizationAnchorPatientId,
        suite: "immunizations",
        workflow: "patient-immunization-history"
      }
    });

    expect(immunizations.patientId).toBe(patient!.pid);
    expect(immunizations.immunizations.length).toBeGreaterThanOrEqual(8);
    expect(immunizations.immunizations.some((item) => item.vaccine === "Influenza, seasonal, injectable" && item.cvxCode === "141")).toBe(true);
    expect(immunizations.immunizations.some((item) => item.vaccine === "Hep A, ped/adol, 2 dose" && item.manufacturer === "GlaxoSmithKline")).toBe(true);
    expect(immunizations.immunizations.some((item) => item.administeredDate.startsWith("2026-"))).toBe(true);
    expect(immunizations.immunizations.every((item) => item.lotNumber.startsWith("LOT-"))).toBe(true);
  });

  test("immunizations are visible in the application UI", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(immunizationAnchorPatientId);
    expect(patient).not.toBeNull();
    const immunizations = await targetDb.getPatientImmunizationsForPatient(patient!.pid);
    expect(immunizations.immunizations.length).toBeGreaterThanOrEqual(8);

    const influenza = immunizations.immunizations.find((item) => item.vaccine === "Influenza, seasonal, injectable") ?? immunizations.immunizations[0];
    const hepatitisA = immunizations.immunizations.find((item) => item.vaccine === "Hep A, ped/adol, 2 dose") ?? immunizations.immunizations[0];
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-29-immunization-ui-precondition",
      description: "Captures the Slice 29 immunization history rows before steering legacy Immunizations or the modernized clinical Lists Immunizations panel.",
      expected: {
        patient: {
          pubpid: immunizationAnchorPatientId,
          displayName: "Rivera, Mateo"
        },
        visibleImmunizations: [
          {
            vaccine: "Influenza, seasonal, injectable",
            cvxCode: "141"
          },
          {
            vaccine: "Hep A, ped/adol, 2 dose",
            manufacturer: "GlaxoSmithKline",
            lotNumber: "LOT-100007-09"
          }
        ]
      },
      actual: {
        patient,
        immunizations,
        influenza,
        hepatitisA
      },
      context: {
        canonicalId: immunizationAnchorPatientId,
        suite: "immunizations",
        workflow: "patient-immunization-ui"
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientImmunizationsDirect(page, target, patient!.pid);

      await expectRenderedText(page, "Vaccine");
      await expectRenderedText(page, influenza.vaccine);
      await expectRenderedText(page, hepatitisA.vaccine);
      await expectRenderedText(page, hepatitisA.manufacturer);
      await expectRenderedText(page, hepatitisA.lotNumber);
      return;
    }

    await openAuthenticatedModernizedClinicalLists(page, target, patient!.pubpid);

    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText("Immunizations");
    await expect(page.locator("body")).toContainText(influenza.vaccine);
    await expect(page.locator("body")).toContainText(hepatitisA.vaccine);
    await expect(page.locator("body")).toContainText(hepatitisA.manufacturer);
    await expect(page.locator("body")).toContainText(hepatitisA.lotNumber);
  });
});
