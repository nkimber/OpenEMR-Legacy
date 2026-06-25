import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openFacilitiesDirect,
  openUserAdministrationDirect
} from "../../src/ui/legacyOpenEmr.js";

test.describe("administration directory parity @slice8 @admin", () => {
  test("stable administration directory has seeded users, roles, and facilities", async ({ target, targetDb }, testInfo) => {
    const directory = await targetDb.getAdministrationDirectory();
    const providers = directory.users.filter((user) => user.role === "provider");
    const calendarUsers = directory.users.filter((user) => user.calendar);
    const provider = directory.users.find((user) => user.username === "gold-provider-02") ?? null;
    const billingUser = directory.users.find((user) => user.username === "gold-billing-01") ?? null;
    const mainFacility = directory.facilities.find(
      (facility) => facility.code === "MAIN" && facility.name === "Modernization Family Medicine"
    ) ?? null;
    const northFacility = directory.facilities.find(
      (facility) => facility.code === "NORTH" && facility.name === "North County Clinic"
    ) ?? null;
    const eastFacility = directory.facilities.find(
      (facility) => facility.code === "EAST" && facility.name === "East County Care Center"
    ) ?? null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-8-administration-directory-anchor",
      description: "Verifies the Slice 8 administration directory seeded users, provider/calendar counts, and facility database facts.",
      expected: {
        users: {
          count: 20,
          providerCount: 12,
          calendarCount: 12
        },
        facilities: {
          count: 3,
          requiredCodes: ["MAIN", "NORTH", "EAST"]
        },
        selectedUsers: {
          provider: {
            username: "gold-provider-02",
            role: "provider",
            authorized: true,
            active: true,
            calendar: true,
            facilityName: "North County Clinic"
          },
          billing: {
            username: "gold-billing-01",
            role: "billing",
            authorized: false,
            calendar: false
          }
        }
      },
      actual: {
        directory,
        counts: {
          users: directory.users.length,
          facilities: directory.facilities.length,
          providers: providers.length,
          calendarUsers: calendarUsers.length
        },
        selected: {
          provider,
          billingUser,
          facilities: {
            main: mainFacility,
            north: northFacility,
            east: eastFacility
          }
        }
      },
      context: {
        suite: "admin",
        workflow: "administration-directory"
      }
    });

    expect(directory.users).toHaveLength(20);
    expect(directory.facilities).toHaveLength(3);
    expect(providers).toHaveLength(12);
    expect(calendarUsers).toHaveLength(12);

    expect(provider).not.toBeNull();
    expect(provider!.role).toBe("provider");
    expect(provider!.authorized).toBe(true);
    expect(provider!.active).toBe(true);
    expect(provider!.calendar).toBe(true);
    expect(provider!.facilityName).toBe("North County Clinic");

    expect(billingUser).not.toBeNull();
    expect(billingUser!.role).toBe("billing");
    expect(billingUser!.authorized).toBe(false);
    expect(billingUser!.calendar).toBe(false);

    expect(mainFacility).not.toBeNull();
    expect(northFacility).not.toBeNull();
    expect(eastFacility).not.toBeNull();
  });

  test("seeded users and facilities are visible in the application UI", async ({ page, target, targetDb }, testInfo) => {
    const directory = await targetDb.getAdministrationDirectory();
    const provider = directory.users.find((user) => user.username === "gold-provider-02") ?? directory.users[0] ?? null;
    const billingUser = directory.users.find((user) => user.username === "gold-billing-01") ?? directory.users[0] ?? null;
    const mainFacility = directory.facilities.find((facility) => facility.code === "MAIN") ?? directory.facilities[0] ?? null;
    const northFacility = directory.facilities.find((facility) => facility.code === "NORTH") ?? directory.facilities[0] ?? null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-8-administration-directory-ui-precondition",
      description: "Captures the users and facilities database rows used before steering the Slice 8 administration directory UI parity flow.",
      expected: {
        users: {
          count: 20,
          requiredUsernames: ["gold-provider-02", "gold-billing-01"]
        },
        facilities: {
          count: 3,
          requiredCodes: ["MAIN", "NORTH"]
        }
      },
      actual: {
        directory,
        selected: {
          provider,
          billingUser,
          facilities: {
            main: mainFacility,
            north: northFacility
          }
        }
      },
      context: {
        suite: "admin",
        workflow: "administration-directory-ui"
      }
    });

    expect(provider).not.toBeNull();
    expect(billingUser).not.toBeNull();
    expect(mainFacility).not.toBeNull();
    expect(northFacility).not.toBeNull();

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openUserAdministrationDirect(page, target);

      await expectRenderedText(page, provider!.username);
      await expectRenderedText(page, provider!.firstName);
      await expectRenderedText(page, provider!.lastName);
      await expectRenderedText(page, billingUser!.username);

      await openFacilitiesDirect(page, target);
      await expectRenderedText(page, mainFacility!.name);
      await expectRenderedText(page, northFacility!.name);
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
    await expect(page.locator("body")).toContainText(provider!.username);
    await expect(page.locator("body")).toContainText(provider!.displayName);
    await expect(page.locator("body")).toContainText(provider!.facilityName);
    await expect(page.locator("body")).toContainText(billingUser!.username);
    await expect(page.locator("body")).toContainText(mainFacility!.name);
    await expect(page.locator("body")).toContainText(northFacility!.name);
    await expect(page.locator("body")).toContainText("Access Control Status");
    await expect(page.locator("body")).toContainText("Admin ACL policy enforced");
  });
});
