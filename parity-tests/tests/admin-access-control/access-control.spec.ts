import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openAccessControlDirect } from "../../src/ui/legacyOpenEmr.js";

test.describe("administration access-control parity @slice20 @admin-access-control", () => {
  test("stable ACL groups and permissions match the legacy default matrix", async ({ page, target, targetDb }, testInfo) => {
    const accessControl = await targetDb.getAdministrationAccessControl();
    const groupAnchors = {
      users: accessControl.groups.find((group) => group.value === "users") ?? null,
      admin: accessControl.groups.find((group) => group.value === "admin") ?? null,
      clinician: accessControl.groups.find((group) => group.value === "clin") ?? null,
      physician: accessControl.groups.find((group) => group.value === "doc") ?? null,
      frontOffice: accessControl.groups.find((group) => group.value === "front") ?? null,
      accounting: accessControl.groups.find((group) => group.value === "back") ?? null,
      emergencyLogin: accessControl.groups.find((group) => group.value === "breakglass") ?? null
    };
    const permissionAnchors = {
      aclAdministration:
        accessControl.permissions.find(
          (permission) =>
            permission.sectionValue === "admin" &&
            permission.value === "acl" &&
            permission.name === "ACL Administration"
        ) ?? null,
      patientDemographics:
        accessControl.permissions.find(
          (permission) =>
            permission.sectionValue === "patients" &&
            permission.value === "demo" &&
            permission.name === "Demographics (write,addonly optional)"
        ) ?? null,
      prescriptions:
        accessControl.permissions.find(
          (permission) =>
            permission.sectionValue === "patients" &&
            permission.value === "rx" &&
            permission.name === "Prescriptions (write,addonly optional)"
        ) ?? null,
      highSensitivity:
        accessControl.permissions.find(
          (permission) =>
            permission.sectionValue === "sensitivities" &&
            permission.value === "high" &&
            permission.name === "High"
        ) ?? null
    };
    const assignmentAnchors = {
      adminAcl:
        accessControl.groupPermissions.find(
          (assignment) =>
            assignment.groupValue === "admin" &&
            assignment.sectionValue === "admin" &&
            assignment.permissionValue === "acl" &&
            assignment.returnValue === "write"
        ) ?? null,
      breakglassSuper:
        accessControl.groupPermissions.find(
          (assignment) =>
            assignment.groupValue === "breakglass" &&
            assignment.sectionValue === "admin" &&
            assignment.permissionValue === "super" &&
            assignment.returnValue === "write"
        ) ?? null,
      physicianPrescriptions:
        accessControl.groupPermissions.find(
          (assignment) =>
            assignment.groupValue === "doc" &&
            assignment.sectionValue === "patients" &&
            assignment.permissionValue === "rx" &&
            assignment.returnValue === "write"
        ) ?? null,
      clinicianPatientReport:
        accessControl.groupPermissions.find(
          (assignment) =>
            assignment.groupValue === "clin" &&
            assignment.sectionValue === "patients" &&
            assignment.permissionValue === "pat_rep" &&
            assignment.returnValue === "view"
        ) ?? null,
      frontOfficeDemographics:
        accessControl.groupPermissions.find(
          (assignment) =>
            assignment.groupValue === "front" &&
            assignment.sectionValue === "patients" &&
            assignment.permissionValue === "demo" &&
            assignment.returnValue === "write"
        ) ?? null,
      accountingEob:
        accessControl.groupPermissions.find(
          (assignment) =>
            assignment.groupValue === "back" &&
            assignment.sectionValue === "acct" &&
            assignment.permissionValue === "eob" &&
            assignment.returnValue === "write"
        ) ?? null
    };
    const membershipAnchors = {
      admin:
        accessControl.userMemberships.find(
          (membership) =>
            membership.userValue === "admin" &&
            membership.groupValue === "admin" &&
            membership.groupName === "Administrators"
        ) ?? null,
      oeSystem:
        accessControl.userMemberships.find(
          (membership) =>
            membership.userValue === "oe-system" &&
            membership.groupValue === "admin" &&
            membership.groupName === "Administrators"
        ) ?? null,
      frontDesk:
        accessControl.userMemberships.find(
          (membership) =>
            membership.userValue === "gold-frontdesk-01" &&
            membership.groupValue === "front" &&
            membership.groupName === "Front Office"
        ) ?? null,
      provider:
        accessControl.userMemberships.find(
          (membership) =>
            membership.userValue === "gold-provider-01" &&
            membership.groupValue === "clin" &&
            membership.groupName === "Clinicians"
        ) ?? null
    };
    const expectedMembershipCount = target.type === "modernized-openemr" ? 4 : 2;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-20-access-control-matrix",
      description: "Captures the Slice 20 administration access-control read-model counts and ACL matrix anchors.",
      expected: {
        counts: {
          groups: 7,
          permissions: 65,
          groupPermissions: 203,
          userMemberships: expectedMembershipCount
        },
        groups: {
          requiredValues: ["users", "admin", "clin", "doc", "front", "back", "breakglass"]
        },
        permissions: {
          requiredObjects: ["admin:acl", "patients:demo", "patients:rx", "sensitivities:high"]
        },
        groupPermissions: {
          requiredAssignments: [
            "admin:admin:acl:write",
            "breakglass:admin:super:write",
            "doc:patients:rx:write",
            "clin:patients:pat_rep:view",
            "front:patients:demo:write",
            "back:acct:eob:write"
          ]
        },
        memberships: {
          requiredUsers:
            target.type === "modernized-openemr"
              ? ["admin", "oe-system", "gold-frontdesk-01", "gold-provider-01"]
              : ["admin", "oe-system"]
        }
      },
      actual: {
        accessControl,
        counts: {
          groups: accessControl.groups.length,
          permissions: accessControl.permissions.length,
          groupPermissions: accessControl.groupPermissions.length,
          userMemberships: accessControl.userMemberships.length
        },
        anchors: {
          groups: groupAnchors,
          permissions: permissionAnchors,
          groupPermissions: assignmentAnchors,
          memberships: membershipAnchors
        }
      },
      context: {
        suite: "admin-access-control",
        workflow: "administration-access-control"
      }
    });

    expect(accessControl.groups).toHaveLength(7);
    expect(accessControl.permissions).toHaveLength(65);
    expect(accessControl.groupPermissions).toHaveLength(203);
    expect(accessControl.userMemberships).toHaveLength(expectedMembershipCount);

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
    if (target.type === "modernized-openemr") {
      expect(accessControl.userMemberships).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userValue: "gold-frontdesk-01", groupValue: "front", groupName: "Front Office" }),
          expect.objectContaining({ userValue: "gold-provider-01", groupValue: "clin", groupName: "Clinicians" })
        ])
      );
    }

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-20-access-control-ui-precondition",
      description: "Captures the ACL matrix facts used before steering the Slice 20 administration access-control UI parity flow.",
      expected: {
        legacyText: ["User Memberships", "Groups and Access Controls"],
        modernizedText: [
          "Access Control Matrix",
          "Access memberships",
          "Administrators",
          "Physicians",
          "Clinicians",
          "Front Office",
          "ACL Administration",
          "patients:demo write"
        ]
      },
      actual: {
        anchors: {
          groups: groupAnchors,
          permissions: permissionAnchors,
          groupPermissions: assignmentAnchors,
          memberships: membershipAnchors
        }
      },
      context: {
        suite: "admin-access-control",
        workflow: "administration-access-control-ui"
      }
    });

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
    await expect(page.locator("body")).toContainText("Sign in to load the users and facilities directory");

    const loginPanel = page.locator('form[aria-label="Login readiness"]');
    await loginPanel.getByLabel("Username").fill(target.credentials.username);
    await loginPanel.getByLabel("Password").fill(target.credentials.password);
    await loginPanel.getByRole("button", { name: "Verify Login" }).click();

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
