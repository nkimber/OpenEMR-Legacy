import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedFees } from "../../src/ui/modernizedOpenEmr.js";

const receiptAnchorPatientId = "MOD-PAT-0005";
const receiptAnchorEncounter = 1000052;
const receiptPostDate = "2026-06-18";

test.describe("patient payment receipt export parity @slice525 @workflow-patient-payment-receipts @mutation @billing", () => {
  test("generates a deterministic receipt for a posted patient payment", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(receiptAnchorPatientId);
    expect(patient).not.toBeNull();
    const patientDisplayName = `${patient!.lname}, ${patient!.fname}`;

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const reference = `RCPT-DOWNLOAD-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const paymentInput = {
      patientId: patient!.pid,
      encounter: receiptAnchorEncounter,
      payerId: 0,
      payerName: "",
      payerType: 0,
      reference,
      postDate: receiptPostDate,
      paymentType: "patient_payment",
      paymentMethod: "cash",
      codeType: "CPT4",
      code: "99214",
      memo: "Receipt parity patient payment",
      payAmount: "42.00",
      adjustmentAmount: "0.00",
      accountCode: "",
      reasonCode: "",
      payerClaimNumber: ""
    };
    let patientPaymentId: number | string | null = null;

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-525-patient-payment-receipt-precondition",
        description: "Captures the Slice 525 receipt anchor patient and temporary patient-payment payload before receipt generation.",
        expected: {
          patient: {
            pubpid: receiptAnchorPatientId
          },
          encounter: receiptAnchorEncounter,
          receipt: {
            title: "Payment Receipt",
            contentType: "application/pdf",
            postDate: receiptPostDate,
            payAmount: "42.00",
            paymentMethod: "cash"
          },
          countChange: {
            paymentSessionsAfterCreate: beforeCounts.paymentSessions + 1,
            paymentActivitiesAfterCreate: beforeCounts.paymentActivities + 1,
            paymentSessionsAfterCleanup: beforeCounts.paymentSessions,
            paymentActivitiesAfterCleanup: beforeCounts.paymentActivities
          }
        },
        actual: {
          patient,
          beforeCounts,
          proposedPayment: paymentInput
        },
        context: {
          canonicalId: receiptAnchorPatientId,
          encounter: receiptAnchorEncounter,
          suite: "workflow-patient-payment-receipts",
          workflow: "patient-payment-receipt-precondition"
        }
      });

      patientPaymentId = await workflow.createPaymentPosting(paymentInput);
      const created = await workflow.getPaymentPosting(patientPaymentId);
      expect(created).not.toBeNull();
      expect(created).toMatchObject({
        patientId: patient!.pid,
        encounter: receiptAnchorEncounter,
        reference,
        paymentType: "patient_payment",
        paymentMethod: "cash",
        postDate: receiptPostDate,
        memo: "Receipt parity patient payment",
        payAmount: "42.00",
        adjustmentAmount: "0.00",
        deleted: ""
      });

      const receiptNumber = `RCPT-${patient!.pubpid}-${receiptPostDate.replaceAll("-", "")}-${String(created!.sequenceNo).padStart(3, "0")}`;
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-525-patient-payment-receipt-contract",
        description: "Captures the deterministic Slice 525 payment receipt contract derived from the created patient payment posting.",
        expected: {
          receiptNumber,
          fileName: `${receiptNumber}.pdf`,
          contentType: "application/pdf",
          pdfHeader: "%PDF-1.4",
          textAnchors: [
            `Payment Receipt ${receiptNumber}`,
            patientDisplayName,
            `Patient ID ${patient!.pubpid}`,
            `Encounter ${receiptAnchorEncounter}`,
            `Posted date ${receiptPostDate}`,
            "Payer Patient",
            `Reference ${reference}`,
            "Payment method cash",
            "Payment amount $42.00",
            "Adjustment amount $0.00"
          ]
        },
        actual: {
          patient,
          patientDisplayName,
          created,
          receiptNumber
        },
        context: {
          canonicalId: receiptAnchorPatientId,
          encounter: receiptAnchorEncounter,
          suite: "workflow-patient-payment-receipts",
          workflow: "patient-payment-receipt-contract"
        }
      });

      if (target.type !== "legacy-openemr") {
        const receiptResponse = await page.request.get(
          `${target.apiBaseUrl}/api/billing/payments/${encodeURIComponent(String(patientPaymentId))}/receipt.pdf`,
          { headers: await getModernizedAdminSessionHeaders(page, target) }
        );
        expect(receiptResponse.ok()).toBeTruthy();
        expect(receiptResponse.headers()["content-type"]).toContain("application/pdf");
        expect(receiptResponse.headers()["content-disposition"]).toContain(`${receiptNumber}.pdf`);

        const pdfText = (await receiptResponse.body()).toString("ascii");
        expect(pdfText.startsWith("%PDF-1.4")).toBeTruthy();
        expect(pdfText).toContain(`Payment Receipt ${receiptNumber}`);
        expect(pdfText).toContain(patientDisplayName);
        expect(pdfText).toContain(`Patient ID ${patient!.pubpid}`);
        expect(pdfText).toContain(`Encounter ${receiptAnchorEncounter}`);
        expect(pdfText).toContain(`Reference ${reference}`);
        expect(pdfText).toContain("Payment method cash");
        expect(pdfText).toContain("Payment amount $42.00");

        await openAuthenticatedModernizedFees(page, target, patient!.pubpid);
        const body = page.locator("body");
        await expect(body).toContainText(reference);
        await expect(body).toContainText("Paid $42.00");
        await expect(page.getByRole("button", { name: "Receipt" }).first()).toBeVisible();
      }
    } finally {
      if (patientPaymentId !== null) {
        await workflow.voidPaymentPosting(patientPaymentId).catch(() => undefined);
        await workflow.deletePaymentPosting(patientPaymentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-525-patient-payment-receipt-cleanup",
      description: "Captures the final Slice 525 cleanup state after the temporary receipt-backed patient payment is removed.",
      expected: {
        counts: {
          paymentSessions: beforeCounts.paymentSessions,
          paymentActivities: beforeCounts.paymentActivities
        },
        deletedPayment: null
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        patientPaymentId,
        afterCleanup: patientPaymentId === null ? null : await workflow.getPaymentPosting(patientPaymentId)
      },
      context: {
        canonicalId: receiptAnchorPatientId,
        encounter: receiptAnchorEncounter,
        suite: "workflow-patient-payment-receipts",
        workflow: "patient-payment-receipt-cleanup"
      }
    });
    expect(afterCleanupCounts.paymentSessions).toBe(beforeCounts.paymentSessions);
    expect(afterCleanupCounts.paymentActivities).toBe(beforeCounts.paymentActivities);
  });
});
