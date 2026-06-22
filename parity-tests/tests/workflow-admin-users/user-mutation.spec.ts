import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openUserAdministrationDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedAdmin } from "../../src/ui/modernizedOpenEmr.js";

test.describe("user administration mutation parity @slice19 @workflow-admin-users @mutation", () => {
  test("creates, updates, renders, deactivates, and removes an administration user", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
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

    try {
      userId = await workflow.createUser(user);
      await expect(workflow.getUser(userId)).resolves.toMatchObject(user);
      await expect(countTemporaryUsers(target.type, targetDb)).resolves.toBe(beforeTempUsers + 1);

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
      await expect(workflow.getUser(userId)).resolves.toMatchObject(updatedUser);

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

    await expect(countTemporaryUsers(target.type, targetDb)).resolves.toBe(beforeTempUsers);
    if (userId !== null) {
      await expect(workflow.getUser(userId)).resolves.toBeNull();
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
