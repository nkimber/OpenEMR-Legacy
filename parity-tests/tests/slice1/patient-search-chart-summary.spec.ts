import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { isSuccessStatus, requestText } from "../../src/http/httpClient.js";
import { loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

test.describe("patient search and chart summary parity @slice1 @patient-chart", () => {
  test("target health endpoint is reachable", async ({ target }) => {
    const response = await requestText(target.healthUrl, { allowSelfSigned: true });

    expect(isSuccessStatus(response.statusCode)).toBe(true);
  });

  test("stable anchor patient has comparable demographic and activity facts", async ({ target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId("MOD-PAT-0001");
    const counts = patient ? await targetDb.getPatientWorkflowCounts(patient.pid) : null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-1-anchor-patient-demographics-and-counts",
      description: "Verifies the Slice 1 anchor patient demographics and activity-count facts used by patient search/chart summary parity.",
      expected: {
        patient: {
          pid: 100001,
          pubpid: "MOD-PAT-0001",
          fname: "Avery",
          lname: "Stone"
        },
        counts: {
          appointments: ">= 3",
          encounters: ">= 1",
          prescriptions: ">= 2",
          billingLineItems: ">= 1",
          procedureOrders: ">= 1"
        }
      },
      actual: {
        patient,
        counts
      },
      context: {
        canonicalId: "MOD-PAT-0001",
        suite: "slice1",
        workflow: "patient-search-chart-summary"
      }
    });

    expect(patient).not.toBeNull();
    expect(patient).toMatchObject({
      pid: 100001,
      pubpid: "MOD-PAT-0001",
      fname: "Avery",
      lname: "Stone"
    });

    expect(counts?.appointments).toBeGreaterThanOrEqual(3);
    expect(counts?.encounters).toBeGreaterThanOrEqual(1);
    expect(counts?.prescriptions).toBeGreaterThanOrEqual(2);
    expect(counts?.billingLineItems).toBeGreaterThanOrEqual(1);
    expect(counts?.procedureOrders).toBeGreaterThanOrEqual(1);
  });

  test("stable anchor patient chart is visible in the application UI", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId("MOD-PAT-0001");
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-1-chart-ui-anchor-patient",
      description: "Captures the database anchor used before steering the Slice 1 patient chart UI parity flow.",
      expected: {
        pubpid: "MOD-PAT-0001",
        fname: "Avery",
        lname: "Stone"
      },
      actual: patient,
      context: {
        canonicalId: "MOD-PAT-0001",
        suite: "slice1",
        workflow: "patient-chart-ui"
      }
    });
    expect(patient).not.toBeNull();

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientSummaryDirect(page, target, patient!.pid);

      await expect(page.locator("body")).toContainText(patient!.fname);
      await expect(page.locator("body")).toContainText(patient!.lname);
      await expect(page.locator("body")).toContainText(patient!.pubpid);
      return;
    }

    await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);

    await expect(page.getByRole("button", { name: /Stone, Avery/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Stone, Avery" })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(`PID ${patient!.pid}`);
    await expect(page.locator("body")).toContainText("Stable search and demographics navigation");
  });
});
