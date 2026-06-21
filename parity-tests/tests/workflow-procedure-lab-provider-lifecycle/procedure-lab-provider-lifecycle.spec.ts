import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureProvidersDirect
} from "../../src/ui/legacyOpenEmr.js";

test.describe("procedure lab provider lifecycle parity @slice141 @workflow-procedure-lab-provider-lifecycle @mutation", () => {
  test("creates, deactivates, renders, includes inactive, and deletes a temporary lab provider", async ({
    page,
    target,
    workflow
  }) => {
    const suffix = `${Date.now()}-${test.info().workerIndex}`;
    const providerName = `Slice 141 Temporary Lab ${suffix}`;
    const updatedProviderName = `Slice 141 Inactive Lab ${suffix}`;
    const providerNpi = "1720123499";
    let providerId: number | null = null;

    try {
      providerId = await workflow.createProcedureLabProvider({
        name: providerName,
        npi: providerNpi,
        protocol: "DL",
        active: true
      });

      await expect.poll(async () => workflow.getProcedureLabProvider(providerId!)).toMatchObject({
        id: providerId,
        name: providerName,
        npi: providerNpi,
        protocol: "DL",
        active: true
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureProvidersDirect(page, target);
        await expectRenderedText(page, providerName);
        await expectRenderedText(page, providerNpi);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Reports" }).click();
        const providerDirectory = page.locator('[aria-label="Procedure lab provider directory"]');
        await expect(providerDirectory).toContainText(providerName);
        await expect(providerDirectory).toContainText(`NPI ${providerNpi}`);
        await expect(providerDirectory).toContainText("6 active");
        await expect(providerDirectory).toContainText("6 total");
        await expect(providerDirectory).toContainText("Active");
      }

      await workflow.updateProcedureLabProvider(providerId, {
        name: updatedProviderName,
        npi: providerNpi,
        protocol: "DL",
        active: false
      });

      await expect.poll(async () => workflow.getProcedureLabProvider(providerId!)).toMatchObject({
        id: providerId,
        name: updatedProviderName,
        npi: providerNpi,
        protocol: "DL",
        active: false
      });

      if (target.type === "legacy-openemr") {
        await openProcedureProvidersDirect(page, target);
        await expect(page.locator("body")).not.toContainText(updatedProviderName);
        await openProcedureProvidersDirect(page, target, true);
        await expectRenderedText(page, updatedProviderName);
        await expectRenderedText(page, providerNpi);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Reports" }).click();
        const providerDirectory = page.locator('[aria-label="Procedure lab provider directory"]');
        await expect(providerDirectory).toContainText("5 active");
        await expect(providerDirectory).toContainText("1 inactive");
        await expect(providerDirectory).toContainText("6 total");
        await expect(providerDirectory).not.toContainText(updatedProviderName);
        await providerDirectory.getByLabel("Include inactive providers").check();
        await expect(providerDirectory).toContainText(updatedProviderName);
        await expect(providerDirectory).toContainText("Inactive");
      }

      const deletedProviderId = providerId;
      await workflow.deleteProcedureLabProvider(deletedProviderId);
      providerId = null;
      await expect.poll(async () => workflow.getProcedureLabProvider(deletedProviderId)).toBeNull();
    } finally {
      if (providerId !== null) {
        await workflow.deleteProcedureLabProvider(providerId);
      }
    }
  });
});
