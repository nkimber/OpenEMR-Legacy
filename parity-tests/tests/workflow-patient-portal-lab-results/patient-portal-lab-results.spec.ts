import { test, expect } from "../../src/fixtures/parityTest.js";
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
    workflow
  }) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalLabResultsAnchorPatientId);
    expect(patient).not.toBeNull();

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
  });

  test("renders signed-in portal patient lab results on the portal surface", async ({
    page,
    target
  }) => {
    test.setTimeout(120_000);

    if (target.type === "legacy-openemr") {
      await expectLegacyPatientPortalLabResults(page, target);
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
}
