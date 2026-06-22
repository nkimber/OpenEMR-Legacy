import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openFacilitiesDirect,
  openUserAdministrationDirect
} from "../../src/ui/legacyOpenEmr.js";

test.describe("administration directory parity @slice8 @admin", () => {
  test("stable administration directory has seeded users, roles, and facilities", async ({ targetDb }) => {
    const directory = await targetDb.getAdministrationDirectory();

    expect(directory.users).toHaveLength(20);
    expect(directory.facilities).toHaveLength(3);
    expect(directory.users.filter((user) => user.role === "provider")).toHaveLength(12);
    expect(directory.users.filter((user) => user.calendar)).toHaveLength(12);

    const provider = directory.users.find((user) => user.username === "gold-provider-02");
    expect(provider).toBeDefined();
    expect(provider!.role).toBe("provider");
    expect(provider!.authorized).toBe(true);
    expect(provider!.active).toBe(true);
    expect(provider!.calendar).toBe(true);
    expect(provider!.facilityName).toBe("North County Clinic");

    const billingUser = directory.users.find((user) => user.username === "gold-billing-01");
    expect(billingUser).toBeDefined();
    expect(billingUser!.role).toBe("billing");
    expect(billingUser!.authorized).toBe(false);
    expect(billingUser!.calendar).toBe(false);

    expect(directory.facilities.some((facility) => facility.code === "MAIN" && facility.name === "Modernization Family Medicine")).toBe(true);
    expect(directory.facilities.some((facility) => facility.code === "NORTH" && facility.name === "North County Clinic")).toBe(true);
    expect(directory.facilities.some((facility) => facility.code === "EAST" && facility.name === "East County Care Center")).toBe(true);
  });

  test("seeded users and facilities are visible in the application UI", async ({ page, target, targetDb }) => {
    const directory = await targetDb.getAdministrationDirectory();
    const provider = directory.users.find((user) => user.username === "gold-provider-02") ?? directory.users[0];
    const billingUser = directory.users.find((user) => user.username === "gold-billing-01") ?? directory.users[0];
    const mainFacility = directory.facilities.find((facility) => facility.code === "MAIN") ?? directory.facilities[0];
    const northFacility = directory.facilities.find((facility) => facility.code === "NORTH") ?? directory.facilities[0];

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openUserAdministrationDirect(page, target);

      await expectRenderedText(page, provider.username);
      await expectRenderedText(page, provider.firstName);
      await expectRenderedText(page, provider.lastName);
      await expectRenderedText(page, billingUser.username);

      await openFacilitiesDirect(page, target);
      await expectRenderedText(page, mainFacility.name);
      await expectRenderedText(page, northFacility.name);
      return;
    }

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Admin" }).click();
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
    await expect(page.locator("body")).toContainText("Sign in to load the users and facilities directory");

    const loginPanel = page.locator('form[aria-label="Login readiness"]');
    await loginPanel.getByLabel("Username").fill(target.credentials.username);
    await loginPanel.getByLabel("Password").fill(target.credentials.password);
    await loginPanel.getByRole("button", { name: "Verify Login" }).click();

    await expect(page.locator("body")).toContainText("Administration Directory");
    await expect(page.locator("body")).toContainText("Users And Facilities");
    await expect(page.locator("body")).toContainText(provider.username);
    await expect(page.locator("body")).toContainText(provider.displayName);
    await expect(page.locator("body")).toContainText(provider.facilityName);
    await expect(page.locator("body")).toContainText(billingUser.username);
    await expect(page.locator("body")).toContainText(mainFacility.name);
    await expect(page.locator("body")).toContainText(northFacility.name);
    await expect(page.locator("body")).toContainText("Access Control Status");
    await expect(page.locator("body")).toContainText("Default ACL model mirrored");
  });
});
