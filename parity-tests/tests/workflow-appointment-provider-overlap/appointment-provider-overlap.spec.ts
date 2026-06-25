import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
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
  test("allows overlapping same-provider appointments and renders modernized overlap detail", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const primaryPatient = await targetDb.findPatientByCanonicalId(primaryPatientId);
    const secondaryPatient = await targetDb.findPatientByCanonicalId(secondaryPatientId);
    expect(primaryPatient).not.toBeNull();
    expect(secondaryPatient).not.toBeNull();

    if (!primaryPatient) {
      throw new Error(`Missing seeded primary appointment provider-overlap patient ${primaryPatientId}`);
    }
    if (!secondaryPatient) {
      throw new Error(`Missing seeded secondary appointment provider-overlap patient ${secondaryPatientId}`);
    }

    const providerId = primaryPatient.providerId;
    const beforePrimaryCounts = await targetDb.getPatientWorkflowCounts(primaryPatient.pid);
    const beforeSecondaryCounts = await targetDb.getPatientWorkflowCounts(secondaryPatient.pid);
    const suffix = workflowSuffix();
    const primaryTitle = `Parity Provider Overlap A ${suffix}`;
    const secondaryTitle = `Parity Provider Overlap B ${suffix}`;
    let primaryAppointmentId: number | string | null = null;
    let secondaryAppointmentId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-117-appointment-provider-overlap-precondition",
      description:
        "Seeded patient/provider and appointment-count precondition before creating temporary same-provider overlapping appointments.",
      expected: {
        primaryPatientCanonicalId: primaryPatientId,
        secondaryPatientCanonicalId: secondaryPatientId,
        sharedProviderId: providerId,
        overlapDate,
        overlapStartTime,
        overlapEndTime,
        overlapDurationSeconds,
        status: "-",
        room: "Overlap",
        categoryId: 9
      },
      actual: {
        primaryPatient: {
          pid: primaryPatient.pid,
          pubpid: primaryPatient.pubpid,
          providerId: primaryPatient.providerId
        },
        secondaryPatient: {
          pid: secondaryPatient.pid,
          pubpid: secondaryPatient.pubpid,
          providerId: secondaryPatient.providerId
        },
        beforePrimaryCounts,
        beforeSecondaryCounts,
        plannedTitles: [primaryTitle, secondaryTitle]
      }
    });

    let overlapRows: Array<{ id: string; title: string }> = [];
    let primaryAppointment: Awaited<ReturnType<typeof workflow.getAppointment>> = null;
    let secondaryAppointment: Awaited<ReturnType<typeof workflow.getAppointment>> = null;
    let surfaceFacts: Record<string, unknown> = {};

    try {
      primaryAppointmentId = await workflow.createAppointment({
        patientId: primaryPatient.pid,
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
        patientId: secondaryPatient.pid,
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

      primaryAppointment = await workflow.getAppointment(primaryAppointmentId);
      secondaryAppointment = await workflow.getAppointment(secondaryAppointmentId);
      expect(primaryAppointment).toMatchObject({
        patientId: primaryPatient.pid,
        providerId,
        title: primaryTitle,
        eventDate: overlapDate,
        startTime: overlapStartTime,
        endTime: overlapEndTime,
        status: "-",
        room: "Overlap"
      });
      expect(secondaryAppointment).toMatchObject({
        patientId: secondaryPatient.pid,
        providerId,
        title: secondaryTitle,
        eventDate: overlapDate,
        startTime: overlapStartTime,
        endTime: overlapEndTime,
        status: "-",
        room: "Overlap"
      });

      overlapRows = await queryProviderOverlapRows(target.type, targetDb as QueryableDb, providerId, primaryTitle, secondaryTitle);
      expect(overlapRows.map((row) => row.title).sort()).toEqual([primaryTitle, secondaryTitle].sort());

      const afterPrimaryCreateCounts = await targetDb.getPatientWorkflowCounts(primaryPatient.pid);
      const afterSecondaryCreateCounts = await targetDb.getPatientWorkflowCounts(secondaryPatient.pid);
      expect(afterPrimaryCreateCounts.appointments).toBe(beforePrimaryCounts.appointments + 1);
      expect(afterSecondaryCreateCounts.appointments).toBe(beforeSecondaryCounts.appointments + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, primaryAppointmentId);
        await expect(page.locator('input[name="form_title"]')).toHaveValue(primaryTitle);
        await expect(page.locator("#provd")).toHaveValue(String(providerId));
        const primaryLegacyTitle = await page.locator('input[name="form_title"]').inputValue();
        const primaryLegacyProvider = await page.locator("#provd").inputValue();

        await openAppointmentDirect(page, target, secondaryAppointmentId);
        await expect(page.locator('input[name="form_title"]')).toHaveValue(secondaryTitle);
        await expect(page.locator("#provd")).toHaveValue(String(providerId));
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

        const primaryModernizedFacts = await openModernizedAppointment(page, primaryPatient.pubpid, primaryTitle, providerId);
        const secondaryModernizedFacts = await openModernizedAppointment(
          page,
          secondaryPatient.pubpid,
          secondaryTitle,
          providerId
        );
        surfaceFacts = {
          modernized: {
            primary: primaryModernizedFacts,
            secondary: secondaryModernizedFacts
          }
        };
      }

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-117-appointment-provider-overlap-created",
        description:
          "Temporary same-provider, same-time appointments were created for two patients and remain non-blocking overlap rows.",
        expected: {
          sharedProviderId: providerId,
          overlapDate,
          overlapStartTime,
          overlapEndTime,
          titles: [primaryTitle, secondaryTitle],
          overlapRowCount: 2,
          primaryAppointmentCountDelta: 1,
          secondaryAppointmentCountDelta: 1,
          modernizedOverlapLabel: target.type === "modernized-openemr" ? "1 overlapping appointment" : undefined
        },
        actual: {
          primaryAppointmentId,
          secondaryAppointmentId,
          primaryAppointment,
          secondaryAppointment,
          overlapRows,
          afterPrimaryCreateCounts,
          afterSecondaryCreateCounts,
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

    const afterPrimaryCleanupCounts = await targetDb.getPatientWorkflowCounts(primaryPatient.pid);
    const afterSecondaryCleanupCounts = await targetDb.getPatientWorkflowCounts(secondaryPatient.pid);
    expect(afterPrimaryCleanupCounts.appointments).toBe(beforePrimaryCounts.appointments);
    expect(afterSecondaryCleanupCounts.appointments).toBe(beforeSecondaryCounts.appointments);
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
      probe: "slice-117-appointment-provider-overlap-cleanup",
      description:
        "Temporary provider-overlap appointments were deleted and both seeded patients returned to their original appointment counts.",
      expected: {
        primaryAppointmentDeleted: true,
        secondaryAppointmentDeleted: true,
        primaryAppointmentCountRestored: true,
        secondaryAppointmentCountRestored: true
      },
      actual: {
        primaryAppointmentId,
        secondaryAppointmentId,
        primaryAfterCleanup,
        secondaryAfterCleanup,
        beforePrimaryCounts,
        beforeSecondaryCounts,
        afterPrimaryCleanupCounts,
        afterSecondaryCleanupCounts
      }
    });
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
  return {
    patientId,
    title,
    providerId,
    providerIdRendered: true,
    providerOverlapLabelRendered: true,
    providerOverlapCountText: "1 overlapping appointment"
  };
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
