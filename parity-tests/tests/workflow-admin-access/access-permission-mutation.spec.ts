import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openAccessControlDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedAdmin } from "../../src/ui/modernizedOpenEmr.js";

test.describe("access-control permission mutation parity @slice21 @workflow-admin-access @mutation", () => {
  test("revokes, renders, restores, and verifies a group permission assignment", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const assignment = {
      groupValue: "front",
      sectionValue: "patients",
      permissionValue: "demo",
      returnValue: "write"
    };

    const original = await workflow.getAccessPermissionAssignment(assignment);
    const beforeAccess = await targetDb.getAdministrationAccessControl();
    const beforeFrontOffice = beforeAccess.groups.find((group) => group.value === "front") ?? null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-21-access-permission-mutation-precondition",
      description: "Captures the Slice 21 focused ACL assignment before revoking the Front Office demographics permission.",
      expected: {
        assignment: {
          ...assignment,
          permissionName: "Demographics (write,addonly optional)"
        },
        counts: {
          groupPermissions: 203
        },
        frontOffice: {
          permissionCount: 6
        }
      },
      actual: {
        assignment,
        original,
        counts: {
          groups: beforeAccess.groups.length,
          permissions: beforeAccess.permissions.length,
          groupPermissions: beforeAccess.groupPermissions.length,
          userMemberships: beforeAccess.userMemberships.length
        },
        frontOffice: beforeFrontOffice
      },
      context: {
        suite: "workflow-admin-access",
        workflow: "access-permission-mutation"
      }
    });

    expect(original).toMatchObject({
      ...assignment,
      permissionName: "Demographics (write,addonly optional)"
    });

    try {
      await workflow.revokeAccessPermission(assignment);
      const revoked = await workflow.getAccessPermissionAssignment(assignment);
      expect(revoked).toBeNull();

      const afterRevoke = await targetDb.getAdministrationAccessControl();
      const revokedFrontOffice = afterRevoke.groups.find((group) => group.value === "front") ?? null;
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-21-access-permission-mutation-revoked",
        description: "Captures the Slice 21 ACL assignment state after revoking the Front Office demographics permission.",
        expected: {
          assignment: null,
          counts: {
            groupPermissions: 202
          },
          frontOffice: {
            permissionCount: 5
          }
        },
        actual: {
          assignment,
          revoked,
          counts: {
            groups: afterRevoke.groups.length,
            permissions: afterRevoke.permissions.length,
            groupPermissions: afterRevoke.groupPermissions.length,
            userMemberships: afterRevoke.userMemberships.length
          },
          frontOffice: revokedFrontOffice
        },
        context: {
          suite: "workflow-admin-access",
          workflow: "access-permission-mutation-revoked"
        }
      });

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
      const restored = await workflow.getAccessPermissionAssignment(assignment);
      expect(restored).toMatchObject(original!);

      const afterRestore = await targetDb.getAdministrationAccessControl();
      const restoredFrontOffice = afterRestore.groups.find((group) => group.value === "front") ?? null;
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-21-access-permission-mutation-restored",
        description: "Captures the Slice 21 ACL assignment state after restoring the Front Office demographics permission.",
        expected: {
          assignment: original,
          counts: {
            groupPermissions: 203
          },
          frontOffice: {
            permissionCount: 6
          }
        },
        actual: {
          assignment,
          original,
          restored,
          counts: {
            groups: afterRestore.groups.length,
            permissions: afterRestore.permissions.length,
            groupPermissions: afterRestore.groupPermissions.length,
            userMemberships: afterRestore.userMemberships.length
          },
          frontOffice: restoredFrontOffice
        },
        context: {
          suite: "workflow-admin-access",
          workflow: "access-permission-mutation-restored"
        }
      });

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

    const afterCleanup = await targetDb.getAdministrationAccessControl();
    const cleanupAssignment = await workflow.getAccessPermissionAssignment(assignment);
    const cleanupFrontOffice = afterCleanup.groups.find((group) => group.value === "front") ?? null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-21-access-permission-mutation-cleanup",
      description: "Captures the Slice 21 cleanup state after ensuring the Front Office demographics permission is restored.",
      expected: {
        assignment: original,
        counts: {
          groupPermissions: 203
        },
        frontOffice: {
          permissionCount: 6
        }
      },
      actual: {
        assignment,
        original,
        cleanupAssignment,
        counts: {
          groups: afterCleanup.groups.length,
          permissions: afterCleanup.permissions.length,
          groupPermissions: afterCleanup.groupPermissions.length,
          userMemberships: afterCleanup.userMemberships.length
        },
        frontOffice: cleanupFrontOffice
      },
      context: {
        suite: "workflow-admin-access",
        workflow: "access-permission-mutation-cleanup"
      }
    });

    expect(cleanupAssignment).toMatchObject(original!);
    expect(afterCleanup.groupPermissions).toHaveLength(203);
  });
});
