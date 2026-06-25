import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureProvidersDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedReports } from "../../src/ui/modernizedOpenEmr.js";

test.describe("procedure lab provider lifecycle parity @slice141 @workflow-procedure-lab-provider-lifecycle @mutation", () => {
  test("creates, deactivates, renders, includes inactive, and deletes a temporary lab provider", async ({
    page,
    target,
    workflow
  }, testInfo) => {
    const suffix = `${Date.now()}-${test.info().workerIndex}`;
    const providerName = `Slice 141 Temporary Lab ${suffix}`;
    const updatedProviderName = `Slice 141 Inactive Lab ${suffix}`;
    const providerNpi = "1720123499";
    let providerId: number | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-141-procedure-lab-provider-lifecycle-precondition",
      description:
        "Temporary provider lifecycle inputs before creating a focused lab-provider row for mutation parity.",
      expected: {
        providerName,
        updatedProviderName,
        providerNpi,
        protocol: "DL",
        initialActive: true,
        updatedActive: false
      },
      actual: {
        suffix,
        target: target.type
      }
    });

    try {
      providerId = await workflow.createProcedureLabProvider({
        name: providerName,
        npi: providerNpi,
        protocol: "DL",
        active: true
      });
      const createdProvider = await workflow.getProcedureLabProvider(providerId);

      await expect.poll(async () => workflow.getProcedureLabProvider(providerId!)).toMatchObject({
        id: providerId,
        name: providerName,
        npi: providerNpi,
        protocol: "DL",
        active: true
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-141-procedure-lab-provider-lifecycle-created",
        description:
          "Created temporary lab provider row is active, uses the default DL protocol, and carries the deterministic NPI.",
        expected: {
          id: providerId,
          name: providerName,
          npi: providerNpi,
          protocol: "DL",
          active: true
        },
        actual: {
          provider: createdProvider
        }
      });

      let activeSurfaceFacts: Record<string, unknown> = {};

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureProvidersDirect(page, target);
        await expectRenderedText(page, providerName);
        await expectRenderedText(page, providerNpi);
        activeSurfaceFacts = {
          legacyProcedureProviders: {
            renderedProviderName: providerName,
            renderedProviderNpi: providerNpi,
            defaultActiveDirectory: true
          }
        };
      } else {
        await openAuthenticatedModernizedReports(page, target);
        const providerDirectory = page.locator('[aria-label="Procedure lab provider directory"]');
        await expect(providerDirectory).toContainText(providerName);
        await expect(providerDirectory).toContainText(`NPI ${providerNpi}`);
        await expect(providerDirectory).toContainText("6 active");
        await expect(providerDirectory).toContainText("6 total");
        await expect(providerDirectory).toContainText("Active");
        activeSurfaceFacts = {
          modernizedProcedureLabProviderDirectory: {
            renderedProviderName: providerName,
            renderedProviderNpiLabel: `NPI ${providerNpi}`,
            renderedActiveSummary: "6 active",
            renderedTotalSummary: "6 total",
            renderedStatus: "Active"
          }
        };
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-141-procedure-lab-provider-lifecycle-active-rendered",
        description:
          "Browser/API surface evidence after creating the temporary active lab provider.",
        expected: {
          rendersProviderName: providerName,
          rendersProviderNpi: providerNpi,
          activeProviderCount: 6,
          totalProviderCount: 6
        },
        actual: {
          provider: await workflow.getProcedureLabProvider(providerId),
          surfaceFacts: activeSurfaceFacts
        }
      });

      await workflow.updateProcedureLabProvider(providerId, {
        name: updatedProviderName,
        npi: providerNpi,
        protocol: "DL",
        active: false
      });
      const deactivatedProvider = await workflow.getProcedureLabProvider(providerId);

      await expect.poll(async () => workflow.getProcedureLabProvider(providerId!)).toMatchObject({
        id: providerId,
        name: updatedProviderName,
        npi: providerNpi,
        protocol: "DL",
        active: false
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-141-procedure-lab-provider-lifecycle-deactivated",
        description:
          "Updated temporary lab provider row is inactive, renamed, and still retrievable for include-inactive directory views.",
        expected: {
          id: providerId,
          name: updatedProviderName,
          npi: providerNpi,
          protocol: "DL",
          active: false
        },
        actual: {
          provider: deactivatedProvider
        }
      });

      let inactiveSurfaceFacts: Record<string, unknown> = {};

      if (target.type === "legacy-openemr") {
        await openProcedureProvidersDirect(page, target);
        await expect(page.locator("body")).not.toContainText(updatedProviderName);
        await openProcedureProvidersDirect(page, target, true);
        await expectRenderedText(page, updatedProviderName);
        await expectRenderedText(page, providerNpi);
        inactiveSurfaceFacts = {
          legacyProcedureProviders: {
            hiddenFromDefaultActiveDirectory: true,
            renderedInIncludeInactiveDirectory: updatedProviderName,
            renderedProviderNpi: providerNpi
          }
        };
      } else {
        await openAuthenticatedModernizedReports(page, target);
        const providerDirectory = page.locator('[aria-label="Procedure lab provider directory"]');
        await expect(providerDirectory).toContainText("5 active");
        await expect(providerDirectory).toContainText("1 inactive");
        await expect(providerDirectory).toContainText("6 total");
        await expect(providerDirectory).not.toContainText(updatedProviderName);
        await providerDirectory.getByLabel("Include inactive providers").check();
        await expect(providerDirectory).toContainText(updatedProviderName);
        await expect(providerDirectory).toContainText("Inactive");
        inactiveSurfaceFacts = {
          modernizedProcedureLabProviderDirectory: {
            hiddenFromDefaultActiveDirectory: true,
            renderedActiveSummary: "5 active",
            renderedInactiveSummary: "1 inactive",
            renderedTotalSummary: "6 total",
            includeInactiveToggleChecked: true,
            renderedProviderName: updatedProviderName,
            renderedStatus: "Inactive"
          }
        };
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-141-procedure-lab-provider-lifecycle-inactive-rendered",
        description:
          "Browser/API surface evidence after deactivation proves default active filtering and include-inactive rendering.",
        expected: {
          hidesInactiveProviderByDefault: true,
          rendersInactiveProviderWhenIncluded: true,
          activeProviderCount: 5,
          inactiveProviderCount: 1,
          totalProviderCount: 6
        },
        actual: {
          provider: await workflow.getProcedureLabProvider(providerId),
          surfaceFacts: inactiveSurfaceFacts
        }
      });

      const deletedProviderId = providerId;
      await workflow.deleteProcedureLabProvider(deletedProviderId);
      providerId = null;
      await expect.poll(async () => workflow.getProcedureLabProvider(deletedProviderId)).toBeNull();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-141-procedure-lab-provider-lifecycle-cleanup",
        description:
          "Temporary lab provider cleanup deletes the focused mutation row after lifecycle assertions complete.",
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
