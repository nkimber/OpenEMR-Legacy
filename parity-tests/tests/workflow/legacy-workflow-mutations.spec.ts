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

  test("creates, updates, and removes an encounter with vitals and SOAP details", async ({ legacyDb, legacyWorkflow }) => {
    const patient = await legacyDb.findPatientByCanonicalId("MOD-PAT-0002");
    expect(patient).not.toBeNull();

    const beforeCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
    const reason = `Parity Encounter ${workflowSuffix()}`;
    let encounterId: number | null = null;
    let vitalsId: number | null = null;
    let soapId: number | null = null;

    try {
      encounterId = await legacyWorkflow.createEncounter({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        dateTime: "2026-06-18 10:00:00",
        reason,
        facilityId: 10,
        facilityName: "OpenEMR Modernization Clinic",
        billingFacilityId: 10,
        billingNote: "Created by the parity workflow mutation suite."
      });

      const createdEncounter = await legacyWorkflow.getEncounter(encounterId);
      expect(createdEncounter).toMatchObject({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        date: "2026-06-18",
        reason,
        facilityId: 10,
        billingFacilityId: 10
      });

      vitalsId = await legacyWorkflow.createVitals({
        patientId: patient!.pid,
        encounter: createdEncounter!.encounter,
        dateTime: "2026-06-18 10:05:00",
        bps: "128",
        bpd: "76",
        weight: 186,
        height: 70,
        pulse: 72,
        oxygenSaturation: 98,
        note: "Parity vitals detail."
      });

      const vitals = await legacyWorkflow.getVitals(vitalsId);
      expect(vitals).toMatchObject({
        patientId: patient!.pid,
        bps: "128",
        bpd: "76",
        weight: 186,
        height: 70,
        pulse: 72,
        oxygenSaturation: 98,
        note: "Parity vitals detail."
      });

      soapId = await legacyWorkflow.createSoapNote({
        patientId: patient!.pid,
        encounter: createdEncounter!.encounter,
        dateTime: "2026-06-18 10:10:00",
        subjective: "Patient reports parity workflow symptoms are stable.",
        objective: "Vitals reviewed during parity workflow.",
        assessment: "Stable parity workflow condition.",
        plan: "Continue parity workflow validation."
      });

      const soap = await legacyWorkflow.getSoapNote(soapId);
      expect(soap).toMatchObject({
        patientId: patient!.pid,
        subjective: "Patient reports parity workflow symptoms are stable.",
        objective: "Vitals reviewed during parity workflow.",
        assessment: "Stable parity workflow condition.",
        plan: "Continue parity workflow validation."
      });

      const afterCreateCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterCreateCounts.vitals).toBe(beforeCounts.vitals + 1);
      expect(afterCreateCounts.clinicalNotes).toBe(beforeCounts.clinicalNotes + 1);

      const updatedReason = `${reason} Updated`;
      const updatedBillingNote = "Updated by the parity workflow mutation suite.";
      await legacyWorkflow.updateEncounterReason(encounterId, updatedReason, updatedBillingNote);
      const updatedEncounter = await legacyWorkflow.getEncounter(encounterId);
      expect(updatedEncounter).toMatchObject({
        reason: updatedReason,
        billingNote: updatedBillingNote
      });
    } finally {
      if (soapId !== null) {
        await legacyWorkflow.deleteSoapNote(soapId);
      }
      if (vitalsId !== null) {
        await legacyWorkflow.deleteVitals(vitalsId);
      }
      if (encounterId !== null) {
        await legacyWorkflow.deleteEncounter(encounterId);
      }
    }

    const afterCleanupCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.vitals).toBe(beforeCounts.vitals);
    expect(afterCleanupCounts.clinicalNotes).toBe(beforeCounts.clinicalNotes);
  });

  test("creates, marks billed, deactivates, and removes a CPT billing line", async ({ legacyDb, legacyWorkflow }) => {
    const patient = await legacyDb.findPatientByCanonicalId("MOD-PAT-0004");
    expect(patient).not.toBeNull();

    const beforeCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
    let encounterId: number | null = null;
    let billingLineId: number | null = null;

    try {
      encounterId = await legacyWorkflow.createEncounter({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        dateTime: "2026-06-18 11:00:00",
        reason: `Parity Billing Encounter ${workflowSuffix()}`,
        facilityId: 10,
        facilityName: "OpenEMR Modernization Clinic",
        billingFacilityId: 10,
        billingNote: "Billing line test encounter."
      });
      const encounter = await legacyWorkflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      billingLineId = await legacyWorkflow.createBillingLine({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        encounter: encounter!.encounter,
        dateTime: "2026-06-18 11:10:00",
        codeType: "CPT4",
        code: "99213",
        codeText: "Established patient office visit",
        fee: "125.00",
        units: 1,
        justify: "Z00.00"
      });

      const created = await legacyWorkflow.getBillingLine(billingLineId);
      expect(created).toMatchObject({
        patientId: patient!.pid,
        encounter: encounter!.encounter,
        codeType: "CPT4",
        code: "99213",
        codeText: "Established patient office visit",
        fee: "125.00",
        units: 1,
        activity: 1,
        billed: 0
      });

      const afterCreateCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterCreateCounts.billingLineItems).toBe(beforeCounts.billingLineItems + 1);

      await legacyWorkflow.updateBillingLineStatus(billingLineId, 1, 0);
      const inactive = await legacyWorkflow.getBillingLine(billingLineId);
      expect(inactive).toMatchObject({
        billed: 1,
        activity: 0
      });
    } finally {
      if (billingLineId !== null) {
        await legacyWorkflow.deleteBillingLine(billingLineId);
      }
      if (encounterId !== null) {
        await legacyWorkflow.deleteEncounter(encounterId);
      }
    }

    const afterCleanupCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.billingLineItems).toBe(beforeCounts.billingLineItems);
    if (billingLineId !== null) {
      await expect(legacyWorkflow.getBillingLine(billingLineId)).resolves.toBeNull();
    }
  });

  test("creates, completes, reports, and removes a lab procedure workflow", async ({ legacyDb, legacyWorkflow }) => {
    const patient = await legacyDb.findPatientByCanonicalId("MOD-PAT-0009");
    expect(patient).not.toBeNull();

    const beforeCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
    let encounterId: number | null = null;
    let procedureOrderId: number | null = null;
    let procedureReportId: number | null = null;
    let procedureResultId: number | null = null;

    try {
      encounterId = await legacyWorkflow.createEncounter({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        dateTime: "2026-06-18 12:00:00",
        reason: `Parity Lab Encounter ${workflowSuffix()}`,
        facilityId: 10,
        facilityName: "OpenEMR Modernization Clinic",
        billingFacilityId: 10,
        billingNote: "Procedure workflow test encounter."
      });
      const encounter = await legacyWorkflow.getEncounter(encounterId);
      expect(encounter).not.toBeNull();

      procedureOrderId = await legacyWorkflow.createProcedureOrder({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        encounterId: encounter!.encounter,
        dateOrdered: "2026-06-18 12:15:00",
        priority: "routine",
        status: "pending",
        procedureCode: "80053",
        procedureName: "Comprehensive metabolic panel",
        procedureType: "laboratory",
        diagnosis: "Z00.00",
        instructions: "Created by the parity workflow mutation suite."
      });

      const order = await legacyWorkflow.getProcedureOrder(procedureOrderId);
      expect(order).toMatchObject({
        patientId: patient!.pid,
        encounterId: encounter!.encounter,
        orderStatus: "pending",
        orderPriority: "routine",
        procedureCode: "80053",
        procedureName: "Comprehensive metabolic panel",
        procedureType: "laboratory"
      });

      const afterOrderCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterOrderCounts.encounters).toBe(beforeCounts.encounters + 1);
      expect(afterOrderCounts.procedureOrders).toBe(beforeCounts.procedureOrders + 1);

      await legacyWorkflow.updateProcedureOrderStatus(procedureOrderId, "complete");
      const completedOrder = await legacyWorkflow.getProcedureOrder(procedureOrderId);
      expect(completedOrder).toMatchObject({
        orderStatus: "complete"
      });

      procedureReportId = await legacyWorkflow.createProcedureReport({
        orderId: procedureOrderId,
        dateCollected: "2026-06-18 12:30:00",
        dateReport: "2026-06-18 13:00:00",
        specimenNumber: `PARITY-${workflowSuffix()}`,
        reportStatus: "final",
        reviewStatus: "reviewed",
        notes: "Parity procedure report."
      });

      const report = await legacyWorkflow.getProcedureReport(procedureReportId);
      expect(report).toMatchObject({
        orderId: procedureOrderId,
        reportStatus: "final",
        reviewStatus: "reviewed",
        reportNotes: "Parity procedure report."
      });

      procedureResultId = await legacyWorkflow.createProcedureResult({
        reportId: procedureReportId,
        resultCode: "GLU",
        resultText: "Glucose",
        dateTime: "2026-06-18 13:05:00",
        facility: "OpenEMR Modernization Clinic",
        units: "mg/dL",
        result: "92",
        range: "70-99",
        abnormal: "no",
        comments: "Parity result in normal range.",
        status: "final"
      });

      const result = await legacyWorkflow.getProcedureResult(procedureResultId);
      expect(result).toMatchObject({
        reportId: procedureReportId,
        resultCode: "GLU",
        resultText: "Glucose",
        result: "92",
        abnormal: "no",
        status: "final"
      });
    } finally {
      if (procedureOrderId !== null) {
        await legacyWorkflow.deleteProcedureOrderCascade(procedureOrderId);
      }
      if (encounterId !== null) {
        await legacyWorkflow.deleteEncounter(encounterId);
      }
    }

    const afterCleanupCounts = await legacyDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.encounters).toBe(beforeCounts.encounters);
    expect(afterCleanupCounts.procedureOrders).toBe(beforeCounts.procedureOrders);
    if (procedureOrderId !== null) {
      await expect(legacyWorkflow.getProcedureOrder(procedureOrderId)).resolves.toBeNull();
    }
    if (procedureReportId !== null) {
      await expect(legacyWorkflow.getProcedureReport(procedureReportId)).resolves.toBeNull();
    }
    if (procedureResultId !== null) {
      await expect(legacyWorkflow.getProcedureResult(procedureResultId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-16) || "local";
}
