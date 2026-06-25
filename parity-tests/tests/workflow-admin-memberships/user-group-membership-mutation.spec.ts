import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openAccessControlDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedAdmin } from "../../src/ui/modernizedOpenEmr.js";

test.describe("user group membership mutation parity @slice22 @workflow-admin-memberships @mutation", () => {
  test("creates a user, assigns access group membership, renders it, revokes it, and cleans up", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
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
    let userId: number | null = null;

    try {
      userId = await workflow.createUser(user);
      await expect(workflow.getUser(userId)).resolves.toMatchObject(user);
      await expect(workflow.getAccessGroupMembership(membership)).resolves.toBeNull();

      await workflow.grantAccessGroupMembership(membership);
      await expect(workflow.getAccessGroupMembership(membership)).resolves.toMatchObject({
        userValue: user.username,
        groupValue: "front",
        groupName: "Front Office"
      });

      const afterGrant = await targetDb.getAdministrationAccessControl();
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
      await expect(workflow.getAccessGroupMembership(membership)).resolves.toBeNull();

      const afterRevoke = await targetDb.getAdministrationAccessControl();
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
    expect(afterCleanup.userMemberships).toHaveLength(beforeAccess.userMemberships.length);
    if (userId !== null) {
      await expect(workflow.getUser(userId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-12) || "local";
}
