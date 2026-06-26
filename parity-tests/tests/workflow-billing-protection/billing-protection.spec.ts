import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openEncounterDirect,
  openFeeSheetDirect
} from "../../src/ui/legacyOpenEmr.js";
import {
  getModernizedAdminSessionHeaders,
  openAuthenticatedModernizedFees
} from "../../src/ui/modernizedOpenEmr.js";

const billingProtectionPatientId = "MOD-PAT-0001";

test.describe("billing protection parity @slice171 @billing-protection", () => {
  test("requires an active session before fee sheet and revenue-cycle data are visible", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(billingProtectionPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    const billingLines = await targetDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
    const officeVisit = billingLines.find((line) => line.code === "99214");
    const venipuncture = billingLines.find((line) => line.code === "36415");
    expect(officeVisit).toBeTruthy();
    expect(venipuncture).toBeTruthy();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-171-billing-protection-precondition",
      description:
        "Captures the Slice 171 billing protection precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: billingProtectionPatientId,
        anchorBillingCodes: ["99214", "36415"],
        legacyFeeSheetPath: "/interface/forms/fee_sheet/new.php",
        modernizedBillingSummaryPath: "/api/billing/{canonicalId}",
        modernizedBillingBatchPath: "/api/billing/statements/batch",
        modernizedBillingLineCreatePath: "/api/billing/lines",
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
        encounter: {
          encounter: encounter!.encounter,
          date: encounter!.date,
          reason: encounter!.reason
        },
        billingLines: [summarizeBillingLine(officeVisit!), summarizeBillingLine(venipuncture!)]
      },
      context: {
        suite: "workflow-billing-protection",
        workflow: "billing-protection-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await page.goto(`${target.publicUrl}/interface/forms/fee_sheet/new.php?pid=${patient!.pid}&encounter=${encounter!.encounter}`);
      await expect(page.locator("body")).not.toContainText("Selected Fee Sheet Codes and Charges");
      await expect(page.locator("body")).not.toContainText(officeVisit!.codeText);
      const unauthenticatedFeeSheetText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-171-billing-protection-unauthenticated",
        description:
          "Captures legacy OpenEMR fee-sheet protection markers before an admin session is established.",
        expected: {
          containsFeeSheetHeading: false,
          containsOfficeVisitCodeText: false
        },
        actual: summarizeRenderedText(unauthenticatedFeeSheetText, [
          "Selected Fee Sheet Codes and Charges",
          officeVisit!.codeText
        ]),
        context: {
          suite: "workflow-billing-protection",
          workflow: "billing-protection-unauthenticated"
        }
      });

      await loginToLegacyOpenEmr(page, target);
      await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
      await openFeeSheetDirect(page, target, patient!.pid, encounter!.encounter);
      await expectRenderedText(page, "Selected Fee Sheet Codes and Charges");
      await expectRenderedText(page, officeVisit!.code);
      await expectRenderedText(page, officeVisit!.codeText);
      await expectRenderedText(page, venipuncture!.code);
      await expectRenderedText(page, venipuncture!.codeText);
      const authenticatedFeeSheetText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-171-billing-protection-authenticated",
        description:
          "Captures legacy OpenEMR fee-sheet visibility markers after an admin session is established.",
        expected: {
          containsFeeSheetHeading: true,
          containsOfficeVisitCode: true,
          containsOfficeVisitCodeText: true,
          containsVenipunctureCode: true,
          containsVenipunctureCodeText: true,
          passwordMaterialRedacted: true
        },
        actual: {
          rendered: summarizeRenderedText(authenticatedFeeSheetText, [
            "Selected Fee Sheet Codes and Charges",
            officeVisit!.code,
            officeVisit!.codeText,
            venipuncture!.code,
            venipuncture!.codeText
          ]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-billing-protection",
          workflow: "billing-protection-authenticated"
        }
      });
      return;
    }

    const unauthenticatedBilling = await page.request.get(
      `${target.apiBaseUrl}/api/billing/${encodeURIComponent(patient!.pubpid)}`
    );
    expect(unauthenticatedBilling.status()).toBe(401);
    const unauthenticatedBillingBody = await expectUnauthenticatedResponse(unauthenticatedBilling);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-171-billing-protection-unauthenticated-summary",
      description:
        "Captures modernized billing summary API protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        authenticated: false,
        sessionSource: "modernized-openemr"
      },
      actual: {
        statusCode: unauthenticatedBilling.status(),
        body: unauthenticatedBillingBody
      },
      context: {
        suite: "workflow-billing-protection",
        workflow: "billing-protection-unauthenticated-summary"
      }
    });

    const unauthenticatedBatch = await page.request.get(`${target.apiBaseUrl}/api/billing/statements/batch?limit=5`);
    expect(unauthenticatedBatch.status()).toBe(401);
    const unauthenticatedBatchBody = await expectUnauthenticatedResponse(unauthenticatedBatch);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-171-billing-protection-unauthenticated-batch",
      description:
        "Captures modernized statement batch API protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        authenticated: false,
        sessionSource: "modernized-openemr"
      },
      actual: {
        statusCode: unauthenticatedBatch.status(),
        body: unauthenticatedBatchBody
      },
      context: {
        suite: "workflow-billing-protection",
        workflow: "billing-protection-unauthenticated-batch"
      }
    });

    const unauthenticatedCreate = await page.request.post(`${target.apiBaseUrl}/api/billing/lines`, {
      data: {
        patientId: patient!.pubpid,
        encounter: encounter!.encounter,
        billingDate: "2026-06-18",
        codeType: "CPT4",
        code: "99213",
        codeText: "Blocked Protection Billing Line",
        fee: 125,
        units: 1,
        justify: "Z00.00"
      }
    });
    expect(unauthenticatedCreate.status()).toBe(401);
    const unauthenticatedCreateBody = await expectUnauthenticatedResponse(unauthenticatedCreate);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-171-billing-protection-unauthenticated-create",
      description:
        "Captures modernized billing-line create protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        createRejected: true,
        code: "99213",
        codeText: "Blocked Protection Billing Line"
      },
      actual: {
        statusCode: unauthenticatedCreate.status(),
        body: unauthenticatedCreateBody
      },
      context: {
        suite: "workflow-billing-protection",
        workflow: "billing-protection-unauthenticated-create"
      }
    });

    const headers = await getModernizedAdminSessionHeaders(page, target);
    const authenticatedBilling = await page.request.get(
      `${target.apiBaseUrl}/api/billing/${encodeURIComponent(patient!.pubpid)}`,
      { headers }
    );
    expect(authenticatedBilling.ok()).toBeTruthy();
    const authenticatedPayload = await authenticatedBilling.json() as {
      patientId: string;
      patientDisplayName: string;
      encounters: Array<{ encounter: number; lines: Array<{ code: string; codeText: string }> }>;
    };
    const authenticatedEncounter = authenticatedPayload.encounters.find((item) => item.encounter === encounter!.encounter);
    expect(authenticatedPayload.patientId).toBe(patient!.pubpid);
    expect(authenticatedEncounter?.lines.some((line) => line.code === officeVisit!.code && line.codeText === officeVisit!.codeText)).toBe(true);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-171-billing-protection-authenticated-summary",
      description:
        "Captures modernized billing summary API visibility facts after an admin session is established, with session headers redacted.",
      expected: {
        statusCode: 200,
        patientId: patient!.pubpid,
        encounter: encounter!.encounter,
        officeVisitCode: officeVisit!.code,
        officeVisitCodeText: officeVisit!.codeText,
        sessionIdentifierRedacted: true
      },
      actual: {
        authenticatedBilling: {
          statusCode: authenticatedBilling.status(),
          patientId: authenticatedPayload.patientId,
          patientDisplayName: authenticatedPayload.patientDisplayName,
          encounterCount: authenticatedPayload.encounters.length,
          includesAnchorEncounter: Boolean(authenticatedEncounter),
          includesOfficeVisitLine: Boolean(
            authenticatedEncounter?.lines.some(
              (line) => line.code === officeVisit!.code && line.codeText === officeVisit!.codeText
            )
          ),
          sampleLines: authenticatedEncounter?.lines.slice(0, 5) ?? []
        },
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-billing-protection",
        workflow: "billing-protection-authenticated-summary"
      }
    });

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Fees" }).click();
    await expect(page.getByRole("heading", { name: "Fees", exact: true })).toBeVisible();
    await expect(page.locator('form[aria-label="Billing access"]')).toBeVisible();
    await expect(page.locator("body")).toContainText("Sign in to load fee sheet data");
    await expect(page.getByLabel("Fees patient ID")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save CPT" })).toBeDisabled();
    await expect(page.locator("body")).not.toContainText(officeVisit!.codeText);

    await openAuthenticatedModernizedFees(page, target, patient!.pubpid);
    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText("Selected Fee Sheet Codes and Charges");
    await expect(page.locator("body")).toContainText(officeVisit!.code);
    await expect(page.locator("body")).toContainText(officeVisit!.codeText);
    await expect(page.locator("body")).toContainText(venipuncture!.code);
    await expect(page.locator("body")).toContainText(venipuncture!.codeText);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-171-billing-protection-rendered",
      description:
        "Captures modernized Fees-page protection rendering facts before and after login.",
      expected: {
        rendersSignedOutPrompt: "Sign in to load fee sheet data",
        hidesOfficeVisitBeforeLogin: true,
        disablesPatientSearchBeforeLogin: true,
        disablesSaveBeforeLogin: true,
        rendersFeeSheetHeading: "Selected Fee Sheet Codes and Charges",
        rendersOfficeVisitCode: officeVisit!.code,
        rendersOfficeVisitCodeText: officeVisit!.codeText,
        rendersVenipunctureCode: venipuncture!.code,
        rendersVenipunctureCodeText: venipuncture!.codeText
      },
      actual: {
        surfaceFacts: {
          modernizedFeesPage: {
            renderedSignedOutPrompt: "Sign in to load fee sheet data",
            didNotRenderOfficeVisitBeforeLogin: true,
            disabledPatientSearchBeforeLogin: true,
            disabledSaveBeforeLogin: true,
            renderedPatientHeading: `${patient!.lname}, ${patient!.fname}`,
            renderedFeeSheetHeading: "Selected Fee Sheet Codes and Charges",
            renderedOfficeVisitCode: officeVisit!.code,
            renderedOfficeVisitCodeText: officeVisit!.codeText,
            renderedVenipunctureCode: venipuncture!.code,
            renderedVenipunctureCodeText: venipuncture!.codeText,
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-billing-protection",
        workflow: "billing-protection-rendered"
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

function summarizeBillingLine(line: { code: string; codeText: string; fee?: number | string; units?: number | string; justify?: string | null }) {
  return {
    code: line.code,
    codeText: line.codeText,
    fee: line.fee,
    units: line.units,
    justify: line.justify ?? null
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
