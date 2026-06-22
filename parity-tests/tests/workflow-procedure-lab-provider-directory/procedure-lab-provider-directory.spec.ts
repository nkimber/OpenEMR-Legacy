import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureProvidersDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedReports } from "../../src/ui/modernizedOpenEmr.js";

const expectedProviders = [
  { id: 503, name: "Canyon Pathology Partners", npi: "1720123403" },
  { id: 502, name: "Harbor Reference Laboratory", npi: "1720123402" },
  { id: 505, name: "Metro Clinical Labs", npi: "1720123405" },
  { id: 501, name: "Northstar Diagnostics", npi: "1720123401" },
  { id: 504, name: "Pacific Women's Health Laboratory", npi: "1720123404" }
];

const anchorProvider = expectedProviders[4];

test.describe("procedure lab provider directory parity @slice140 @workflow-procedure-lab-provider-directory @read-only", () => {
  test("renders the permanent gold-data procedure lab provider directory", async ({
    page,
    target,
    targetDb
  }) => {
    const directory = await targetDb.getProcedureLabProviders(false);

    expect(directory.includeInactive).toBe(false);
    expect(directory.totalProviders).toBe(5);
    expect(directory.activeProviders).toBe(5);
    expect(directory.inactiveProviders).toBe(0);
    expect(directory.providers).toHaveLength(5);
    expect(directory.providers.map((provider) => provider.id)).toEqual(expectedProviders.map((provider) => provider.id));

    for (const expectedProvider of expectedProviders) {
      const provider = directory.providers.find((candidate) => candidate.id === expectedProvider.id);
      expect(provider).toMatchObject({
        id: expectedProvider.id,
        name: expectedProvider.name,
        npi: expectedProvider.npi,
        protocol: "DL",
        active: true,
        orderCount: 200,
        reportCount: 140,
        futureOrderCount: 60
      });
    }

    const includeInactiveDirectory = await targetDb.getProcedureLabProviders(true);
    expect(includeInactiveDirectory.providers.map((provider) => provider.id)).toEqual(
      expectedProviders.map((provider) => provider.id)
    );

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openProcedureProvidersDirect(page, target);
      await expectRenderedText(page, /Procedure Providers/i);
      await expectRenderedText(page, anchorProvider.name);
      await expectRenderedText(page, anchorProvider.npi);
      await expect(page.locator("tbody tr.detail")).toHaveCount(5);
    } else {
      await openAuthenticatedModernizedReports(page, target);

      const providerDirectory = page.locator('[aria-label="Procedure lab provider directory"]');
      await expect(providerDirectory).toContainText(anchorProvider.name);
      await expect(providerDirectory).toContainText(`NPI ${anchorProvider.npi}`);
      await expect(providerDirectory).toContainText("5 active");
      await expect(providerDirectory).toContainText("5 total");
      await expect(providerDirectory).toContainText("200");
      await expect(providerDirectory).toContainText("140");
      await expect(providerDirectory).toContainText("60");

      await providerDirectory.getByLabel("Include inactive providers").check();
      await expect(providerDirectory).toContainText("0 inactive");
      await expect(providerDirectory).toContainText(anchorProvider.name);
    }
  });
});
