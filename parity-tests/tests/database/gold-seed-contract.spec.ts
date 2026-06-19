import { promises as fs } from "node:fs";
import { test, expect } from "../../src/fixtures/parityTest.js";

type Summary = {
  counts: Record<string, number>;
  temporalCoverage: Record<string, unknown> & {
    asOfDate: string;
    currentYear: string;
  };
  testAnchors: Array<{
    canonicalId: string;
    name: string;
    cohort: string;
    purpose: string;
  }>;
};

test.describe("gold seed database contract @database @gold", () => {
  test("matches the generated gold dataset count contract", async ({ target, targetDb }) => {
    const summary = await readSummary(target.seedSummaryPathAbs);
    const actual = await targetDb.getGoldCounts();

    for (const [name, expected] of Object.entries(summary.counts)) {
      expect(actual[name], `${name} row count`).toBe(expected);
    }
  });

  test("matches the generated temporal coverage contract", async ({ target, targetDb }) => {
    const summary = await readSummary(target.seedSummaryPathAbs);
    const actual = await targetDb.getTemporalCoverage(summary.temporalCoverage.asOfDate, summary.temporalCoverage.currentYear);

    for (const [name, expectedValue] of Object.entries(summary.temporalCoverage)) {
      if (name === "asOfDate" || name === "currentYear") {
        continue;
      }
      const expected = expectedValue as {
        total: number;
        currentYear: number;
        futureCurrentYear: number;
        minDate: string | null;
        maxDate: string | null;
      };
      expect(actual[name], `${name} temporal coverage exists`).toBeTruthy();
      expect(actual[name].total, `${name}.total`).toBe(expected.total);
      expect(actual[name].currentYear, `${name}.currentYear`).toBe(expected.currentYear);
      expect(actual[name].futureCurrentYear, `${name}.futureCurrentYear`).toBe(expected.futureCurrentYear);
      expect(actual[name].minDate, `${name}.minDate`).toBe(expected.minDate);
      expect(actual[name].maxDate, `${name}.maxDate`).toBe(expected.maxDate);
    }
  });

  test("contains stable named workflow anchor patients", async ({ target, targetDb }) => {
    const summary = await readSummary(target.seedSummaryPathAbs);

    for (const anchor of summary.testAnchors.slice(0, 10)) {
      const patient = await targetDb.findPatientByCanonicalId(anchor.canonicalId);
      expect(patient, `${anchor.canonicalId} exists`).not.toBeNull();
      expect(`${patient?.fname} ${patient?.lname}`).toBe(anchor.name);
      expect(patient?.pubpid).toBe(anchor.canonicalId);
    }
  });

  test("gold workflow anchors have meaningful related records", async ({ targetDb }) => {
    const patientSearch = await targetDb.findPatientByCanonicalId("MOD-PAT-0001");
    const chronicCare = await targetDb.findPatientByCanonicalId("MOD-PAT-0002");
    const scheduling = await targetDb.findPatientByCanonicalId("MOD-PAT-0003");
    const medications = await targetDb.findPatientByCanonicalId("MOD-PAT-0008");
    const labs = await targetDb.findPatientByCanonicalId("MOD-PAT-0009");

    for (const patient of [patientSearch, chronicCare, scheduling, medications, labs]) {
      expect(patient).not.toBeNull();
    }

    const patientSearchCounts = await targetDb.getPatientWorkflowCounts(patientSearch!.pid);
    expect(patientSearchCounts.appointments).toBeGreaterThanOrEqual(3);
    expect(patientSearchCounts.encounters).toBeGreaterThanOrEqual(1);

    const chronicCareCounts = await targetDb.getPatientWorkflowCounts(chronicCare!.pid);
    expect(chronicCareCounts.problems).toBeGreaterThanOrEqual(1);
    expect(chronicCareCounts.prescriptions).toBeGreaterThanOrEqual(2);

    const schedulingCounts = await targetDb.getPatientWorkflowCounts(scheduling!.pid);
    expect(schedulingCounts.appointments).toBeGreaterThanOrEqual(3);

    const medicationCounts = await targetDb.getPatientWorkflowCounts(medications!.pid);
    expect(medicationCounts.medications).toBeGreaterThanOrEqual(2);
    expect(medicationCounts.prescriptions).toBeGreaterThanOrEqual(2);

    const labCounts = await targetDb.getPatientWorkflowCounts(labs!.pid);
    expect(labCounts.procedureOrders).toBeGreaterThanOrEqual(1);
  });
});

async function readSummary(filePath: string): Promise<Summary> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as Summary;
}
