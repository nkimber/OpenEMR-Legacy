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
