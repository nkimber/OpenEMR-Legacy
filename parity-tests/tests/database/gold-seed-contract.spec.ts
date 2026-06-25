import { promises as fs } from "node:fs";
import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";

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
  test("matches the generated gold dataset count contract", async ({ target, targetDb }, testInfo) => {
    const summary = await readSummary(target.seedSummaryPathAbs);
    const actual = await targetDb.getGoldCounts();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "gold-dataset-counts",
      description: "Compares generated gold dataset row-count expectations with target database counts.",
      expected: summary.counts,
      actual,
      context: {
        seedSummaryPath: target.seedSummaryPathAbs
      }
    });

    for (const [name, expected] of Object.entries(summary.counts)) {
      expect(actual[name], `${name} row count`).toBe(expected);
    }
  });

  test("matches the generated temporal coverage contract", async ({ target, targetDb }, testInfo) => {
    const summary = await readSummary(target.seedSummaryPathAbs);
    const actual = await targetDb.getTemporalCoverage(summary.temporalCoverage.asOfDate, summary.temporalCoverage.currentYear);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "gold-temporal-coverage",
      description: "Compares generated temporal coverage expectations with target database date coverage.",
      expected: summary.temporalCoverage,
      actual,
      context: {
        asOfDate: summary.temporalCoverage.asOfDate,
        currentYear: summary.temporalCoverage.currentYear
      }
    });

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

  test("contains stable named workflow anchor patients", async ({ target, targetDb }, testInfo) => {
    const summary = await readSummary(target.seedSummaryPathAbs);
    const expectedAnchors = summary.testAnchors.slice(0, 10);
    const actualPatients = [];

    for (const anchor of expectedAnchors) {
      const patient = await targetDb.findPatientByCanonicalId(anchor.canonicalId);
      actualPatients.push({
        canonicalId: anchor.canonicalId,
        expectedName: anchor.name,
        actual: patient
      });
    }
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "workflow-anchor-patients",
      description: "Verifies stable named workflow anchor patients from the generated seed summary.",
      expected: expectedAnchors,
      actual: actualPatients
    });

    for (const patientProbe of actualPatients) {
      expect(patientProbe.actual, `${patientProbe.canonicalId} exists`).not.toBeNull();
      expect(`${patientProbe.actual?.fname} ${patientProbe.actual?.lname}`).toBe(patientProbe.expectedName);
      expect(patientProbe.actual?.pubpid).toBe(patientProbe.canonicalId);
    }
  });

  test("gold workflow anchors have meaningful related records", async ({ target, targetDb }, testInfo) => {
    const patientSearch = await targetDb.findPatientByCanonicalId("MOD-PAT-0001");
    const chronicCare = await targetDb.findPatientByCanonicalId("MOD-PAT-0002");
    const scheduling = await targetDb.findPatientByCanonicalId("MOD-PAT-0003");
    const medications = await targetDb.findPatientByCanonicalId("MOD-PAT-0008");
    const labs = await targetDb.findPatientByCanonicalId("MOD-PAT-0009");

    const patientSearchCounts = patientSearch ? await targetDb.getPatientWorkflowCounts(patientSearch.pid) : null;
    const chronicCareCounts = chronicCare ? await targetDb.getPatientWorkflowCounts(chronicCare.pid) : null;
    const schedulingCounts = scheduling ? await targetDb.getPatientWorkflowCounts(scheduling.pid) : null;
    const medicationCounts = medications ? await targetDb.getPatientWorkflowCounts(medications.pid) : null;
    const labCounts = labs ? await targetDb.getPatientWorkflowCounts(labs.pid) : null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "workflow-anchor-related-records",
      description: "Verifies selected gold workflow anchors have meaningful related records for parity workflows.",
      expected: {
        "MOD-PAT-0001": { appointments: ">= 3", encounters: ">= 1" },
        "MOD-PAT-0002": { problems: ">= 1", prescriptions: ">= 2" },
        "MOD-PAT-0003": { appointments: ">= 3" },
        "MOD-PAT-0008": { medications: ">= 2", prescriptions: ">= 2" },
        "MOD-PAT-0009": { procedureOrders: ">= 1" }
      },
      actual: {
        "MOD-PAT-0001": { patient: patientSearch, counts: patientSearchCounts },
        "MOD-PAT-0002": { patient: chronicCare, counts: chronicCareCounts },
        "MOD-PAT-0003": { patient: scheduling, counts: schedulingCounts },
        "MOD-PAT-0008": { patient: medications, counts: medicationCounts },
        "MOD-PAT-0009": { patient: labs, counts: labCounts }
      }
    });

    for (const patient of [patientSearch, chronicCare, scheduling, medications, labs]) {
      expect(patient).not.toBeNull();
    }

    expect(patientSearchCounts?.appointments).toBeGreaterThanOrEqual(3);
    expect(patientSearchCounts?.encounters).toBeGreaterThanOrEqual(1);
    expect(chronicCareCounts?.problems).toBeGreaterThanOrEqual(1);
    expect(chronicCareCounts?.prescriptions).toBeGreaterThanOrEqual(2);
    expect(schedulingCounts?.appointments).toBeGreaterThanOrEqual(3);
    expect(medicationCounts?.medications).toBeGreaterThanOrEqual(2);
    expect(medicationCounts?.prescriptions).toBeGreaterThanOrEqual(2);
    expect(labCounts?.procedureOrders).toBeGreaterThanOrEqual(1);
  });
});

async function readSummary(filePath: string): Promise<Summary> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as Summary;
}
