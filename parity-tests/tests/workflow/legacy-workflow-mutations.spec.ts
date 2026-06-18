import { test, expect } from "../../src/fixtures/parityTest.js";
import { loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";

test.describe("legacy workflow mutation contract @workflow @mutation", () => {
  test("updates patient contact data and renders the change in the legacy chart", async ({
    page,
    target,
    legacyDb,
    legacyWorkflow
  }) => {
    const patient = await legacyDb.findPatientByCanonicalId("MOD-PAT-0001");
    expect(patient).not.toBeNull();

    const original = await legacyWorkflow.getPatientContact(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient contact record.");
    }

    const updated = {
      ...original,
      phoneHome: "(619) 555-9101",
      phoneCell: "(619) 555-9102",
      email: `parity-${workflowSuffix()}@example.test`,
      hipaaAllowSms: "YES",
      hipaaAllowEmail: "YES"
    };

    try {
      await legacyWorkflow.updatePatientContact(updated);
      const actual = await legacyWorkflow.getPatientContact(patient!.pid);
      expect(actual).toEqual(updated);

      await loginToLegacyOpenEmr(page, target);
      await openPatientSummaryDirect(page, target, patient!.pid);
      await expect(page.locator("body")).toContainText(updated.email);
    } finally {
      await legacyWorkflow.updatePatientContact(original);
    }

    const restored = await legacyWorkflow.getPatientContact(patient!.pid);
    expect(restored).toEqual(original);
  });

  test("creates, cancels, and removes a future appointment with count probes", async ({ legacyDb, legacyWorkflow }) => {
    const patient = await legacyDb.findPatientByCanonicalId("MOD-PAT-0003");
    expect(patient).not.toBeNull();

    const beforeCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Appointment ${workflowSuffix()}`;
    let appointmentId: number | null = null;

    try {
      appointmentId = await legacyWorkflow.createAppointment({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-10-15",
        startTime: "10:30:00",
        endTime: "11:00:00",
        durationSeconds: 1800,
        homeText: "Created by the parity workflow mutation suite.",
        facilityId: 10,
        billingLocationId: 10,
        room: "Parity"
      });

      const created = await legacyWorkflow.getAppointment(appointmentId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        title,
        eventDate: "2026-10-15",
        startTime: "10:30:00",
        endTime: "11:00:00",
        status: "-"
      });

      const afterCreateCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 1);

      const cancelledTitle = `${title} Cancelled`;
      await legacyWorkflow.updateAppointmentStatus(appointmentId, "x", cancelledTitle);
      const cancelled = await legacyWorkflow.getAppointment(appointmentId);
      expect(cancelled).toMatchObject({
        title: cancelledTitle,
        status: "x"
      });
    } finally {
      if (appointmentId !== null) {
        await legacyWorkflow.deleteAppointment(appointmentId);
      }
    }

    const afterCleanupCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.appointments).toBe(beforeCounts.appointments);
    if (appointmentId !== null) {
      await expect(legacyWorkflow.getAppointment(appointmentId)).resolves.toBeNull();
    }
  });

  test("creates, deactivates, and removes a clinical allergy list entry", async ({ legacyDb, legacyWorkflow }) => {
    const patient = await legacyDb.findPatientByCanonicalId("MOD-PAT-0006");
    expect(patient).not.toBeNull();

    const beforeCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Allergy ${workflowSuffix()}`;
    let listEntryId: number | null = null;

    try {
      listEntryId = await legacyWorkflow.createClinicalListEntry({
        patientId: patient!.pid,
        type: "allergy",
        title,
        dateTime: "2026-06-18 09:00:00",
        comments: "Created by the parity workflow mutation suite.",
        reaction: "Rash",
        severity: "mild",
        listOptionId: "parity-allergy"
      });

      const created = await legacyWorkflow.getClinicalListEntry(listEntryId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        type: "allergy",
        title,
        activity: 1,
        reaction: "Rash",
        severity: "mild"
      });

      const afterCreateCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.allergies).toBe(beforeCounts.allergies + 1);

      const inactiveComment = "Deactivated by the parity workflow mutation suite.";
      await legacyWorkflow.deactivateClinicalListEntry(listEntryId, inactiveComment);
      const inactive = await legacyWorkflow.getClinicalListEntry(listEntryId);
      expect(inactive).toMatchObject({
        activity: 0,
        comments: inactiveComment
      });
    } finally {
      if (listEntryId !== null) {
        await legacyWorkflow.deleteClinicalListEntry(listEntryId);
      }
    }

    const afterCleanupCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.allergies).toBe(beforeCounts.allergies);
    if (listEntryId !== null) {
      await expect(legacyWorkflow.getClinicalListEntry(listEntryId)).resolves.toBeNull();
    }
  });

  test("creates, closes, soft-deletes, and removes a patient message", async ({ legacyDb, legacyWorkflow }) => {
    const patient = await legacyDb.findPatientByCanonicalId("MOD-PAT-0001");
    expect(patient).not.toBeNull();

    const beforeCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
    const title = `Parity Message ${workflowSuffix()}`;
    let messageId: number | null = null;

    try {
      messageId = await legacyWorkflow.createPatientMessage({
        patientId: patient!.pid,
        title,
        body: "Created by the parity workflow mutation suite.",
        assignedTo: "admin"
      });

      const created = await legacyWorkflow.getPatientMessage(messageId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        title,
        status: "New",
        assignedTo: "admin",
        deleted: 0
      });

      const afterCreateCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.messages).toBe(beforeCounts.messages + 1);

      const closedBody = "Closed by the parity workflow mutation suite.";
      await legacyWorkflow.updatePatientMessageStatus(messageId, "Done", closedBody);
      const closed = await legacyWorkflow.getPatientMessage(messageId);
      expect(closed).toMatchObject({
        body: closedBody,
        status: "Done"
      });

      await legacyWorkflow.softDeletePatientMessage(messageId);
      const deleted = await legacyWorkflow.getPatientMessage(messageId);
      expect(deleted).toMatchObject({
        deleted: 1
      });
    } finally {
      if (messageId !== null) {
        await legacyWorkflow.deletePatientMessage(messageId);
      }
    }

    const afterCleanupCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.messages).toBe(beforeCounts.messages);
    if (messageId !== null) {
      await expect(legacyWorkflow.getPatientMessage(messageId)).resolves.toBeNull();
    }
  });

  test("creates, deactivates, and removes a prescription", async ({ legacyDb, legacyWorkflow }) => {
    const patient = await legacyDb.findPatientByCanonicalId("MOD-PAT-0008");
    expect(patient).not.toBeNull();

    const beforeCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
    const drug = `Parity Medication ${workflowSuffix()}`;
    let prescriptionId: number | null = null;

    try {
      prescriptionId = await legacyWorkflow.createPrescription({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        startDate: "2026-07-15",
        drug,
        rxNormCode: "1049502",
        dosage: "1 tablet daily",
        quantity: "30",
        refills: 1,
        note: "Created by the parity workflow mutation suite.",
        diagnosis: "Z00.00"
      });

      const created = await legacyWorkflow.getPrescription(prescriptionId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        startDate: "2026-07-15",
        drug,
        dosage: "1 tablet daily",
        quantity: "30",
        refills: 1,
        active: 1
      });

      const afterCreateCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.prescriptions).toBe(beforeCounts.prescriptions + 1);

      const inactiveNote = "Deactivated by the parity workflow mutation suite.";
      await legacyWorkflow.deactivatePrescription(prescriptionId, "2026-08-15", inactiveNote);
      const inactive = await legacyWorkflow.getPrescription(prescriptionId);
      expect(inactive).toMatchObject({
        active: 0,
        endDate: "2026-08-15",
        note: inactiveNote
      });
    } finally {
      if (prescriptionId !== null) {
        await legacyWorkflow.deletePrescription(prescriptionId);
      }
    }

    const afterCleanupCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.prescriptions).toBe(beforeCounts.prescriptions);
    if (prescriptionId !== null) {
      await expect(legacyWorkflow.getPrescription(prescriptionId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-16) || "local";
}
