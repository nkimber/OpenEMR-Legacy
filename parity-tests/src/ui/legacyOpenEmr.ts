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

export async function openPatientNotesDirect(page: Page, target: RuntimeTarget, pid: number) {
  await page.goto(`${target.publicUrl}/interface/patient_file/summary/pnotes_full.php?set_pid=${pid}`);
  await expectRenderedText(page, /Patient Notes|Messages|Notes/i);
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
        return await frame.locator("body").innerText({ timeout: 2_500 });
      } catch {
        return "";
      }
    })
  );
  return frameTexts.join("\n").replace(/\s+/g, " ");
}
