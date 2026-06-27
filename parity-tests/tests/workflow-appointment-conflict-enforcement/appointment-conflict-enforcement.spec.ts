import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";

const blockingPatientId = "MOD-PAT-0003";
const requestingPatientId = "MOD-PAT-0004";
const enforcementDate = "2026-12-30";
const enforcementStartTime = "11:00:00";
const enforcementEndTime = "11:30:00";
const durationSeconds = 1800;
const facilityId = 10;
const conflictRoom = "Strict Conflict Room";

type QueryableDb = {
  queryRows<T extends Record<string, string>>(sql: string): Promise<T[]>;
};

type ConflictRow = {
  id: string;
  title: string;
  conflictType: string;
};

test.describe("appointment conflict enforcement parity @slice589 @workflow-appointment-conflict-enforcement @scheduling @mutation", () => {
  test("blocks strict modernized appointment creation when provider and room conflicts exist", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const blockingPatient = await targetDb.findPatientByCanonicalId(blockingPatientId);
    const requestingPatient = await targetDb.findPatientByCanonicalId(requestingPatientId);
    expect(blockingPatient).not.toBeNull();
    expect(requestingPatient).not.toBeNull();

    if (!blockingPatient || !requestingPatient) {
      throw new Error("Missing seeded patients for appointment conflict enforcement.");
    }

    const providerId = blockingPatient.providerId;
    const suffix = workflowSuffix();
    const blockingTitle = `Strict Conflict Blocker ${suffix}`;
    const blockedTitle = `Strict Conflict Blocked ${suffix}`;
    let blockingAppointmentId: number | string | null = null;

    try {
      blockingAppointmentId = await workflow.createAppointment({
        patientId: blockingPatient.pid,
        providerId,
        title: blockingTitle,
        eventDate: enforcementDate,
        startTime: enforcementStartTime,
        endTime: enforcementEndTime,
        durationSeconds,
        homeText: "Created by the appointment conflict enforcement suite.",
        facilityId,
        billingLocationId: facilityId,
        room: conflictRoom,
        categoryId: 9
      });

      const conflictRows = await queryConflictRows(
        target.type,
        targetDb as QueryableDb,
        providerId,
        conflictRoom,
        enforcementDate,
        enforcementStartTime,
        enforcementEndTime,
        String(blockingAppointmentId)
      );
      expect(conflictRows.map((row) => row.conflictType).sort()).toEqual(["provider", "room"]);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-589-appointment-conflict-source",
        description:
          "Captures the provider and room conflict source facts used by the strict appointment conflict enforcement policy.",
        expected: {
          blockingPatientId,
          requestingPatientId,
          providerId,
          facilityId,
          conflictRoom,
          enforcementDate,
          enforcementStartTime,
          enforcementEndTime,
          conflictTypes: ["provider", "room"]
        },
        actual: {
          blockingAppointmentId,
          blockingTitle,
          blockedTitle,
          conflictRows
        },
        context: {
          canonicalId: requestingPatientId,
          suite: "workflow-appointment-conflict-enforcement",
          workflow: "appointment-conflict-enforcement"
        }
      });

      if (target.type === "legacy-openemr") {
        return;
      }

      const headers = await getModernizedAdminSessionHeaders(page, target);
      const response = await page.request.post(`${target.apiBaseUrl}/api/appointments`, {
        headers,
        data: {
          patientId: requestingPatient.pubpid,
          providerId,
          title: blockedTitle,
          date: enforcementDate,
          startTime: enforcementStartTime.slice(0, 5),
          durationMinutes: 30,
          facilityId,
          billingLocationId: facilityId,
          categoryId: 9,
          room: conflictRoom,
          comments: "Strict create should be rejected by conflict policy.",
          recurrenceType: 0,
          enforceConflictPolicy: true
        }
      });
      expect(response.status()).toBe(409);
      const body = await response.json() as {
        error: string;
        validation: {
          available: boolean;
          conflictCount: number;
          conflicts: Array<{ conflictType: string; appointmentId: string }>;
          messages: string[];
        };
      };
      expect(body.error).toBe("Appointment conflicts with existing schedule availability.");
      expect(body.validation.available).toBe(false);
      expect(body.validation.conflictCount).toBe(2);
      expect(body.validation.conflicts.map((conflict) => conflict.conflictType).sort()).toEqual(["provider", "room"]);
      expect(body.validation.messages.join(" ")).toContain("2 active scheduling conflict");

      const blockedRows = await queryAppointmentRowsByTitle(target.type, targetDb as QueryableDb, blockedTitle);
      expect(blockedRows).toHaveLength(0);

      await openAuthenticatedModernizedCalendar(page, target, requestingPatient.pubpid, enforcementDate);
      await page.getByLabel("Appointment title").fill(blockedTitle);
      await page.getByLabel("New appointment date").fill(enforcementDate);
      await page.getByLabel("New appointment start time").fill(enforcementStartTime.slice(0, 5));
      await page.getByLabel("New appointment duration").fill("30");
      await page.getByLabel("New appointment provider ID").fill(String(providerId));
      await page.getByLabel("New appointment facility ID").fill(String(facilityId));
      await page.getByLabel("New appointment billing facility ID").fill(String(facilityId));
      await page.getByLabel("New appointment room").fill(conflictRoom);
      await page.getByLabel("Block scheduling conflicts").check();
      await page.getByRole("button", { name: "Create" }).click();
      await expect(page.locator(".save-note.error")).toContainText(
        "Appointment conflicts with existing schedule availability.",
      );

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-589-appointment-conflict-enforcement",
        description:
          "Strict modernized appointment creation returned 409 conflict evidence and did not insert the requested overlapping appointment.",
        expected: {
          status: 409,
          insertedBlockedAppointments: 0,
          conflictTypes: ["provider", "room"],
          uiConflictMessageVisible: true
        },
        actual: {
          response: body,
          blockedRows
        },
        context: {
          canonicalId: requestingPatientId,
          suite: "workflow-appointment-conflict-enforcement",
          workflow: "appointment-conflict-enforcement"
        }
      });
    } finally {
      if (blockingAppointmentId !== null) {
        await workflow.deleteAppointment(blockingAppointmentId);
      }
    }

    const afterCleanup = blockingAppointmentId !== null ? await workflow.getAppointment(blockingAppointmentId) : null;
    expect(afterCleanup).toBeNull();
  });
});

async function queryConflictRows(
  targetType: string,
  db: QueryableDb,
  providerId: number,
  room: string,
  date: string,
  startTime: string,
  endTime: string,
  blockerId: string
) {
  if (targetType === "legacy-openemr") {
    return db.queryRows<ConflictRow>(`
SELECT CAST(pc_eid AS CHAR) AS id, pc_title AS title, 'provider' AS conflictType
FROM openemr_postcalendar_events
WHERE pc_eid = ${sqlString(blockerId)}
  AND pc_eventDate = ${sqlString(date)}
  AND pc_aid = ${integer(providerId)}
  AND pc_startTime < ${sqlString(endTime)}
  AND ADDTIME(pc_startTime, SEC_TO_TIME(pc_duration)) > ${sqlString(startTime)}
UNION ALL
SELECT CAST(pc_eid AS CHAR) AS id, pc_title AS title, 'room' AS conflictType
FROM openemr_postcalendar_events
WHERE pc_eid = ${sqlString(blockerId)}
  AND pc_eventDate = ${sqlString(date)}
  AND LOWER(TRIM(COALESCE(pc_room, ''))) = LOWER(${sqlString(room)})
  AND pc_startTime < ${sqlString(endTime)}
  AND ADDTIME(pc_startTime, SEC_TO_TIME(pc_duration)) > ${sqlString(startTime)}
ORDER BY conflictType;
`);
  }

  return db.queryRows<ConflictRow>(`
SELECT id, title, 'provider' AS "conflictType"
FROM appointments
WHERE id = ${sqlString(blockerId)}
  AND appointment_date = ${sqlString(date)}
  AND provider_id = ${integer(providerId)}
  AND start_time < ${sqlString(endTime)}
  AND (start_time + make_interval(mins => duration_minutes))::time > ${sqlString(startTime)}
UNION ALL
SELECT id, title, 'room' AS "conflictType"
FROM appointments
WHERE id = ${sqlString(blockerId)}
  AND appointment_date = ${sqlString(date)}
  AND LOWER(TRIM(COALESCE(room, ''))) = LOWER(${sqlString(room)})
  AND start_time < ${sqlString(endTime)}
  AND (start_time + make_interval(mins => duration_minutes))::time > ${sqlString(startTime)}
ORDER BY "conflictType";
`);
}

async function queryAppointmentRowsByTitle(targetType: string, db: QueryableDb, title: string) {
  if (targetType === "legacy-openemr") {
    return db.queryRows<{ id: string }>(`
SELECT CAST(pc_eid AS CHAR) AS id
FROM openemr_postcalendar_events
WHERE pc_title = ${sqlString(title)};
`);
  }

  return db.queryRows<{ id: string }>(`
SELECT id
FROM appointments
WHERE title = ${sqlString(title)};
`);
}

function workflowSuffix() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function integer(value: number) {
  return Math.trunc(value).toString();
}

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}
