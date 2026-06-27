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

type PatientSummaryInput = {
  pid: number;
  pubpid: string;
  fname: string;
  lname: string;
  dob?: string | null;
  providerId?: number | null;
};

type EncounterSummaryInput = {
  encounter: number;
  date?: string | null;
  reason?: string | null;
};

type BillingLineSummaryInput = {
  id?: string | number | null;
  code: string;
  codeText?: string | null;
  fee?: string | number | null;
  modifier?: string | null;
  justify?: string | null;
};

const billingMutationAuthorizationPatientId = "MOD-PAT-0005";
const billingMutationAuthorizationDate = "2026-06-18";

test.describe("billing mutation authorization policy parity @workflow-billing-mutation-authorization-policy @slice188 @billing @security", () => {
  test("separates Billing view access from write-level revenue-cycle mutations", async ({ page, target, targetDb }, testInfo) => {
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-188-billing-mutation-authorization-policy-precondition",
      description:
        "Captures the Slice 188 billing mutation authorization-policy precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: billingMutationAuthorizationPatientId,
        billingMutationAuthorizationDate,
        adminBillingWrite: true,
        backOfficeBillingWrite: true,
        clinicianBillingGrantAbsentBeforeTest: true,
        modernizedBillingSummaryPath: "/api/billing/{patientId}",
        modernizedStatementBatchPath: "/api/billing/statements/batch",
        modernizedCollectionsQueuePath: "/api/billing/collections/work-queue",
        modernizedBillingLinePath: "/api/billing/lines",
        modernizedClaimPath: "/api/billing/claims",
        modernizedPaymentPath: "/api/billing/payments/insurance-payments",
        modernizedCollectionsFollowUpPath: "/api/billing/collections/follow-ups",
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
        officeVisit: summarizeBillingLine(officeVisit!),
        claimCount: claims.length,
        paymentPostingCount: paymentPostings.length,
        beforeCounts,
        accessControl: summarizeAccessControl(accessControl)
      },
      context: {
        suite: "workflow-billing-mutation-authorization-policy",
        workflow: "billing-mutation-authorization-policy-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
      await openFeeSheetDirect(page, target, patient!.pid, encounter!.encounter);
      await expectRenderedText(page, "Selected Fee Sheet Codes and Charges");
      await expectRenderedText(page, officeVisit!.code);
      await expectRenderedText(page, officeVisit!.codeText);
      const feeSheetText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-188-billing-mutation-authorization-policy-legacy-rendered",
        description:
          "Captures legacy OpenEMR Fee Sheet rendering markers after admin login, with credentials redacted.",
        expected: {
          canonicalPatientId: patient!.pubpid,
          encounter: encounter!.encounter,
          containsFeeSheetHeading: "Selected Fee Sheet Codes and Charges",
          containsOfficeVisitCode: officeVisit!.code,
          containsOfficeVisitText: officeVisit!.codeText,
          passwordMaterialRedacted: true
        },
        actual: {
          feeSheetPage: summarizeRenderedText(feeSheetText, [
            "Selected Fee Sheet Codes and Charges",
            officeVisit!.code,
            officeVisit!.codeText
          ]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-billing-mutation-authorization-policy",
          workflow: "billing-mutation-authorization-policy-legacy-rendered"
        }
      });
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-188-billing-mutation-authorization-policy-admin-login",
      description:
        "Captures modernized admin session setup for temporary Billing view-grant management with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: target.credentials.username,
        role: "admin",
        sessionIdentifierRedacted: true
      },
      actual: summarizeLogin(adminLogin),
      context: {
        suite: "workflow-billing-mutation-authorization-policy",
        workflow: "billing-mutation-authorization-policy-admin-login"
      }
    });
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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-188-billing-mutation-authorization-policy-view-grant",
        description:
          "Captures the temporary Clinicians Billing view grant and proves Billing write remains absent.",
        expected: {
          clinicianBillingView: true,
          clinicianBillingWrite: false,
          grantWillBeRemoved: true,
          sessionIdentifierRedacted: true
        },
        actual: {
          accessControl: summarizeAccessControl(afterGrant),
          grantedPermission: clinicianBillingViewGrant,
          adminSessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-billing-mutation-authorization-policy",
          workflow: "billing-mutation-authorization-policy-view-grant"
        }
      });

      const clinicianLogin = await modernizedLogin(target, "gold-provider-01", "pass");
      expect(clinicianLogin).toMatchObject({
        authenticated: true,
        username: "gold-provider-01",
        displayName: "Alex Walker",
        role: "provider",
        staffId: 101
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-188-billing-mutation-authorization-policy-clinician-login",
        description:
          "Captures modernized clinician session setup for Billing view/read and write-denial checks with the session identifier redacted.",
        expected: {
          authenticated: true,
          username: "gold-provider-01",
          role: "provider",
          staffId: 101,
          sessionIdentifierRedacted: true
        },
        actual: summarizeLogin(clinicianLogin),
        context: {
          suite: "workflow-billing-mutation-authorization-policy",
          workflow: "billing-mutation-authorization-policy-clinician-login"
        }
      });
      const clinicianHeaders = { "X-OpenEMR-Session": clinicianLogin.sessionId! };

      const retiredBroadPaymentCreate = await requestText(`${target.apiBaseUrl}/api/billing/payments`, {
        method: "POST",
        headers: {
          ...adminHeaders,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          patientId: patient!.pubpid,
          encounter: encounter!.encounter,
          paymentType: "insurance_payment"
        })
      });
      expect(retiredBroadPaymentCreate.statusCode).toBe(405);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-569-billing-focused-payment-contract-broad-create-retired",
        description:
          "Captures that the modernized broad payment-create endpoint is retired even for admin sessions, leaving focused payment operations as the only create entry points.",
        expected: {
          retiredPath: "/api/billing/payments",
          statusCode: 405,
          focusedInsurancePaymentPath: "/api/billing/payments/insurance-payments",
          secretMaterialRedacted: true
        },
        actual: {
          statusCode: retiredBroadPaymentCreate.statusCode,
          responseBodyLength: retiredBroadPaymentCreate.body.length,
          adminSessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-billing-mutation-authorization-policy",
          workflow: "billing-focused-payment-contract-broad-create-retired"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-188-billing-mutation-authorization-policy-clinician-read",
        description:
          "Captures modernized clinician Billing view access across fee-sheet, statement batch, and collections queue reads.",
        expected: {
          billingStatusCode: 200,
          statementBatchStatusCode: 200,
          collectionsQueueStatusCode: 200,
          requiredSection: "acct",
          requiredPermission: "bill",
          requiredReturnValue: "view",
          sessionIdentifierRedacted: true
        },
        actual: {
          billingStatusCode: clinicianBilling.statusCode,
          statementBatchStatusCode: clinicianBatch.statusCode,
          collectionsQueueStatusCode: clinicianQueue.statusCode,
          billing: summarizeBillingSummary(billing, encounter!.encounter),
          selectedLine: summarizeBillingLine(apiLine),
          selectedClaim: summarizeClaim(apiClaim),
          selectedPayment: summarizePayment(apiPayment),
          collectionsQueue: summarizeCollectionsQueue(queue),
          sessionHeaderRedacted: true
        },
        context: {
          suite: "workflow-billing-mutation-authorization-policy",
          workflow: "billing-mutation-authorization-policy-clinician-read"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-188-billing-mutation-authorization-policy-clinician-line-create-forbidden",
        description:
          "Captures modernized clinician billing-line create denial facts with session material redacted.",
        expected: authorizationDenialExpectation("line-create", null),
        actual: { denial: summarizeAuthorizationFailure(lineCreate), sessionHeaderRedacted: true },
        context: {
          suite: "workflow-billing-mutation-authorization-policy",
          workflow: "billing-mutation-authorization-policy-clinician-line-create-forbidden"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-188-billing-mutation-authorization-policy-clinician-line-update-forbidden",
        description:
          "Captures modernized clinician billing-line update denial facts with session material redacted.",
        expected: authorizationDenialExpectation("line-update", apiLine.id),
        actual: { denial: summarizeAuthorizationFailure(lineUpdate), sessionHeaderRedacted: true },
        context: {
          suite: "workflow-billing-mutation-authorization-policy",
          workflow: "billing-mutation-authorization-policy-clinician-line-update-forbidden"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-188-billing-mutation-authorization-policy-clinician-line-status-forbidden",
        description:
          "Captures modernized clinician billing-line status denial facts with session material redacted.",
        expected: authorizationDenialExpectation("line-status", apiLine.id),
        actual: { denial: summarizeAuthorizationFailure(lineStatus), sessionHeaderRedacted: true },
        context: {
          suite: "workflow-billing-mutation-authorization-policy",
          workflow: "billing-mutation-authorization-policy-clinician-line-status-forbidden"
        }
      });

      const lineDelete = await deleteJson<ModernizedAuthorizationFailure>(
        target,
        `/api/billing/lines/${encodeURIComponent(apiLine.id)}`,
        clinicianHeaders,
        403
      );
      expectBillingWriteAuthorizationFailure(lineDelete);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-188-billing-mutation-authorization-policy-clinician-line-delete-forbidden",
        description:
          "Captures modernized clinician billing-line delete denial facts with session material redacted.",
        expected: authorizationDenialExpectation("line-delete", apiLine.id),
        actual: { denial: summarizeAuthorizationFailure(lineDelete), sessionHeaderRedacted: true },
        context: {
          suite: "workflow-billing-mutation-authorization-policy",
          workflow: "billing-mutation-authorization-policy-clinician-line-delete-forbidden"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-188-billing-mutation-authorization-policy-clinician-follow-up-forbidden",
        description:
          "Captures modernized clinician collections follow-up denial facts with session material redacted.",
        expected: authorizationDenialExpectation("collections-follow-up", queue.items[0].pubpid),
        actual: { denial: summarizeAuthorizationFailure(followUp), sessionHeaderRedacted: true },
        context: {
          suite: "workflow-billing-mutation-authorization-policy",
          workflow: "billing-mutation-authorization-policy-clinician-follow-up-forbidden"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-188-billing-mutation-authorization-policy-clinician-claim-create-forbidden",
        description:
          "Captures modernized clinician claim create denial facts with session material redacted.",
        expected: authorizationDenialExpectation("claim-create", null),
        actual: { denial: summarizeAuthorizationFailure(claimCreate), sessionHeaderRedacted: true },
        context: {
          suite: "workflow-billing-mutation-authorization-policy",
          workflow: "billing-mutation-authorization-policy-clinician-claim-create-forbidden"
        }
      });

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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-188-billing-mutation-authorization-policy-clinician-claim-update-forbidden",
        description:
          "Captures modernized clinician claim status/update denial facts with session material redacted.",
        expected: authorizationDenialExpectation("claim-update", apiClaim.id),
        actual: { denial: summarizeAuthorizationFailure(claimUpdate), sessionHeaderRedacted: true },
        context: {
          suite: "workflow-billing-mutation-authorization-policy",
          workflow: "billing-mutation-authorization-policy-clinician-claim-update-forbidden"
        }
      });

      const claimDelete = await deleteJson<ModernizedAuthorizationFailure>(
        target,
        `/api/billing/claims/${encodeURIComponent(apiClaim.id)}`,
        clinicianHeaders,
        403
      );
      expectBillingWriteAuthorizationFailure(claimDelete);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-188-billing-mutation-authorization-policy-clinician-claim-delete-forbidden",
        description:
          "Captures modernized clinician claim delete denial facts with session material redacted.",
        expected: authorizationDenialExpectation("claim-delete", apiClaim.id),
        actual: { denial: summarizeAuthorizationFailure(claimDelete), sessionHeaderRedacted: true },
        context: {
          suite: "workflow-billing-mutation-authorization-policy",
          workflow: "billing-mutation-authorization-policy-clinician-claim-delete-forbidden"
        }
      });

      const paymentCreate = await postJson<ModernizedAuthorizationFailure>(
        target,
        "/api/billing/payments/insurance-payments",
        clinicianHeaders,
        {
          patientId: patient!.pubpid,
          encounter: encounter!.encounter,
          payerId: 9005,
          payerName: "Northstar HMO",
          reference: "EOB-BLOCKED-SLICE-188",
          postDate: billingMutationAuthorizationDate,
          checkDate: billingMutationAuthorizationDate,
          depositDate: billingMutationAuthorizationDate,
          paymentMethod: "check_payment",
          codeType: "CPT4",
          code: officeVisit!.code,
          modifier: officeVisit!.modifier,
          memo: "Blocked Slice 188 payment posting",
          payAmount: 21,
          adjustmentAmount: 3.5,
          reasonCode: "CO-45",
          payerClaimNumber: "NSTAR-BLOCKED-SLICE-188"
        },
        403
      );
      expectBillingWriteAuthorizationFailure(paymentCreate);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-188-billing-mutation-authorization-policy-clinician-payment-create-forbidden",
        description:
          "Captures modernized clinician payment create denial facts with session material redacted.",
        expected: authorizationDenialExpectation("payment-create", null),
        actual: { denial: summarizeAuthorizationFailure(paymentCreate), sessionHeaderRedacted: true },
        context: {
          suite: "workflow-billing-mutation-authorization-policy",
          workflow: "billing-mutation-authorization-policy-clinician-payment-create-forbidden"
        }
      });

      const paymentVoid = await putJson<ModernizedAuthorizationFailure>(
        target,
        `/api/billing/payments/${encodeURIComponent(apiPayment.activityId)}/void`,
        clinicianHeaders,
        {},
        403
      );
      expectBillingWriteAuthorizationFailure(paymentVoid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-188-billing-mutation-authorization-policy-clinician-payment-void-forbidden",
        description:
          "Captures modernized clinician payment void denial facts with session material redacted.",
        expected: authorizationDenialExpectation("payment-void", apiPayment.activityId),
        actual: { denial: summarizeAuthorizationFailure(paymentVoid), sessionHeaderRedacted: true },
        context: {
          suite: "workflow-billing-mutation-authorization-policy",
          workflow: "billing-mutation-authorization-policy-clinician-payment-void-forbidden"
        }
      });

      const paymentDelete = await deleteJson<ModernizedAuthorizationFailure>(
        target,
        `/api/billing/payments/${encodeURIComponent(apiPayment.activityId)}`,
        clinicianHeaders,
        403
      );
      expectBillingWriteAuthorizationFailure(paymentDelete);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-188-billing-mutation-authorization-policy-clinician-payment-delete-forbidden",
        description:
          "Captures modernized clinician payment delete denial facts with session material redacted.",
        expected: authorizationDenialExpectation("payment-delete", apiPayment.activityId),
        actual: { denial: summarizeAuthorizationFailure(paymentDelete), sessionHeaderRedacted: true },
        context: {
          suite: "workflow-billing-mutation-authorization-policy",
          workflow: "billing-mutation-authorization-policy-clinician-payment-delete-forbidden"
        }
      });
    } finally {
      if (grantActive) {
        const grantDelete = await requestText(`${target.apiBaseUrl}/api/administration/access-control/group-permissions/clin/acct/bill`, {
          method: "DELETE",
          headers: adminHeaders
        });
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-188-billing-mutation-authorization-policy-grant-delete",
          description:
            "Captures modernized admin removal of the temporary Clinicians Billing view grant with session material redacted.",
          expected: {
            statusCode: 204,
            clinicianBillingGrantRemoved: true,
            requiredSection: "acct",
            requiredPermission: "bill",
            requiredReturnValue: "write",
            sessionIdentifierRedacted: true
          },
          actual: {
            statusCode: grantDelete.statusCode,
            deletedPermission: clinicianBillingViewGrant,
            sessionHeaderRedacted: true
          },
          context: {
            suite: "workflow-billing-mutation-authorization-policy",
            workflow: "billing-mutation-authorization-policy-grant-delete"
          }
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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-188-billing-mutation-authorization-policy-cleanup",
      description:
        "Captures final cleanup proving the temporary Billing view grant is absent and revenue-cycle counts returned to the Slice 188 baseline.",
      expected: {
        clinicianBillingGrantAbsent: true,
        billingLineItems: beforeCounts.billingLineItems,
        claims: beforeCounts.claims,
        paymentSessions: beforeCounts.paymentSessions,
        paymentActivities: beforeCounts.paymentActivities,
        messages: beforeCounts.messages,
        secretMaterialRedacted: true
      },
      actual: {
        accessControl: summarizeAccessControl(afterCleanup),
        beforeCounts,
        afterCounts
      },
      context: {
        suite: "workflow-billing-mutation-authorization-policy",
        workflow: "billing-mutation-authorization-policy-cleanup"
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

function authorizationDenialExpectation(operation: string, resourceId: string | number | null) {
  return {
    statusCode: 403,
    operation,
    resourceId,
    requiredSection: "acct",
    requiredPermission: "bill",
    requiredReturnValue: "write",
    sessionIdentifierRedacted: true
  };
}

function summarizePatient(patient: PatientSummaryInput) {
  return {
    pid: patient.pid,
    pubpid: patient.pubpid,
    firstName: patient.fname,
    lastName: patient.lname,
    dateOfBirth: patient.dob ?? null,
    providerId: patient.providerId ?? null
  };
}

function summarizeEncounter(encounter: EncounterSummaryInput) {
  return {
    encounter: encounter.encounter,
    date: encounter.date ?? null,
    reason: encounter.reason ?? null
  };
}

function summarizeBillingLine(line: BillingLineSummaryInput) {
  return {
    id: line.id ?? null,
    code: line.code,
    codeText: line.codeText ?? null,
    fee: line.fee ?? null,
    modifier: line.modifier ?? null,
    justify: line.justify ?? null
  };
}

function summarizeAccessControl(accessControl: AccessControlSnapshot) {
  const hasPermission = (groupValue: string, returnValue?: string) =>
    accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === groupValue &&
        permission.sectionValue === "acct" &&
        permission.permissionValue === "bill" &&
        (returnValue === undefined || permission.returnValue === returnValue)
    );

  return {
    adminBillingWrite: hasPermission("admin", "write"),
    backOfficeBillingWrite: hasPermission("back", "write"),
    clinicianBillingAny: hasPermission("clin"),
    clinicianBillingView: hasPermission("clin", "view"),
    clinicianBillingWrite: hasPermission("clin", "write"),
    clinicianMembership: accessControl.userMemberships.some(
      (membership) =>
        membership.userValue === "gold-provider-01" &&
        membership.groupValue === "clin" &&
        membership.groupName === "Clinicians"
    )
  };
}

function summarizeLogin(login: ModernizedLoginResponse) {
  return {
    authenticated: login.authenticated,
    username: login.username,
    displayName: login.displayName,
    role: login.role,
    staffId: login.staffId ?? null,
    sessionIdentifierPresent: Boolean(login.sessionId),
    sessionIdentifierRedacted: true
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
          claimCount: selectedEncounter.claims.length,
          paymentCount: selectedEncounter.payments.length,
          sampleLines: selectedEncounter.lines.slice(0, 5).map(summarizeBillingLine),
          sampleClaims: selectedEncounter.claims.slice(0, 3).map(summarizeClaim),
          samplePayments: selectedEncounter.payments.slice(0, 3).map(summarizePayment)
        }
      : null
  };
}

function summarizeClaim(claim: PatientBillingResponse["encounters"][number]["claims"][number]) {
  return {
    id: claim.id,
    encounter: claim.encounter,
    payerId: claim.payerId,
    payerName: claim.payerName ?? null,
    status: claim.status,
    statusLabel: claim.statusLabel
  };
}

function summarizePayment(payment: PatientBillingResponse["encounters"][number]["payments"][number]) {
  return {
    activityId: payment.activityId,
    encounter: payment.encounter,
    payerName: payment.payerName ?? null,
    reference: payment.reference ?? null,
    code: payment.code ?? null,
    payAmount: payment.payAmount,
    adjustmentAmount: payment.adjustmentAmount
  };
}

function summarizeCollectionsQueue(queue: CollectionsWorkQueueResponse) {
  return {
    itemCount: queue.items.length,
    sampleItems: queue.items.slice(0, 5).map((item) => ({
      pubpid: item.pubpid,
      recommendedAction: item.recommendedAction
    }))
  };
}

function summarizeAuthorizationFailure(response: ModernizedAuthorizationFailure) {
  return {
    authenticated: response.authenticated,
    authorized: response.authorized,
    username: response.username,
    role: response.role,
    requiredSection: response.requiredSection,
    requiredPermission: response.requiredPermission,
    requiredReturnValue: response.requiredReturnValue,
    failureReason: response.failureReason ?? null,
    sessionSource: response.sessionSource,
    sessionIdentifierPresent: Boolean(response.sessionId),
    sessionIdentifierRedacted: true
  };
}

function summarizeRenderedText(text: string | null, markers: string[]) {
  const normalized = (text ?? "").replace(/\s+/g, " ").trim();
  return {
    textLength: normalized.length,
    preview: normalized.slice(0, 240),
    containsMarkers: Object.fromEntries(markers.map((marker) => [marker, normalized.includes(marker)]))
  };
}
