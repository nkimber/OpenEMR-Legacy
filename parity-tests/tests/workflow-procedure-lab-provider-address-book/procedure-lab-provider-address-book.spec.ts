import { expect, test } from "../../src/fixtures/parityTest.js";
import {
  loginToLegacyOpenEmr,
  openProcedureProvidersDirect
} from "../../src/ui/legacyOpenEmr.js";

test.describe("procedure lab provider address book parity @slice144 @workflow-procedure-lab-provider-address-book @mutation", () => {
  test("links a procedure lab provider to address book organizations", async ({
    workflow,
    page,
    target
  }) => {
    const suffix = `${Date.now()}`;
    const initialOrganization = `Slice 144 Linked Lab ${suffix}`;
    const updatedOrganization = `Slice 144 Updated Linked Lab ${suffix}`;
    const fallbackName = `Slice 144 Manual Provider ${suffix}`;
    const secondFallbackName = `Slice 144 Manual Update ${suffix}`;
    let initialAddressBookId: number | undefined;
    let updatedAddressBookId: number | undefined;
    let providerId: number | undefined;

    try {
      initialAddressBookId = await workflow.createProcedureLabProviderAddressBookOrganization({
        organization: initialOrganization,
        type: "ord_lab",
        active: true,
        npi: "1720123496"
      });

      providerId = await workflow.createProcedureLabProvider({
        name: fallbackName,
        labDirectorId: initialAddressBookId,
        npi: "1720123496",
        protocol: "DL",
        usage: "D",
        direction: "B",
        active: true
      });

      let provider = await workflow.getProcedureLabProvider(providerId);
      expect(provider).toMatchObject({
        id: providerId,
        name: initialOrganization,
        labDirectorId: initialAddressBookId,
        labDirectorName: initialOrganization,
        labDirectorType: "ord_lab",
        npi: "1720123496",
        protocol: "DL",
        active: true
      });

      updatedAddressBookId = await workflow.createProcedureLabProviderAddressBookOrganization({
        organization: updatedOrganization,
        type: "ord_lab",
        active: true,
        npi: "1720123497"
      });

      await workflow.updateProcedureLabProvider(providerId, {
        name: secondFallbackName,
        labDirectorId: updatedAddressBookId,
        npi: "1720123497",
        protocol: "SFTP",
        usage: "P",
        direction: "R",
        active: true
      });

      provider = await workflow.getProcedureLabProvider(providerId);
      expect(provider).toMatchObject({
        id: providerId,
        name: updatedOrganization,
        labDirectorId: updatedAddressBookId,
        labDirectorName: updatedOrganization,
        labDirectorType: "ord_lab",
        npi: "1720123497",
        protocol: "SFTP",
        usage: "P",
        direction: "R",
        active: true
      });

      if (target.id === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureProvidersDirect(page, target, true);
        await expect(page.locator("body")).toContainText(updatedOrganization);
        await expect(page.locator("body")).toContainText("1720123497");
        await expect(page.locator("body")).toContainText("SFTP");
        await expect(page.locator("body")).not.toContainText(secondFallbackName);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Reports" }).click();
        await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
        const providerDirectory = page.locator('[aria-label="Procedure lab provider directory"]');
        await expect(providerDirectory).toContainText(updatedOrganization);
        await expect(providerDirectory).toContainText("Address book organization");
        await expect(providerDirectory).toContainText("ord_lab");
        await expect(providerDirectory).toContainText("1720123497");
        await expect(providerDirectory).toContainText("SFTP");
        await expect(providerDirectory).toContainText("Production");
        await expect(providerDirectory).toContainText("Results Only");
        await expect(providerDirectory).not.toContainText(secondFallbackName);
      }
    } finally {
      if (providerId) {
        await workflow.deleteProcedureLabProvider(providerId).catch(() => {});
        expect(await workflow.getProcedureLabProvider(providerId)).toBeNull();
      }
      if (updatedAddressBookId) {
        await workflow.deleteProcedureLabProviderAddressBookOrganization(updatedAddressBookId).catch(() => {});
      }
      if (initialAddressBookId) {
        await workflow.deleteProcedureLabProviderAddressBookOrganization(initialAddressBookId).catch(() => {});
      }
    }
  });
});
