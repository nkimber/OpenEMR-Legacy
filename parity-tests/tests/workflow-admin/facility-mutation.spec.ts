import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openFacilitiesDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedAdmin } from "../../src/ui/modernizedOpenEmr.js";

test.describe("facility administration mutation parity @slice18 @workflow-admin @mutation", () => {
  test("creates, updates, renders, deactivates, and removes an administration facility", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const suffix = workflowSuffix();
    const facility = {
      code: `P${suffix.slice(-8).toUpperCase()}`,
      name: `Parity Facility ${suffix}`,
      phone: "(619) 555-0199",
      street: "900 Parity Way",
      city: "San Diego",
      state: "CA",
      postalCode: "92109",
      color: "#356f9f",
      active: true
    };
    const updatedFacility = {
      ...facility,
      name: `Parity Facility ${suffix} Inactive`,
      phone: "(619) 555-0299",
      active: false
    };

    const beforeTempFacilities = await countTemporaryFacilities(target.type, targetDb);
    let facilityId: number | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-18-admin-facility-mutation-precondition",
      description: "Captures the Slice 18 administration facility mutation starting count and proposed active facility payload.",
      expected: {
        facility: {
          codePrefix: "P",
          namePrefix: "Parity Facility",
          active: true,
          state: "CA",
          postalCode: "92109"
        },
        counts: {
          temporaryFacilities: beforeTempFacilities
        }
      },
      actual: {
        beforeTempFacilities,
        proposed: facility
      },
      context: {
        suite: "workflow-admin",
        workflow: "admin-facility-mutation"
      }
    });

    try {
      facilityId = await workflow.createFacility(facility);
      const created = await workflow.getFacility(facilityId);
      const afterCreateTempFacilities = await countTemporaryFacilities(target.type, targetDb);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-18-admin-facility-mutation-created",
        description: "Captures the temporary active facility row immediately after Slice 18 creates it, including the temporary facility count increment.",
        expected: {
          facility,
          counts: {
            temporaryFacilities: beforeTempFacilities + 1
          }
        },
        actual: {
          beforeTempFacilities,
          afterCreateTempFacilities,
          facilityId,
          created
        },
        context: {
          suite: "workflow-admin",
          workflow: "admin-facility-mutation-created"
        }
      });

      expect(created).toMatchObject(facility);
      expect(afterCreateTempFacilities).toBe(beforeTempFacilities + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openFacilitiesDirect(page, target);
        await expectRenderedText(page, facility.name);
      } else {
        await openAuthenticatedModernizedAdmin(page, target);
        await expect(page.locator("body")).toContainText(facility.name);
        await expect(page.locator("body")).toContainText(facility.code);
      }

      await workflow.updateFacility(facilityId, updatedFacility);
      const updated = await workflow.getFacility(facilityId);
      const afterUpdateTempFacilities = await countTemporaryFacilities(target.type, targetDb);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-18-admin-facility-mutation-deactivated",
        description: "Captures the temporary facility row after Slice 18 updates the facility name/phone and deactivates it before cleanup.",
        expected: {
          facility: updatedFacility,
          counts: {
            temporaryFacilities: beforeTempFacilities + 1
          }
        },
        actual: {
          beforeTempFacilities,
          afterUpdateTempFacilities,
          facilityId,
          created,
          updated
        },
        context: {
          suite: "workflow-admin",
          workflow: "admin-facility-mutation-deactivated"
        }
      });

      expect(updated).toMatchObject(updatedFacility);
      expect(afterUpdateTempFacilities).toBe(beforeTempFacilities + 1);

      if (target.type === "legacy-openemr") {
        await openFacilitiesDirect(page, target);
        await expectRenderedText(page, "Include Inactive Facilities");
      } else {
        await openAuthenticatedModernizedAdmin(page, target);
        await expect(page.locator("body")).toContainText("Users And Facilities");
        await expect(page.locator("body")).not.toContainText(updatedFacility.name);
      }
    } finally {
      if (facilityId !== null) {
        await workflow.deleteFacility(facilityId);
      }
    }

    const afterCleanupTempFacilities = await countTemporaryFacilities(target.type, targetDb);
    const deleted = facilityId !== null ? await workflow.getFacility(facilityId) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-18-admin-facility-mutation-cleanup",
      description: "Captures the Slice 18 cleanup state after hard-deleting the temporary administration facility.",
      expected: {
        counts: {
          temporaryFacilities: beforeTempFacilities
        },
        deletedFacility: null
      },
      actual: {
        beforeTempFacilities,
        afterCleanupTempFacilities,
        facilityId,
        deleted
      },
      context: {
        suite: "workflow-admin",
        workflow: "admin-facility-mutation-cleanup"
      }
    });

    expect(afterCleanupTempFacilities).toBe(beforeTempFacilities);
    if (facilityId !== null) {
      expect(deleted).toBeNull();
    }
  });
});

async function countTemporaryFacilities(
  targetType: string,
  targetDb: { queryRows: <T extends Record<string, string>>(sql: string) => Promise<T[]> }
) {
  const rows = await targetDb.queryRows<{ count: string }>(
    targetType === "legacy-openemr"
      ? "SELECT COUNT(*) AS count FROM facility WHERE facility_code LIKE 'P%' AND name LIKE 'Parity Facility %';"
      : "SELECT COUNT(*) AS count FROM facilities WHERE code LIKE 'P%' AND name LIKE 'Parity Facility %';"
  );
  return Number(rows[0]?.count ?? 0);
}

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-12) || "local";
}
