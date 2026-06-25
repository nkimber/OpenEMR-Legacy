import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";

const recurrenceScenarios = [
  {
    key: "daily",
    label: "Daily",
    room: "Daily",
    anchorDate: "2026-12-07",
    endDate: "2026-12-13",
    repeatFrequency: 2,
    repeatUnit: 0,
    startTime: "08:00:00",
    endTime: "08:30:00",
    expectedDates: ["2026-12-07", "2026-12-09", "2026-12-11", "2026-12-13"],
    expectedLabel: "Every 2 days until 2026-12-13",
    generatedDate: "2026-12-09",
    generatedOccurrenceNumber: 2
  },
  {
    key: "workday",
    label: "Workday",
    room: "Workday",
    anchorDate: "2026-12-11",
    endDate: "2026-12-16",
    repeatFrequency: 1,
    repeatUnit: 4,
    startTime: "09:00:00",
    endTime: "09:30:00",
    expectedDates: ["2026-12-11", "2026-12-14", "2026-12-15", "2026-12-16"],
    expectedLabel: "Every workday until 2026-12-16",
    generatedDate: "2026-12-14",
    generatedOccurrenceNumber: 2
  },
  {
    key: "yearly",
    label: "Yearly",
    room: "Yearly",
    anchorDate: "2026-06-30",
    endDate: "2028-06-30",
    repeatFrequency: 1,
    repeatUnit: 3,
    startTime: "10:00:00",
    endTime: "10:30:00",
    expectedDates: ["2026-06-30", "2027-06-30", "2028-06-30"],
    expectedLabel: "Every year until 2028-06-30",
    generatedDate: "2027-06-30",
    generatedOccurrenceNumber: 2
  }
] as const;

test.describe("appointment recurrence unit matrix parity @slice113 @workflow-appointment-recurrence-unit-matrix @mutation", () => {
  test("creates, renders, expands, and removes daily, workday, and yearly recurring appointments", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Anchor patient ${appointmentAnchorPatientId} was not found.`);
    }

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const suffix = workflowSuffix();
    const createdAppointments: Array<{
      id: number | string;
      title: string;
      scenario: (typeof recurrenceScenarios)[number];
      created: unknown | null;
      occurrences: unknown[];
    }> = [];

    try {
      for (const scenario of recurrenceScenarios) {
        const title = `Parity ${scenario.label} Recurrence ${suffix}`;
        const appointmentId = await workflow.createAppointment({
          patientId: patient.pid,
          providerId: patient.providerId,
          title,
          eventDate: scenario.anchorDate,
          startTime: scenario.startTime,
          endTime: scenario.endTime,
          durationSeconds: 1800,
          homeText: `Created by the appointment ${scenario.key} recurrence unit matrix suite.`,
          facilityId: 10,
          billingLocationId: 10,
          room: scenario.room,
          categoryId: 9,
          recurrenceType: 1,
          repeatFrequency: scenario.repeatFrequency,
          repeatUnit: scenario.repeatUnit,
          recurrenceEndDate: scenario.endDate
        });
        const createdAppointment: (typeof createdAppointments)[number] = {
          id: appointmentId,
          title,
          scenario,
          created: null,
          occurrences: []
        };
        createdAppointments.push(createdAppointment);

        const created = await workflow.getAppointment(appointmentId);
        expect(created).toMatchObject({
          patientId: patient.pid,
          providerId: patient.providerId,
          title,
          eventDate: scenario.anchorDate,
          startTime: scenario.startTime,
          endTime: scenario.endTime,
          status: "-",
          facilityId: 10,
          billingLocationId: 10,
          room: scenario.room,
          categoryId: 9,
          recurrenceType: 1,
          repeatFrequency: scenario.repeatFrequency,
          repeatUnit: scenario.repeatUnit,
          recurrenceEndDate: scenario.endDate
        });
        if (!created) {
          throw new Error(`Created ${scenario.key} recurring appointment ${appointmentId} was not found.`);
        }
        createdAppointment.created = created;

        const occurrences = await workflow.getAppointmentSeriesOccurrences(patient.pid, scenario.anchorDate);
        const scenarioOccurrences = occurrences.filter((occurrence) => occurrence.title === title);
        expect(scenarioOccurrences.map((occurrence) => occurrence.date)).toEqual(scenario.expectedDates);
        expect(scenarioOccurrences.map((occurrence) => occurrence.occurrenceNumber)).toEqual(
          scenario.expectedDates.map((_, index) => index + 1));
        expect(scenarioOccurrences.every((occurrence) => occurrence.repeatFrequency === scenario.repeatFrequency)).toBe(true);
        expect(scenarioOccurrences.every((occurrence) => occurrence.repeatUnit === scenario.repeatUnit)).toBe(true);
        expect(scenarioOccurrences[1].isVirtualOccurrence).toBe(true);
        createdAppointment.occurrences = scenarioOccurrences;
      }

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + recurrenceScenarios.length);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-113-appointment-recurrence-unit-matrix-precondition",
        description: "Captures the Slice 113 temporary daily, workday, and yearly recurring appointment roots after creation and before UI rendering.",
        expected: {
          patient: {
            pubpid: appointmentAnchorPatientId,
            providerId: patient.providerId
          },
          roots: recurrenceScenarios.map((scenario) => ({
            key: scenario.key,
            eventDate: scenario.anchorDate,
            startTime: scenario.startTime,
            endTime: scenario.endTime,
            recurrenceType: 1,
            repeatFrequency: scenario.repeatFrequency,
            repeatUnit: scenario.repeatUnit,
            recurrenceEndDate: scenario.endDate,
            occurrenceDates: scenario.expectedDates,
            generatedOccurrence: {
              date: scenario.generatedDate,
              occurrenceNumber: scenario.generatedOccurrenceNumber,
              isVirtualOccurrence: true
            }
          })),
          appointmentCountDelta: recurrenceScenarios.length
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          createdAppointments
        },
        context: {
          canonicalId: appointmentAnchorPatientId,
          suite: "workflow-appointment-recurrence-unit-matrix",
          workflow: "appointment-recurrence-unit-matrix-precondition"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);

        for (const { id, title, scenario } of createdAppointments) {
          await openAppointmentDirect(page, target, id);

          await expect(page.locator('input[name="form_title"]')).toHaveValue(title);
          await expect(page.locator('input[name="form_repeat"]')).toBeChecked();
          await expect(page.locator('select[name="form_repeat_freq"]')).toHaveValue(String(scenario.repeatFrequency));
          await expect(page.locator('select[name="form_repeat_type"]')).toHaveValue(String(scenario.repeatUnit));
          await expect(page.locator('input[name="form_enddate"]')).toHaveValue(scenario.endDate);
        }
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient.pubpid);

        for (const { title, scenario } of createdAppointments) {
          await page.getByLabel("Appointment from date").fill(scenario.anchorDate);

          const rootButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
          await expect(rootButton).toBeVisible();
          await expect(rootButton).toContainText(scenario.expectedLabel);
          await rootButton.click();
          await expect(page.getByRole("heading", { name: title })).toBeVisible();
          await expect(page.getByLabel("Edit appointment repeats")).toBeChecked();
          await expect(page.getByLabel("Edit appointment repeat frequency")).toHaveValue(String(scenario.repeatFrequency));
          await expect(page.getByLabel("Edit appointment repeat unit")).toHaveValue(String(scenario.repeatUnit));
          await expect(page.getByLabel("Edit appointment recurrence end date")).toHaveValue(scenario.endDate);

          await page.getByLabel("Appointment from date").fill(scenario.generatedDate);
          const generatedButton = page
            .getByRole("button", { name: new RegExp(`${escapeRegex(title)}[\\s\\S]*${scenario.generatedDate}`, "i") })
            .first();
          await expect(generatedButton).toBeVisible();
          await expect(generatedButton).toContainText(`Generated occurrence ${scenario.generatedOccurrenceNumber}`);
          await expect(generatedButton).toContainText(scenario.expectedLabel);
          await generatedButton.click();
          await expect(page.locator("body")).toContainText(`Generated occurrence ${scenario.generatedOccurrenceNumber}`);
          await expect(page.locator("body")).toContainText(scenario.generatedDate);
          await expect(page.locator("body")).toContainText(scenario.expectedLabel);
        }
      }
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-113-appointment-recurrence-unit-matrix-rendered",
        description: "Captures the Slice 113 recurrence-unit rendering and expansion facts after legacy or modernized UI assertions.",
        expected: {
          labels: recurrenceScenarios.map((scenario) => ({
            key: scenario.key,
            expectedLabel: scenario.expectedLabel,
            repeatFrequency: scenario.repeatFrequency,
            repeatUnit: scenario.repeatUnit,
            recurrenceEndDate: scenario.endDate,
            generatedDate: scenario.generatedDate,
            generatedOccurrenceNumber: scenario.generatedOccurrenceNumber
          })),
          appointmentCountDelta: recurrenceScenarios.length
        },
        actual: {
          patient,
          beforeCounts,
          afterCreateCounts,
          createdAppointments,
          surface: target.type === "modernized-openemr"
            ? {
                application: target.type,
                page: "calendar",
                repeatLabels: recurrenceScenarios.map((scenario) => scenario.expectedLabel),
                generatedDates: recurrenceScenarios.map((scenario) => scenario.generatedDate)
              }
            : {
                application: target.type,
                page: "legacy-appointment-direct",
                repeatControls: recurrenceScenarios.map((scenario) => ({
                  key: scenario.key,
                  repeatFrequencyControl: String(scenario.repeatFrequency),
                  repeatUnitControl: String(scenario.repeatUnit),
                  endDateControl: scenario.endDate
                }))
              }
        },
        context: {
          canonicalId: appointmentAnchorPatientId,
          suite: "workflow-appointment-recurrence-unit-matrix",
          workflow: "appointment-recurrence-unit-matrix-rendered"
        }
      });
    } finally {
      for (const appointment of createdAppointments.reverse()) {
        await workflow.deleteAppointment(appointment.id);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.appointments).toBe(beforeCounts.appointments);
    const cleanupAppointments: Array<{ id: number | string; title: string; scenarioKey: string; appointment: unknown }> = [];
    for (const appointment of createdAppointments) {
      await expect(workflow.getAppointment(appointment.id)).resolves.toBeNull();
      cleanupAppointments.push({
        id: appointment.id,
        title: appointment.title,
        scenarioKey: appointment.scenario.key,
        appointment: await workflow.getAppointment(appointment.id)
      });
    }
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-113-appointment-recurrence-unit-matrix-cleanup",
      description: "Captures the Slice 113 cleanup state after deleting the temporary recurrence-unit appointment roots.",
      expected: {
        patient: {
          pubpid: appointmentAnchorPatientId,
          providerId: patient.providerId
        },
        appointmentsDeleted: createdAppointments.length === recurrenceScenarios.length,
        appointmentCountRestored: true,
        beforeAppointmentCount: beforeCounts.appointments
      },
      actual: {
        patient,
        beforeCounts,
        afterCleanupCounts,
        cleanupAppointments
      },
      context: {
        canonicalId: appointmentAnchorPatientId,
        suite: "workflow-appointment-recurrence-unit-matrix",
        workflow: "appointment-recurrence-unit-matrix-cleanup"
      }
    });
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
