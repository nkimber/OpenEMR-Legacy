import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { requestText } from "../../src/http/httpClient.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openEncounterDirect,
  openFeeSheetDirect
} from "../../src/ui/legacyOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";

type ModernizedLoginResponse = {
  authenticated: boolean;
  username: string;
  displayName: string;
  role: string;
  staffId?: number | null;
  sessionId?: string | null;
};

type ModernizedAuthorizationFailure = {
  authenticated: boolean;
  authorized: boolean;
  sessionId?: string | null;
  username: string;
  role: string;
  requiredSection: string;
  requiredPermission: string;
  requiredReturnValue: string;
  failureReason?: string | null;
  sessionSource: string;
};

type PatientBillingResponse = {
  patientId: string;
  legacyPid: number;
  patientDisplayName: string;
  encounters: Array<{
    encounter: number;
    lines: Array<{ id: string; code: string; codeText: string; fee?: number | null }>;
  }>;
};

type AccessControlSnapshot = {
  groupPermissions: Array<{
    groupValue: string;
    sectionValue: string;
    permissionValue: string;
    returnValue: string;
  }>;
  userMemberships: Array<{
    userValue: string;
    groupValue: string;
    groupName: string;
  }>;
};

const billingAuthorizationPatientId = "MOD-PAT-0001";

test.describe("billing authorization policy parity @workflow-billing-authorization-policy @slice181 @billing @security", () => {
  test("enforces Billing access for fee sheet and revenue-cycle APIs and UI", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(billingAuthorizationPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    const billingLines = await targetDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
    const officeVisit = billingLines.find((line) => line.code === "99214");
    const venipuncture = billingLines.find((line) => line.code === "36415");
    expect(officeVisit).toBeTruthy();
    expect(venipuncture).toBeTruthy();

    const accessControl = await targetDb.getAdministrationAccessControl();
    expect(accessControl.groupPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "admin",
          sectionValue: "acct",
          permissionValue: "bill",
          returnValue: "write"
        }),
        expect.objectContaining({
          groupValue: "back",
          sectionValue: "acct",
          permissionValue: "bill",
          returnValue: "write"
        }),
        expect.objectContaining({
          groupValue: "front",
          sectionValue: "patients",
          permissionValue: "demo",
          returnValue: "write"
        })
      ])
    );
    expect(accessControl.groupPermissions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "front",
          sectionValue: "acct",
          permissionValue: "bill"
        })
      ])
    );
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-181-billing-authorization-policy-precondition",
      description:
        "Captures the Slice 181 billing authorization-policy precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: billingAuthorizationPatientId,
        anchorBillingCodes: ["99214", "36415"],
        requiredSection: "acct",
        requiredPermission: "bill",
        requiredReturnValue: "view",
        adminWriteSatisfiesView: true,
        billingGroupWriteGrantExists: true,
        frontOfficeGroupDoesNotHaveBillingAccess: true,
        modernizedBillingSummaryPath: "/api/billing/{canonicalId}",
        modernizedBillingBatchPath: "/api/billing/statements/batch",
        modernizedBillingLineCreatePath: "/api/billing/lines",
        secretMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true,
        patient: summarizePatient(patient!),
        encounter: summarizeEncounter(encounter!),
        billingLines: [summarizeBillingLine(officeVisit!), summarizeBillingLine(venipuncture!)],
        accessControl: summarizeAccessControl(accessControl)
      },
      context: {
        suite: "workflow-billing-authorization-policy",
        workflow: "billing-authorization-policy-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
      await openFeeSheetDirect(page, target, patient!.pid, encounter!.encounter);
      await expectRenderedText(page, "Selected Fee Sheet Codes and Charges");
      await expectRenderedText(page, officeVisit!.code);
      await expectRenderedText(page, officeVisit!.codeText);
      await expectRenderedText(page, venipuncture!.code);
      await expectRenderedText(page, venipuncture!.codeText);
      const feeSheetText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-181-billing-authorization-policy-legacy-rendered",
        description:
          "Captures legacy OpenEMR fee-sheet rendering markers after admin login, with credentials redacted.",
        expected: {
          canonicalPatientId: patient!.pubpid,
          encounter: encounter!.encounter,
          containsFeeSheetHeading: "Selected Fee Sheet Codes and Charges",
          containsOfficeVisitCode: officeVisit!.code,
          containsOfficeVisitCodeText: officeVisit!.codeText,
          containsVenipunctureCode: venipuncture!.code,
          containsVenipunctureCodeText: venipuncture!.codeText,
          passwordMaterialRedacted: true
        },
        actual: {
          feeSheet: summarizeRenderedText(feeSheetText, [
            "Selected Fee Sheet Codes and Charges",
            officeVisit!.code,
            officeVisit!.codeText,
            venipuncture!.code,
            venipuncture!.codeText
          ]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-billing-authorization-policy",
          workflow: "billing-authorization-policy-legacy-rendered"
        }
      });
      return;
    }

    const frontDeskLogin = await modernizedLogin(target, "gold-frontdesk-01", "pass");
    expect(frontDeskLogin).toMatchObject({
      authenticated: true,
      username: "gold-frontdesk-01",
      displayName: "Parker Fleming",
      role: "frontdesk",
      staffId: 117
    });
    expect(frontDeskLogin.sessionId).toMatch(/^[0-9a-f-]{36}$/i);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-181-billing-authorization-policy-frontdesk-login",
      description:
        "Captures modernized front-desk session setup for billing policy checks with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: "gold-frontdesk-01",
        role: "frontdesk",
        staffId: 117,
        sessionIdentifierRedacted: true
      },
      actual: summarizeLogin(frontDeskLogin),
      context: {
        suite: "workflow-billing-authorization-policy",
        workflow: "billing-authorization-policy-frontdesk-login"
      }
    });

    const frontDeskBilling = await requestText(
      `${target.apiBaseUrl}/api/billing/${encodeURIComponent(patient!.pubpid)}`,
      {
        headers: {
          "X-OpenEMR-Session": frontDeskLogin.sessionId!
        }
      }
    );
    expect(frontDeskBilling.statusCode).toBe(403);
    const frontDeskFailure = JSON.parse(frontDeskBilling.body) as ModernizedAuthorizationFailure;
    expect(frontDeskFailure).toMatchObject({
      authenticated: true,
      authorized: false,
      username: "gold-frontdesk-01",
      role: "frontdesk",
      requiredSection: "acct",
      requiredPermission: "bill",
      requiredReturnValue: "view",
      sessionSource: "modernized-openemr"
    });
    expect(frontDeskFailure.failureReason).toMatch(/not authorized/i);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-181-billing-authorization-policy-frontdesk-summary-forbidden",
      description:
        "Captures modernized front-desk billing-summary rejection facts with session material redacted.",
      expected: {
        statusCode: 403,
        authenticated: true,
        authorized: false,
        username: "gold-frontdesk-01",
        role: "frontdesk",
        requiredSection: "acct",
        requiredPermission: "bill",
        requiredReturnValue: "view",
        failureReasonContains: "not authorized",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskBilling.statusCode,
        body: summarizeAuthorizationFailure(frontDeskFailure)
      },
      context: {
        suite: "workflow-billing-authorization-policy",
        workflow: "billing-authorization-policy-frontdesk-summary-forbidden"
      }
    });

    const frontDeskBatch = await requestText(`${target.apiBaseUrl}/api/billing/statements/batch?limit=5`, {
      headers: {
        "X-OpenEMR-Session": frontDeskLogin.sessionId!
      }
    });
    expect(frontDeskBatch.statusCode).toBe(403);
    const frontDeskBatchFailure = JSON.parse(frontDeskBatch.body) as ModernizedAuthorizationFailure;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-181-billing-authorization-policy-frontdesk-batch-forbidden",
      description:
        "Captures modernized front-desk statement-batch rejection facts with session material redacted.",
      expected: {
        statusCode: 403,
        batchRejected: true,
        requiredSection: "acct",
        requiredPermission: "bill",
        requiredReturnValue: "view",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskBatch.statusCode,
        body: summarizeAuthorizationFailure(frontDeskBatchFailure)
      },
      context: {
        suite: "workflow-billing-authorization-policy",
        workflow: "billing-authorization-policy-frontdesk-batch-forbidden"
      }
    });

    const frontDeskMutationBody = JSON.stringify({
      patientId: patient!.pubpid,
      encounter: encounter!.encounter,
      billingDate: "2026-06-18",
      codeType: "CPT4",
      code: "99213",
      codeText: "Blocked Billing Authorization Line",
      fee: 125,
      units: 1,
      justify: "Z00.00"
    });
    const frontDeskMutation = await requestText(`${target.apiBaseUrl}/api/billing/lines`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(frontDeskMutationBody)),
        "X-OpenEMR-Session": frontDeskLogin.sessionId!
      },
      body: frontDeskMutationBody
    });
    expect(frontDeskMutation.statusCode).toBe(403);
    const frontDeskMutationFailure = JSON.parse(frontDeskMutation.body) as ModernizedAuthorizationFailure;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-181-billing-authorization-policy-frontdesk-create-forbidden",
      description:
        "Captures modernized front-desk billing-line create rejection facts with request and session material redacted.",
      expected: {
        statusCode: 403,
        createRejected: true,
        requiredSection: "acct",
        requiredPermission: "bill",
        requiredReturnValue: "write",
        submittedCode: "99213",
        submittedCodeText: "Blocked Billing Authorization Line",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskMutation.statusCode,
        body: summarizeAuthorizationFailure(frontDeskMutationFailure),
        request: {
          patientId: patient!.pubpid,
          encounter: encounter!.encounter,
          billingDate: "2026-06-18",
          codeType: "CPT4",
          code: "99213",
          codeText: "Blocked Billing Authorization Line",
          fee: 125,
          units: 1,
          justify: "Z00.00",
          passwordRedacted: true,
          sessionHeaderRedacted: true
        }
      },
      context: {
        suite: "workflow-billing-authorization-policy",
        workflow: "billing-authorization-policy-frontdesk-create-forbidden"
      }
    });

    const adminLogin = await modernizedLogin(target, target.credentials.username, target.credentials.password);
    expect(adminLogin).toMatchObject({
      authenticated: true,
      username: "admin",
      role: "administrator"
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-181-billing-authorization-policy-admin-login",
      description:
        "Captures modernized admin session setup for billing policy checks with password and session identifier redacted.",
      expected: {
        authenticated: true,
        username: "admin",
        role: "administrator",
        sessionIdentifierRedacted: true,
        passwordMaterialRedacted: true
      },
      actual: summarizeLogin(adminLogin),
      context: {
        suite: "workflow-billing-authorization-policy",
        workflow: "billing-authorization-policy-admin-login"
      }
    });

    const adminBilling = await requestText(`${target.apiBaseUrl}/api/billing/${encodeURIComponent(patient!.pubpid)}`, {
      headers: {
        "X-OpenEMR-Session": adminLogin.sessionId!
      }
    });
    expect(adminBilling.statusCode).toBe(200);
    const adminBillingBody = JSON.parse(adminBilling.body) as PatientBillingResponse;
    const adminEncounter = adminBillingBody.encounters.find((item) => item.encounter === encounter!.encounter);
    expect(adminBillingBody).toMatchObject({
      patientId: patient!.pubpid,
      legacyPid: patient!.pid,
      patientDisplayName: `${patient!.lname}, ${patient!.fname}`
    });
    expect(adminEncounter?.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: officeVisit!.code,
          codeText: officeVisit!.codeText
        }),
        expect.objectContaining({
          code: venipuncture!.code,
          codeText: venipuncture!.codeText
        })
      ])
    );
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-181-billing-authorization-policy-admin-summary",
      description:
        "Captures modernized admin billing-summary allow facts with session material redacted.",
      expected: {
        statusCode: 200,
        patientId: patient!.pubpid,
        legacyPid: patient!.pid,
        patientDisplayName: `${patient!.lname}, ${patient!.fname}`,
        encounter: encounter!.encounter,
        officeVisitCode: officeVisit!.code,
        officeVisitCodeText: officeVisit!.codeText,
        venipunctureCode: venipuncture!.code,
        venipunctureCodeText: venipuncture!.codeText,
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: adminBilling.statusCode,
        billingSummary: summarizeBillingSummary(adminBillingBody, encounter!.encounter),
        includesOfficeVisitLine: Boolean(
          adminEncounter?.lines.some((line) => line.code === officeVisit!.code && line.codeText === officeVisit!.codeText)
        ),
        includesVenipunctureLine: Boolean(
          adminEncounter?.lines.some((line) => line.code === venipuncture!.code && line.codeText === venipuncture!.codeText)
        ),
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-billing-authorization-policy",
        workflow: "billing-authorization-policy-admin-summary"
      }
    });

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Fees" }).click();
    await expect(page.getByRole("heading", { name: "Fees", exact: true })).toBeVisible();

    const accessPanel = page.locator('form[aria-label="Billing access"]');
    await accessPanel.getByLabel("Username").fill("gold-frontdesk-01");
    await accessPanel.getByLabel("Password").fill("pass");
    await accessPanel.getByRole("button", { name: "Verify Billing Access" }).click();

    await expect(page.locator("body")).toContainText("Signed in as Parker Fleming");
    await expect(page.locator("body")).toContainText("Patient billing load requires Billing access");
    await expect(page.locator("body")).not.toContainText("Selected Fee Sheet Codes and Charges");
    await expect(page.locator("body")).not.toContainText(officeVisit!.codeText);

    await accessPanel.getByLabel("Username").fill(target.credentials.username);
    await accessPanel.getByLabel("Password").fill(target.credentials.password);
    await accessPanel.getByRole("button", { name: "Verify Billing Access" }).click();
    await expect(page.getByLabel("Fees patient ID")).toBeEnabled();
    await page.getByLabel("Fees patient ID").fill(patient!.pubpid);

    await expect(page.getByRole("heading", { name: adminBillingBody.patientDisplayName })).toBeVisible();
    await expect(page.locator("body")).toContainText("Selected Fee Sheet Codes and Charges");
    await expect(page.locator("body")).toContainText(officeVisit!.code);
    await expect(page.locator("body")).toContainText(officeVisit!.codeText);
    await expect(page.locator("body")).toContainText(venipuncture!.code);
    await expect(page.locator("body")).toContainText(venipuncture!.codeText);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-181-billing-authorization-policy-rendered",
      description:
        "Captures modernized Fees-page ACL retry rendering facts for front-desk denial followed by admin allow.",
      expected: {
        frontDeskSignedIn: "Signed in as Parker Fleming",
        frontDeskDeniedMessage: "Patient billing load requires Billing access",
        hidesFeeSheetForFrontDesk: true,
        rendersPatientHeadingForAdmin: adminBillingBody.patientDisplayName,
        rendersFeeSheetHeadingForAdmin: "Selected Fee Sheet Codes and Charges",
        rendersOfficeVisitCodeForAdmin: officeVisit!.code,
        rendersOfficeVisitCodeTextForAdmin: officeVisit!.codeText,
        rendersVenipunctureCodeForAdmin: venipuncture!.code,
        rendersVenipunctureCodeTextForAdmin: venipuncture!.codeText
      },
      actual: {
        surfaceFacts: {
          modernizedFeesPage: {
            renderedFrontDeskSignedIn: "Signed in as Parker Fleming",
            renderedFrontDeskDeniedMessage: "Patient billing load requires Billing access",
            didNotRenderFeeSheetForFrontDesk: true,
            didNotRenderOfficeVisitForFrontDesk: true,
            renderedPatientHeadingForAdmin: adminBillingBody.patientDisplayName,
            renderedFeeSheetHeadingForAdmin: "Selected Fee Sheet Codes and Charges",
            renderedOfficeVisitCodeForAdmin: officeVisit!.code,
            renderedOfficeVisitCodeTextForAdmin: officeVisit!.codeText,
            renderedVenipunctureCodeForAdmin: venipuncture!.code,
            renderedVenipunctureCodeTextForAdmin: venipuncture!.codeText,
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-billing-authorization-policy",
        workflow: "billing-authorization-policy-rendered"
      }
    });
  });
});

async function modernizedLogin(target: RuntimeTarget, username: string, password: string): Promise<ModernizedLoginResponse> {
  const body = JSON.stringify({ username, password });
  const response = await requestText(`${target.apiBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(body))
    },
    body
  });

  expect(response.statusCode).toBe(200);
  return JSON.parse(response.body) as ModernizedLoginResponse;
}

function summarizePatient(patient: { pubpid: string; pid: number; lname: string; fname: string }) {
  return {
    canonicalId: patient.pubpid,
    legacyPid: patient.pid,
    displayName: `${patient.lname}, ${patient.fname}`
  };
}

function summarizeEncounter(encounter: { encounter: number; date?: string | null; reason?: string | null }) {
  return {
    encounter: encounter.encounter,
    date: encounter.date ?? null,
    reason: encounter.reason ?? null
  };
}

function summarizeBillingLine(line: {
  id?: string | number | null;
  code: string;
  codeText: string;
  fee?: number | string | null;
  units?: number | string | null;
  justify?: string | null;
}) {
  return {
    id: line.id ?? null,
    code: line.code,
    codeText: line.codeText,
    fee: line.fee ?? null,
    units: line.units ?? null,
    justify: line.justify ?? null
  };
}

function summarizeAccessControl(accessControl: AccessControlSnapshot) {
  return {
    groupPermissionCount: accessControl.groupPermissions.length,
    userMembershipCount: accessControl.userMemberships.length,
    adminBillingWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "admin" &&
        permission.sectionValue === "acct" &&
        permission.permissionValue === "bill" &&
        permission.returnValue === "write"
    ),
    backOfficeBillingWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "back" &&
        permission.sectionValue === "acct" &&
        permission.permissionValue === "bill" &&
        permission.returnValue === "write"
    ),
    frontOfficeDemographicsWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "front" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "demo" &&
        permission.returnValue === "write"
    ),
    frontOfficeBillingAccess: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "front" &&
        permission.sectionValue === "acct" &&
        permission.permissionValue === "bill"
    ),
    frontDeskFrontOfficeMembership: accessControl.userMemberships.some(
      (membership) => membership.userValue === "gold-frontdesk-01" && membership.groupValue === "front"
    ),
    sampleGroupPermissions: accessControl.groupPermissions.slice(0, 8),
    sampleUserMemberships: accessControl.userMemberships.slice(0, 8)
  };
}

function summarizeLogin(login: ModernizedLoginResponse) {
  return {
    authenticated: login.authenticated,
    username: login.username,
    displayName: login.displayName,
    role: login.role,
    staffId: login.staffId ?? null,
    hasSessionId: Boolean(login.sessionId),
    sessionIdRedacted: true
  };
}

function summarizeAuthorizationFailure(failure: ModernizedAuthorizationFailure) {
  return {
    authenticated: failure.authenticated,
    authorized: failure.authorized,
    username: failure.username,
    role: failure.role,
    requiredSection: failure.requiredSection,
    requiredPermission: failure.requiredPermission,
    requiredReturnValue: failure.requiredReturnValue,
    failureReason: failure.failureReason,
    sessionSource: failure.sessionSource,
    hasSessionId: Boolean(failure.sessionId),
    sessionIdRedacted: true
  };
}

function summarizeBillingSummary(summary: PatientBillingResponse, encounter: number) {
  const selectedEncounter = summary.encounters.find((item) => item.encounter === encounter) ?? null;
  return {
    patientId: summary.patientId,
    legacyPid: summary.legacyPid,
    patientDisplayName: summary.patientDisplayName,
    encounterCount: summary.encounters.length,
    selectedEncounter: selectedEncounter
      ? {
          encounter: selectedEncounter.encounter,
          lineCount: selectedEncounter.lines.length,
          sampleLines: selectedEncounter.lines.slice(0, 8)
        }
      : null
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
