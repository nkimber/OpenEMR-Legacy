import { test, expect } from "../../src/fixtures/parityTest.js";
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
  test("allows overlapping same-patient appointments and renders modernized overlap detail", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(patientId);
    expect(patient).not.toBeNull();

    const primaryProviderId = patient!.providerId;
    const secondaryProviderId = primaryProviderId === 102 ? 101 : 102;
    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const primaryTitle = `Parity Patient Overlap A ${suffix}`;
    const secondaryTitle = `Parity Patient Overlap B ${suffix}`;
    let primaryAppointmentId: number | string | null = null;
    let secondaryAppointmentId: number | string | null = null;

    try {
      primaryAppointmentId = await workflow.createAppointment({
        patientId: patient!.pid,
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
        patientId: patient!.pid,
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

      const primaryAppointment = await workflow.getAppointment(primaryAppointmentId);
      const secondaryAppointment = await workflow.getAppointment(secondaryAppointmentId);
      expect(primaryAppointment).toMatchObject({
        patientId: patient!.pid,
        providerId: primaryProviderId,
        title: primaryTitle,
        eventDate: overlapDate,
        startTime: overlapStartTime,
        endTime: overlapEndTime,
        status: "-",
        room: "Overlap"
      });
      expect(secondaryAppointment).toMatchObject({
        patientId: patient!.pid,
        providerId: secondaryProviderId,
        title: secondaryTitle,
        eventDate: overlapDate,
        startTime: overlapStartTime,
        endTime: overlapEndTime,
        status: "-",
        room: "Overlap"
      });

      const overlapRows = await queryPatientOverlapRows(target.type, targetDb as QueryableDb, patient!.pid, primaryTitle, secondaryTitle);
      expect(overlapRows.map((row) => row.title).sort()).toEqual([primaryTitle, secondaryTitle].sort());

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + 2);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, primaryAppointmentId);
        await expect(page.locator('input[name="form_title"]')).toHaveValue(primaryTitle);
        await expect(page.locator("#provd")).toHaveValue(String(primaryProviderId));

        await openAppointmentDirect(page, target, secondaryAppointmentId);
        await expect(page.locator('input[name="form_title"]')).toHaveValue(secondaryTitle);
        await expect(page.locator("#provd")).toHaveValue(String(secondaryProviderId));
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Calendar" }).click();
        await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();

        await openModernizedAppointment(page, patient!.pubpid, primaryTitle);
        await openModernizedAppointment(page, patient!.pubpid, secondaryTitle);
      }
    } finally {
      if (secondaryAppointmentId !== null) {
        await workflow.deleteAppointment(secondaryAppointmentId);
      }
      if (primaryAppointmentId !== null) {
        await workflow.deleteAppointment(primaryAppointmentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.appointments).toBe(beforeCounts.appointments);
    if (primaryAppointmentId !== null) {
      await expect(workflow.getAppointment(primaryAppointmentId)).resolves.toBeNull();
    }
    if (secondaryAppointmentId !== null) {
      await expect(workflow.getAppointment(secondaryAppointmentId)).resolves.toBeNull();
    }
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
