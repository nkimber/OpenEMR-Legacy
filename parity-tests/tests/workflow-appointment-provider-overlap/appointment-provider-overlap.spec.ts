import { test, expect } from "../../src/fixtures/parityTest.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const primaryPatientId = "MOD-PAT-0003";
const secondaryPatientId = "MOD-PAT-0004";
const overlapDate = "2026-12-04";
const overlapStartTime = "09:00:00";
const overlapEndTime = "09:30:00";
const overlapDurationSeconds = 1800;

type QueryableDb = {
  queryRows<T extends Record<string, string>>(sql: string): Promise<T[]>;
};

test.describe("appointment provider overlap parity @slice117 @workflow-appointment-provider-overlap @mutation", () => {
  test("allows overlapping same-provider appointments and renders modernized overlap detail", async ({ page, target, targetDb, workflow }) => {
    const primaryPatient = await targetDb.findPatientByCanonicalId(primaryPatientId);
    const secondaryPatient = await targetDb.findPatientByCanonicalId(secondaryPatientId);
    expect(primaryPatient).not.toBeNull();
    expect(secondaryPatient).not.toBeNull();

    const providerId = primaryPatient!.providerId;
    const beforePrimaryCounts = await targetDb.getPatientWorkflowCounts(primaryPatient!.pid);
    const beforeSecondaryCounts = await targetDb.getPatientWorkflowCounts(secondaryPatient!.pid);
    const suffix = workflowSuffix();
    const primaryTitle = `Parity Provider Overlap A ${suffix}`;
    const secondaryTitle = `Parity Provider Overlap B ${suffix}`;
    let primaryAppointmentId: number | string | null = null;
    let secondaryAppointmentId: number | string | null = null;

    try {
      primaryAppointmentId = await workflow.createAppointment({
        patientId: primaryPatient!.pid,
        providerId,
        title: primaryTitle,
        eventDate: overlapDate,
        startTime: overlapStartTime,
        endTime: overlapEndTime,
        durationSeconds: overlapDurationSeconds,
        homeText: "Created by the appointment provider overlap suite.",
        facilityId: 10,
        billingLocationId: 10,
        room: "Overlap",
        categoryId: 9
      });
      secondaryAppointmentId = await workflow.createAppointment({
        patientId: secondaryPatient!.pid,
        providerId,
        title: secondaryTitle,
        eventDate: overlapDate,
        startTime: overlapStartTime,
        endTime: overlapEndTime,
        durationSeconds: overlapDurationSeconds,
        homeText: "Created by the appointment provider overlap suite.",
        facilityId: 10,
        billingLocationId: 10,
        room: "Overlap",
        categoryId: 9
      });

      const primaryAppointment = await workflow.getAppointment(primaryAppointmentId);
      const secondaryAppointment = await workflow.getAppointment(secondaryAppointmentId);
      expect(primaryAppointment).toMatchObject({
        patientId: primaryPatient!.pid,
        providerId,
        title: primaryTitle,
        eventDate: overlapDate,
        startTime: overlapStartTime,
        endTime: overlapEndTime,
        status: "-",
        room: "Overlap"
      });
      expect(secondaryAppointment).toMatchObject({
        patientId: secondaryPatient!.pid,
        providerId,
        title: secondaryTitle,
        eventDate: overlapDate,
        startTime: overlapStartTime,
        endTime: overlapEndTime,
        status: "-",
        room: "Overlap"
      });

      const overlapRows = await queryProviderOverlapRows(target.type, targetDb as QueryableDb, providerId, primaryTitle, secondaryTitle);
      expect(overlapRows.map((row) => row.title).sort()).toEqual([primaryTitle, secondaryTitle].sort());

      const afterPrimaryCreateCounts = await targetDb.getPatientWorkflowCounts(primaryPatient!.pid);
      const afterSecondaryCreateCounts = await targetDb.getPatientWorkflowCounts(secondaryPatient!.pid);
      expect(afterPrimaryCreateCounts.appointments).toBe(beforePrimaryCounts.appointments + 1);
      expect(afterSecondaryCreateCounts.appointments).toBe(beforeSecondaryCounts.appointments + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, primaryAppointmentId);
        await expect(page.locator('input[name="form_title"]')).toHaveValue(primaryTitle);
        await expect(page.locator("#provd")).toHaveValue(String(providerId));

        await openAppointmentDirect(page, target, secondaryAppointmentId);
        await expect(page.locator('input[name="form_title"]')).toHaveValue(secondaryTitle);
        await expect(page.locator("#provd")).toHaveValue(String(providerId));
      } else {
        await page.goto(target.publicUrl);
        await page.getByRole("button", { name: "Calendar" }).click();
        await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();

        await openModernizedAppointment(page, primaryPatient!.pubpid, primaryTitle, providerId);
        await openModernizedAppointment(page, secondaryPatient!.pubpid, secondaryTitle, providerId);
      }
    } finally {
      if (secondaryAppointmentId !== null) {
        await workflow.deleteAppointment(secondaryAppointmentId);
      }
      if (primaryAppointmentId !== null) {
        await workflow.deleteAppointment(primaryAppointmentId);
      }
    }

    const afterPrimaryCleanupCounts = await targetDb.getPatientWorkflowCounts(primaryPatient!.pid);
    const afterSecondaryCleanupCounts = await targetDb.getPatientWorkflowCounts(secondaryPatient!.pid);
    expect(afterPrimaryCleanupCounts.appointments).toBe(beforePrimaryCounts.appointments);
    expect(afterSecondaryCleanupCounts.appointments).toBe(beforeSecondaryCounts.appointments);
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
  patientId: string,
  title: string,
  providerId: number
) {
  await page.getByLabel("Appointment patient ID").fill(patientId);
  await page.getByLabel("Appointment from date").fill(overlapDate);

  const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
  await expect(appointmentButton).toBeVisible();
  await appointmentButton.click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.locator("body")).toContainText(`(${providerId})`);
  await expect(page.locator("body")).toContainText("Provider overlaps");
  await expect(page.locator("body")).toContainText("1 overlapping appointment");
}

async function queryProviderOverlapRows(
  targetType: string,
  db: QueryableDb,
  providerId: number,
  primaryTitle: string,
  secondaryTitle: string
) {
  if (targetType === "legacy-openemr") {
    return db.queryRows<{ id: string; title: string }>(`
SELECT pc_eid AS id, pc_title AS title
FROM openemr_postcalendar_events
WHERE pc_aid = ${sqlString(String(providerId))}
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
WHERE provider_id = ${providerId}
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
