import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedEncounters } from "../../src/ui/modernizedOpenEmr.js";
import { expectRenderedText, loginToLegacyOpenEmr, openEncounterDirect } from "../../src/ui/legacyOpenEmr.js";

const encounterAnchorPatientId = "MOD-PAT-0001";
const encounterAnchorFromDate = "2026-01-01";

test.describe("encounter clinical detail parity @slice3 @encounters", () => {
  test("stable encounter anchor has SOAP and vitals facts", async ({ target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterAnchorPatientId);
    const encounter = patient ? await targetDb.getLatestEncounterForPatient(patient.pid) : null;
    const clinical = patient && encounter ? await targetDb.getEncounterClinicalDetail(patient.pid, encounter.encounter) : null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-3-encounter-clinical-detail-anchor",
      description: "Verifies the Slice 3 encounter anchor patient, latest encounter, SOAP note, and vitals database facts.",
      expected: {
        patient: {
          pubpid: encounterAnchorPatientId
        },
        encounter: {
          patientId: patient?.pid ?? 100001,
          encounter: "latest seeded encounter id",
          date: `>= ${encounterAnchorFromDate}`,
          reason: "non-empty"
        },
        clinical: {
          patientId: patient?.pid ?? 100001,
          encounter: encounter?.encounter ?? "latest seeded encounter id",
          reason: "non-empty",
          assessment: "contains 'monitored during visit'",
          bloodPressure: "systolic/diastolic"
        }
      },
      actual: {
        patient,
        encounter,
        clinical
      },
      context: {
        canonicalId: encounterAnchorPatientId,
        fromDate: encounterAnchorFromDate,
        suite: "encounters",
        workflow: "encounter-clinical-detail"
      }
    });

    expect(patient).not.toBeNull();
    expect(encounter).not.toBeNull();
    expect(clinical).not.toBeNull();

    expect(clinical!.patientId).toBe(patient!.pid);
    expect(clinical!.encounter).toBe(encounter!.encounter);
    expect(clinical!.assessment).toContain("monitored during visit");
    expect(clinical!.bloodPressure).toMatch(/^\d+\/\d+$/);
    expect(clinical!.reason).toBeTruthy();
  });

  test("encounter SOAP and vitals are visible in the application UI", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(encounterAnchorPatientId);
    const encounter = patient ? await targetDb.getLatestEncounterForPatient(patient.pid) : null;
    const clinical = patient && encounter ? await targetDb.getEncounterClinicalDetail(patient.pid, encounter.encounter) : null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-3-encounter-ui-precondition",
      description: "Captures the patient, latest encounter, SOAP note, and vitals database rows used before steering the Slice 3 encounter UI parity flow.",
      expected: {
        patient: {
          pubpid: encounterAnchorPatientId
        },
        encounter: {
          reason: "visible encounter topic",
          date: `>= ${encounterAnchorFromDate}`
        },
        clinical: {
          bloodPressure: "visible blood pressure",
          assessment: "visible assessment text"
        }
      },
      actual: {
        patient,
        encounter,
        clinical
      },
      context: {
        canonicalId: encounterAnchorPatientId,
        fromDate: encounterAnchorFromDate,
        suite: "encounters",
        workflow: "encounter-clinical-detail-ui"
      }
    });

    expect(patient).not.toBeNull();
    expect(encounter).not.toBeNull();
    expect(clinical).not.toBeNull();

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);

      await expectRenderedText(page, new RegExp(escapeRegex(encounterTopic(clinical!.reason)), "i"));
      await expectRenderedText(page, "SOAP");
      await expectRenderedText(page, "Vitals");
      await expectRenderedText(page, /Blood Pressure/i);
      await expectRenderedText(page, /Assessment:/i);
      return;
    }

    await openAuthenticatedModernizedEncounters(page, target, patient!.pubpid, encounterAnchorFromDate);

    const encounterButton = page.getByRole("button", { name: new RegExp(escapeRegex(encounterTopic(clinical!.reason)), "i") }).first();
    await expect(encounterButton).toBeVisible();
    await encounterButton.click();

    await expect(page.getByRole("heading", { name: clinical!.reason })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(`PID ${patient!.pid}`);
    await expect(page.locator("body")).toContainText("SOAP Note");
    await expect(page.locator("body")).toContainText("Vitals");
    await expect(page.locator("body")).toContainText("Blood Pressure");
    await expect(page.locator("body")).toContainText("Assessment:");
    await expect(page.locator("body")).toContainText(clinical!.bloodPressure);
    await expect(page.locator("body")).toContainText(clinical!.assessment);
  });
});

function encounterTopic(reason: string) {
  return reason.replace(/^Follow-up for\s+/i, "").replace(/^Comprehensive\s+/i, "");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
