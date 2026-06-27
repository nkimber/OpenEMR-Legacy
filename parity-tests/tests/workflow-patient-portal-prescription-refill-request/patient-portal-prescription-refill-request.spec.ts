import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";

const portalClinicalAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const requestDate = "2026-08-20";
const requestNote = "Please review my portal refill request before my next visit.";

test.describe("patient portal prescription refill request parity @slice580 @workflow-patient-portal-prescription-refill-request @patients @portal @prescriptions", () => {
  test("submits a patient-originated prescription refill request through portal secure messaging", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalClinicalAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const drug = `Portal Refill Request ${workflowSuffix()}`;
    const title = `Prescription refill request - ${drug}`;
    let prescriptionId: number | string | null = null;

    try {
      prescriptionId = await workflow.createPrescription({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        startDate: "2026-08-01",
        drug,
        rxNormCode: "1049502",
        dosage: "1 tablet daily",
        quantity: "30",
        refills: 1,
        note: "Created by the Slice 580 portal refill request suite.",
        diagnosis: "Z00.00"
      });

      const created = await workflow.getPrescription(prescriptionId);
      expect(created).toMatchObject({
        drug,
        active: 1,
        endDate: null
      });

      let requestResult;
      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        const prescriptionRegion = page.getByRole("region", { name: "Patient portal prescriptions" });
        const prescriptionCard = prescriptionRegion.locator("article.clinical-item").filter({ hasText: drug }).first();
        await expect(prescriptionCard).toContainText(drug);
        await prescriptionCard.getByRole("button", { name: "Request refill" }).click();
        await expect(page.locator("body")).toContainText(`Prescription refill request sent for ${drug}`);
        const messages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
        requestResult = {
          authenticated: true,
          created: messages.sentMessages.some((message) => message.title === title),
          sentMessage: messages.sentMessages.find((message) => message.title === title) ?? null,
          recipientMessage: messages.allMessages.find((message) => message.title === title && message.recipientId === "admin") ?? null,
          messageCount: messages.messageCount,
          sentMessageCount: messages.sentMessageCount,
          failureReason: null,
          sessionSource: "modernized-openemr-portal"
        };
      } else {
        requestResult = await workflow.requestPatientPortalPrescriptionRefill(portalLoginUsername, portalPassword, {
          prescriptionId,
          requestDate,
          note: requestNote
        });
      }

      expect(requestResult).toMatchObject({
        authenticated: true,
        created: true,
        failureReason: null
      });
      expect(requestResult.sentMessage).toMatchObject({
        title,
        status: "New",
        senderId: portalLoginUsername,
        recipientId: "admin",
        portalRelation: "portal:prescription-refill-request"
      });
      expect(requestResult.sentMessage?.body).toContain(`Prescription: ${drug}`);
      expect(requestResult.sentMessage?.body).toContain(`Prescription ID: ${prescriptionId}`);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-580-patient-portal-prescription-refill-request-result",
        description:
          "Captures the Slice 580 patient-originated refill request after creating mailbox-style sent and recipient rows for the temporary active prescription.",
        expected: {
          title,
          portalRelation: "portal:prescription-refill-request",
          recipientId: "admin",
          prescriptionActive: 1,
          prescriptionEndDate: null,
          counts: {
            prescriptions: beforeCounts.prescriptions + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          prescriptionId,
          prescription: created,
          requestResult: summarizeRequestResult(requestResult)
        },
        context: {
          canonicalId: portalClinicalAnchorPatientId,
          suite: "workflow-patient-portal-prescription-refill-request",
          workflow: "patient-portal-prescription-refill-request"
        }
      });
    } finally {
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
      if (prescriptionId !== null) {
        await workflow.deletePrescription(prescriptionId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-580-patient-portal-prescription-refill-request-cleanup",
      description:
        "Captures the Slice 580 cleanup state after removing the temporary portal refill request mailbox rows and prescription.",
      expected: {
        counts: {
          prescriptions: beforeCounts.prescriptions
        }
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        prescriptionId,
        title
      },
      context: {
        canonicalId: portalClinicalAnchorPatientId,
        suite: "workflow-patient-portal-prescription-refill-request",
        workflow: "patient-portal-prescription-refill-request-cleanup"
      }
    });
    expect(afterCleanupCounts.prescriptions).toBe(beforeCounts.prescriptions);
  });
});

function summarizeRequestResult(result: any) {
  return {
    authenticated: result.authenticated,
    created: result.created,
    recipientId: result.recipientId,
    recipientName: result.recipientName,
    sentMessage: result.sentMessage ? {
      id: result.sentMessage.id,
      title: result.sentMessage.title,
      date: result.sentMessage.date,
      status: result.sentMessage.status,
      senderId: result.sentMessage.senderId,
      recipientId: result.sentMessage.recipientId,
      portalRelation: result.sentMessage.portalRelation,
      body: result.sentMessage.body
    } : null,
    recipientMessage: result.recipientMessage ? {
      id: result.recipientMessage.id,
      title: result.recipientMessage.title,
      ownerRecipient: result.recipientMessage.recipientId,
      portalRelation: result.recipientMessage.portalRelation
    } : null,
    messageCount: result.messageCount,
    sentMessageCount: result.sentMessageCount,
    failureReason: result.failureReason,
    sessionSource: result.sessionSource
  };
}

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
