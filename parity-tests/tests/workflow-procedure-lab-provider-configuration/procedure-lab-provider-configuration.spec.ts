import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureProvidersDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedReports } from "../../src/ui/modernizedOpenEmr.js";

test.describe("procedure lab provider configuration parity @slice142 @workflow-procedure-lab-provider-configuration @mutation", () => {
  test("persists and renders temporary lab provider transport settings", async ({
    page,
    target,
    workflow
  }, testInfo) => {
    const suffix = `${Date.now()}-${test.info().workerIndex}`;
    const providerName = `Slice 142 Config Lab ${suffix}`;
    const updatedProviderName = `Slice 142 SFTP Lab ${suffix}`;
    const providerNpi = "1720123498";
    const initialProviderPayload = {
      name: providerName,
      npi: providerNpi,
      protocol: "DL",
      usage: "D",
      direction: "B",
      active: true
    };
    const updatedProviderPayload = {
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
    };
    let providerId: number | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-142-procedure-lab-provider-configuration-precondition",
      description:
        "Temporary lab provider configuration inputs before creating and updating transport settings.",
      expected: {
        initialProviderPayload,
        updatedProviderPayload
      },
      actual: {
        suffix,
        target: target.type
      }
    });

    try {
      providerId = await workflow.createProcedureLabProvider(initialProviderPayload);
      const createdProvider = await workflow.getProcedureLabProvider(providerId);

      await expect.poll(async () => workflow.getProcedureLabProvider(providerId!)).toMatchObject({
        id: providerId,
        name: providerName,
        npi: providerNpi,
        protocol: "DL",
        usage: "D",
        direction: "B",
        active: true
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-142-procedure-lab-provider-configuration-created",
        description:
          "Created temporary lab provider row stores the initial direct-lab protocol, usage, and bidirectional transport flags.",
        expected: {
          id: providerId,
          ...initialProviderPayload
        },
        actual: {
          provider: createdProvider
        }
      });

      await workflow.updateProcedureLabProvider(providerId, updatedProviderPayload);
      const configuredProvider = await workflow.getProcedureLabProvider(providerId);

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-142-procedure-lab-provider-configuration-updated",
        description:
          "Updated temporary lab provider row stores SFTP protocol, production/results-only routing, sender/receiver IDs, host, credentials, paths, and notes.",
        expected: {
          id: providerId,
          ...updatedProviderPayload
        },
        actual: {
          provider: configuredProvider
        }
      });

      let surfaceFacts: Record<string, unknown> = {};

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureProvidersDirect(page, target);
        await expectRenderedText(page, updatedProviderName);
        await expectRenderedText(page, providerNpi);
        await expectRenderedText(page, "SFTP");
        surfaceFacts = {
          legacyProcedureProviders: {
            renderedProviderName: updatedProviderName,
            renderedProviderNpi: providerNpi,
            renderedProtocol: "SFTP"
          }
        };
      } else {
        await openAuthenticatedModernizedReports(page, target);
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
        surfaceFacts = {
          modernizedProcedureLabProviderDirectory: {
            renderedProviderName: updatedProviderName,
            renderedProtocol: "SFTP",
            renderedUsage: "Production",
            renderedDirection: "Results Only",
            renderedSender: "MODERNIZED-SEND / MODERNIZED-FAC",
            renderedReceiver: "LEGACY-RECV / LEGACY-FAC",
            renderedRemoteHost: "sftp.slice142.example.test:2222",
            renderedLogin: "slice142-user",
            renderedOrdersPath: "/outbound/orders",
            renderedResultsPath: "/inbound/results",
            renderedPasswordStored: true,
            renderedNotes: "Slice 142 transport settings parity"
          }
        };
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-142-procedure-lab-provider-configuration-rendered",
        description:
          "Browser/API surface evidence after saving the temporary lab provider transport configuration.",
        expected: {
          rendersProviderName: updatedProviderName,
          rendersProviderNpi: providerNpi,
          rendersProtocol: "SFTP",
          rendersUsage: "Production",
          rendersDirection: "Results Only",
          rendersCredentialsAndPaths: target.type !== "legacy-openemr"
        },
        actual: {
          provider: await workflow.getProcedureLabProvider(providerId),
          surfaceFacts
        }
      });

      const deletedProviderId = providerId;
      await workflow.deleteProcedureLabProvider(deletedProviderId);
      providerId = null;
      await expect.poll(async () => workflow.getProcedureLabProvider(deletedProviderId)).toBeNull();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-142-procedure-lab-provider-configuration-cleanup",
        description:
          "Temporary lab provider configuration row is deleted after transport-setting assertions complete.",
        expected: {
          deletedProviderId,
          deletedProvider: null
        },
        actual: {
          deletedProviderId,
          provider: await workflow.getProcedureLabProvider(deletedProviderId)
        }
      });
    } finally {
      if (providerId !== null) {
        await workflow.deleteProcedureLabProvider(providerId);
      }
    }
  });
});
