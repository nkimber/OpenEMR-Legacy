import { test, expect } from "../../src/fixtures/parityTest.js";
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
    lines: Array<{
      id: string;
      code: string;
      codeText: string;
      fee?: number | null;
      modifier?: string | null;
      justify?: string | null;
    }>;
    claims: Array<{
      id: string;
      encounter: number;
      payerId: number;
      payerName?: string | null;
      status: number;
      statusLabel: string;
    }>;
    payments: Array<{
      activityId: string;
      encounter: number;
      payerName?: string | null;
      reference?: string | null;
      code?: string | null;
      payAmount: number;
      adjustmentAmount: number;
    }>;
  }>;
};

type CollectionsWorkQueueResponse = {
  items: Array<{
    pubpid: string;
    recommendedAction: string;
  }>;
};

const billingMutationAuthorizationPatientId = "MOD-PAT-0005";
const billingMutationAuthorizationDate = "2026-06-18";

test.describe("billing mutation authorization policy parity @workflow-billing-mutation-authorization-policy @slice188 @billing @security", () => {
  test("separates Billing view access from write-level revenue-cycle mutations", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(billingMutationAuthorizationPatientId);
    expect(patient).not.toBeNull();

    const encounter = await targetDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    const billingLines = await targetDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
    const officeVisit = billingLines.find((line) => line.code === "99214") ?? billingLines[0];
    expect(officeVisit).toBeTruthy();

    const claims = await targetDb.getClaimsForPatient(patient!.pid);
    expect(claims.length).toBeGreaterThan(0);

    const paymentPostings = await targetDb.getPaymentPostingsForPatient(patient!.pid);
    expect(paymentPostings.length).toBeGreaterThan(0);

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
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
        })
      ])
    );
    expect(accessControl.groupPermissions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "clin",
          sectionValue: "acct",
          permissionValue: "bill"
        })
      ])
    );

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
      await openFeeSheetDirect(page, target, patient!.pid, encounter!.encounter);
      await expectRenderedText(page, "Selected Fee Sheet Codes and Charges");
      await expectRenderedText(page, officeVisit!.code);
      await expectRenderedText(page, officeVisit!.codeText);
      return;
    }

    expect(accessControl.userMemberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userValue: "gold-provider-01",
          groupValue: "clin",
          groupName: "Clinicians"
        })
      ])
    );

    const adminLogin = await modernizedLogin(target, target.credentials.username, target.credentials.password);
    const adminHeaders = { "X-OpenEMR-Session": adminLogin.sessionId! };
    const clinicianBillingViewGrant = {
      groupValue: "clin",
      sectionValue: "acct",
      permissionValue: "bill",
      returnValue: "view"
    };

    let grantActive = false;
    try {
      await putJson<unknown>(
        target,
        "/api/administration/access-control/group-permissions",
        adminHeaders,
        clinicianBillingViewGrant,
        200
      );
      grantActive = true;

      const afterGrant = await targetDb.getAdministrationAccessControl();
      expect(afterGrant.groupPermissions).toEqual(
        expect.arrayContaining([expect.objectContaining(clinicianBillingViewGrant)])
      );
      expect(afterGrant.groupPermissions).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            groupValue: "clin",
            sectionValue: "acct",
            permissionValue: "bill",
            returnValue: "write"
          })
        ])
      );

      const clinicianLogin = await modernizedLogin(target, "gold-provider-01", "pass");
      expect(clinicianLogin).toMatchObject({
        authenticated: true,
        username: "gold-provider-01",
        displayName: "Alex Walker",
        role: "provider",
        staffId: 101
      });
      const clinicianHeaders = { "X-OpenEMR-Session": clinicianLogin.sessionId! };

      const clinicianBilling = await requestText(
        `${target.apiBaseUrl}/api/billing/${encodeURIComponent(patient!.pubpid)}`,
        { headers: clinicianHeaders }
      );
      expect(clinicianBilling.statusCode).toBe(200);
      const billing = JSON.parse(clinicianBilling.body) as PatientBillingResponse;
      const billedEncounter =
        billing.encounters.find((item) => item.encounter === encounter!.encounter)
        ?? billing.encounters.find((item) => item.claims.length > 0 && item.payments.length > 0)
        ?? billing.encounters[0];
      expect(billedEncounter).toBeTruthy();

      const apiLine = billedEncounter.lines.find((line) => line.id === officeVisit!.id) ?? billedEncounter.lines[0];
      const apiClaim = billedEncounter.claims[0] ?? billing.encounters.flatMap((item) => item.claims)[0];
      const apiPayment = billedEncounter.payments[0] ?? billing.encounters.flatMap((item) => item.payments)[0];
      expect(apiLine).toBeTruthy();
      expect(apiClaim).toBeTruthy();
      expect(apiPayment).toBeTruthy();

      const clinicianBatch = await requestText(`${target.apiBaseUrl}/api/billing/statements/batch?limit=5`, {
        headers: clinicianHeaders
      });
      expect(clinicianBatch.statusCode).toBe(200);

      const clinicianQueue = await requestText(`${target.apiBaseUrl}/api/billing/collections/work-queue?limit=5`, {
        headers: clinicianHeaders
      });
      expect(clinicianQueue.statusCode).toBe(200);
      const queue = JSON.parse(clinicianQueue.body) as CollectionsWorkQueueResponse;
      expect(queue.items.length).toBeGreaterThan(0);

      const lineCreate = await postJson<ModernizedAuthorizationFailure>(
        target,
        "/api/billing/lines",
        clinicianHeaders,
        {
          patientId: patient!.pubpid,
          providerId: patient!.providerId,
          encounter: encounter!.encounter,
          billingDate: billingMutationAuthorizationDate,
          codeType: "CPT4",
          code: "99213",
          modifier: "",
          codeText: "Blocked Billing Authorization Line",
          fee: 125,
          units: 1,
          justify: "Z00.00"
        },
        403
      );
      expectBillingWriteAuthorizationFailure(lineCreate);

      const lineUpdate = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/billing/lines/${encodeURIComponent(apiLine.id)}`,
        clinicianHeaders,
        {
          codeText: `${apiLine.codeText} Blocked`,
          modifier: apiLine.modifier ?? "",
          fee: apiLine.fee ?? 125,
          units: 1,
          justify: apiLine.justify ?? "Z00.00"
        },
        403
      );
      expectBillingWriteAuthorizationFailure(lineUpdate);

      const lineStatus = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/billing/lines/${encodeURIComponent(apiLine.id)}/status`,
        clinicianHeaders,
        {
          billed: 1,
          activity: 0
        },
        403
      );
      expectBillingWriteAuthorizationFailure(lineStatus);

      const lineDelete = await deleteJson<ModernizedAuthorizationFailure>(
        target,
        `/api/billing/lines/${encodeURIComponent(apiLine.id)}`,
        clinicianHeaders,
        403
      );
      expectBillingWriteAuthorizationFailure(lineDelete);

      const followUp = await postJson<ModernizedAuthorizationFailure>(
        target,
        "/api/billing/collections/follow-ups",
        clinicianHeaders,
        {
          patientId: queue.items[0].pubpid,
          assignedTo: "billing",
          action: queue.items[0].recommendedAction,
          note: "Blocked by Slice 188 billing mutation authorization policy."
        },
        403
      );
      expectBillingWriteAuthorizationFailure(followUp);

      const claimCreate = await postJson<ModernizedAuthorizationFailure>(
        target,
        "/api/billing/claims",
        clinicianHeaders,
        {
          patientId: patient!.pubpid,
          encounter: encounter!.encounter,
          payerId: 9005,
          payerName: "Northstar HMO",
          payerType: 1,
          status: 1,
          billProcess: 1,
          billTime: "2026-06-18 12:15:00",
          processTime: null,
          processFile: "",
          target: "HCFA",
          x12PartnerId: 0,
          submittedClaim: "Blocked Slice 188 claim create"
        },
        403
      );
      expectBillingWriteAuthorizationFailure(claimCreate);

      const claimUpdate = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/billing/claims/${encodeURIComponent(apiClaim.id)}/status`,
        clinicianHeaders,
        {
          status: 2,
          billProcess: 0,
          processTime: "2026-06-18 14:15:00",
          processFile: "BLOCKED-SLICE-188-837P.txt",
          target: "X12",
          x12PartnerId: 1,
          submittedClaim: "Blocked Slice 188 claim update"
        },
        403
      );
      expectBillingWriteAuthorizationFailure(claimUpdate);

      const claimDelete = await deleteJson<ModernizedAuthorizationFailure>(
        target,
        `/api/billing/claims/${encodeURIComponent(apiClaim.id)}`,
        clinicianHeaders,
        403
      );
      expectBillingWriteAuthorizationFailure(claimDelete);

      const paymentCreate = await postJson<ModernizedAuthorizationFailure>(
        target,
        "/api/billing/payments",
        clinicianHeaders,
        {
          patientId: patient!.pubpid,
          encounter: encounter!.encounter,
          payerId: 9005,
          payerName: "Northstar HMO",
          payerType: 1,
          reference: "EOB-BLOCKED-SLICE-188",
          postDate: billingMutationAuthorizationDate,
          checkDate: billingMutationAuthorizationDate,
          depositDate: billingMutationAuthorizationDate,
          paymentType: "insurance_payment",
          paymentMethod: "check_payment",
          codeType: "CPT4",
          code: officeVisit!.code,
          modifier: officeVisit!.modifier,
          memo: "Blocked Slice 188 payment posting",
          payAmount: 21,
          adjustmentAmount: 3.5,
          accountCode: "CO45",
          reasonCode: "CO-45",
          payerClaimNumber: "NSTAR-BLOCKED-SLICE-188"
        },
        403
      );
      expectBillingWriteAuthorizationFailure(paymentCreate);

      const paymentVoid = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/billing/payments/${encodeURIComponent(apiPayment.activityId)}/void`,
        clinicianHeaders,
        {},
        403
      );
      expectBillingWriteAuthorizationFailure(paymentVoid);

      const paymentDelete = await deleteJson<ModernizedAuthorizationFailure>(
        target,
        `/api/billing/payments/${encodeURIComponent(apiPayment.activityId)}`,
        clinicianHeaders,
        403
      );
      expectBillingWriteAuthorizationFailure(paymentDelete);
    } finally {
      if (grantActive) {
        await requestText(`${target.apiBaseUrl}/api/administration/access-control/group-permissions/clin/acct/bill`, {
          method: "DELETE",
          headers: adminHeaders
        });
      }
    }

    const afterCleanup = await targetDb.getAdministrationAccessControl();
    expect(afterCleanup.groupPermissions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "clin",
          sectionValue: "acct",
          permissionValue: "bill"
        })
      ])
    );

    const afterCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCounts.billingLineItems).toBe(beforeCounts.billingLineItems);
    expect(afterCounts.claims).toBe(beforeCounts.claims);
    expect(afterCounts.paymentSessions).toBe(beforeCounts.paymentSessions);
    expect(afterCounts.paymentActivities).toBe(beforeCounts.paymentActivities);
    expect(afterCounts.messages).toBe(beforeCounts.messages);
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

async function postJson<T>(
  target: RuntimeTarget,
  path: string,
  headers: Record<string, string>,
  payload: unknown,
  expectedStatusCode: number
): Promise<T> {
  return sendJson<T>(target, "POST", path, headers, payload, expectedStatusCode);
}

async function putJson<T>(
  target: RuntimeTarget,
  path: string,
  headers: Record<string, string>,
  payload: unknown,
  expectedStatusCode: number
): Promise<T> {
  return sendJson<T>(target, "PUT", path, headers, payload, expectedStatusCode);
}

async function deleteJson<T>(
  target: RuntimeTarget,
  path: string,
  headers: Record<string, string>,
  expectedStatusCode: number
): Promise<T> {
  const response = await requestText(`${target.apiBaseUrl}${path}`, {
    method: "DELETE",
    headers
  });

  expect(response.statusCode).toBe(expectedStatusCode);
  return JSON.parse(response.body) as T;
}

async function sendJson<T>(
  target: RuntimeTarget,
  method: "POST" | "PUT",
  path: string,
  headers: Record<string, string>,
  payload: unknown,
  expectedStatusCode: number
): Promise<T> {
  const body = JSON.stringify(payload);
  const response = await requestText(`${target.apiBaseUrl}${path}`, {
    method,
    headers: {
      ...headers,
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(body))
    },
    body
  });

  expect(response.statusCode).toBe(expectedStatusCode);
  return JSON.parse(response.body) as T;
}

function expectBillingWriteAuthorizationFailure(response: ModernizedAuthorizationFailure) {
  expect(response).toMatchObject({
    authenticated: true,
    authorized: false,
    username: "gold-provider-01",
    role: "provider",
    requiredSection: "acct",
    requiredPermission: "bill",
    requiredReturnValue: "write",
    sessionSource: "modernized-openemr"
  });
  expect(response.failureReason).toMatch(/not authorized/i);
}
