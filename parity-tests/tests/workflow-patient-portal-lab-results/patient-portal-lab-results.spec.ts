import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { PatientPortalLabResultItem } from "../../src/workflows/legacyWorkflowActions.js";
import type { Page } from "@playwright/test";

const portalLabResultsAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal lab results parity @slice223 @workflow-patient-portal-lab-results @patients @portal @labs", () => {
  test("lists signed-in portal patient lab order, report, and result facts", async ({
    targetDb,
    target,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalLabResultsAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-223-patient-portal-lab-results-precondition",
      description: "Captures the Slice 223 portal lab-results precondition: the signed-in anchor patient exists before projecting lab order, report, and final result facts.",
      expected: {
        canonicalId: portalLabResultsAnchorPatientId,
        portalUsername: portalLoginUsername
      },
      actual: {
        canonicalId: portalLabResultsAnchorPatientId,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        portalUsername: portalLoginUsername
      },
      context: {
        suite: "workflow-patient-portal-lab-results",
        workflow: "patient-portal-lab-results-precondition"
      }
    });

    const labResults = await workflow.getPatientPortalLabResults(portalLoginUsername, portalPassword);
    expect(labResults).toMatchObject({
      authenticated: true,
      username: portalLoginUsername,
      portalUsername: portalLoginUsername,
      pid: patient!.pid,
      pubpid: patient!.pubpid,
      displayName: "Kim, Nora",
      orderCount: 1,
      reportCount: 1,
      resultCount: 4,
      failureReason: null
    });

    const order = labResults.orders[0];
    expect(order).toMatchObject({
      orderDate: "2026-02-21",
      procedureName: "Hemoglobin A1c",
      reportCount: 1,
      resultCount: 4
    });

    const report = order.reports[0];
    expect(report).toMatchObject({
      reportDate: "2026-02-23 14:00",
      reportStatus: "complete",
      reviewStatus: "reviewed",
      resultCount: 4
    });

    expect(report.results.map((result) => result.resultName)).toEqual([
      "Hemoglobin A1c",
      "Glucose",
      "Cholesterol",
      "HDL Cholesterol"
    ]);

    const resultsByName = new Map<string, PatientPortalLabResultItem>(
      report.results.map((result) => [result.resultName, result])
    );
    expect(resultsByName.get("Hemoglobin A1c")).toMatchObject({
      value: "5.7",
      units: "%",
      range: "4.0-5.6",
      abnormal: "no",
      resultStatus: "final"
    });
    expect(resultsByName.get("Glucose")).toMatchObject({
      value: "102",
      units: "mg/dL",
      range: "70-99",
      abnormal: "no",
      resultStatus: "final"
    });
    expect(resultsByName.get("Cholesterol")).toMatchObject({
      value: "188",
      units: "mg/dL",
      range: "<200",
      abnormal: "no",
      resultStatus: "final"
    });
    expect(resultsByName.get("HDL Cholesterol")).toMatchObject({
      value: "52",
      units: "mg/dL",
      range: ">40",
      abnormal: "no",
      resultStatus: "final"
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-223-patient-portal-lab-results-result",
      description: "Captures the Slice 223 portal lab-results projection, including order, report, and final result values visible to the signed-in patient.",
      expected: {
        displayName: "Kim, Nora",
        orderCount: 1,
        reportCount: 1,
        resultCount: 4,
        procedureName: "Hemoglobin A1c",
        reportStatus: "complete",
        reviewStatus: "reviewed",
        resultNames: ["Hemoglobin A1c", "Glucose", "Cholesterol", "HDL Cholesterol"]
      },
      actual: {
        authenticated: labResults.authenticated,
        username: labResults.username,
        portalUsername: labResults.portalUsername,
        pid: labResults.pid,
        pubpid: labResults.pubpid,
        displayName: labResults.displayName,
        orderCount: labResults.orderCount,
        reportCount: labResults.reportCount,
        resultCount: labResults.resultCount,
        orders: labResults.orders
      },
      context: {
        suite: "workflow-patient-portal-lab-results",
        workflow: "patient-portal-lab-results-result"
      }
    });
  });

  test("renders signed-in portal patient lab results on the portal surface", async ({
    page,
    target
  }, testInfo) => {
    test.setTimeout(120_000);

    if (target.type === "legacy-openemr") {
      const legacySurface = await expectLegacyPatientPortalLabResults(page, target);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-223-patient-portal-lab-results-legacy-surface",
        description: "Captures the legacy OpenEMR portal lab-results surface for the signed-in patient.",
        expected: {
          page: "get_lab_results.php",
          procedureName: "Hemoglobin A1c",
          resultValues: ["5.7", "102", "188", "52"],
          resultStatus: "final",
          reportStatus: "complete"
        },
        actual: legacySurface,
        context: {
          suite: "workflow-patient-portal-lab-results",
          workflow: "patient-portal-lab-results-legacy-surface"
        }
      });
      return;
    }

    await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
    const labRegion = page.getByRole("region", { name: "Patient portal lab results" });
    await expect(labRegion).toContainText("Lab Results");
    await expect(labRegion).toContainText("1 order");
    await expect(labRegion).toContainText("4 results");
    await expect(labRegion).toContainText("Hemoglobin A1c");
    await expect(labRegion).toContainText("Glucose");
    await expect(labRegion).toContainText("5.7 %");
    await expect(labRegion).toContainText("102 mg/dL");
    await expect(labRegion).toContainText(/final/i);
    await expect(labRegion).toContainText(/complete/i);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-223-patient-portal-lab-results-modernized-surface",
      description: "Captures the modernized Portal lab-results surface rendered for the signed-in patient.",
      expected: {
        heading: "Lab Results",
        counts: ["1 order", "4 results"],
        visibleFacts: ["Hemoglobin A1c", "Glucose", "5.7 %", "102 mg/dL", "final", "complete"]
      },
      actual: {
        url: page.url(),
        regionText: await labRegion.innerText()
      },
      context: {
        suite: "workflow-patient-portal-lab-results",
        workflow: "patient-portal-lab-results-modernized-surface"
      }
    });
  });
});

async function expectLegacyPatientPortalLabResults(page: Page, target: RuntimeTarget) {
  await page.context().clearCookies();
  await page.goto(`${target.publicUrl}/portal/index.php?site=default&woops=1`);
  await page.locator("#uname").fill(portalLoginUsername);
  await page.locator("#pass").fill(portalPassword);

  const emailConfirmation = page.locator("#passaddon");
  if ((await emailConfirmation.count()) > 0 && await emailConfirmation.isVisible()) {
    await emailConfirmation.fill(portalLoginUsername);
  }

  await page.getByRole("button", { name: "Log In" }).click();
  await expect.poll(() => page.url()).toContain("/portal/home.php");

  await page.goto(`${target.publicUrl}/portal/get_lab_results.php`);
  await expectRenderedText(page, /Order Date|Result Name/i);
  await expect(page.locator("body")).toContainText("Hemoglobin A1c");
  await expect(page.locator("body")).toContainText("5.7");
  await expect(page.locator("body")).toContainText("102");
  await expect(page.locator("body")).toContainText("188");
  await expect(page.locator("body")).toContainText("52");
  await expect(page.locator("body")).toContainText(/final/i);
  await expect(page.locator("body")).toContainText(/complete/i);
  const bodyText = await page.locator("body").innerText();

  return {
    url: `${target.publicUrl}/portal/get_lab_results.php`,
    bodyText
  };
}
