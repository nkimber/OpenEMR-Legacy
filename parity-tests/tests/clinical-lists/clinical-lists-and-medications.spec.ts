import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedClinicalLists } from "../../src/ui/modernizedOpenEmr.js";

const clinicalListsAnchorPatientId = "MOD-PAT-0001";

test.describe("clinical lists and medications parity @slice4 @clinical-lists", () => {
  test("stable clinical-list anchor has problems, allergies, medications, and prescriptions", async ({ target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(clinicalListsAnchorPatientId);
    const lists = patient ? await targetDb.getClinicalListsForPatient(patient.pid) : null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-4-clinical-lists-anchor",
      description: "Verifies the Slice 4 anchor patient clinical-list database facts for problems, allergies, medications, and prescriptions.",
      expected: {
        patient: {
          pubpid: clinicalListsAnchorPatientId
        },
        lists: {
          patientId: patient?.pid ?? 100001,
          problems: "contains a diabetes problem",
          allergies: "contains Penicillin with rash reaction",
          medications: "contains Metformin medication-list entry",
          prescriptions: "contains Metformin Oral prescription"
        }
      },
      actual: {
        patient,
        lists
      },
      context: {
        canonicalId: clinicalListsAnchorPatientId,
        suite: "clinical-lists",
        workflow: "clinical-lists-and-medications"
      }
    });

    expect(patient).not.toBeNull();
    expect(lists).not.toBeNull();
    expect(lists!.patientId).toBe(patient!.pid);
    expect(lists!.problems.some((item) => item.title.includes("diabetes"))).toBe(true);
    expect(lists!.allergies.some((item) => item.title === "Penicillin" && item.reaction === "rash")).toBe(true);
    expect(lists!.medications.some((item) => item.title.startsWith("Metformin"))).toBe(true);
    expect(lists!.prescriptions.some((item) => item.drug === "Metformin" && item.route === "Oral")).toBe(true);
  });

  test("clinical lists are visible in the application UI", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(clinicalListsAnchorPatientId);
    const lists = patient ? await targetDb.getClinicalListsForPatient(patient.pid) : null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-4-clinical-lists-ui-precondition",
      description: "Captures the clinical-list database rows used before steering the Slice 4 clinical lists UI parity flow.",
      expected: {
        patient: {
          pubpid: clinicalListsAnchorPatientId
        },
        lists: {
          problems: "one or more visible problems",
          allergies: "one or more visible allergies",
          medications: "one or more visible medications",
          prescriptions: "one or more visible prescriptions"
        }
      },
      actual: {
        patient,
        lists
      },
      context: {
        canonicalId: clinicalListsAnchorPatientId,
        suite: "clinical-lists",
        workflow: "clinical-lists-ui"
      }
    });

    expect(patient).not.toBeNull();
    expect(lists).not.toBeNull();
    expect(lists!.problems.length).toBeGreaterThan(0);
    expect(lists!.allergies.length).toBeGreaterThan(0);
    expect(lists!.medications.length).toBeGreaterThan(0);
    expect(lists!.prescriptions.length).toBeGreaterThan(0);

    const problem = lists!.problems.find((item) => item.title.includes("diabetes")) ?? lists!.problems[0];
    const allergy = lists!.allergies.find((item) => item.title === "Penicillin") ?? lists!.allergies[0];
    const medication = lists!.medications.find((item) => item.title.startsWith("Metformin")) ?? lists!.medications[0];
    const prescription = lists!.prescriptions.find((item) => item.drug === "Metformin") ?? lists!.prescriptions[0];

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientSummaryDirect(page, target, patient!.pid);

      await expectRenderedText(page, problem.title);
      await expectRenderedText(page, allergy.title);
      await expectRenderedText(page, medication.title);
      await expectRenderedText(page, prescription.drug);
      return;
    }

    await openAuthenticatedModernizedClinicalLists(page, target, patient!.pubpid);

    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(problem.title);
    await expect(page.locator("body")).toContainText(allergy.title);
    await expect(page.locator("body")).toContainText(medication.title);
    await expect(page.locator("body")).toContainText(prescription.drug);
    await expect(page.locator("body")).toContainText("Prescriptions");
  });
});
