import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openProcedureResultsDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedProcedures } from "../../src/ui/modernizedOpenEmr.js";

const procedureAnchorPatientId = "MOD-PAT-0009";

test.describe("procedure results parity @slice6 @procedures", () => {
  test("stable procedure anchor has a completed order, report, and final result rows", async ({ target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureAnchorPatientId);
    const procedures = patient ? await targetDb.getProcedureResultsForPatient(patient.pid) : null;
    const cbcOrder = procedures?.orders.find((order) => order.procedureName === "Complete blood count") ?? null;
    const report = cbcOrder?.reports.find((item) => item.status === "complete") ?? cbcOrder?.reports[0] ?? null;
    const hemoglobin = report?.results.find((result) => result.text === "Hemoglobin") ?? null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-6-procedure-results-anchor",
      description: "Verifies the Slice 6 procedure anchor patient, completed CBC order, completed report, and final Hemoglobin result database facts.",
      expected: {
        patient: {
          pubpid: procedureAnchorPatientId
        },
        order: {
          procedureName: "Complete blood count",
          procedureCode: "85025",
          orderStatus: "complete"
        },
        report: {
          status: "complete",
          resultCount: ">= 4"
        },
        result: {
          text: "Hemoglobin",
          resultStatus: "final",
          resultDate: "2026-*"
        }
      },
      actual: {
        patient,
        procedures,
        selected: {
          order: cbcOrder,
          report,
          result: hemoglobin
        }
      },
      context: {
        canonicalId: procedureAnchorPatientId,
        suite: "procedures",
        workflow: "procedure-results"
      }
    });

    expect(patient).not.toBeNull();
    expect(procedures).not.toBeNull();
    expect(procedures!.patientId).toBe(patient!.pid);

    expect(cbcOrder).toBeDefined();
    expect(cbcOrder!.orderStatus).toBe("complete");
    expect(cbcOrder!.procedureCode).toBe("85025");
    expect(cbcOrder!.reports.length).toBeGreaterThan(0);

    expect(report).not.toBeNull();
    expect(report!.status).toBe("complete");
    expect(report!.results.length).toBeGreaterThanOrEqual(4);
    expect(report!.results.some((result) => result.text === "Hemoglobin" && result.resultStatus === "final")).toBe(true);
    expect(report!.results.every((result) => result.resultDate.startsWith("2026-"))).toBe(true);
  });

  test("completed procedure results are visible in the application UI", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureAnchorPatientId);
    const procedures = patient ? await targetDb.getProcedureResultsForPatient(patient.pid) : null;
    const cbcOrder = procedures?.orders.find((item) => item.procedureName === "Complete blood count") ?? procedures?.orders[0] ?? null;
    const report = cbcOrder?.reports.find((item) => item.status === "complete") ?? cbcOrder?.reports[0] ?? null;
    const hemoglobin = report?.results.find((item) => item.text === "Hemoglobin") ?? report?.results[0] ?? null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-6-procedure-results-ui-precondition",
      description: "Captures the procedure order, report, and result database rows used before steering the Slice 6 procedure results UI parity flow.",
      expected: {
        patient: {
          pubpid: procedureAnchorPatientId
        },
        order: {
          procedureName: "Complete blood count",
          procedureCode: "85025"
        },
        report: {
          status: "complete"
        },
        result: {
          text: "Hemoglobin",
          resultStatus: "final"
        }
      },
      actual: {
        patient,
        procedures,
        selected: {
          order: cbcOrder,
          report,
          result: hemoglobin
        }
      },
      context: {
        canonicalId: procedureAnchorPatientId,
        suite: "procedures",
        workflow: "procedure-results-ui"
      }
    });

    expect(patient).not.toBeNull();
    expect(procedures).not.toBeNull();
    expect(cbcOrder).toBeDefined();
    const order = cbcOrder!;
    expect(report).toBeDefined();
    expect(hemoglobin).toBeDefined();
    const result = hemoglobin!;

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openProcedureResultsDirect(page, target, patient!.pid);

      await expectRenderedText(page, "Order Report Results");
      await expectRenderedText(page, order.procedureName);
      await expectRenderedText(page, result.text);
      await expectRenderedText(page, /Final|Reviewed|complete/i);
      return;
    }

    await openAuthenticatedModernizedProcedures(page, target, patient!.pubpid);

    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText("Order Report Results");
    await expect(page.locator("body")).toContainText(order.procedureName);
    await expect(page.locator("body")).toContainText(order.procedureCode);
    await expect(page.locator("body")).toContainText(result.text);
    await expect(page.locator("body")).toContainText(result.result);
    await expect(page.locator("body")).toContainText(result.resultStatus);
  });
});
