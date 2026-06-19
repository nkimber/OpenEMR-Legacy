import { expect, type Page } from "@playwright/test";
import type { RuntimeTarget } from "../config/targets.js";

export async function loginToLegacyOpenEmr(page: Page, target: RuntimeTarget) {
  await page.goto(`${target.publicUrl}/interface/login/login.php?site=default`);
  await page.locator('input[name="authUser"]').fill(target.credentials.username);
  await page.locator('input[name="clearPass"]').fill(target.credentials.password);
  await page.locator('button[type="submit"], input[type="submit"]').first().click();
  await expect(page).toHaveTitle(/OpenEMR/i);
  await expect(page.locator("body")).toContainText(/OpenEMR|Patient/i);
}

export async function openPatientSummaryDirect(page: Page, target: RuntimeTarget, pid: number) {
  await page.goto(`${target.publicUrl}/interface/patient_file/summary/demographics.php?set_pid=${pid}`);
  await expect(page.locator("body")).toContainText(/Demographics|Patient|History/i);
}

export async function openPatientDemographicsEditDirect(page: Page, target: RuntimeTarget, pid: number) {
  await page.goto(`${target.publicUrl}/interface/patient_file/summary/demographics_full.php?set_pid=${pid}`);
  await expectRenderedText(page, /Demographics|First Name|Last Name/i);
}

export async function openPatientInsuranceBrowseDirect(
  page: Page,
  target: RuntimeTarget,
  pid: number,
  type: "primary" | "secondary" | "tertiary" = "primary"
) {
  await page.goto(`${target.publicUrl}/interface/patient_file/summary/browse.php?browsenum=1&set_pid=${pid}`);
  await expectRenderedText(page, /Insurance Provider|Policy Number/i);

  if (type !== "primary") {
    await page.locator('select[name="insurance"]').selectOption(type);
    await expect(page.locator('select[name="insurance"]')).toHaveValue(type);
    await expectRenderedText(page, /Insurance Provider|Policy Number/i);
  }
}

export async function openPatientImmunizationsDirect(page: Page, target: RuntimeTarget, pid: number) {
  await openPatientSummaryDirect(page, target, pid);
  await page.goto(`${target.publicUrl}/interface/patient_file/summary/immunizations.php`);
  await expectRenderedText(page, /Immunizations|Vaccine|Lot Number/i);
}

export async function openPatientNotesDirect(page: Page, target: RuntimeTarget, pid: number) {
  await page.goto(`${target.publicUrl}/interface/patient_file/summary/pnotes_full.php?set_pid=${pid}`);
  await expectRenderedText(page, /Patient Notes|Messages|Notes/i);
}

export async function openPatientDocumentsDirect(page: Page, target: RuntimeTarget, pid: number) {
  await page.goto(`${target.publicUrl}/controller.php?document&list&patient_id=${pid}`);
  await expectRenderedText(page, /Documents|Patient Documents|Document/i);
}

export async function expandPatientDocumentCategories(page: Page, categoryNames: string[]) {
  for (const categoryName of categoryNames) {
    const categoryLink = page.locator("a", { hasText: categoryName }).first();
    await expect(categoryLink).toBeVisible();
    const expander = categoryLink.locator('xpath=ancestor::nobr[1]/img[contains(@src, "plus.gif")]').first();
    if ((await expander.count()) > 0) {
      await expander.click();
    }
  }
}

export async function openEncounterDirect(page: Page, target: RuntimeTarget, pid: number, encounter: number) {
  await page.goto(`${target.publicUrl}/interface/patient_file/encounter/encounter_top.php?set_pid=${pid}&set_encounter=${encounter}`);
  await expectRenderedText(page, /Encounter|Summary/i);
}

export async function openAppointmentDirect(page: Page, target: RuntimeTarget, appointmentId: number | string) {
  await page.goto(`${target.publicUrl}/interface/main/calendar/add_edit_event.php?eid=${appointmentId}`);
  await expect(page).toHaveTitle(/Edit Event/i);
}

export async function openFeeSheetDirect(page: Page, target: RuntimeTarget, pid: number, encounter: number) {
  await page.goto(`${target.publicUrl}/interface/forms/fee_sheet/new.php?pid=${pid}&encounter=${encounter}`);
  await expectRenderedText(page, /Fee Sheet/i);
}

export async function openProcedureResultsDirect(page: Page, target: RuntimeTarget, pid: number) {
  await page.goto(`${target.publicUrl}/interface/orders/orders_results.php?pid=${pid}`);
  await expect(page).toHaveTitle(/Procedure Results/i);
}

export async function openProcedureOrdersAndReportsForPatient(
  page: Page,
  target: RuntimeTarget,
  pid: number,
  fromDate: string,
  toDate: string
) {
  await openPatientSummaryDirect(page, target, pid);
  await page.goto(`${target.publicUrl}/interface/orders/list_reports.php`);
  await expectRenderedText(page, /Procedure Orders and Reports/i);
  await page.locator('input[name="form_from_date"]').fill(fromDate);
  await page.locator('input[name="form_to_date"]').fill(toDate);
  await page.locator('input[name="form_patient"]').check();
  await page.locator('select[name="form_reviewed"]').selectOption("5");
  await page.getByRole("button", { name: /Filter/i }).click();
  await expectRenderedText(page, /Procedure Orders and Reports/i);
}

export async function openUserAdministrationDirect(page: Page, target: RuntimeTarget) {
  await page.goto(`${target.publicUrl}/interface/usergroup/usergroup_admin.php`);
  await expectRenderedText(page, /Users|Add User/i);
}

export async function openFacilitiesDirect(page: Page, target: RuntimeTarget) {
  await page.goto(`${target.publicUrl}/interface/usergroup/facilities.php`);
  await expectRenderedText(page, /Facilities|Facility/i);
}

export async function openAccessControlDirect(page: Page, target: RuntimeTarget) {
  await page.goto(`${target.publicUrl}/interface/usergroup/adminacl.php`);
  await expectRenderedText(page, /Access Control List Administration|Groups and Access Controls/i);
}

export async function openPatientListReportDirect(page: Page, target: RuntimeTarget) {
  await page.goto(`${target.publicUrl}/interface/reports/patient_list.php`);
  await expectRenderedText(page, /Report|Patient List/i);
}

export async function openClinicalReportsDirect(page: Page, target: RuntimeTarget) {
  await page.goto(`${target.publicUrl}/interface/reports/clinical_reports.php`);
  await expectRenderedText(page, /Report - Clinical|Diagnosis/i);
}

export async function expectRenderedText(page: Page, expected: string | RegExp) {
  const text = expect.poll(async () => await collectRenderedText(page), { timeout: 10_000 });
  if (typeof expected === "string") {
    await text.toContain(expected);
  } else {
    await text.toMatch(expected);
  }
}

async function collectRenderedText(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  const frameTexts = await Promise.all(
    page.frames().map(async (frame) => {
      try {
        const bodyText = await frame.locator("body").innerText({ timeout: 2_500 });
        const fieldValues = await frame.locator("input, textarea, select").evaluateAll((elements) =>
          elements
            .map((element) => {
              if (element instanceof HTMLSelectElement) {
                return Array.from(element.selectedOptions)
                  .map((option) => option.textContent?.trim() || option.value)
                  .join(" ");
              }
              if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
                return element.value;
              }
              return "";
            })
            .filter(Boolean)
            .join(" ")
        );
        return `${bodyText} ${fieldValues}`;
      } catch {
        return "";
      }
    })
  );
  return frameTexts.join("\n").replace(/\s+/g, " ");
}
