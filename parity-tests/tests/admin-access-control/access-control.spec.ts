import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openAccessControlDirect } from "../../src/ui/legacyOpenEmr.js";

test.describe("administration access-control parity @slice20 @admin-access-control", () => {
  test("stable ACL groups and permissions match the legacy default matrix", async ({ page, target, targetDb }) => {
    const accessControl = await targetDb.getAdministrationAccessControl();

    expect(accessControl.groups).toHaveLength(7);
    expect(accessControl.permissions).toHaveLength(65);
    expect(accessControl.groupPermissions).toHaveLength(203);
    expect(accessControl.userMemberships).toHaveLength(2);

    expect(accessControl.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "users", name: "OpenEMR Users", parentId: null, permissionCount: 0 }),
        expect.objectContaining({ value: "admin", name: "Administrators", parentId: 10, permissionCount: 64 }),
        expect.objectContaining({ value: "clin", name: "Clinicians", parentId: 10, permissionCount: 23 }),
        expect.objectContaining({ value: "doc", name: "Physicians", parentId: 10, permissionCount: 31 }),
        expect.objectContaining({ value: "front", name: "Front Office", parentId: 10, permissionCount: 6 }),
        expect.objectContaining({ value: "back", name: "Accounting", parentId: 10, permissionCount: 15 }),
        expect.objectContaining({ value: "breakglass", name: "Emergency Login", parentId: 10, permissionCount: 64 })
      ])
    );

    expect(accessControl.permissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sectionValue: "admin", value: "acl", name: "ACL Administration" }),
        expect.objectContaining({ sectionValue: "patients", value: "demo", name: "Demographics (write,addonly optional)" }),
        expect.objectContaining({ sectionValue: "patients", value: "rx", name: "Prescriptions (write,addonly optional)" }),
        expect.objectContaining({ sectionValue: "sensitivities", value: "high", name: "High" })
      ])
    );

    expect(accessControl.groupPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ groupValue: "admin", sectionValue: "admin", permissionValue: "acl", returnValue: "write" }),
        expect.objectContaining({ groupValue: "breakglass", sectionValue: "admin", permissionValue: "super", returnValue: "write" }),
        expect.objectContaining({ groupValue: "doc", sectionValue: "patients", permissionValue: "rx", returnValue: "write" }),
        expect.objectContaining({ groupValue: "clin", sectionValue: "patients", permissionValue: "pat_rep", returnValue: "view" }),
        expect.objectContaining({ groupValue: "front", sectionValue: "patients", permissionValue: "demo", returnValue: "write" }),
        expect.objectContaining({ groupValue: "back", sectionValue: "acct", permissionValue: "eob", returnValue: "write" })
      ])
    );

    expect(accessControl.userMemberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userValue: "admin", groupValue: "admin", groupName: "Administrators" }),
        expect.objectContaining({ userValue: "oe-system", groupValue: "admin", groupName: "Administrators" })
      ])
    );

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openAccessControlDirect(page, target);
      await expectRenderedText(page, "User Memberships");
      await expectRenderedText(page, "Groups and Access Controls");
      return;
    }

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Admin" }).click();
    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
    await expect(page.locator("body")).toContainText("Access Control Matrix");
    await expect(page.locator("body")).toContainText("Access memberships");
    await expect(page.locator("body")).toContainText("Administrators");
    await expect(page.locator("body")).toContainText("Physicians");
    await expect(page.locator("body")).toContainText("Clinicians");
    await expect(page.locator("body")).toContainText("Front Office");
    await expect(page.locator("body")).toContainText("ACL Administration");
    await expect(page.locator("body")).toContainText("patients:demo write");
  });
});
