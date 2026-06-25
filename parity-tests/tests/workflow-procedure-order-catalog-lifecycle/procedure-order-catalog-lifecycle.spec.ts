import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureOrderCatalogDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedReports } from "../../src/ui/modernizedOpenEmr.js";

const parentGroupId = 9040;
const anchorLabId = 504;

test.describe("procedure order catalog lifecycle parity @slice147 @workflow-procedure-order-catalog-lifecycle @mutation", () => {
  test("creates, updates, deactivates, renders, and deletes a temporary catalog item", async ({
    page,
    target,
    workflow
  }, testInfo) => {
    const suffix = `${Date.now()}-${test.info().workerIndex}`;
    const initialName = `Slice 147 Temporary Panel ${suffix}`;
    const updatedName = `Slice 147 Updated Panel ${suffix}`;
    const initialCode = `S147A${test.info().workerIndex}`;
    const updatedCode = `S147B${test.info().workerIndex}`;
    const initialPayload = {
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
    };
    const updatedPayload = {
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
    };
    const deactivatedPayload = {
      ...updatedPayload,
      description: "Temporary order catalog item deactivated by Slice 147 parity.",
      active: false
    };
    let itemId: number | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-147-procedure-order-catalog-lifecycle-precondition",
      description:
        "Temporary procedure order catalog item lifecycle inputs under the Pacific Women's Health Laboratory provider group.",
      expected: {
        parentGroupId,
        anchorLabId,
        initialPayload,
        updatedPayload,
        deactivatedPayload
      },
      actual: {
        suffix,
        target: target.type
      }
    });

    try {
      itemId = await workflow.createProcedureOrderCatalogItem(initialPayload);
      const createdItem = await workflow.getProcedureOrderCatalogItem(itemId);

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-147-procedure-order-catalog-lifecycle-created",
        description:
          "Created temporary order catalog item is active, linked to the Pacific Women's Health Laboratory group, and uses the initial blood specimen metadata.",
        expected: {
          id: itemId,
          ...initialPayload,
          childCount: 0
        },
        actual: {
          item: createdItem
        }
      });

      let createdSurfaceFacts: Record<string, unknown> = {};

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureOrderCatalogDirect(page, target);
        await page.goto(`${target.publicUrl}/interface/orders/types_ajax.php?id=${parentGroupId}&order=0&labid=0`);
        await expectRenderedText(page, initialName);
        await expectRenderedText(page, initialCode);
        createdSurfaceFacts = {
          legacyProcedureOrderCatalog: {
            renderedInitialName: initialName,
            renderedInitialCode: initialCode,
            parentGroupAjaxId: parentGroupId
          }
        };
      } else {
        await openAuthenticatedModernizedReports(page, target);
        const orderCatalog = page.locator('[aria-label="Procedure order catalog"]');
        await expect(orderCatalog).toContainText(initialName);
        await expect(orderCatalog).toContainText(initialCode);
        await expect(orderCatalog).toContainText("16 orders");
        createdSurfaceFacts = {
          modernizedProcedureOrderCatalog: {
            renderedInitialName: initialName,
            renderedInitialCode: initialCode,
            renderedOrderSummary: "16 orders"
          }
        };
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-147-procedure-order-catalog-lifecycle-created-rendered",
        description:
          "Browser/API surface evidence after creating the temporary active procedure order catalog item.",
        expected: {
          rendersInitialName: initialName,
          rendersInitialCode: initialCode,
          activeOrderCountAfterCreate: 16
        },
        actual: {
          item: await workflow.getProcedureOrderCatalogItem(itemId),
          surfaceFacts: createdSurfaceFacts
        }
      });

      await workflow.updateProcedureOrderCatalogItem(itemId, updatedPayload);
      const updatedItem = await workflow.getProcedureOrderCatalogItem(itemId);

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-147-procedure-order-catalog-lifecycle-updated",
        description:
          "Updated temporary order catalog item changes name, code, specimen, standard code, sequence, and description while remaining active.",
        expected: {
          id: itemId,
          ...updatedPayload
        },
        actual: {
          item: updatedItem
        }
      });

      let updatedSurfaceFacts: Record<string, unknown> = {};

      if (target.type === "legacy-openemr") {
        await page.goto(`${target.publicUrl}/interface/orders/types_ajax.php?id=${parentGroupId}&order=0&labid=0`);
        await expectRenderedText(page, updatedName);
        await expectRenderedText(page, updatedCode);
        updatedSurfaceFacts = {
          legacyProcedureOrderCatalog: {
            renderedUpdatedName: updatedName,
            renderedUpdatedCode: updatedCode,
            parentGroupAjaxId: parentGroupId
          }
        };
      } else {
        await openAuthenticatedModernizedReports(page, target);
        const orderCatalog = page.locator('[aria-label="Procedure order catalog"]');
        await expect(orderCatalog).toContainText(updatedName);
        await expect(orderCatalog).toContainText(updatedCode);
        await expect(orderCatalog).toContainText("serum");
        updatedSurfaceFacts = {
          modernizedProcedureOrderCatalog: {
            renderedUpdatedName: updatedName,
            renderedUpdatedCode: updatedCode,
            renderedSpecimen: "serum"
          }
        };
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-147-procedure-order-catalog-lifecycle-updated-rendered",
        description:
          "Browser/API surface evidence after updating the temporary procedure order catalog item.",
        expected: {
          rendersUpdatedName: updatedName,
          rendersUpdatedCode: updatedCode,
          rendersUpdatedSpecimen: target.type !== "legacy-openemr"
        },
        actual: {
          item: await workflow.getProcedureOrderCatalogItem(itemId),
          surfaceFacts: updatedSurfaceFacts
        }
      });

      await workflow.updateProcedureOrderCatalogItem(itemId, deactivatedPayload);
      const deactivatedItem = await workflow.getProcedureOrderCatalogItem(itemId);

      await expect.poll(async () => workflow.getProcedureOrderCatalogItem(itemId!)).toMatchObject({
        id: itemId,
        active: false
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-147-procedure-order-catalog-lifecycle-deactivated",
        description:
          "Temporary procedure order catalog item is deactivated before hard-delete cleanup.",
        expected: {
          id: itemId,
          ...deactivatedPayload
        },
        actual: {
          item: deactivatedItem
        }
      });

      const deletedItemId = itemId;
      await workflow.deleteProcedureOrderCatalogItem(deletedItemId);
      itemId = null;
      await expect.poll(async () => workflow.getProcedureOrderCatalogItem(deletedItemId)).toBeNull();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-147-procedure-order-catalog-lifecycle-cleanup",
        description:
          "Temporary procedure order catalog item cleanup deletes the focused mutation row after lifecycle assertions complete.",
        expected: {
          deletedItemId,
          deletedItem: null
        },
        actual: {
          deletedItemId,
          item: await workflow.getProcedureOrderCatalogItem(deletedItemId)
        }
      });
    } finally {
      if (itemId !== null) {
        await workflow.deleteProcedureOrderCatalogItem(itemId).catch(() => {});
      }
    }
  });
});
