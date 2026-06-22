import { test, expect } from "../../src/fixtures/parityTest.js";
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
  }) => {
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
    }
  });
});
