import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientHistoryDirect } from "../../src/ui/legacyOpenEmr.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const patientHistoryAnchorPatientId = "MOD-PAT-0010";

const expectedHistory = {
  coffee: "2 cups/day",
  tobacco: "Former smoker - quit 2019",
  alcohol: "No alcohol use",
  sleepPatterns: "Sleeps 7-8 hours nightly",
  exercisePatterns: "Walks 30 minutes 5 days/week",
  seatbeltUse: "Always",
  recreationalDrugs: "Denies recreational drug use",
  hazardousActivities: "No hazardous activities reported",
  lastPhysicalExam: "2026-01-15",
  lastProstateExam: "2026-02-09",
  lastColonoscopy: "2025-11-20",
  lastFluvax: "2025-10-01",
  lastLdl: "2026-01-11 LDL 100",
  lastHemoglobin: "2026-01-11 Hgb 13.0",
  lastPsa: "2026-02-11 PSA 2.0",
  historyMother: "Mother: hypertension",
  historyFather: "Father: type 2 diabetes",
  historySiblings: "Siblings: no major chronic illness",
  relativesDiabetes: "father",
  relativesHighBloodPressure: "mother",
  relativesMentalIllness: "sibling anxiety",
  appendectomyDate: "2016-04-20",
  additionalHistory: "Gold history for MOD-PAT-0010: Multiple encounter history",
  exams: "Annual physical, medication reconciliation, and preventive screening reviewed."
};

type PatientChartHistory = {
  pubpid: string;
  history?: typeof expectedHistory | null;
};

test.describe("patient history parity @slice202 @patient-history @patients", () => {
  test("renders history and lifestyle from the shared gold dataset", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(patientHistoryAnchorPatientId);
    expect(patient).not.toBeNull();

    const history = await targetDb.getPatientHistoryForPatient(patient!.pid);
    expect(history).not.toBeNull();
    expect(history).toMatchObject({
      patientId: patient!.pid,
      ...expectedHistory
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-202-patient-history-precondition",
      description: "Captures the Slice 202 read-only patient history precondition: anchor patient plus seeded OpenEMR History and Lifestyle facts.",
      expected: {
        anchorCanonicalId: patientHistoryAnchorPatientId,
        history: expectedHistory
      },
      actual: {
        patient,
        history
      },
      context: {
        canonicalId: patientHistoryAnchorPatientId,
        suite: "patient-history",
        workflow: "patient-history-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientHistoryDirect(page, target, patient!.pid);
      await expectRenderedText(page, /History and Lifestyle|History/i);

      await page.getByRole("link", { name: "Lifestyle", exact: true }).click();
      await expectRenderedText(page, "Former smoker - quit 2019");
      await expectRenderedText(page, "Walks 30 minutes 5 days/week");

      await page.getByRole("link", { name: "Family History", exact: true }).click();
      await expectRenderedText(page, "Mother: hypertension");

      await page.getByRole("link", { name: "Other", exact: true }).click();
      await expectRenderedText(page, "Gold history for MOD-PAT-0010");
      const historyPageText = await page.locator("body").innerText();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-202-patient-history-legacy-surface",
        description: "Captures the Slice 202 legacy UI evidence that OpenEMR renders the seeded History and Lifestyle tab values.",
        expected: {
          patientLastNameVisible: patient!.lname,
          visibleHistoryFields: {
            tobacco: expectedHistory.tobacco,
            exercisePatterns: expectedHistory.exercisePatterns,
            historyMother: expectedHistory.historyMother,
            additionalHistory: expectedHistory.additionalHistory
          }
        },
        actual: {
          patient,
          history,
          historyPageText
        },
        context: {
          canonicalId: patientHistoryAnchorPatientId,
          suite: "patient-history",
          workflow: "patient-history-legacy-surface"
        }
      });
      return;
    }

    const headers = await getModernizedAdminSessionHeaders(page, target);
    const chartResponse = await page.request.get(
      `${target.apiBaseUrl}/api/patients/${encodeURIComponent(patient!.pubpid)}`,
      { headers }
    );
    expect(chartResponse.ok()).toBeTruthy();
    const chart = (await chartResponse.json()) as PatientChartHistory;
    expect(chart.pubpid).toBe(patient!.pubpid);
    expect(chart.history).toMatchObject(expectedHistory);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-202-patient-history-modernized-api",
      description: "Captures the Slice 202 modernized patient chart API response for the seeded History and Lifestyle fields.",
      expected: {
        pubpid: patient!.pubpid,
        history: expectedHistory
      },
      actual: {
        status: chartResponse.status(),
        chart
      },
      context: {
        canonicalId: patientHistoryAnchorPatientId,
        suite: "patient-history",
        workflow: "patient-history-modernized-api"
      }
    });

    await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);
    await expect(page.getByRole("heading", { name: new RegExp(patient!.lname) })).toBeVisible();
    await expect(page.locator("body")).toContainText("History and Lifestyle");
    await expect(page.locator("body")).toContainText("Former smoker - quit 2019");
    await expect(page.locator("body")).toContainText("Walks 30 minutes 5 days/week");
    await expect(page.locator("body")).toContainText("Gold history for MOD-PAT-0010");
    await expect(page.locator("body")).toContainText("Mother: hypertension");
    await expect(page.locator("body")).toContainText("2016-04-20");
    const chartPageText = await page.locator("body").innerText();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-202-patient-history-modernized-surface",
      description: "Captures the Slice 202 modernized Patient/Client chart rendering for seeded History and Lifestyle facts.",
      expected: {
        heading: patient!.lname,
        visibleHistoryFields: {
          tobacco: expectedHistory.tobacco,
          exercisePatterns: expectedHistory.exercisePatterns,
          additionalHistory: expectedHistory.additionalHistory,
          historyMother: expectedHistory.historyMother,
          appendectomyDate: expectedHistory.appendectomyDate
        }
      },
      actual: {
        patient,
        chartPageText
      },
      context: {
        canonicalId: patientHistoryAnchorPatientId,
        suite: "patient-history",
        workflow: "patient-history-modernized-surface"
      }
    });
  });
});
