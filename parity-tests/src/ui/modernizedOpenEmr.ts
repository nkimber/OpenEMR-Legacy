import { expect, type Page } from "@playwright/test";
import type { RuntimeTarget } from "../config/targets.js";

export async function openAuthenticatedModernizedPatient(page: Page, target: RuntimeTarget, patientSearch?: string) {
  await page.goto(target.publicUrl);
  await expect(page.getByRole("heading", { name: "Patient/Client" })).toBeVisible();

  const accessPanel = page.locator('form[aria-label="Patient access"]');
  if ((await accessPanel.count()) > 0) {
    await accessPanel.getByLabel("Username").fill(target.credentials.username);
    await accessPanel.getByLabel("Password").fill(target.credentials.password);
    await accessPanel.getByRole("button", { name: "Verify Patient Access" }).click();
  }

  await expect(page.locator("body")).not.toContainText("Sign in to search patient charts");

  if (patientSearch) {
    await page.getByLabel("Search patients").fill(patientSearch);
  }
}

export async function openAuthenticatedModernizedAdmin(page: Page, target: RuntimeTarget) {
  await page.goto(target.publicUrl);
  await page.getByRole("button", { name: "Admin" }).click();
  await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();

  const loginPanel = page.locator('form[aria-label="Login readiness"]');
  await loginPanel.getByLabel("Username").fill(target.credentials.username);
  await loginPanel.getByLabel("Password").fill(target.credentials.password);
  await loginPanel.getByRole("button", { name: "Verify Login" }).click();

  await expect(page.locator("body")).toContainText("Administration Directory");
}

export async function openAuthenticatedModernizedReports(page: Page, target: RuntimeTarget) {
  await page.goto(target.publicUrl);
  await page.getByRole("button", { name: "Reports" }).click();
  await expect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();

  const accessPanel = page.locator('form[aria-label="Reports access"]');
  await accessPanel.getByLabel("Username").fill(target.credentials.username);
  await accessPanel.getByLabel("Password").fill(target.credentials.password);
  await accessPanel.getByRole("button", { name: "Verify Reports Access" }).click();

  await expect(page.locator("body")).toContainText("Gold Data Snapshot");
}
