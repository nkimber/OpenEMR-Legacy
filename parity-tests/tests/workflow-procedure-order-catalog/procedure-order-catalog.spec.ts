import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureOrderCatalogDirect
} from "../../src/ui/legacyOpenEmr.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedReports } from "../../src/ui/modernizedOpenEmr.js";

const rootCatalogId = 9000;
const anchorProviderGroupId = 9040;
const anchorLabId = 504;
const anchorLabName = "Pacific Women's Health Laboratory";
const expectedPanelCodes = ["83036", "80053", "85025"];
const expectedPanelNames = ["Hemoglobin A1c", "Comprehensive metabolic panel", "Complete blood count"];

test.describe("procedure order catalog parity @slice145 @workflow-procedure-order-catalog @read-only", () => {
  test("renders the permanent gold-data procedure order catalog", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-145-procedure-order-catalog-precondition",
      description:
        "Expected permanent gold-data procedure order catalog anchors before read-only catalog checks.",
      expected: {
        rootCatalogId,
        rootCatalogName: "Gold Lab Order Catalog",
        anchorProviderGroupId,
        anchorLabId,
        anchorLabName,
        totalItems: 21,
        groupCount: 6,
        orderCount: 15,
        labProviderCount: 5,
        expectedPanelCodes,
        expectedPanelNames
      },
      actual: {
        target: target.type
      }
    });

    const catalog = await targetDb.getProcedureOrderCatalog();

    expect(catalog.totalItems).toBe(21);
    expect(catalog.groupCount).toBe(6);
    expect(catalog.orderCount).toBe(15);
    expect(catalog.labProviderCount).toBe(5);

    const root = catalog.items.find((item) => item.id === rootCatalogId);
    expect(root).toMatchObject({
      id: rootCatalogId,
      parentId: null,
      labId: null,
      name: "Gold Lab Order Catalog",
      itemType: "grp",
      childCount: 5,
      active: true
    });

    const providerGroups = catalog.items.filter((item) => item.itemType === "grp" && item.parentId === rootCatalogId);
    expect(providerGroups).toHaveLength(5);
    expect(providerGroups.every((group) => group.childCount === 3)).toBe(true);

    const anchorGroup = catalog.items.find((item) => item.id === anchorProviderGroupId);
    expect(anchorGroup).toMatchObject({
      id: anchorProviderGroupId,
      parentId: rootCatalogId,
      labId: anchorLabId,
      labName: anchorLabName,
      name: anchorLabName,
      itemType: "grp",
      childCount: 3,
      active: true
    });

    const anchorOrders = catalog.items.filter((item) => item.parentId === anchorProviderGroupId);
    expect(anchorOrders.map((order) => order.code)).toEqual(expectedPanelCodes);
    expect(anchorOrders.map((order) => order.name)).toEqual(expectedPanelNames);
    for (const order of anchorOrders) {
      expect(order).toMatchObject({
        labId: anchorLabId,
        labName: anchorLabName,
        itemType: "ord",
        procedureTypeName: "laboratory",
        specimen: "blood",
        active: true
      });
      expect(order.standardCode).toBe(`CPT4:${order.code}`);
    }
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-145-procedure-order-catalog-matched",
      description:
        "Database/API catalog projection contains the permanent root, five lab-provider groups, and three Pacific Women's Health Laboratory order panels.",
      expected: {
        totalItems: 21,
        groupCount: 6,
        orderCount: 15,
        labProviderCount: 5,
        root: {
          id: rootCatalogId,
          parentId: null,
          labId: null,
          name: "Gold Lab Order Catalog",
          itemType: "grp",
          childCount: 5,
          active: true
        },
        providerGroupCount: 5,
        providerGroupChildCount: 3,
        anchorGroup: {
          id: anchorProviderGroupId,
          parentId: rootCatalogId,
          labId: anchorLabId,
          labName: anchorLabName,
          name: anchorLabName,
          itemType: "grp",
          childCount: 3,
          active: true
        },
        anchorOrders: expectedPanelCodes.map((code, index) => ({
          code,
          name: expectedPanelNames[index],
          standardCode: `CPT4:${code}`,
          labId: anchorLabId,
          labName: anchorLabName,
          itemType: "ord",
          procedureTypeName: "laboratory",
          specimen: "blood",
          active: true
        }))
      },
      actual: {
        catalog,
        root,
        providerGroups,
        anchorGroup,
        anchorOrders
      }
    });

    let surfaceFacts: Record<string, unknown> = {};

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openProcedureOrderCatalogDirect(page, target);
      await expectRenderedText(page, "Gold Lab Order Catalog");

      await page.goto(`${target.publicUrl}/interface/orders/types_ajax.php?id=${rootCatalogId}&order=0&labid=0`);
      await expectRenderedText(page, anchorLabName);

      await page.goto(`${target.publicUrl}/interface/orders/types_ajax.php?id=${anchorProviderGroupId}&order=0&labid=0`);
      for (const panelName of expectedPanelNames) {
        await expectRenderedText(page, panelName);
      }
      for (const panelCode of expectedPanelCodes) {
        await expectRenderedText(page, panelCode);
      }
      surfaceFacts = {
        legacyProcedureOrderCatalog: {
          renderedRootCatalogName: "Gold Lab Order Catalog",
          renderedAnchorLabName: anchorLabName,
          renderedPanelNames: expectedPanelNames,
          renderedPanelCodes: expectedPanelCodes,
          rootCatalogAjaxId: rootCatalogId,
          anchorProviderGroupAjaxId: anchorProviderGroupId
        }
      };
    } else {
      const apiResponse = await page.request.get(`${target.apiBaseUrl}/api/procedures/order-catalog`, {
        headers: await getModernizedAdminSessionHeaders(page, target)
      });
      expect(apiResponse.ok()).toBe(true);
      const apiPayload = await apiResponse.json();
      expect(apiPayload.orderCount).toBe(15);

      await openAuthenticatedModernizedReports(page, target);

      const orderCatalog = page.locator('[aria-label="Procedure order catalog"]');
      await expect(orderCatalog).toContainText(anchorLabName);
      await expect(orderCatalog).toContainText("5 labs");
      await expect(orderCatalog).toContainText("15 orders");
      for (const panelName of expectedPanelNames) {
        await expect(orderCatalog).toContainText(panelName);
      }
      for (const panelCode of expectedPanelCodes) {
        await expect(orderCatalog).toContainText(panelCode);
      }
      surfaceFacts = {
        modernizedProcedureOrderCatalog: {
          apiOrderCount: apiPayload.orderCount,
          renderedAnchorLabName: anchorLabName,
          renderedLabSummary: "5 labs",
          renderedOrderSummary: "15 orders",
          renderedPanelNames: expectedPanelNames,
          renderedPanelCodes: expectedPanelCodes
        }
      };
    }
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-145-procedure-order-catalog-rendered",
      description:
        "Browser/API surface evidence for the permanent procedure order catalog root, anchor lab group, and three orderable panels.",
      expected: {
        rendersRootCatalogName: true,
        rendersAnchorLabName: anchorLabName,
        rendersLabCount: 5,
        rendersOrderCount: 15,
        rendersPanelCodes: expectedPanelCodes,
        rendersPanelNames: expectedPanelNames
      },
      actual: {
        anchorLabName,
        surfaceFacts
      }
    });
  });
});
