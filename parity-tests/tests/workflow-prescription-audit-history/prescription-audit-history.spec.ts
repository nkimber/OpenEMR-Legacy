import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedClinicalLists } from "../../src/ui/modernizedOpenEmr.js";

const auditAnchorPatientId = "MOD-PAT-0008";
const pharmacyId = 9001;
const pharmacyName = "Northstar Community Pharmacy";
const pharmacyEmail = "rx@northstar.example.test";
const pharmacyNcpdp = 4501001;
const pharmacyNpi = 1800001001;
const refillDate = "2026-08-20";
const sentAt = "2026-08-21 09:15:00";
const createNote = "Created by the Slice 584 prescription audit history suite.";
const refillNote = "Audit history refill authorized from the modernized Lists workspace.";
const routeNote = "Audit history prescription routed to Northstar Community Pharmacy.";

test.describe("prescription audit history parity @slice584 @workflow-prescription-audit-history @clinical-lists @prescriptions @pharmacy", () => {
  test("records create, refill, and route audit events for a temporary prescription", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(auditAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const drug = `Audit History Prescription ${suffix}`;
    let createdLegacyPharmacy = false;
    let prescriptionId: number | string | null = null;

    try {
      if (target.type === "legacy-openemr") {
        await workflow.createPharmacy({
          id: pharmacyId,
          name: pharmacyName,
          email: pharmacyEmail,
          ncpdp: pharmacyNcpdp,
          npi: pharmacyNpi
        });
        createdLegacyPharmacy = true;
      }

      prescriptionId = await workflow.createPrescription({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        startDate: "2026-08-01",
        drug,
        rxNormCode: "audit-slice-584",
        dosage: "1 tablet daily",
        quantity: "30",
        refills: 1,
        note: createNote,
        diagnosis: "Z00.00"
      });

      await workflow.refillPrescription(prescriptionId, refillDate, 1, refillNote);
      await workflow.routePrescriptionToPharmacy(prescriptionId, pharmacyId, sentAt, routeNote);

      const prescription = await workflow.getPrescription(prescriptionId);
      const history = await workflow.getPrescriptionAuditHistory(prescriptionId);
      const normalizedHistory = normalizeHistory(history.events);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-584-prescription-audit-history",
        description:
          "Captures the Slice 584 temporary prescription audit history after create, refill, and selected-pharmacy route operations.",
        expected: {
          prescription: {
            drug,
            refills: 2,
            pharmacyName,
            pharmacyNcpdp,
            erxUploaded: 1,
            note: routeNote
          },
          audit: [
            {
              action: "create",
              occurredAt: "2026-08-01 10:00:00",
              actor: "admin",
              detail: createNote,
              beforeRefills: null,
              afterRefills: 1,
              pharmacyId: null,
              pharmacyName: null,
              failureReason: null
            },
            {
              action: "refill",
              occurredAt: "2026-08-20 10:00:00",
              actor: "admin",
              detail: refillNote,
              beforeRefills: 1,
              afterRefills: 2,
              pharmacyId: null,
              pharmacyName: null,
              failureReason: null
            },
            {
              action: "route-pharmacy",
              occurredAt: sentAt,
              actor: "admin",
              detail: routeNote,
              beforeRefills: null,
              afterRefills: null,
              pharmacyId,
              pharmacyName,
              failureReason: null
            }
          ],
          counts: {
            prescriptions: beforeCounts.prescriptions + 1
          }
        },
        actual: {
          patient,
          beforeCounts,
          prescriptionId,
          prescription,
          auditHistory: history,
          normalizedHistory
        },
        context: {
          canonicalId: auditAnchorPatientId,
          suite: "workflow-prescription-audit-history",
          workflow: "prescription-audit-history"
        }
      });

      expect(prescription).toMatchObject({
        active: 1,
        refills: 2,
        pharmacyName,
        pharmacyNcpdp,
        erxUploaded: 1,
        note: routeNote
      });
      expect(history.eventCount).toBe(3);
      expect(normalizedHistory).toEqual([
        {
          action: "create",
          occurredAt: "2026-08-01 10:00:00",
          actor: "admin",
          detail: createNote,
          beforeRefills: null,
          afterRefills: 1,
          pharmacyId: null,
          pharmacyName: null,
          failureReason: null
        },
        {
          action: "refill",
          occurredAt: "2026-08-20 10:00:00",
          actor: "admin",
          detail: refillNote,
          beforeRefills: 1,
          afterRefills: 2,
          pharmacyId: null,
          pharmacyName: null,
          failureReason: null
        },
        {
          action: "route-pharmacy",
          occurredAt: sentAt,
          actor: "admin",
          detail: routeNote,
          beforeRefills: null,
          afterRefills: null,
          pharmacyId,
          pharmacyName,
          failureReason: null
        }
      ]);

      if (target.type === "modernized-openemr") {
        await openAuthenticatedModernizedClinicalLists(page, target, patient!.pubpid);
        const prescriptionCard = page.locator("article", { hasText: drug });
        await prescriptionCard.getByRole("button", { name: "History" }).click();
        await expect(page.getByLabel(`Prescription audit history ${drug}`)).toContainText("3");
        await expect(page.getByLabel(`Prescription audit history entries ${drug}`)).toContainText("create");
        await expect(page.getByLabel(`Prescription audit history entries ${drug}`)).toContainText("refill");
        await expect(page.getByLabel(`Prescription audit history entries ${drug}`)).toContainText("route-pharmacy");
        await expect(page.getByLabel(`Prescription audit history entries ${drug}`)).toContainText(pharmacyName);
      }
    } finally {
      if (prescriptionId !== null) {
        await workflow.deletePrescription(prescriptionId);
      }
      if (createdLegacyPharmacy) {
        await workflow.deletePharmacy(pharmacyId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-584-prescription-audit-history-cleanup",
      description: "Captures the Slice 584 cleanup state after hard-deleting the temporary prescription and legacy-only pharmacy fixture.",
      expected: {
        counts: {
          prescriptions: beforeCounts.prescriptions
        }
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        prescriptionId
      },
      context: {
        canonicalId: auditAnchorPatientId,
        suite: "workflow-prescription-audit-history",
        workflow: "prescription-audit-history-cleanup"
      }
    });
    expect(afterCleanupCounts.prescriptions).toBe(beforeCounts.prescriptions);
  });
});

function normalizeHistory(events: Array<{
  action: string;
  occurredAt: string;
  actor: string;
  detail: string | null;
  beforeRefills: number | null;
  afterRefills: number | null;
  pharmacyId: number | null;
  pharmacyName: string | null;
  failureReason: string | null;
}>) {
  return events.map((event) => ({
    action: event.action,
    occurredAt: event.occurredAt,
    actor: event.actor,
    detail: event.detail,
    beforeRefills: event.beforeRefills,
    afterRefills: event.afterRefills,
    pharmacyId: event.pharmacyId,
    pharmacyName: event.pharmacyName,
    failureReason: event.failureReason
  }));
}

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
