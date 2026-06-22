import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openAccessControlDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedAdmin } from "../../src/ui/modernizedOpenEmr.js";

test.describe("access-control permission mutation parity @slice21 @workflow-admin-access @mutation", () => {
  test("revokes, renders, restores, and verifies a group permission assignment", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
    const assignment = {
      groupValue: "front",
      sectionValue: "patients",
      permissionValue: "demo",
      returnValue: "write"
    };

    const original = await workflow.getAccessPermissionAssignment(assignment);
    expect(original).toMatchObject({
      ...assignment,
      permissionName: "Demographics (write,addonly optional)"
    });

    try {
      await workflow.revokeAccessPermission(assignment);
      await expect(workflow.getAccessPermissionAssignment(assignment)).resolves.toBeNull();

      const afterRevoke = await targetDb.getAdministrationAccessControl();
      expect(afterRevoke.groupPermissions).toHaveLength(202);
      expect(afterRevoke.groups).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ value: "front", name: "Front Office", permissionCount: 5 })
        ])
      );

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAccessControlDirect(page, target);
        await expectRenderedText(page, /Groups and Access Controls/i);
      } else {
        await openAuthenticatedModernizedAdmin(page, target);
        await expect(page.locator("body")).toContainText("Access Control Matrix");
        await expect(page.locator("body")).toContainText("Front Office");
        await expect(page.locator("body")).toContainText("5 permissions");
      }

      await workflow.grantAccessPermission(assignment);
      await expect(workflow.getAccessPermissionAssignment(assignment)).resolves.toMatchObject(original!);

      const afterRestore = await targetDb.getAdministrationAccessControl();
      expect(afterRestore.groupPermissions).toHaveLength(203);
      expect(afterRestore.groups).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ value: "front", name: "Front Office", permissionCount: 6 })
        ])
      );

      if (target.type === "legacy-openemr") {
        await openAccessControlDirect(page, target);
        await expectRenderedText(page, /Access Control List Administration|Groups and Access Controls/i);
      } else {
        await openAuthenticatedModernizedAdmin(page, target);
        await expect(page.locator("body")).toContainText("6 permissions");
        await expect(page.locator("body")).toContainText("patients:demo write");
      }
    } finally {
      await workflow.grantAccessPermission(assignment);
    }
  });
});
