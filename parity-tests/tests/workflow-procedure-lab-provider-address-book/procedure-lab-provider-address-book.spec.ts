import { expect, test } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  loginToLegacyOpenEmr,
  openProcedureProvidersDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedReports } from "../../src/ui/modernizedOpenEmr.js";

test.describe("procedure lab provider address book parity @slice144 @workflow-procedure-lab-provider-address-book @mutation", () => {
  test("links a procedure lab provider to address book organizations", async ({
    workflow,
    page,
    target
  }, testInfo) => {
    const suffix = `${Date.now()}`;
    const initialOrganization = `Slice 144 Linked Lab ${suffix}`;
    const updatedOrganization = `Slice 144 Updated Linked Lab ${suffix}`;
    const fallbackName = `Slice 144 Manual Provider ${suffix}`;
    const secondFallbackName = `Slice 144 Manual Update ${suffix}`;
    const initialOrganizationPayload = {
      organization: initialOrganization,
      type: "ord_lab",
      active: true,
      npi: "1720123496"
    };
    const updatedOrganizationPayload = {
      organization: updatedOrganization,
      type: "ord_lab",
      active: true,
      npi: "1720123497"
    };
    let initialAddressBookId: number | undefined;
    let updatedAddressBookId: number | undefined;
    let providerId: number | undefined;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-144-procedure-lab-provider-address-book-precondition",
      description:
        "Temporary address-book organization and provider-linkage inputs before exercising linked provider name derivation.",
      expected: {
        initialOrganizationPayload,
        updatedOrganizationPayload,
        fallbackName,
        secondFallbackName,
        initialProviderNpi: "1720123496",
        updatedProviderNpi: "1720123497",
        initialProtocol: "DL",
        updatedProtocol: "SFTP"
      },
      actual: {
        suffix,
        target: target.type
      }
    });

    try {
      initialAddressBookId =
        await workflow.createProcedureLabProviderAddressBookOrganization(initialOrganizationPayload);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-144-procedure-lab-provider-address-book-organization-created",
        description:
          "Initial temporary order-service address-book organization exists before linking a lab provider to it.",
        expected: {
          id: initialAddressBookId,
          ...initialOrganizationPayload
        },
        actual: {
          initialAddressBookId,
          organization: initialOrganizationPayload
        }
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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-144-procedure-lab-provider-address-book-linked",
        description:
          "Created temporary lab provider derives its visible name from the linked address-book organization instead of the manual fallback name.",
        expected: {
          id: providerId,
          name: initialOrganization,
          fallbackName,
          labDirectorId: initialAddressBookId,
          labDirectorName: initialOrganization,
          labDirectorType: "ord_lab",
          npi: "1720123496",
          protocol: "DL",
          usage: "D",
          direction: "B",
          active: true
        },
        actual: {
          provider
        }
      });

      updatedAddressBookId =
        await workflow.createProcedureLabProviderAddressBookOrganization(updatedOrganizationPayload);

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-144-procedure-lab-provider-address-book-relinked",
        description:
          "Updated temporary lab provider relinks to the second address-book organization, updates NPI/protocol/routing, and continues deriving its visible name from the organization.",
        expected: {
          id: providerId,
          name: updatedOrganization,
          secondFallbackName,
          labDirectorId: updatedAddressBookId,
          labDirectorName: updatedOrganization,
          labDirectorType: "ord_lab",
          npi: "1720123497",
          protocol: "SFTP",
          usage: "P",
          direction: "R",
          active: true
        },
        actual: {
          updatedAddressBookId,
          provider
        }
      });

      let surfaceFacts: Record<string, unknown> = {};

      if (target.id === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureProvidersDirect(page, target, true);
        await expect(page.locator("body")).toContainText(updatedOrganization);
        await expect(page.locator("body")).toContainText("1720123497");
        await expect(page.locator("body")).toContainText("SFTP");
        await expect(page.locator("body")).not.toContainText(secondFallbackName);
        surfaceFacts = {
          legacyProcedureProviders: {
            renderedOrganizationName: updatedOrganization,
            renderedNpi: "1720123497",
            renderedProtocol: "SFTP",
            hidesManualFallbackName: true
          }
        };
      } else {
        await openAuthenticatedModernizedReports(page, target);
        const providerDirectory = page.locator('[aria-label="Procedure lab provider directory"]');
        await expect(providerDirectory).toContainText(updatedOrganization);
        await expect(providerDirectory).toContainText("Address book organization");
        await expect(providerDirectory).toContainText("ord_lab");
        await expect(providerDirectory).toContainText("1720123497");
        await expect(providerDirectory).toContainText("SFTP");
        await expect(providerDirectory).toContainText("Production");
        await expect(providerDirectory).toContainText("Results Only");
        await expect(providerDirectory).not.toContainText(secondFallbackName);
        surfaceFacts = {
          modernizedProcedureLabProviderDirectory: {
            renderedOrganizationName: updatedOrganization,
            renderedOrganizationLabel: "Address book organization",
            renderedOrganizationType: "ord_lab",
            renderedNpi: "1720123497",
            renderedProtocol: "SFTP",
            renderedUsage: "Production",
            renderedDirection: "Results Only",
            hidesManualFallbackName: true
          }
        };
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-144-procedure-lab-provider-address-book-rendered",
        description:
          "Browser/API surface evidence for address-book-derived provider rendering after relinking to the updated organization.",
        expected: {
          rendersOrganizationName: updatedOrganization,
          rendersOrganizationType: "ord_lab",
          rendersNpi: "1720123497",
          rendersProtocol: "SFTP",
          hidesManualFallbackName: true
        },
        actual: {
          provider: await workflow.getProcedureLabProvider(providerId),
          surfaceFacts
        }
      });

      const deletedProviderId = providerId;
      const deletedUpdatedAddressBookId = updatedAddressBookId;
      const deletedInitialAddressBookId = initialAddressBookId;
      await workflow.deleteProcedureLabProvider(deletedProviderId);
      providerId = undefined;
      await workflow.deleteProcedureLabProviderAddressBookOrganization(deletedUpdatedAddressBookId);
      updatedAddressBookId = undefined;
      await workflow.deleteProcedureLabProviderAddressBookOrganization(deletedInitialAddressBookId);
      initialAddressBookId = undefined;
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-144-procedure-lab-provider-address-book-cleanup",
        description:
          "Temporary linked lab provider and both temporary order-service address-book organizations are deleted after address-book assertions complete.",
        expected: {
          deletedProviderId,
          deletedInitialAddressBookId,
          deletedUpdatedAddressBookId,
          deletedProvider: null
        },
        actual: {
          deletedProviderId,
          deletedInitialAddressBookId,
          deletedUpdatedAddressBookId,
          provider: await workflow.getProcedureLabProvider(deletedProviderId)
        }
      });
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
