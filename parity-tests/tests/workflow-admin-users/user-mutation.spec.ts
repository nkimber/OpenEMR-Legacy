import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openUserAdministrationDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedAdmin } from "../../src/ui/modernizedOpenEmr.js";

test.describe("user administration mutation parity @slice19 @workflow-admin-users @mutation", () => {
  test("creates, updates, renders, deactivates, and removes an administration user", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const suffix = workflowSuffix();
    const user = {
      username: `slice19-${suffix.toLowerCase()}`,
      firstName: "Morgan",
      lastName: `Parity${suffix.slice(-4)}`,
      role: "frontdesk",
      calendar: false,
      facilityId: 10,
      email: `slice19-${suffix.toLowerCase()}@example.test`,
      npi: "",
      active: true
    };
    const updatedUser = {
      ...user,
      lastName: `${user.lastName} Inactive`,
      active: false
    };

    const beforeTempUsers = await countTemporaryUsers(target.type, targetDb);
    let userId: number | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-19-admin-user-mutation-precondition",
      description: "Captures the Slice 19 administration user mutation starting count and proposed active user payload.",
      expected: {
        user: {
          usernamePrefix: "slice19-",
          firstName: "Morgan",
          role: "frontdesk",
          calendar: false,
          facilityId: 10,
          active: true
        },
        counts: {
          temporaryUsers: beforeTempUsers
        }
      },
      actual: {
        beforeTempUsers,
        proposed: user
      },
      context: {
        suite: "workflow-admin-users",
        workflow: "admin-user-mutation"
      }
    });

    try {
      userId = await workflow.createUser(user);
      const created = await workflow.getUser(userId);
      const afterCreateTempUsers = await countTemporaryUsers(target.type, targetDb);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-19-admin-user-mutation-created",
        description: "Captures the temporary active administration user row immediately after Slice 19 creates it, including the temporary user count increment.",
        expected: {
          user,
          counts: {
            temporaryUsers: beforeTempUsers + 1
          }
        },
        actual: {
          beforeTempUsers,
          afterCreateTempUsers,
          userId,
          created
        },
        context: {
          suite: "workflow-admin-users",
          workflow: "admin-user-mutation-created"
        }
      });

      expect(created).toMatchObject(user);
      expect(afterCreateTempUsers).toBe(beforeTempUsers + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openUserAdministrationDirect(page, target);
        await expectRenderedText(page, user.username);
        await expectRenderedText(page, user.firstName);
        await expectRenderedText(page, user.lastName);
      } else {
        await openAuthenticatedModernizedAdmin(page, target);
        await expect(page.locator("body")).toContainText(user.username);
        await expect(page.locator("body")).toContainText(`${user.lastName}, ${user.firstName}`);
      }

      await workflow.updateUser(userId, updatedUser);
      const updated = await workflow.getUser(userId);
      const afterUpdateTempUsers = await countTemporaryUsers(target.type, targetDb);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-19-admin-user-mutation-deactivated",
        description: "Captures the temporary administration user row after Slice 19 updates the last name and deactivates it before cleanup.",
        expected: {
          user: updatedUser,
          counts: {
            temporaryUsers: beforeTempUsers + 1
          }
        },
        actual: {
          beforeTempUsers,
          afterUpdateTempUsers,
          userId,
          created,
          updated
        },
        context: {
          suite: "workflow-admin-users",
          workflow: "admin-user-mutation-deactivated"
        }
      });

      expect(updated).toMatchObject(updatedUser);
      expect(afterUpdateTempUsers).toBe(beforeTempUsers + 1);

      if (target.type === "legacy-openemr") {
        await openUserAdministrationDirect(page, target);
        await expectRenderedText(page, "Include inactive users");
        await expect(page.locator("body")).not.toContainText(updatedUser.username);
      } else {
        await openAuthenticatedModernizedAdmin(page, target);
        await expect(page.locator("body")).toContainText("Users And Facilities");
        await expect(page.locator("body")).not.toContainText(updatedUser.username);
      }
    } finally {
      if (userId !== null) {
        await workflow.deleteUser(userId);
      }
    }

    const afterCleanupTempUsers = await countTemporaryUsers(target.type, targetDb);
    const deleted = userId !== null ? await workflow.getUser(userId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-19-admin-user-mutation-cleanup",
      description: "Captures the Slice 19 cleanup state after hard-deleting the temporary administration user.",
      expected: {
        counts: {
          temporaryUsers: beforeTempUsers
        },
        deletedUser: null
      },
      actual: {
        beforeTempUsers,
        afterCleanupTempUsers,
        userId,
        deleted
      },
      context: {
        suite: "workflow-admin-users",
        workflow: "admin-user-mutation-cleanup"
      }
    });

    expect(afterCleanupTempUsers).toBe(beforeTempUsers);
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
      ? "SELECT COUNT(*) AS count FROM users WHERE username LIKE 'slice19-%';"
      : "SELECT COUNT(*) AS count FROM staff WHERE username LIKE 'slice19-%';"
  );
  return Number(rows[0]?.count ?? 0);
}

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-12) || "local";
}
