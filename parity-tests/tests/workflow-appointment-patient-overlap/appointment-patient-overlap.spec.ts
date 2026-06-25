import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const patientId = "MOD-PAT-0003";
const overlapDate = "2026-12-05";
const overlapStartTime = "09:00:00";
const overlapEndTime = "09:30:00";
const overlapDurationSeconds = 1800;

type QueryableDb = {
  queryRows<T extends Record<string, string>>(sql: string): Promise<T[]>;
};

test.describe("appointment patient overlap parity @slice118 @workflow-appointment-patient-overlap @mutation", () => {
  test("allows overlapping same-patient appointments and renders modernized overlap detail", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(patientId);
    expect(patient).not.toBeNull();

    if (!patient) {
      throw new Error(`Missing seeded appointment patient-overlap patient ${patientId}`);
    }

    const primaryProviderId = patient.providerId;
    const secondaryProviderId = primaryProviderId === 102 ? 101 : 102;
    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    const suffix = workflowSuffix();
    const primaryTitle = `Parity Patient Overlap A ${suffix}`;
    const secondaryTitle = `Parity Patient Overlap B ${suffix}`;
    let primaryAppointmentId: number | string | null = null;
    let secondaryAppointmentId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-118-appointment-patient-overlap-precondition",
      description:
        "Seeded patient/provider and appointment-count precondition before creating temporary same-patient overlapping appointments.",
      expected: {
        patientCanonicalId: patientId,
        primaryProviderId,
        secondaryProviderId,
        overlapDate,
        overlapStartTime,
        overlapEndTime,
        overlapDurationSeconds,
        status: "-",
        room: "Overlap",
        categoryId: 9
      },
      actual: {
        patient: {
          pid: patient.pid,
          pubpid: patient.pubpid,
          providerId: patient.providerId
        },
        beforeCounts,
        plannedTitles: [primaryTitle, secondaryTitle]
      }
    });

    let overlapRows: Array<{ id: string; title: string }> = [];
    let primaryAppointment: Awaited<ReturnType<typeof workflow.getAppointment>> = null;
    let secondaryAppointment: Awaited<ReturnType<typeof workflow.getAppointment>> = null;
    let surfaceFacts: Record<string, unknown> = {};

    try {
      primaryAppointmentId = await workflow.createAppointment({
        patientId: patient.pid,
        providerId: primaryProviderId,
        title: primaryTitle,
        eventDate: overlapDate,
        startTime: overlapStartTime,
        endTime: overlapEndTime,
        durationSeconds: overlapDurationSeconds,
        homeText: "Created by the appointment patient overlap suite.",
        facilityId: 10,
        billingLocationId: 10,
        room: "Overlap",
        categoryId: 9
      });
      secondaryAppointmentId = await workflow.createAppointment({
        patientId: patient.pid,
        providerId: secondaryProviderId,
        title: secondaryTitle,
        eventDate: overlapDate,
        startTime: overlapStartTime,
        endTime: overlapEndTime,
        durationSeconds: overlapDurationSeconds,
        homeText: "Created by the appointment patient overlap suite.",
        facilityId: 10,
        billingLocationId: 10,
        room: "Overlap",
        categoryId: 9
      });

      primaryAppointment = await workflow.getAppointment(primaryAppointmentId);
      secondaryAppointment = await workflow.getAppointment(secondaryAppointmentId);
      expect(primaryAppointment).toMatchObject({
        patientId: patient.pid,
        providerId: primaryProviderId,
        title: primaryTitle,
        eventDate: overlapDate,
        startTime: overlapStartTime,
        endTime: overlapEndTime,
        status: "-",
        room: "Overlap"
      });
      expect(secondaryAppointment).toMatchObject({
        patientId: patient.pid,
        providerId: secondaryProviderId,
        title: secondaryTitle,
        eventDate: overlapDate,
        startTime: overlapStartTime,
        endTime: overlapEndTime,
        status: "-",
        room: "Overlap"
      });

      overlapRows = await queryPatientOverlapRows(target.type, targetDb as QueryableDb, patient.pid, primaryTitle, secondaryTitle);
      expect(overlapRows.map((row) => row.title).sort()).toEqual([primaryTitle, secondaryTitle].sort());

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 2);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, primaryAppointmentId);
        await expect(page.locator('input[name="form_title"]')).toHaveValue(primaryTitle);
        await expect(page.locator("#provd")).toHaveValue(String(primaryProviderId));
        const primaryLegacyTitle = await page.locator('input[name="form_title"]').inputValue();
        const primaryLegacyProvider = await page.locator("#provd").inputValue();

        await openAppointmentDirect(page, target, secondaryAppointmentId);
        await expect(page.locator('input[name="form_title"]')).toHaveValue(secondaryTitle);
        await expect(page.locator("#provd")).toHaveValue(String(secondaryProviderId));
        const secondaryLegacyTitle = await page.locator('input[name="form_title"]').inputValue();
        const secondaryLegacyProvider = await page.locator("#provd").inputValue();
        surfaceFacts = {
          legacy: {
            primaryTitle: primaryLegacyTitle,
            primaryProvider: primaryLegacyProvider,
            secondaryTitle: secondaryLegacyTitle,
            secondaryProvider: secondaryLegacyProvider
          }
        };
      } else {
        await openAuthenticatedModernizedCalendar(page, target);

        const primaryModernizedFacts = await openModernizedAppointment(page, patient.pubpid, primaryTitle);
        const secondaryModernizedFacts = await openModernizedAppointment(page, patient.pubpid, secondaryTitle);
        surfaceFacts = {
          modernized: {
            primary: primaryModernizedFacts,
            secondary: secondaryModernizedFacts
          }
        };
      }

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-118-appointment-patient-overlap-created",
        description:
          "Temporary same-patient, same-time appointments were created with two providers and remain non-blocking overlap rows.",
        expected: {
          patientPid: patient.pid,
          primaryProviderId,
          secondaryProviderId,
          overlapDate,
          overlapStartTime,
          overlapEndTime,
          titles: [primaryTitle, secondaryTitle],
          overlapRowCount: 2,
          appointmentCountDelta: 2,
          modernizedOverlapLabel: target.type === "modernized-openemr" ? "1 overlapping appointment" : undefined
        },
        actual: {
          primaryAppointmentId,
          secondaryAppointmentId,
          primaryAppointment,
          secondaryAppointment,
          overlapRows,
          afterCreateCounts,
          surfaceFacts
        }
      });
    } finally {
      if (secondaryAppointmentId !== null) {
        await workflow.deleteAppointment(secondaryAppointmentId);
      }
      if (primaryAppointmentId !== null) {
        await workflow.deleteAppointment(primaryAppointmentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient.pid);
    expect(afterCleanupCounts.appointments).toBe(beforeCounts.appointments);
    const primaryAfterCleanup = primaryAppointmentId !== null ? await workflow.getAppointment(primaryAppointmentId) : null;
    const secondaryAfterCleanup = secondaryAppointmentId !== null ? await workflow.getAppointment(secondaryAppointmentId) : null;
    if (primaryAppointmentId !== null) {
      expect(primaryAfterCleanup).toBeNull();
    }
    if (secondaryAppointmentId !== null) {
      expect(secondaryAfterCleanup).toBeNull();
    }

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-118-appointment-patient-overlap-cleanup",
      description:
        "Temporary patient-overlap appointments were deleted and the seeded patient returned to the original appointment count.",
      expected: {
        primaryAppointmentDeleted: true,
        secondaryAppointmentDeleted: true,
        appointmentCountRestored: true
      },
      actual: {
        primaryAppointmentId,
        secondaryAppointmentId,
        primaryAfterCleanup,
        secondaryAfterCleanup,
        beforeCounts,
        afterCleanupCounts
      }
    });
  });
});

async function openModernizedAppointment(
  page: import("@playwright/test").Page,
  patientPubpid: string,
  title: string
) {
  await page.getByLabel("Appointment patient ID").fill(patientPubpid);
  await page.getByLabel("Appointment from date").fill(overlapDate);

  const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
  await expect(appointmentButton).toBeVisible();
  await appointmentButton.click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.locator("body")).toContainText("Patient overlaps");
  await expect(page.locator("body")).toContainText("1 overlapping appointment");
  return {
    patientPubpid,
    title,
    patientOverlapLabelRendered: true,
    patientOverlapCountText: "1 overlapping appointment"
  };
}

async function queryPatientOverlapRows(
  targetType: string,
  db: QueryableDb,
  patientPid: number,
  primaryTitle: string,
  secondaryTitle: string
) {
  if (targetType === "legacy-openemr") {
    return db.queryRows<{ id: string; title: string }>(`
SELECT pc_eid AS id, pc_title AS title
FROM openemr_postcalendar_events
WHERE pc_pid = ${patientPid}
  AND DATE(pc_eventDate) = ${sqlString(overlapDate)}
  AND pc_startTime < ${sqlString(overlapEndTime)}
  AND pc_endTime > ${sqlString(overlapStartTime)}
  AND pc_apptstatus <> 'x'
  AND pc_title IN (${sqlString(primaryTitle)}, ${sqlString(secondaryTitle)})
ORDER BY pc_eid;
`);
  }

  return db.queryRows<{ id: string; title: string }>(`
SELECT id, title
FROM appointments
WHERE pid = ${patientPid}
  AND appointment_date = ${sqlString(overlapDate)}
  AND start_time < ${sqlString(overlapEndTime)}
  AND (start_time + make_interval(mins => duration_minutes))::time > ${sqlString(overlapStartTime)}
  AND coalesce(status, '-') <> 'x'
  AND title IN (${sqlString(primaryTitle)}, ${sqlString(secondaryTitle)})
ORDER BY id;
`);
}

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
