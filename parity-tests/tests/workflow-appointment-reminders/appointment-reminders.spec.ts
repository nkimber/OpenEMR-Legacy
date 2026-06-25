import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const reminderAnchorPatientId = "MOD-PAT-0191";
const reminderAnchorAppointmentId = "APPT-MOD-PAT-0191-3";
const reminderLegacyNoteKey = "MOD-PAT-0191-3";
const reminderBaseDate = "2026-06-18";
const reminderDate = "2026-06-25";
const reminderTitle = "Preventive Care";
const reminderPhone = "(619) 555-1191";
const reminderEmail = "mod-pat-0191@example.test";

type QueryableDb = {
  queryRows<T extends Record<string, string>>(sql: string): Promise<T[]>;
};

type ReminderRow = {
  id: string;
  title: string;
  eventDate: string;
  status: string;
  email: string;
  phone: string;
  phoneHome: string;
  phoneCell: string;
  hipaaAllowSms: string;
  hipaaAllowEmail: string;
};

test.describe("appointment reminder readiness parity @slice120 @workflow-appointment-reminders", () => {
  test("derives appointment reminder readiness facts from seeded appointment and contact data", async ({
    target,
    targetDb
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(reminderAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Missing seeded appointment reminder patient ${reminderAnchorPatientId}`);
    }

    const rows = await queryReminderAnchor(target.type, targetDb as QueryableDb);
    expect(rows).toHaveLength(1);

    const facts = buildReminderFacts(rows[0]);
    expect(facts).toMatchObject({
      title: reminderTitle,
      eventDate: reminderDate,
      reminderDue: true,
      reminderStatus: "Due now",
      reminderChannel: "SMS + Email",
      reminderContact: `${reminderPhone} / ${reminderEmail}`,
      reminderLeadDays: 7
    });
    if (target.type === "legacy-openemr") {
      expect(facts.id).toMatch(/^\d+$/);
    } else {
      expect(facts.id).toBe(reminderAnchorAppointmentId);
    }

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-120-appointment-reminders-readiness",
      description:
        "Seeded future appointment and patient contact consent rows produce the normalized reminder-readiness contract.",
      expected: {
        patientCanonicalId: reminderAnchorPatientId,
        appointmentId: target.type === "modernized-openemr" ? reminderAnchorAppointmentId : "legacy numeric appointment id",
        title: reminderTitle,
        eventDate: reminderDate,
        reminderDue: true,
        reminderStatus: "Due now",
        reminderChannel: "SMS + Email",
        reminderContact: `${reminderPhone} / ${reminderEmail}`,
        reminderLeadDays: 7
      },
      actual: {
        patient: {
          pid: patient.pid,
          pubpid: patient.pubpid,
          fname: patient.fname,
          lname: patient.lname
        },
        reminderRows: rows,
        facts
      }
    });
  });

  test("renders appointment reminder readiness in the application UI", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(reminderAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Missing seeded appointment reminder patient ${reminderAnchorPatientId}`);
    }

    const rows = await queryReminderAnchor(target.type, targetDb as QueryableDb);
    expect(rows).toHaveLength(1);
    const facts = buildReminderFacts(rows[0]);
    let surfaceFacts: Record<string, unknown>;

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openAppointmentDirect(page, target, facts.id);
      await expect(page.locator('input[name="form_title"]')).toHaveValue(reminderTitle);
      await expect(page.locator('input[name="form_patient"]')).toHaveValue(`${patient.lname}, ${patient.fname}`);
      await expect(page.locator('input[name="form_date"]')).toHaveValue(reminderDate);
      surfaceFacts = {
        legacy: {
          title: await page.locator('input[name="form_title"]').inputValue(),
          patient: await page.locator('input[name="form_patient"]').inputValue(),
          eventDate: await page.locator('input[name="form_date"]').inputValue()
        }
      };
    } else {
      await openAuthenticatedModernizedCalendar(page, target);

      await page.getByLabel("Appointment patient ID").fill(patient.pubpid);
      await page.getByLabel("Appointment from date").fill(reminderBaseDate);

      const appointmentButton = page
        .locator(".appointment-result")
        .filter({ hasText: reminderTitle })
        .filter({ hasText: reminderDate })
        .first();
      await expect(appointmentButton).toBeVisible();
      await expect(appointmentButton).toContainText("Reminder due");
      const resultText = await appointmentButton.innerText();
      await appointmentButton.click();

      await expect(page.getByRole("heading", { name: reminderTitle })).toBeVisible();
      await expect(page.locator("body")).toContainText("Reminder status");
      await expect(page.locator("body")).toContainText(facts.reminderStatus);
      await expect(page.locator("body")).toContainText("Reminder channel");
      await expect(page.locator("body")).toContainText(facts.reminderChannel);
      await expect(page.locator("body")).toContainText("Reminder contact");
      await expect(page.locator("body")).toContainText(facts.reminderContact);
      await expect(page.locator("body")).toContainText("Reminder lead");
      await expect(page.locator("body")).toContainText("7 days");
      surfaceFacts = {
        modernized: {
          searchPatientId: patient.pubpid,
          fromDate: reminderBaseDate,
          resultText,
          detailTitle: reminderTitle,
          reminderStatus: facts.reminderStatus,
          reminderChannel: facts.reminderChannel,
          reminderContact: facts.reminderContact,
          reminderLead: "7 days"
        }
      };
    }

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-120-appointment-reminders-rendered",
      description:
        "The application UI renders the seeded appointment reminder readiness using the normalized database-derived facts.",
      expected: {
        patientCanonicalId: reminderAnchorPatientId,
        title: reminderTitle,
        eventDate: reminderDate,
        reminderStatus: facts.reminderStatus,
        reminderChannel: facts.reminderChannel,
        reminderContact: facts.reminderContact,
        reminderLead: "7 days"
      },
      actual: {
        patient: {
          pid: patient.pid,
          pubpid: patient.pubpid,
          fname: patient.fname,
          lname: patient.lname
        },
        reminderRows: rows,
        facts,
        surfaceFacts
      }
    });
  });
});

async function queryReminderAnchor(targetType: string, db: QueryableDb) {
  if (targetType === "legacy-openemr") {
    return db.queryRows<ReminderRow>(`
SELECT
  e.pc_eid AS id,
  e.pc_title AS title,
  DATE(e.pc_eventDate) AS eventDate,
  COALESCE(e.pc_apptstatus, '-') AS status,
  COALESCE(pd.email, '') AS email,
  COALESCE(pd.phone_contact, '') AS phone,
  COALESCE(pd.phone_home, '') AS phoneHome,
  COALESCE(pd.phone_cell, '') AS phoneCell,
  COALESCE(pd.hipaa_allowsms, '') AS hipaaAllowSms,
  COALESCE(pd.hipaa_allowemail, '') AS hipaaAllowEmail
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
  COALESCE(a.status, '-') AS status,
  COALESCE(p.email, '') AS email,
  COALESCE(p.phone, '') AS phone,
  COALESCE(p.phone_home, '') AS "phoneHome",
  COALESCE(p.phone_cell, '') AS "phoneCell",
  COALESCE(p.hipaa_allow_sms, '') AS "hipaaAllowSms",
  COALESCE(p.hipaa_allow_email, '') AS "hipaaAllowEmail"
FROM appointments a
INNER JOIN patients p ON p.legacy_pid = a.pid
WHERE p.pubpid = ${sqlString(reminderAnchorPatientId)}
  AND a.id = ${sqlString(reminderAnchorAppointmentId)}
LIMIT 1;
`);
}

function buildReminderFacts(row: ReminderRow) {
  const leadDays = dateDiffDays(reminderBaseDate, row.eventDate);
  const smsContact = allowsContact(row.hipaaAllowSms) ? firstNonEmpty(row.phoneCell, row.phone, row.phoneHome) : "";
  const emailContact = allowsContact(row.hipaaAllowEmail) ? row.email.trim() : "";
  const phoneContact = firstNonEmpty(row.phoneHome, row.phone, row.phoneCell);
  const reminderChannel = getReminderChannel(smsContact, emailContact, phoneContact);
  const reminderContact = getReminderContact(smsContact, emailContact, phoneContact);

  return {
    id: row.id,
    title: row.title,
    eventDate: row.eventDate,
    reminderDue: row.status !== "x" && leadDays > 0 && leadDays <= 7,
    reminderStatus: row.status !== "x" && leadDays > 0 && leadDays <= 7 ? "Due now" : `Not due - ${leadDays} days out`,
    reminderChannel,
    reminderContact,
    reminderLeadDays: leadDays
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

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}
