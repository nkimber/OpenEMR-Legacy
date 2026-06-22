import { expect, type Page } from "@playwright/test";
import type { RuntimeTarget } from "../config/targets.js";

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
