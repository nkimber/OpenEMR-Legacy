import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureOrderCatalogDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedReports } from "../../src/ui/modernizedOpenEmr.js";

const rootGroupId = 9000;
const anchorLabId = 504;

test.describe("procedure vendor compendium import parity @slice148 @workflow-procedure-vendor-compendium-import @mutation", () => {
  test("imports PathGroup-style compendium rows and re-imports with legacy deactivate semantics", async ({
    page,
    target,
    workflow
  }, testInfo) => {
    const suffix = `${Date.now()}-${test.info().workerIndex}`;
    const groupName = `Slice 148 Import Group ${suffix}`;
    const orderCodeA = `S148A${test.info().workerIndex}`;
    const orderCodeB = `S148B${test.info().workerIndex}`;
    const orderCodeC = `S148C${test.info().workerIndex}`;
    const resultCodeA = `R148A${test.info().workerIndex}`;
    const resultCodeB = `R148B${test.info().workerIndex}`;
    const resultCodeC = `R148C${test.info().workerIndex}`;
    let groupId: number | null = null;
    const groupPayload = {
      parentId: rootGroupId,
      labId: anchorLabId,
      name: groupName,
      code: "",
      itemType: "grp",
      procedureTypeName: "",
      description: "Temporary compendium import group created by Slice 148 parity.",
      sequence: 148,
      active: true
    };
    const firstCsv = [
      "Order Code,Order Name,Result Code,Result Name",
      `${orderCodeA},Slice 148 Chemistry Panel ${suffix},${resultCodeA},Slice 148 Sodium Result ${suffix}`,
      `${orderCodeB},Slice 148 Endocrine Panel ${suffix},${resultCodeB},Slice 148 TSH Result ${suffix}`
    ].join("\n");
    const secondCsv = [
      "Order Code,Order Name,Result Code,Result Name",
      `${orderCodeA},Slice 148 Updated Chemistry Panel ${suffix},${resultCodeA},Slice 148 Updated Sodium Result ${suffix}`,
      `${orderCodeC},Slice 148 Microbiology Panel ${suffix},${resultCodeC},Slice 148 Culture Result ${suffix}`
    ].join("\n");

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-148-procedure-vendor-compendium-import-precondition",
      description:
        "Temporary PathGroup-style vendor compendium import inputs before creating the import group and importing CSV rows.",
      expected: {
        rootGroupId,
        anchorLabId,
        groupPayload,
        firstCsv,
        secondCsv,
        firstImportCodes: {
          orders: [orderCodeA, orderCodeB],
          results: [resultCodeA, resultCodeB]
        },
        secondImportCodes: {
          orders: [orderCodeA, orderCodeC],
          results: [resultCodeA, resultCodeC],
          omittedInactiveOrder: orderCodeB,
          omittedInactiveResult: resultCodeB
        }
      },
      actual: {
        suffix,
        target: target.type
      }
    });

    try {
      groupId = await workflow.createProcedureOrderCatalogItem(groupPayload);
      const createdGroup = await workflow.getProcedureOrderCatalogItem(groupId);

      const firstImport = await workflow.importProcedureVendorCompendium({
        vendorFormat: "pathgroup",
        parentId: groupId,
        labId: anchorLabId,
        csvText: firstCsv
      });

      expect(firstImport).toMatchObject({
        importedOrderCount: 2,
        createdOrderCount: 2,
        updatedOrderCount: 0,
        deactivatedOrderCount: 0,
        importedResultCount: 2,
        createdResultCount: 2,
        updatedResultCount: 0
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-148-procedure-vendor-compendium-import-first-import",
        description:
          "First PathGroup import creates two active order rows and two active result rows under the temporary compendium group.",
        expected: {
          createdGroup: {
            id: groupId,
            ...groupPayload
          },
          firstImport: {
            importedOrderCount: 2,
            createdOrderCount: 2,
            updatedOrderCount: 0,
            deactivatedOrderCount: 0,
            importedResultCount: 2,
            createdResultCount: 2,
            updatedResultCount: 0
          }
        },
        actual: {
          createdGroup,
          firstImport
        }
      });

      const firstOrderA = await workflow.getProcedureOrderCatalogItemByCode(groupId, orderCodeA, "ord");
      const firstOrderB = await workflow.getProcedureOrderCatalogItemByCode(groupId, orderCodeB, "ord");
      expect(firstOrderA).toMatchObject({
        parentId: groupId,
        labId: anchorLabId,
        name: `Slice 148 Chemistry Panel ${suffix}`,
        code: orderCodeA,
        itemType: "ord",
        active: true
      });
      expect(firstOrderB).toMatchObject({
        parentId: groupId,
        labId: anchorLabId,
        name: `Slice 148 Endocrine Panel ${suffix}`,
        code: orderCodeB,
        itemType: "ord",
        active: true
      });

      const firstResultA = await workflow.getProcedureOrderCatalogItemByCode(firstOrderA!.id, resultCodeA, "res");
      expect(firstResultA).toMatchObject({
        parentId: firstOrderA!.id,
        labId: anchorLabId,
        name: `Slice 148 Sodium Result ${suffix}`,
        code: resultCodeA,
        itemType: "res",
        active: true
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-148-procedure-vendor-compendium-import-first-import-rows",
        description:
          "Database/API row evidence for first import order/result rows before re-import semantics are exercised.",
        expected: {
          firstOrderA: {
            parentId: groupId,
            labId: anchorLabId,
            name: `Slice 148 Chemistry Panel ${suffix}`,
            code: orderCodeA,
            itemType: "ord",
            active: true
          },
          firstOrderB: {
            parentId: groupId,
            labId: anchorLabId,
            name: `Slice 148 Endocrine Panel ${suffix}`,
            code: orderCodeB,
            itemType: "ord",
            active: true
          },
          firstResultA: {
            parentId: firstOrderA!.id,
            labId: anchorLabId,
            name: `Slice 148 Sodium Result ${suffix}`,
            code: resultCodeA,
            itemType: "res",
            active: true
          }
        },
        actual: {
          firstOrderA,
          firstOrderB,
          firstResultA
        }
      });

      let firstSurfaceFacts: Record<string, unknown> = {};

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openProcedureOrderCatalogDirect(page, target);
        await page.goto(`${target.publicUrl}/interface/orders/types_ajax.php?id=${groupId}&order=0&labid=0`);
        await expectRenderedText(page, `Slice 148 Chemistry Panel ${suffix}`);
        await expectRenderedText(page, orderCodeA);
        firstSurfaceFacts = {
          legacyProcedureOrderCatalog: {
            renderedGroupId: groupId,
            renderedFirstOrderName: `Slice 148 Chemistry Panel ${suffix}`,
            renderedFirstOrderCode: orderCodeA
          }
        };
      } else {
        await openAuthenticatedModernizedReports(page, target);
        const orderCatalog = page.locator('[aria-label="Procedure order catalog"]');
        await expect(orderCatalog).toContainText(groupName);
        await expect(orderCatalog).toContainText(`Slice 148 Chemistry Panel ${suffix}`);
        await expect(orderCatalog).toContainText(orderCodeA);
        firstSurfaceFacts = {
          modernizedProcedureOrderCatalog: {
            renderedGroupName: groupName,
            renderedFirstOrderName: `Slice 148 Chemistry Panel ${suffix}`,
            renderedFirstOrderCode: orderCodeA
          }
        };
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-148-procedure-vendor-compendium-import-first-rendered",
        description:
          "Browser/API surface evidence after the first compendium import creates visible order catalog rows.",
        expected: {
          rendersGroupName: groupName,
          rendersFirstOrderName: `Slice 148 Chemistry Panel ${suffix}`,
          rendersFirstOrderCode: orderCodeA
        },
        actual: {
          firstOrderA,
          surfaceFacts: firstSurfaceFacts
        }
      });

      const secondImport = await workflow.importProcedureVendorCompendium({
        vendorFormat: "pathgroup",
        parentId: groupId,
        labId: anchorLabId,
        csvText: secondCsv
      });

      expect(secondImport).toMatchObject({
        importedOrderCount: 2,
        createdOrderCount: 1,
        updatedOrderCount: 1,
        reactivatedOrderCount: 1,
        deactivatedOrderCount: 2,
        importedResultCount: 2,
        createdResultCount: 1,
        updatedResultCount: 1,
        reactivatedResultCount: 1
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-148-procedure-vendor-compendium-import-second-import",
        description:
          "Second PathGroup import updates/reactivates the repeated order/result, creates one new order/result, and deactivates omitted rows using legacy-compatible semantics.",
        expected: {
          importedOrderCount: 2,
          createdOrderCount: 1,
          updatedOrderCount: 1,
          reactivatedOrderCount: 1,
          deactivatedOrderCount: 2,
          importedResultCount: 2,
          createdResultCount: 1,
          updatedResultCount: 1,
          reactivatedResultCount: 1
        },
        actual: {
          secondImport
        }
      });

      const updatedOrderA = await workflow.getProcedureOrderCatalogItemByCode(groupId, orderCodeA, "ord");
      const inactiveOrderB = await workflow.getProcedureOrderCatalogItemByCode(groupId, orderCodeB, "ord");
      const newOrderC = await workflow.getProcedureOrderCatalogItemByCode(groupId, orderCodeC, "ord");
      expect(updatedOrderA).toMatchObject({
        name: `Slice 148 Updated Chemistry Panel ${suffix}`,
        active: true
      });
      expect(inactiveOrderB).toMatchObject({
        name: `Slice 148 Endocrine Panel ${suffix}`,
        active: false
      });
      expect(newOrderC).toMatchObject({
        name: `Slice 148 Microbiology Panel ${suffix}`,
        active: true
      });

      const updatedResultA = await workflow.getProcedureOrderCatalogItemByCode(updatedOrderA!.id, resultCodeA, "res");
      const resultC = await workflow.getProcedureOrderCatalogItemByCode(newOrderC!.id, resultCodeC, "res");
      expect(updatedResultA).toMatchObject({
        name: `Slice 148 Updated Sodium Result ${suffix}`,
        active: true
      });
      expect(resultC).toMatchObject({
        name: `Slice 148 Culture Result ${suffix}`,
        active: true
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-148-procedure-vendor-compendium-import-second-import-rows",
        description:
          "Database/API row evidence after re-import proves updated, inactive, and newly-created order/result catalog rows.",
        expected: {
          updatedOrderA: {
            name: `Slice 148 Updated Chemistry Panel ${suffix}`,
            active: true
          },
          inactiveOrderB: {
            name: `Slice 148 Endocrine Panel ${suffix}`,
            active: false
          },
          newOrderC: {
            name: `Slice 148 Microbiology Panel ${suffix}`,
            active: true
          },
          updatedResultA: {
            name: `Slice 148 Updated Sodium Result ${suffix}`,
            active: true
          },
          resultC: {
            name: `Slice 148 Culture Result ${suffix}`,
            active: true
          }
        },
        actual: {
          updatedOrderA,
          inactiveOrderB,
          newOrderC,
          updatedResultA,
          resultC
        }
      });

      const deletedGroupId = groupId;
      await workflow.deleteProcedureOrderCatalogSubtree(deletedGroupId);
      groupId = null;
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-148-procedure-vendor-compendium-import-cleanup",
        description:
          "Temporary compendium import subtree cleanup removes the group and imported order/result rows after assertions complete.",
        expected: {
          deletedGroupId,
          deletedGroup: null
        },
        actual: {
          deletedGroupId,
          group: await workflow.getProcedureOrderCatalogItem(deletedGroupId)
        }
      });
    } finally {
      if (groupId !== null) {
        await workflow.deleteProcedureOrderCatalogSubtree(groupId).catch(() => {});
      }
    }
  });
});
