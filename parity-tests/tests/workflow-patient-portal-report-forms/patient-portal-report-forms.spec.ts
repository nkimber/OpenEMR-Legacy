import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";
import type {
  PatientPortalMedicalReportEncounter,
  PatientPortalMedicalReportEncounterForm,
  PatientPortalMedicalReportResult
} from "../../src/workflows/legacyWorkflowActions.js";

const portalMedicalReportAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

type SelectedEncounterForm = {
  encounter: PatientPortalMedicalReportEncounter;
  form: PatientPortalMedicalReportEncounterForm;
  selectionId: string;
};

test.describe("patient portal generated report encounter form selection parity @slice228 @workflow-patient-portal-report-forms @patients @portal @reports", () => {
  test("generates selected encounter form content in the customized medical history report", async ({
    targetDb,
    target,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMedicalReportAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-228-patient-portal-generated-report-form-selection-precondition",
      description: "Captures the Slice 228 portal generated-report encounter-form selection precondition: the signed-in anchor patient exists before resolving selectable encounter form rows.",
      expected: {
        canonicalId: portalMedicalReportAnchorPatientId,
        portalUsername: portalLoginUsername,
        preferredFormDisplays: ["Vitals", "SOAP"]
      },
      actual: {
        canonicalId: portalMedicalReportAnchorPatientId,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        portalUsername: portalLoginUsername
      },
      context: {
        suite: "workflow-patient-portal-report-forms",
        workflow: "patient-portal-generated-medical-report-form-selection-precondition"
      }
    });

    const reportBuilder = await workflow.getPatientPortalMedicalReport(portalLoginUsername, portalPassword);
    expect(reportBuilder.authenticated).toBeTruthy();

    const selectedForms = selectEncounterForms(reportBuilder);

    const generated = await workflow.generatePatientPortalMedicalReport(portalLoginUsername, portalPassword, {
      sectionIds: ["demographics", "billing"],
      encounterFormIds: selectedForms.map((item) => item.selectionId),
      procedureOrderIds: [],
      issueIds: []
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
      includedProcedureOrderIds: [],
      includedIssueIds: [],
      printableVersionAvailable: true,
      pdfDownloadAvailable: true,
      reportSectionCount: 3,
      failureReason: null
    });
    expect([...generated.includedEncounterFormIds].sort()).toEqual([...selectedForms.map((item) => item.selectionId)].sort());
    expect(generated.reportSections.map((section) => section.title)).toEqual([
      "Patient Data",
      "Billing Information",
      "Encounter Forms"
    ]);

    const generatedText = generated.reportSections
      .flatMap((section) => [section.title, ...section.lines])
      .join("\n");
    for (const selectedForm of selectedForms) {
      expect(generatedText).toContain(`${selectedForm.form.display}: Encounter ${selectedForm.encounter.encounter}`);
      expect(generatedText).toContain(`form ${selectedForm.form.id}; directory ${selectedForm.form.formDirectory}`);
    }
    expect(generated.summaryLines.join("\n")).toContain("Encounter Forms: 2 selected for this customized report.");
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-228-patient-portal-generated-report-form-selection-result",
      description: "Captures the Slice 228 generated medical-report encounter-form selection projection, including selected encounter form IDs and resulting Encounter Forms section content.",
      expected: {
        displayName: "Kim, Nora",
        selectedFormCount: 2,
        selectedFormDisplays: selectedForms.map((item) => item.form.display),
        reportSectionTitles: [
          "Patient Data",
          "Billing Information",
          "Encounter Forms"
        ],
        summaryLine: "Encounter Forms: 2 selected for this customized report."
      },
      actual: {
        authenticated: generated.authenticated,
        username: generated.username,
        portalUsername: generated.portalUsername,
        pid: generated.pid,
        pubpid: generated.pubpid,
        displayName: generated.displayName,
        title: generated.title,
        includedSectionIds: generated.includedSectionIds,
        includedEncounterFormIds: generated.includedEncounterFormIds,
        includedProcedureOrderIds: generated.includedProcedureOrderIds,
        includedIssueIds: generated.includedIssueIds,
        selectedForms: selectedForms.map((item) => ({
          encounter: item.encounter.encounter,
          formId: item.form.id,
          display: item.form.display,
          formDirectory: item.form.formDirectory,
          selectionId: item.selectionId
        })),
        reportSectionCount: generated.reportSectionCount,
        reportSections: generated.reportSections,
        summaryLines: generated.summaryLines
      },
      context: {
        suite: "workflow-patient-portal-report-forms",
        workflow: "patient-portal-generated-medical-report-form-selection-result"
      }
    });
  });

  test("renders selected encounter form content on the portal generated report surface", async ({
    page,
    target,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    const reportBuilder = await workflow.getPatientPortalMedicalReport(portalLoginUsername, portalPassword);
    expect(reportBuilder.authenticated).toBeTruthy();
    const selectedForms = selectEncounterForms(reportBuilder);

    if (target.type === "legacy-openemr") {
      const legacySurface = await expectLegacySelectedEncounterFormReport(page, target, selectedForms);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-228-patient-portal-generated-report-form-selection-legacy-ui",
        description: "Captures the legacy OpenEMR selected encounter-form generated-report surface after POSTing formdir_formid checkbox selections.",
        expected: {
          page: "portal/report/portal_custom_report.php",
          selectedFormDisplays: selectedForms.map((item) => item.form.display),
          visibleFacts: [
            "Encounter Forms",
            ...selectedForms.map((item) => item.form.display)
          ]
        },
        actual: legacySurface,
        context: {
          suite: "workflow-patient-portal-report-forms",
          workflow: "patient-portal-generated-medical-report-form-selection-legacy-ui"
        }
      });
      return;
    }

    const modernizedSurface = await expectModernizedSelectedEncounterFormReport(page, target, selectedForms);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-228-patient-portal-generated-report-form-selection-modernized-ui",
      description: "Captures the modernized Portal selected encounter-form generated-report surface after checking encounter form selections and regenerating the report.",
      expected: {
        heading: "Patient portal generated medical report",
        selectedFormDisplays: selectedForms.map((item) => item.form.display),
        visibleFacts: [
          "Encounter Forms",
          ...selectedForms.map((item) => `${item.form.display}: Encounter ${item.encounter.encounter}`),
          "Encounter Forms: 2 selected for this customized report."
        ]
      },
      actual: modernizedSurface,
      context: {
        suite: "workflow-patient-portal-report-forms",
        workflow: "patient-portal-generated-medical-report-form-selection-modernized-ui"
      }
    });
  });
});

function selectEncounterForms(reportBuilder: PatientPortalMedicalReportResult): SelectedEncounterForm[] {
  const formChoices = reportBuilder.encounters.flatMap((encounter) =>
    encounter.forms.map((form) => ({
      encounter,
      form,
      selectionId: buildEncounterFormSelectionId(form)
    }))
  );
  const preferredChoices = formChoices.filter((item) => item.form.display === "Vitals" || item.form.display === "SOAP");
  const selectedForms = (preferredChoices.length >= 2 ? preferredChoices : formChoices).slice(0, 2);

  expect(selectedForms.length, "Expected at least two encounter forms for the portal medical report anchor").toBe(2);
  return selectedForms;
}

function buildEncounterFormSelectionId(form: PatientPortalMedicalReportEncounterForm): string {
  return `${form.formDirectory}_${form.id}`;
}

async function expectLegacySelectedEncounterFormReport(
  page: Page,
  target: RuntimeTarget,
  selectedForms: SelectedEncounterForm[]
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

  const form: Record<string, string> = {
    include_demographics: "demographics",
    include_billing: "billing"
  };
  for (const selectedForm of selectedForms) {
    const input = page.locator(
      `input[name='${selectedForm.selectionId}'][value='${selectedForm.encounter.encounter}']`
    );
    await expect(input, `Expected encounter form checkbox ${selectedForm.selectionId}`).toHaveCount(1);
    form[selectedForm.selectionId] = String(selectedForm.encounter.encounter);
  }

  const reportResponse = await page.request.post(`${target.publicUrl}/portal/report/portal_custom_report.php`, {
    form
  });
  expect(reportResponse.ok()).toBeTruthy();
  const reportHtml = await reportResponse.text();
  for (const selectedForm of selectedForms) {
    expect(reportHtml).toContain(selectedForm.form.display);
  }

  return {
    url: `${target.publicUrl}/portal/report/portal_custom_report.php`,
    selectedForms: selectedForms.map((item) => ({
      encounter: item.encounter.encounter,
      formId: item.form.id,
      display: item.form.display,
      formDirectory: item.form.formDirectory,
      selectionId: item.selectionId
    })),
    responseLength: reportHtml.length,
    containsFacts: Object.fromEntries(
      selectedForms.map((item) => [item.form.display, reportHtml.includes(item.form.display)])
    )
  };
}

async function expectModernizedSelectedEncounterFormReport(
  page: Page,
  target: RuntimeTarget,
  selectedForms: SelectedEncounterForm[]
) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);

  for (const selectedForm of selectedForms) {
    await page
      .getByRole("checkbox", {
        name: `Include ${selectedForm.form.display} form ${selectedForm.form.id} from encounter ${selectedForm.encounter.encounter} in generated report`
      })
      .check();
  }

  await page.getByRole("button", { name: "Generate report" }).click();
  const generatedReportRegion = page.getByRole("region", { name: "Patient portal generated medical report" });
  await expect(generatedReportRegion).toContainText("Encounter Forms");
  for (const selectedForm of selectedForms) {
    await expect(generatedReportRegion).toContainText(`${selectedForm.form.display}: Encounter ${selectedForm.encounter.encounter}`);
    await expect(generatedReportRegion).toContainText(`form ${selectedForm.form.id}; directory ${selectedForm.form.formDirectory}`);
  }
  await expect(generatedReportRegion).toContainText("Encounter Forms: 2 selected for this customized report.");

  return {
    url: page.url(),
    selectedForms: selectedForms.map((item) => ({
      encounter: item.encounter.encounter,
      formId: item.form.id,
      display: item.form.display,
      formDirectory: item.form.formDirectory,
      selectionId: item.selectionId
    })),
    regionText: await generatedReportRegion.innerText()
  };
}
