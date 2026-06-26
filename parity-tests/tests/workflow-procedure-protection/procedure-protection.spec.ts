import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openProcedureResultsDirect
} from "../../src/ui/legacyOpenEmr.js";
import {
  getModernizedAdminSessionHeaders,
  openAuthenticatedModernizedProcedures
} from "../../src/ui/modernizedOpenEmr.js";

const procedureProtectionPatientId = "MOD-PAT-0009";

test.describe("procedure protection parity @slice172 @procedure-protection", () => {
  test("requires an active session before procedure and lab data are visible", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(procedureProtectionPatientId);
    expect(patient).not.toBeNull();

    const procedures = await targetDb.getProcedureResultsForPatient(patient!.pid);
    const order = procedures.orders.find((item) => item.procedureName === "Complete blood count") ?? procedures.orders[0];
    expect(order).toBeDefined();
    const report = order!.reports.find((item) => item.status === "complete") ?? order!.reports[0];
    expect(report).toBeDefined();
    const hemoglobin = report!.results.find((item) => item.text === "Hemoglobin") ?? report!.results[0];
    expect(hemoglobin).toBeDefined();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-172-procedure-protection-precondition",
      description:
        "Captures the Slice 172 procedure protection precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: procedureProtectionPatientId,
        anchorProcedureName: "Complete blood count",
        anchorResultText: "Hemoglobin",
        legacyProcedureResultsPath: "/interface/orders/orders_results.php",
        modernizedProcedureResultsPath: "/api/procedures/{canonicalId}",
        modernizedOrderCatalogPath: "/api/procedures/order-catalog",
        modernizedOrderCreatePath: "/api/procedures/orders",
        requiresAuthenticatedSession: true,
        secretMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true,
        patient: {
          canonicalId: patient!.pubpid,
          legacyPid: patient!.pid,
          displayName: `${patient!.lname}, ${patient!.fname}`
        },
        order: summarizeProcedureOrder(order!),
        report: summarizeProcedureReport(report!),
        result: summarizeProcedureResult(hemoglobin!)
      },
      context: {
        suite: "workflow-procedure-protection",
        workflow: "procedure-protection-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await page.goto(`${target.publicUrl}/interface/orders/orders_results.php?pid=${patient!.pid}`);
      await expect(page.locator("body")).not.toContainText("Order Report Results");
      await expect(page.locator("body")).not.toContainText(order!.procedureName);
      const unauthenticatedProcedureText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-172-procedure-protection-unauthenticated",
        description:
          "Captures legacy OpenEMR procedure-results protection markers before an admin session is established.",
        expected: {
          containsOrderReportResults: false,
          containsAnchorProcedureName: false
        },
        actual: summarizeRenderedText(unauthenticatedProcedureText, [
          "Order Report Results",
          order!.procedureName
        ]),
        context: {
          suite: "workflow-procedure-protection",
          workflow: "procedure-protection-unauthenticated"
        }
      });

      await loginToLegacyOpenEmr(page, target);
      await openProcedureResultsDirect(page, target, patient!.pid);
      await expectRenderedText(page, "Order Report Results");
      await expectRenderedText(page, order!.procedureName);
      await expectRenderedText(page, hemoglobin!.text);
      await expectRenderedText(page, /Final|Reviewed|complete/i);
      const authenticatedProcedureText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-172-procedure-protection-authenticated",
        description:
          "Captures legacy OpenEMR procedure-results visibility markers after an admin session is established.",
        expected: {
          containsOrderReportResults: true,
          containsAnchorProcedureName: true,
          containsAnchorResultText: true,
          containsFinalOrReviewedStatus: true,
          passwordMaterialRedacted: true
        },
        actual: {
          rendered: summarizeRenderedText(authenticatedProcedureText, [
            "Order Report Results",
            order!.procedureName,
            hemoglobin!.text,
            "Final",
            "Reviewed",
            "complete"
          ]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-procedure-protection",
          workflow: "procedure-protection-authenticated"
        }
      });
      return;
    }

    const unauthenticatedProcedureResults = await page.request.get(
      `${target.apiBaseUrl}/api/procedures/${encodeURIComponent(patient!.pubpid)}`
    );
    expect(unauthenticatedProcedureResults.status()).toBe(401);
    const unauthenticatedProcedureResultsBody = await expectUnauthenticatedResponse(unauthenticatedProcedureResults);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-172-procedure-protection-unauthenticated-results",
      description:
        "Captures modernized procedure-result API protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        authenticated: false,
        sessionSource: "modernized-openemr"
      },
      actual: {
        statusCode: unauthenticatedProcedureResults.status(),
        body: unauthenticatedProcedureResultsBody
      },
      context: {
        suite: "workflow-procedure-protection",
        workflow: "procedure-protection-unauthenticated-results"
      }
    });

    const unauthenticatedCatalog = await page.request.get(`${target.apiBaseUrl}/api/procedures/order-catalog`);
    expect(unauthenticatedCatalog.status()).toBe(401);
    const unauthenticatedCatalogBody = await expectUnauthenticatedResponse(unauthenticatedCatalog);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-172-procedure-protection-unauthenticated-catalog",
      description:
        "Captures modernized procedure order-catalog API protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        authenticated: false,
        sessionSource: "modernized-openemr"
      },
      actual: {
        statusCode: unauthenticatedCatalog.status(),
        body: unauthenticatedCatalogBody
      },
      context: {
        suite: "workflow-procedure-protection",
        workflow: "procedure-protection-unauthenticated-catalog"
      }
    });

    const unauthenticatedCreate = await page.request.post(`${target.apiBaseUrl}/api/procedures/orders`, {
      data: {
        patientId: patient!.pubpid,
        providerId: 101,
        labId: 501,
        encounterId: 1000013,
        dateOrdered: "2026-06-18",
        priority: "routine",
        status: "pending",
        procedureCode: "85025",
        procedureName: "Blocked Protection Procedure Order",
        procedureType: "laboratory",
        diagnosis: "Z00.00",
        instructions: "This should be blocked without a session."
      }
    });
    expect(unauthenticatedCreate.status()).toBe(401);
    const unauthenticatedCreateBody = await expectUnauthenticatedResponse(unauthenticatedCreate);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-172-procedure-protection-unauthenticated-create",
      description:
        "Captures modernized procedure order-create protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        createRejected: true,
        procedureCode: "85025",
        procedureName: "Blocked Protection Procedure Order"
      },
      actual: {
        statusCode: unauthenticatedCreate.status(),
        body: unauthenticatedCreateBody
      },
      context: {
        suite: "workflow-procedure-protection",
        workflow: "procedure-protection-unauthenticated-create"
      }
    });

    const headers = await getModernizedAdminSessionHeaders(page, target);
    const authenticatedProcedureResults = await page.request.get(
      `${target.apiBaseUrl}/api/procedures/${encodeURIComponent(patient!.pubpid)}`,
      { headers }
    );
    expect(authenticatedProcedureResults.ok()).toBeTruthy();
    const authenticatedPayload = await authenticatedProcedureResults.json() as {
      patientId: string;
      orders: Array<{ name: string; code: string; reports: Array<{ results: Array<{ text: string; result: string }> }> }>;
    };
    expect(authenticatedPayload.patientId).toBe(patient!.pubpid);
    expect(authenticatedPayload.orders.some((item) => item.name === order!.procedureName && item.code === order!.procedureCode)).toBe(true);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-172-procedure-protection-authenticated-results",
      description:
        "Captures modernized procedure-result API visibility facts after an admin session is established, with session headers redacted.",
      expected: {
        statusCode: 200,
        patientId: patient!.pubpid,
        procedureName: order!.procedureName,
        procedureCode: order!.procedureCode,
        resultText: hemoglobin!.text,
        sessionIdentifierRedacted: true
      },
      actual: {
        authenticatedProcedureResults: {
          statusCode: authenticatedProcedureResults.status(),
          patientId: authenticatedPayload.patientId,
          orderCount: authenticatedPayload.orders.length,
          includesAnchorOrder: authenticatedPayload.orders.some(
            (item) => item.name === order!.procedureName && item.code === order!.procedureCode
          ),
          includesAnchorResult: authenticatedPayload.orders.some((item) =>
            item.reports.some((payloadReport) =>
              payloadReport.results.some(
                (result) => result.text === hemoglobin!.text && result.result === hemoglobin!.result
              )
            )
          ),
          sampleOrders: authenticatedPayload.orders.slice(0, 5)
        },
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-procedure-protection",
        workflow: "procedure-protection-authenticated-results"
      }
    });

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Procedures" }).click();
    await expect(page.getByRole("heading", { name: "Procedures", exact: true })).toBeVisible();
    await expect(page.locator('form[aria-label="Procedures access"]')).toBeVisible();
    await expect(page.locator("body")).toContainText("Sign in to load procedure results");
    await expect(page.getByLabel("Procedure patient ID")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save Order" })).toBeDisabled();
    await expect(page.locator("body")).not.toContainText(order!.procedureName);

    await openAuthenticatedModernizedProcedures(page, target, patient!.pubpid);
    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText("Order Report Results");
    await expect(page.locator("body")).toContainText(order!.procedureName);
    await expect(page.locator("body")).toContainText(order!.procedureCode);
    await expect(page.locator("body")).toContainText(hemoglobin!.text);
    await expect(page.locator("body")).toContainText(hemoglobin!.result);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-172-procedure-protection-rendered",
      description:
        "Captures modernized Procedures-page protection rendering facts before and after login.",
      expected: {
        rendersSignedOutPrompt: "Sign in to load procedure results",
        hidesAnchorProcedureBeforeLogin: true,
        disablesPatientSearchBeforeLogin: true,
        disablesSaveBeforeLogin: true,
        rendersOrderReportResults: "Order Report Results",
        rendersProcedureName: order!.procedureName,
        rendersProcedureCode: order!.procedureCode,
        rendersResultText: hemoglobin!.text,
        rendersResultValue: hemoglobin!.result
      },
      actual: {
        surfaceFacts: {
          modernizedProceduresPage: {
            renderedSignedOutPrompt: "Sign in to load procedure results",
            didNotRenderAnchorProcedureBeforeLogin: true,
            disabledPatientSearchBeforeLogin: true,
            disabledSaveBeforeLogin: true,
            renderedPatientHeading: `${patient!.lname}, ${patient!.fname}`,
            renderedOrderReportResults: "Order Report Results",
            renderedProcedureName: order!.procedureName,
            renderedProcedureCode: order!.procedureCode,
            renderedResultText: hemoglobin!.text,
            renderedResultValue: hemoglobin!.result,
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-procedure-protection",
        workflow: "procedure-protection-rendered"
      }
    });
  });
});

async function expectUnauthenticatedResponse(response: { json: () => Promise<unknown> }) {
  const payload = await response.json() as { authenticated?: boolean; sessionSource?: string };
  expect(payload).toMatchObject({
    authenticated: false,
    sessionSource: "modernized-openemr"
  });
  return payload;
}

function summarizeProcedureOrder(order: { procedureName: string; procedureCode?: string; status?: string; dateOrdered?: string }) {
  return {
    procedureName: order.procedureName,
    procedureCode: order.procedureCode,
    status: order.status,
    dateOrdered: order.dateOrdered
  };
}

function summarizeProcedureReport(report: { status?: string; dateCollected?: string; dateReported?: string }) {
  return {
    status: report.status,
    dateCollected: report.dateCollected,
    dateReported: report.dateReported
  };
}

function summarizeProcedureResult(result: { text: string; result?: string; units?: string; range?: string; abnormal?: string }) {
  return {
    text: result.text,
    result: result.result,
    units: result.units,
    range: result.range,
    abnormal: result.abnormal
  };
}

function summarizeRenderedText(text: string | null, markers: string[]) {
  const body = text ?? "";
  return {
    bodyLength: body.length,
    bodyPreview: body.slice(0, 240),
    markers: Object.fromEntries(markers.map((marker) => [marker, body.includes(marker)]))
  };
}
