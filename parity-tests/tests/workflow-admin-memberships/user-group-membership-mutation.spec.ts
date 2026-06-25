import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openAccessControlDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedAdmin } from "../../src/ui/modernizedOpenEmr.js";

test.describe("user group membership mutation parity @slice22 @workflow-admin-memberships @mutation", () => {
  test("creates a user, assigns access group membership, renders it, revokes it, and cleans up", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const suffix = workflowSuffix();
    const user = {
      username: `slice22-${suffix.toLowerCase()}`,
      firstName: "Riley",
      lastName: `Member${suffix.slice(-4)}`,
      role: "frontdesk",
      calendar: false,
      facilityId: 10,
      email: `slice22-${suffix.toLowerCase()}@example.test`,
      npi: "",
      active: true
    };
    const membership = {
      userValue: user.username,
      groupValue: "front"
    };

    const beforeAccess = await targetDb.getAdministrationAccessControl();
    const beforeTempUsers = await countTemporaryUsers(target.type, targetDb);
    let userId: number | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-22-user-group-membership-mutation-precondition",
      description: "Captures the Slice 22 proposed temporary user and baseline ACL membership counts before creating the user.",
      expected: {
        user: {
          usernamePrefix: "slice22-",
          firstName: "Riley",
          role: "frontdesk",
          facilityId: 10,
          active: true
        },
        membership: {
          groupValue: "front",
          groupName: "Front Office"
        },
        counts: {
          temporaryUsers: beforeTempUsers,
          userMemberships: beforeAccess.userMemberships.length
        }
      },
      actual: {
        proposedUser: user,
        proposedMembership: membership,
        beforeTempUsers,
        counts: {
          groups: beforeAccess.groups.length,
          permissions: beforeAccess.permissions.length,
          groupPermissions: beforeAccess.groupPermissions.length,
          userMemberships: beforeAccess.userMemberships.length
        }
      },
      context: {
        suite: "workflow-admin-memberships",
        workflow: "user-group-membership-mutation"
      }
    });

    try {
      userId = await workflow.createUser(user);
      const created = await workflow.getUser(userId);
      const beforeGrantMembership = await workflow.getAccessGroupMembership(membership);
      const afterCreateTempUsers = await countTemporaryUsers(target.type, targetDb);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-22-user-group-membership-mutation-created",
        description: "Captures the temporary Slice 22 user after creation and before assigning Front Office membership.",
        expected: {
          user,
          membership: null,
          counts: {
            temporaryUsers: beforeTempUsers + 1,
            userMemberships: beforeAccess.userMemberships.length
          }
        },
        actual: {
          beforeTempUsers,
          afterCreateTempUsers,
          userId,
          created,
          beforeGrantMembership
        },
        context: {
          suite: "workflow-admin-memberships",
          workflow: "user-group-membership-mutation-created"
        }
      });

      expect(created).toMatchObject(user);
      expect(beforeGrantMembership).toBeNull();
      expect(afterCreateTempUsers).toBe(beforeTempUsers + 1);

      await workflow.grantAccessGroupMembership(membership);
      const grantedMembership = await workflow.getAccessGroupMembership(membership);
      expect(grantedMembership).toMatchObject({
        userValue: user.username,
        groupValue: "front",
        groupName: "Front Office"
      });

      const afterGrant = await targetDb.getAdministrationAccessControl();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-22-user-group-membership-mutation-granted",
        description: "Captures the temporary Slice 22 user's Front Office ACL membership immediately after assignment.",
        expected: {
          membership: {
            userValue: user.username,
            groupValue: "front",
            groupName: "Front Office"
          },
          counts: {
            userMemberships: beforeAccess.userMemberships.length + 1
          }
        },
        actual: {
          membership,
          grantedMembership,
          counts: {
            groups: afterGrant.groups.length,
            permissions: afterGrant.permissions.length,
            groupPermissions: afterGrant.groupPermissions.length,
            userMemberships: afterGrant.userMemberships.length
          },
          matchingMemberships: afterGrant.userMemberships.filter(
            (entry) => entry.userValue === user.username && entry.groupValue === "front"
          )
        },
        context: {
          suite: "workflow-admin-memberships",
          workflow: "user-group-membership-mutation-granted"
        }
      });

      expect(afterGrant.userMemberships).toHaveLength(beforeAccess.userMemberships.length + 1);
      expect(afterGrant.userMemberships).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userValue: user.username, groupValue: "front", groupName: "Front Office" })
        ])
      );

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAccessControlDirect(page, target);
        await expectRenderedText(page, /Access Control List Administration|Groups and Access Controls/i);
      } else {
        await openAuthenticatedModernizedAdmin(page, target);
        const userCard = page.locator(".admin-user-card", { hasText: user.username }).first();
        await expect(userCard).toBeVisible();
        await expect(userCard).toContainText("Front Office membership");
      }

      await workflow.revokeAccessGroupMembership(membership);
      const revokedMembership = await workflow.getAccessGroupMembership(membership);
      expect(revokedMembership).toBeNull();

      const afterRevoke = await targetDb.getAdministrationAccessControl();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-22-user-group-membership-mutation-revoked",
        description: "Captures the temporary Slice 22 user after Front Office membership is revoked but before cleanup removes the user.",
        expected: {
          membership: null,
          counts: {
            temporaryUsers: beforeTempUsers + 1,
            userMemberships: beforeAccess.userMemberships.length
          }
        },
        actual: {
          membership,
          revokedMembership,
          afterRevokeTempUsers: await countTemporaryUsers(target.type, targetDb),
          counts: {
            groups: afterRevoke.groups.length,
            permissions: afterRevoke.permissions.length,
            groupPermissions: afterRevoke.groupPermissions.length,
            userMemberships: afterRevoke.userMemberships.length
          },
          matchingMemberships: afterRevoke.userMemberships.filter(
            (entry) => entry.userValue === user.username && entry.groupValue === "front"
          )
        },
        context: {
          suite: "workflow-admin-memberships",
          workflow: "user-group-membership-mutation-revoked"
        }
      });

      expect(afterRevoke.userMemberships).toHaveLength(beforeAccess.userMemberships.length);
      expect(afterRevoke.userMemberships).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userValue: user.username, groupValue: "front" })
        ])
      );

      if (target.type !== "legacy-openemr") {
        await openAuthenticatedModernizedAdmin(page, target);
        const userCard = page.locator(".admin-user-card", { hasText: user.username }).first();
        await expect(userCard).toBeVisible();
        await expect(userCard).not.toContainText("Front Office membership");
      }
    } finally {
      await workflow.revokeAccessGroupMembership(membership);
      if (userId !== null) {
        await workflow.deleteUser(userId);
      }
    }

    const afterCleanup = await targetDb.getAdministrationAccessControl();
    const afterCleanupTempUsers = await countTemporaryUsers(target.type, targetDb);
    const cleanupMembership = await workflow.getAccessGroupMembership(membership);
    const deleted = userId !== null ? await workflow.getUser(userId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-22-user-group-membership-mutation-cleanup",
      description: "Captures the Slice 22 cleanup state after revoking membership and hard-deleting the temporary user.",
      expected: {
        membership: null,
        deletedUser: null,
        counts: {
          temporaryUsers: beforeTempUsers,
          userMemberships: beforeAccess.userMemberships.length
        }
      },
      actual: {
        membership,
        cleanupMembership,
        beforeTempUsers,
        afterCleanupTempUsers,
        userId,
        deleted,
        counts: {
          groups: afterCleanup.groups.length,
          permissions: afterCleanup.permissions.length,
          groupPermissions: afterCleanup.groupPermissions.length,
          userMemberships: afterCleanup.userMemberships.length
        }
      },
      context: {
        suite: "workflow-admin-memberships",
        workflow: "user-group-membership-mutation-cleanup"
      }
    });

    expect(afterCleanup.userMemberships).toHaveLength(beforeAccess.userMemberships.length);
    expect(afterCleanupTempUsers).toBe(beforeTempUsers);
    expect(cleanupMembership).toBeNull();
    if (userId !== null) {
      expect(deleted).toBeNull();
    }
  });
});

async function countTemporaryUsers(
  targetType: string,
  targetDb: { queryRows: <T extends Record<string, string>>(sql: string) => Promise<T[]> }
) {
  const rows = await targetDb.queryRows<{ count: string }>(
    targetType === "legacy-openemr"
      ? "SELECT COUNT(*) AS count FROM users WHERE username LIKE 'slice22-%';"
      : "SELECT COUNT(*) AS count FROM staff WHERE username LIKE 'slice22-%';"
  );
  return Number(rows[0]?.count ?? 0);
}

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-12) || "local";
}
