import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureProvidersDirect
} from "../../src/ui/legacyOpenEmr.js";

test.describe("procedure lab provider configuration parity @slice142 @workflow-procedure-lab-provider-configuration @mutation", () => {
  test("persists and renders temporary lab provider transport settings", async ({
    page,
    target,
    workflow
  }) => {
    const suffix = `${Date.now()}-${test.info().workerIndex}`;
    const providerName = `Slice 142 Config Lab ${suffix}`;
    const updatedProviderName = `Slice 142 SFTP Lab ${suffix}`;
    const providerNpi = "1720123498";
    let providerId: number | null = null;

    try {
      providerId = await workflow.createProcedureLabProvider({
        name: providerName,
        npi: providerNpi,
        protocol: "DL",
        usage: "D",
        direction: "B",
        active: true
      });

      await expect.poll(async () => workflow.getProcedureLabProvider(providerId!)).toMatchObject({
        id: providerId,
        name: providerName,
        npi: providerNpi,
        protocol: "DL",
        usage: "D",
        direction: "B",
        active: true
      });

      await workflow.updateProcedureLabProvider(providerId, {
        name: updatedProviderName,
        npi: providerNpi,
        protocol: "SFTP",
        usage: "P",
        direction: "R",
        sendApplicationId: "MODERNIZED-SEND",
        sendFacilityId: "MODERNIZED-FAC",
        receiveApplicationId: "LEGACY-RECV",
        receiveFacilityId: "LEGACY-FAC",
        remoteHost: "sftp.slice142.example.test:2222",
        login: "slice142-user",
        password: "slice142-password",
        ordersPath: "/outbound/orders",
        resultsPath: "/inbound/results",
        notes: "Slice 142 transport settings parity",
        active: true
      });

      await expect.poll(async () => workflow.getProcedureLabProvider(providerId!)).toMatchObject({
        id: providerId,
        name: updatedProviderName,
        npi: providerNpi,
        protocol: "SFTP",
        usage: "P",
        direction: "R",
        sendApplicationId: "MODERNIZED-SEND",
        sendFacilityId: "MODERNIZED-FAC",
        receiveApplicationId: "LEGACY-RECV",
        receiveFacilityId: "LEGACY-FAC",
        remoteHost: "sftp.slice142.example.test:2222",
        login: "slice142-user",
        password: "slice142-password",
        ordersPath: "/outbound/orders",
        resultsPath: "/inbound/results",
        notes: "Slice 142 transport settings parity",
        active: true
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureProvidersDirect(page, target);
        await expectRenderedText(page, updatedProviderName);
        await expectRenderedText(page, providerNpi);
        await expectRenderedText(page, "SFTP");
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Reports" }).click();
        const providerDirectory = page.locator('[aria-label="Procedure lab provider directory"]');
        await expect(providerDirectory).toContainText(updatedProviderName);
        await expect(providerDirectory).toContainText("SFTP");
        await expect(providerDirectory).toContainText("Production");
        await expect(providerDirectory).toContainText("Results Only");
        await expect(providerDirectory).toContainText("MODERNIZED-SEND / MODERNIZED-FAC");
        await expect(providerDirectory).toContainText("LEGACY-RECV / LEGACY-FAC");
        await expect(providerDirectory).toContainText("sftp.slice142.example.test:2222");
        await expect(providerDirectory).toContainText("slice142-user");
        await expect(providerDirectory).toContainText("/outbound/orders");
        await expect(providerDirectory).toContainText("/inbound/results");
        await expect(providerDirectory).toContainText("Password");
        await expect(providerDirectory).toContainText("Stored");
        await expect(providerDirectory).toContainText("Slice 142 transport settings parity");
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
