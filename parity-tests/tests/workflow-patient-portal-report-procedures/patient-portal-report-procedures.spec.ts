import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMedicalReportAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const procedureOrderDate = "2026-06-24";
const procedureOrderCode = "84443";
const procedureOrderDiagnosis = "ICD10:E11.9";

test.describe("patient portal generated report procedure-order selection parity @slice236 @workflow-patient-portal-report-procedures @patients @portal @reports", () => {
  test("generates explicitly selected procedure-order content in the customized medical history report", async ({
    targetDb,
    workflow
  }) => {
    test.setTimeout(180_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMedicalReportAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    const procedureName = `Slice 236 selected procedure order ${workflowSuffix()}`;
    let procedureOrderId: number | null = null;

    try {
      procedureOrderId = await workflow.createProcedureOrder({
        patientId: patient!.pid,
        providerId: patient!.providerId || 101,
        encounterId: encounter!.encounter,
        dateOrdered: procedureOrderDate,
        priority: "routine",
        status: "pending",
        procedureCode: procedureOrderCode,
        procedureName,
        procedureType: "laboratory",
        diagnosis: procedureOrderDiagnosis,
        instructions: "Created for Slice 236 selected procedure-order report parity."
      });

      const reportBuilder = await workflow.getPatientPortalMedicalReport(portalLoginUsername, portalPassword);
      expect(reportBuilder.authenticated).toBeTruthy();
      const createdOrder = reportBuilder.procedureOrders.find((order) => order.id === String(procedureOrderId));
      expect(createdOrder).toMatchObject({
        id: String(procedureOrderId),
        procedureName,
        procedureCode: procedureOrderCode,
        diagnosis: procedureOrderDiagnosis,
        orderDate: procedureOrderDate,
        orderStatus: "pending"
      });

      const generated = await workflow.generatePatientPortalMedicalReport(portalLoginUsername, portalPassword, {
        sectionIds: ["demographics", "billing"],
        procedureOrderIds: [String(procedureOrderId)],
        issueIds: [],
        encounterFormIds: []
      });

      expect(generated).toMatchObject({
        authenticated: true,
        username: portalLoginUsername,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        title: "Customized Medical History Report",
        includedSectionIds: ["demographics", "billing"],
        includedProcedureOrderIds: [String(procedureOrderId)],
        includedIssueIds: [],
        includedEncounterFormIds: [],
        printableVersionAvailable: true,
        pdfDownloadAvailable: true,
        reportSectionCount: 3,
        failureReason: null
      });
      expect(generated.reportSections.map((section) => section.title)).toEqual([
        "Patient Data",
        "Billing Information",
        "Procedure Order"
      ]);

      const generatedText = generated.reportSections
        .flatMap((section) => [section.title, ...section.lines])
        .join("\n");
      expect(generatedText).toContain(`Order: ${procedureName}`);
      expect(generatedText).toContain(`Order date: ${procedureOrderDate}`);
      expect(generatedText).toMatch(new RegExp(`Encounter: (Not linked|${encounter!.encounter})`));
      expect(generatedText).toContain(`Code: ${procedureOrderCode}`);
      expect(generatedText).toContain(`Diagnosis: ${procedureOrderDiagnosis}`);
      expect(generatedText).toContain("Status: pending");
      expect(generatedText).toContain("Reports: 0");
      expect(generated.summaryLines.join("\n")).toContain(
        `Procedure Order: ${procedureName} ordered ${procedureOrderDate} with 0 result rows.`
      );
    } finally {
      if (procedureOrderId !== null) {
        await workflow.deleteProcedureOrderCascade(procedureOrderId);
      }
    }
  });

  test("renders explicitly selected procedure-order content on the portal generated report surface", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    test.setTimeout(180_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMedicalReportAnchorPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    const procedureName = `Slice 236 UI selected procedure order ${workflowSuffix()}`;
    let procedureOrderId: number | null = null;

    try {
      procedureOrderId = await workflow.createProcedureOrder({
        patientId: patient!.pid,
        providerId: patient!.providerId || 101,
        encounterId: encounter!.encounter,
        dateOrdered: procedureOrderDate,
        priority: "routine",
        status: "pending",
        procedureCode: procedureOrderCode,
        procedureName,
        procedureType: "laboratory",
        diagnosis: procedureOrderDiagnosis,
        instructions: "Created for Slice 236 selected procedure-order UI parity."
      });

      if (target.type === "legacy-openemr") {
        await expectLegacySelectedProcedureOrderReport(page, target, procedureOrderId);
        return;
      }

      await expectModernizedSelectedProcedureOrderReport(page, target, procedureName);
    } finally {
      if (procedureOrderId !== null) {
        await workflow.deleteProcedureOrderCascade(procedureOrderId);
      }
    }
  });
});

async function expectLegacySelectedProcedureOrderReport(
  page: Page,
  target: RuntimeTarget,
  procedureOrderId: number
) {
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

  await page.goto(`${target.publicUrl}/portal/report/portal_patient_report.php`);
  await expectRenderedText(page, /Patient Report/i);
  await expect(page.locator(`input[name='procedures[]'][value='${procedureOrderId}']`)).toHaveCount(1);

  const reportResponse = await page.request.post(`${target.publicUrl}/portal/report/portal_custom_report.php`, {
    form: {
      include_demographics: "demographics",
      include_billing: "billing",
      "procedures[]": String(procedureOrderId)
    }
  });
  expect(reportResponse.ok()).toBeTruthy();
  const reportHtml = await reportResponse.text();
  expect(reportHtml).toContain("Procedure Order");
  expect(reportHtml).toContain(`procedures%5B%5D=${procedureOrderId}`);
}

async function expectModernizedSelectedProcedureOrderReport(
  page: Page,
  target: RuntimeTarget,
  procedureName: string
) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);

  const procedureRegion = page.getByRole("region", { name: "Patient portal medical report procedures" });
  const checkboxes = procedureRegion.getByRole("checkbox");
  const checkboxCount = await checkboxes.count();
  for (let index = 0; index < checkboxCount; index += 1) {
    const checkbox = checkboxes.nth(index);
    if (await checkbox.isChecked()) {
      await checkbox.uncheck();
    }
  }

  await procedureRegion
    .getByRole("checkbox", { name: `Include procedure order ${procedureName} in generated report` })
    .check();

  await page.getByRole("button", { name: "Generate report" }).click();
  const generatedReportRegion = page.getByRole("region", { name: "Patient portal generated medical report" });
  await expect(generatedReportRegion).toContainText("Procedure Order");
  await expect(generatedReportRegion).toContainText(`Order: ${procedureName}`);
  await expect(generatedReportRegion).toContainText(`Code: ${procedureOrderCode}`);
  await expect(generatedReportRegion).toContainText(`Diagnosis: ${procedureOrderDiagnosis}`);
  await expect(generatedReportRegion).toContainText("Status: pending");
  await expect(generatedReportRegion).toContainText("Reports: 0");
  await expect(generatedReportRegion).toContainText("1 procedure orders");
  await expect(generatedReportRegion).toContainText(`Procedure Order: ${procedureName} ordered ${procedureOrderDate} with 0 result rows.`);
}

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
