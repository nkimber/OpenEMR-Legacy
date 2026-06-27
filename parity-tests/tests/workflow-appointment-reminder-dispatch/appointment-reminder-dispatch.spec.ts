import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";

const reminderAnchorPatientId = "MOD-PAT-0191";
const reminderAnchorAppointmentId = "APPT-MOD-PAT-0191-3";
const reminderLegacyNoteKey = "MOD-PAT-0191-3";
const reminderBaseDate = "2026-06-18";
const reminderDate = "2026-06-25";
const reminderTitle = "Preventive Care";

type QueryableDb = {
  queryRows<T extends Record<string, string>>(sql: string): Promise<T[]>;
};

type ReminderRow = {
  id: string;
  title: string;
  eventDate: string;
  startTime: string;
  durationMinutes: string;
  status: string;
  email: string;
  phone: string;
  phoneHome: string;
  phoneCell: string;
  hipaaAllowSms: string;
  hipaaAllowEmail: string;
  pubpid: string;
  legacyPid: string;
  patientDisplayName: string;
};

type ReminderDispatch = {
  appointmentId: string;
  dispatchId: string;
  auditId: string;
  dispatchedAt: string;
  patientId: string;
  legacyPid: number;
  pubpid: string;
  patientDisplayName: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  title: string;
  reminderStatus: string;
  reminderChannel: string;
  reminderContact: string;
  reminderLeadDays: number;
  queueName: string;
  dispatchStatus: string;
  externalReference: string;
  templateName: string;
  messagePreview: string;
};

test.describe("appointment reminder dispatch parity @slice577 @workflow-appointment-reminder-dispatch @appointments @scheduling", () => {
  test("queues deterministic local reminder dispatch evidence and audit history", async ({
    page,
    target,
    targetDb
  }, testInfo) => {
    const rows = await queryReminderAnchor(target.type, targetDb as QueryableDb);
    expect(rows).toHaveLength(1);
    const expectedDispatch = buildExpectedDispatch(rows[0]);

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-577-appointment-reminder-dispatch-source",
      description:
        "Captures the Slice 577 appointment reminder dispatch source facts: due appointment, channel/contact derivation, deterministic local queue, template, external reference, and audit identifiers.",
      expected: {
        patientCanonicalId: reminderAnchorPatientId,
        eventDate: reminderDate,
        reminderStatus: "Due now",
        reminderChannel: "SMS + Email",
        queueName: "appointment-reminder-sms-email",
        templateName: "appointment-reminder-sms-email-v1"
      },
      actual: expectedDispatch,
      context: {
        canonicalId: reminderAnchorPatientId,
        suite: "workflow-appointment-reminder-dispatch",
        workflow: "appointment-reminder-dispatch-source"
      }
    });

    if (target.type === "legacy-openemr") {
      return;
    }

    const headers = await getModernizedAdminSessionHeaders(page, target);
    const response = await page.request.post(
      `${target.apiBaseUrl}/api/appointments/${encodeURIComponent(reminderAnchorAppointmentId)}/reminders/dispatch`,
      { headers }
    );
    expect(response.ok()).toBeTruthy();
    const dispatch = normalizeDispatch(await response.json());
    expect(dispatch).toEqual(expectedDispatch);

    const historyResponse = await page.request.get(
      `${target.apiBaseUrl}/api/appointments/reminders/dispatch-history?appointmentId=${encodeURIComponent(reminderAnchorAppointmentId)}`,
      { headers }
    );
    expect(historyResponse.ok()).toBeTruthy();
    const history = await historyResponse.json() as { eventCount: number; entries: unknown[] };
    expect(history.eventCount).toBe(1);
    expect(normalizeDispatch(history.entries[0])).toEqual(expectedDispatch);

    await openAuthenticatedModernizedCalendar(page, target);
    await page.getByLabel("Appointment patient ID").fill(reminderAnchorPatientId);
    await page.getByLabel("Appointment from date").fill(reminderBaseDate);
    const appointmentButton = page
      .locator(".appointment-result")
      .filter({ hasText: reminderTitle })
      .filter({ hasText: reminderDate })
      .first();
    await expect(appointmentButton).toBeVisible();
    await appointmentButton.click();
    await page.getByRole("button", { name: "Dispatch reminder" }).click();
    const dispatchPanel = page.getByLabel("Appointment reminder dispatch", { exact: true });
    await expect(dispatchPanel).toContainText(expectedDispatch.dispatchId);
    await expect(dispatchPanel).toContainText(expectedDispatch.queueName);
    await expect(dispatchPanel).toContainText(expectedDispatch.externalReference);
    await expect(page.getByLabel("Appointment reminder dispatch history")).toContainText(expectedDispatch.dispatchStatus);
  });
});

async function queryReminderAnchor(targetType: string, db: QueryableDb) {
  if (targetType === "legacy-openemr") {
    return db.queryRows<ReminderRow>(`
SELECT
  e.pc_eid AS id,
  e.pc_title AS title,
  DATE(e.pc_eventDate) AS eventDate,
  TIME_FORMAT(e.pc_startTime, '%H:%i') AS startTime,
  CAST((TIME_TO_SEC(TIMEDIFF(e.pc_endTime, e.pc_startTime)) / 60) AS CHAR) AS durationMinutes,
  COALESCE(e.pc_apptstatus, '-') AS status,
  COALESCE(pd.email, '') AS email,
  COALESCE(pd.phone_contact, '') AS phone,
  COALESCE(pd.phone_home, '') AS phoneHome,
  COALESCE(pd.phone_cell, '') AS phoneCell,
  COALESCE(pd.hipaa_allowsms, '') AS hipaaAllowSms,
  COALESCE(pd.hipaa_allowemail, '') AS hipaaAllowEmail,
  COALESCE(pd.pubpid, '') AS pubpid,
  CAST(pd.pid AS CHAR) AS legacyPid,
  CONCAT(pd.lname, ', ', pd.fname) AS patientDisplayName
FROM openemr_postcalendar_events e
INNER JOIN patient_data pd ON pd.pid = e.pc_pid
WHERE pd.pubpid = ${sqlString(reminderAnchorPatientId)}
  AND e.pc_hometext LIKE ${sqlString(`%${reminderLegacyNoteKey}%`)}
LIMIT 1;
`);
  }

  return db.queryRows<ReminderRow>(`
SELECT
  a.id,
  a.title,
  a.appointment_date AS "eventDate",
  to_char(a.start_time, 'HH24:MI') AS "startTime",
  a.duration_minutes::text AS "durationMinutes",
  COALESCE(a.status, '-') AS status,
  COALESCE(p.email, '') AS email,
  COALESCE(p.phone, '') AS phone,
  COALESCE(p.phone_home, '') AS "phoneHome",
  COALESCE(p.phone_cell, '') AS "phoneCell",
  COALESCE(p.hipaa_allow_sms, '') AS "hipaaAllowSms",
  COALESCE(p.hipaa_allow_email, '') AS "hipaaAllowEmail",
  COALESCE(p.pubpid, '') AS pubpid,
  p.legacy_pid::text AS "legacyPid",
  CONCAT(p.last_name, ', ', p.first_name) AS "patientDisplayName"
FROM appointments a
INNER JOIN patients p ON p.legacy_pid = a.pid
WHERE p.pubpid = ${sqlString(reminderAnchorPatientId)}
  AND a.id = ${sqlString(reminderAnchorAppointmentId)}
LIMIT 1;
`);
}

function buildExpectedDispatch(row: ReminderRow): ReminderDispatch {
  const leadDays = dateDiffDays(reminderBaseDate, row.eventDate);
  const smsContact = allowsContact(row.hipaaAllowSms) ? firstNonEmpty(row.phoneCell, row.phone, row.phoneHome) : "";
  const emailContact = allowsContact(row.hipaaAllowEmail) ? row.email.trim() : "";
  const phoneContact = firstNonEmpty(row.phoneHome, row.phone, row.phoneCell);
  const reminderChannel = getReminderChannel(smsContact, emailContact, phoneContact);
  const reminderContact = getReminderContact(smsContact, emailContact, phoneContact);
  const dispatchId = `APPT-REMINDER-DISPATCH-20260618-${sanitizeIdentifier(row.id)}`;
  const endTime = addMinutes(row.startTime, Number(row.durationMinutes));

  return {
    appointmentId: row.id,
    dispatchId,
    auditId: `AUD-${dispatchId}`,
    dispatchedAt: "2026-06-18T12:10:00Z",
    patientId: reminderAnchorPatientId,
    legacyPid: Number(row.legacyPid),
    pubpid: row.pubpid,
    patientDisplayName: row.patientDisplayName,
    appointmentDate: row.eventDate,
    startTime: row.startTime,
    endTime,
    title: row.title,
    reminderStatus: leadDays > 0 && leadDays <= 7 ? "Due now" : `Not due - ${leadDays} days out`,
    reminderChannel,
    reminderContact,
    reminderLeadDays: leadDays,
    queueName: "appointment-reminder-sms-email",
    dispatchStatus: `${reminderChannel} queued`,
    externalReference: `LOCAL-SMS-EMAIL-${sanitizeIdentifier(row.id)}`,
    templateName: "appointment-reminder-sms-email-v1",
    messagePreview: `Reminder for ${row.patientDisplayName}: ${row.title} on ${row.eventDate} at ${row.startTime}. Channel ${reminderChannel}; contact ${reminderContact}.`
  };
}

function normalizeDispatch(raw: any): ReminderDispatch {
  return {
    appointmentId: String(raw.appointmentId),
    dispatchId: String(raw.dispatchId),
    auditId: String(raw.auditId),
    dispatchedAt: String(raw.dispatchedAt),
    patientId: String(raw.patientId),
    legacyPid: Number(raw.legacyPid),
    pubpid: String(raw.pubpid),
    patientDisplayName: String(raw.patientDisplayName),
    appointmentDate: String(raw.appointmentDate),
    startTime: String(raw.startTime),
    endTime: String(raw.endTime),
    title: String(raw.title),
    reminderStatus: String(raw.reminderStatus),
    reminderChannel: String(raw.reminderChannel),
    reminderContact: String(raw.reminderContact ?? ""),
    reminderLeadDays: Number(raw.reminderLeadDays),
    queueName: String(raw.queueName),
    dispatchStatus: String(raw.dispatchStatus),
    externalReference: String(raw.externalReference),
    templateName: String(raw.templateName),
    messagePreview: String(raw.messagePreview)
  };
}

function getReminderChannel(smsContact: string, emailContact: string, phoneContact: string) {
  if (smsContact && emailContact) {
    return "SMS + Email";
  }
  if (smsContact) {
    return "SMS";
  }
  if (emailContact) {
    return "Email";
  }
  return phoneContact ? "Phone" : "Print";
}

function getReminderContact(smsContact: string, emailContact: string, phoneContact: string) {
  if (smsContact && emailContact) {
    return `${smsContact} / ${emailContact}`;
  }
  return smsContact || emailContact || phoneContact;
}

function allowsContact(value: string) {
  return value.trim().toUpperCase() === "YES";
}

function firstNonEmpty(...values: string[]) {
  return values.map((value) => value.trim()).find(Boolean) ?? "";
}

function dateDiffDays(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  return Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000);
}

function addMinutes(startTime: string, minutes: number) {
  const [hours, mins] = startTime.split(":").map(Number);
  const total = (hours * 60 + mins + minutes) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function sanitizeIdentifier(value: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9]/g, "-").replace(/^-+|-+$/g, "").toUpperCase();
  return cleaned || "UNKNOWN";
}

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}
