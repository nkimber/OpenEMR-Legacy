import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openFacilitiesDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedAdmin } from "../../src/ui/modernizedOpenEmr.js";

test.describe("facility administration mutation parity @slice18 @workflow-admin @mutation", () => {
  test("creates, updates, renders, deactivates, and removes an administration facility", async ({
    page,
    target,
    targetDb,
    workflow
  }) => {
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

    try {
      facilityId = await workflow.createFacility(facility);
      await expect(workflow.getFacility(facilityId)).resolves.toMatchObject(facility);
      await expect(countTemporaryFacilities(target.type, targetDb)).resolves.toBe(beforeTempFacilities + 1);

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
      await expect(workflow.getFacility(facilityId)).resolves.toMatchObject(updatedFacility);

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

    await expect(countTemporaryFacilities(target.type, targetDb)).resolves.toBe(beforeTempFacilities);
    if (facilityId !== null) {
      await expect(workflow.getFacility(facilityId)).resolves.toBeNull();
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
