import { test, expect } from "../../src/fixtures/parityTest.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureOrderCatalogDirect
} from "../../src/ui/legacyOpenEmr.js";

const parentGroupId = 9040;
const anchorLabId = 504;

test.describe("procedure order catalog lifecycle parity @slice147 @workflow-procedure-order-catalog-lifecycle @mutation", () => {
  test("creates, updates, deactivates, renders, and deletes a temporary catalog item", async ({
    page,
    target,
    workflow
  }) => {
    const suffix = `${Date.now()}-${test.info().workerIndex}`;
    const initialName = `Slice 147 Temporary Panel ${suffix}`;
    const updatedName = `Slice 147 Updated Panel ${suffix}`;
    const initialCode = `S147A${test.info().workerIndex}`;
    const updatedCode = `S147B${test.info().workerIndex}`;
    let itemId: number | null = null;

    try {
      itemId = await workflow.createProcedureOrderCatalogItem({
        parentId: parentGroupId,
        labId: anchorLabId,
        name: initialName,
        code: initialCode,
        itemType: "ord",
        procedureTypeName: "laboratory",
        description: "Temporary order catalog item created by Slice 147 parity.",
        specimen: "blood",
        standardCode: `CPT4:${initialCode}`,
        sequence: 97,
        active: true
      });

      await expect.poll(async () => workflow.getProcedureOrderCatalogItem(itemId!)).toMatchObject({
        id: itemId,
        parentId: parentGroupId,
        labId: anchorLabId,
        name: initialName,
        code: initialCode,
        itemType: "ord",
        procedureTypeName: "laboratory",
        specimen: "blood",
        standardCode: `CPT4:${initialCode}`,
        sequence: 97,
        active: true,
        childCount: 0
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureOrderCatalogDirect(page, target);
        await page.goto(`${target.publicUrl}/interface/orders/types_ajax.php?id=${parentGroupId}&order=0&labid=0`);
        await expectRenderedText(page, initialName);
        await expectRenderedText(page, initialCode);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Reports" }).click();
        const orderCatalog = page.locator('[aria-label="Procedure order catalog"]');
        await expect(orderCatalog).toContainText(initialName);
        await expect(orderCatalog).toContainText(initialCode);
        await expect(orderCatalog).toContainText("16 orders");
      }

      await workflow.updateProcedureOrderCatalogItem(itemId, {
        parentId: parentGroupId,
        labId: anchorLabId,
        name: updatedName,
        code: updatedCode,
        itemType: "ord",
        procedureTypeName: "laboratory",
        description: "Temporary order catalog item updated by Slice 147 parity.",
        specimen: "serum",
        standardCode: `CPT4:${updatedCode}`,
        sequence: 98,
        active: true
      });

      await expect.poll(async () => workflow.getProcedureOrderCatalogItem(itemId!)).toMatchObject({
        id: itemId,
        parentId: parentGroupId,
        labId: anchorLabId,
        name: updatedName,
        code: updatedCode,
        itemType: "ord",
        procedureTypeName: "laboratory",
        description: "Temporary order catalog item updated by Slice 147 parity.",
        specimen: "serum",
        standardCode: `CPT4:${updatedCode}`,
        sequence: 98,
        active: true
      });

      if (target.type === "legacy-openemr") {
        await page.goto(`${target.publicUrl}/interface/orders/types_ajax.php?id=${parentGroupId}&order=0&labid=0`);
        await expectRenderedText(page, updatedName);
        await expectRenderedText(page, updatedCode);
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Reports" }).click();
        const orderCatalog = page.locator('[aria-label="Procedure order catalog"]');
        await expect(orderCatalog).toContainText(updatedName);
        await expect(orderCatalog).toContainText(updatedCode);
        await expect(orderCatalog).toContainText("serum");
      }

      await workflow.updateProcedureOrderCatalogItem(itemId, {
        parentId: parentGroupId,
        labId: anchorLabId,
        name: updatedName,
        code: updatedCode,
        itemType: "ord",
        procedureTypeName: "laboratory",
        description: "Temporary order catalog item deactivated by Slice 147 parity.",
        specimen: "serum",
        standardCode: `CPT4:${updatedCode}`,
        sequence: 98,
        active: false
      });

      await expect.poll(async () => workflow.getProcedureOrderCatalogItem(itemId!)).toMatchObject({
        id: itemId,
        active: false
      });

      const deletedItemId = itemId;
      await workflow.deleteProcedureOrderCatalogItem(deletedItemId);
      itemId = null;
      await expect.poll(async () => workflow.getProcedureOrderCatalogItem(deletedItemId)).toBeNull();
    } finally {
      if (itemId !== null) {
        await workflow.deleteProcedureOrderCatalogItem(itemId).catch(() => {});
      }
    }
  });
});
