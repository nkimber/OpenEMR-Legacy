import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedClinicalLists } from "../../src/ui/modernizedOpenEmr.js";

const portalClinicalAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const requestDate = "2026-08-20";
const requestNote = "Please approve this refill request from the staff queue.";
const approvalNote = "Portal refill request approved from the modernized Lists workspace.";

test.describe("prescription refill request approval parity @slice581 @workflow-prescription-refill-request-approval @clinical-lists @portal @prescriptions", () => {
  test("approves a patient-originated refill request from the staff clinical queue", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalClinicalAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const drug = `Portal Refill Approval ${workflowSuffix()}`;
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
        note: "Created by the Slice 581 refill request approval suite.",
        diagnosis: "Z00.00"
      });

      const requestResult = await workflow.requestPatientPortalPrescriptionRefill(portalLoginUsername, portalPassword, {
        prescriptionId,
        requestDate,
        note: requestNote
      });
      expect(requestResult).toMatchObject({
        authenticated: true,
        created: true,
        failureReason: null
      });

      const queue = await workflow.getPrescriptionRefillRequestQueue(patient!.pid);
      const queuedRequest = queue.find((item) => item.title === title);
      expect(queuedRequest).toBeTruthy();
      expect(queuedRequest).toMatchObject({
        drug,
        prescriptionId: String(prescriptionId),
        currentRefills: 1,
        status: "New",
        patientNote: requestNote
      });

      let approvalResult;
      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedClinicalLists(page, target, patient!.pubpid);
        const queueRegion = page.locator("section.clinical-section", { hasText: "Refill Requests" });
        await expect(queueRegion).toContainText("Refill Requests");
        const requestCard = queueRegion.locator("article", { hasText: drug }).first();
        await expect(requestCard).toContainText(requestNote);
        await requestCard.getByRole("button", { name: "Approve" }).click();
        await expect(requestCard).toHaveCount(0);
        const prescription = await workflow.getPrescription(prescriptionId);
        approvalResult = {
          approved: Boolean(prescription),
          messageId: queuedRequest!.messageId,
          prescriptionId: String(prescriptionId),
          refills: prescription?.refills ?? 0,
          modifiedDate: prescription?.modifiedDate ?? null,
          note: prescription?.note ?? null,
          status: "Done",
          failureReason: null
        };
      } else {
        approvalResult = await workflow.approvePrescriptionRefillRequest(queuedRequest!.messageId, requestDate, 1, approvalNote);
      }

      const afterQueue = await workflow.getPrescriptionRefillRequestQueue(patient!.pid);
      const approvedPrescription = await workflow.getPrescription(prescriptionId);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-581-prescription-refill-request-approved",
        description:
          "Captures the Slice 581 staff approval after a portal-originated refill request is removed from the pending queue and the prescription receives one additional refill.",
        expected: {
          title,
          prescription: {
            refills: 2,
            modifiedDate: requestDate,
            note: approvalNote,
            active: 1,
            endDate: null
          },
          requestStatus: "Done",
          queueRemoved: true,
          counts: {
            prescriptions: beforeCounts.prescriptions + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          prescriptionId,
          queuedRequest,
          approvalResult,
          approvedPrescription,
          remainingQueueTitles: afterQueue.map((item) => item.title)
        },
        context: {
          canonicalId: portalClinicalAnchorPatientId,
          suite: "workflow-prescription-refill-request-approval",
          workflow: "prescription-refill-request-approval"
        }
      });

      expect(approvedPrescription).toMatchObject({
        refills: 2,
        modifiedDate: requestDate,
        note: approvalNote,
        active: 1,
        endDate: null
      });
      expect(afterQueue.some((item) => item.title === title)).toBe(false);
      expect(approvalResult).toMatchObject({
        approved: true,
        status: "Done",
        failureReason: null
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
      probe: "slice-581-prescription-refill-request-approval-cleanup",
      description:
        "Captures the Slice 581 cleanup state after removing the temporary refill request mailbox rows and prescription.",
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
        suite: "workflow-prescription-refill-request-approval",
        workflow: "prescription-refill-request-approval-cleanup"
      }
    });
    expect(afterCleanupCounts.prescriptions).toBe(beforeCounts.prescriptions);
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
