import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar, openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";
import type { PatientContact } from "../../src/workflows/legacyWorkflowActions.js";
import type { Page } from "@playwright/test";
import type { RuntimeTarget } from "../../src/config/targets.js";

const portalProfileAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const reminderBaseDate = "2026-06-18";
const reminderDate = "2026-06-25";
const reminderPhone = "(619) 555-6021";
const reminderEmail = "nora.reminders.slice602@example.test";
const reminderTitlePrefix = "Portal Reminder Preference";
const profileChangeInput = {
  email: reminderEmail,
  phoneHome: "(619) 555-6020",
  phoneCell: reminderPhone,
  street: "602 Reminder Preference Way",
  city: "National City",
  state: "CA",
  postalCode: "91953",
  hipaaAllowSms: "NO",
  hipaaAllowEmail: "YES"
};

type QueryableDb = {
  queryRows<T extends Record<string, string>>(sql: string): Promise<T[]>;
};

type ReminderPreferenceRow = {
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

test.describe("patient portal reminder preference parity @slice602 @workflow-patient-portal-reminder-preferences @patients @portal @appointments @reminders @mutation", () => {
  test("commits patient-facing reminder delivery preferences and updates reminder channel derivation", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(180_000);

    const patient = await targetDb.findPatientByCanonicalId(portalProfileAnchorPatientId);
    expect(patient).not.toBeNull();
    if (!patient) {
      throw new Error(`Missing portal reminder preference anchor patient ${portalProfileAnchorPatientId}.`);
    }

    await workflow.cleanupPatientPortalProfileChange(portalLoginUsername, portalPassword);
    const originalProfile = await workflow.getPatientPortalProfile(portalLoginUsername, portalPassword);
    expect(originalProfile.authenticated).toBe(true);
    const originalContact = await workflow.getPatientContact(patient.pid);
    expect(originalContact).not.toBeNull();
    if (!originalContact) {
      throw new Error(`Missing contact row for ${portalProfileAnchorPatientId}.`);
    }

    const baselineContact: PatientContact = {
      ...originalContact,
      phoneHome: profileChangeInput.phoneHome,
      phoneCell: reminderPhone,
      email: reminderEmail,
      hipaaAllowSms: "YES",
      hipaaAllowEmail: "YES"
    };
    const title = `${reminderTitlePrefix} ${workflowSuffix()}`;
    const appointmentInput = {
      patientId: patient.pid,
      providerId: patient.providerId,
      title,
      eventDate: reminderDate,
      startTime: "09:20:00",
      endTime: "09:50:00",
      durationSeconds: 1800,
      homeText: "Temporary appointment for Slice 602 reminder preference parity.",
      facilityId: 10,
      billingLocationId: 10,
      room: "Preferences",
      categoryId: 13
    };
    let appointmentId: number | string | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-602-patient-portal-reminder-preferences-precondition",
      description:
        "Captures the Slice 602 portal-enabled anchor patient, original contact permissions, and planned temporary due appointment before patient-facing reminder delivery preferences are submitted.",
      expected: {
        canonicalId: portalProfileAnchorPatientId,
        authenticated: true,
        baselineReminderChannel: "SMS + Email",
        acceptedReminderChannel: "Email"
      },
      actual: {
        patient,
        originalProfile: summarizePortalProfile(originalProfile),
        originalContact,
        proposedBaselineContact: baselineContact,
        appointmentInput,
        profileChangeInput
      },
      context: {
        canonicalId: portalProfileAnchorPatientId,
        suite: "workflow-patient-portal-reminder-preferences",
        workflow: "patient-portal-reminder-preferences-precondition"
      }
    });

    try {
      await workflow.updatePatientContact(baselineContact);
      appointmentId = await workflow.createAppointment(appointmentInput);
      const createdAppointment = await workflow.getAppointment(appointmentId);
      expect(createdAppointment).toMatchObject({
        patientId: patient.pid,
        title,
        eventDate: reminderDate,
        status: "-",
        categoryId: 13
      });

      const beforeRows = await queryTemporaryReminderPreference(target.type, targetDb as QueryableDb, appointmentId);
      expect(beforeRows).toHaveLength(1);
      const beforeFacts = buildReminderPreferenceFacts(beforeRows[0]);
      expect(beforeFacts).toMatchObject({
        title,
        eventDate: reminderDate,
        reminderDue: true,
        reminderStatus: "Due now",
        reminderChannel: "SMS + Email",
        reminderContact: `${reminderPhone} / ${reminderEmail}`,
        reminderLeadDays: 7
      });

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-602-patient-portal-reminder-preferences-before",
        description:
          "Captures the temporary due appointment while the anchor patient allows both SMS and email reminders, proving the reminder channel starts as SMS plus Email.",
        expected: {
          appointment: {
            title,
            eventDate: reminderDate
          },
          reminderChannel: "SMS + Email",
          reminderContact: `${reminderPhone} / ${reminderEmail}`
        },
        actual: {
          appointment: createdAppointment,
          reminderRows: beforeRows,
          facts: beforeFacts
        },
        context: {
          canonicalId: portalProfileAnchorPatientId,
          suite: "workflow-patient-portal-reminder-preferences",
          workflow: "patient-portal-reminder-preferences-before"
        }
      });

      if (target.type === "modernized-openemr") {
        await submitModernizedPortalProfilePreferenceChange(page, target, beforeFacts);
      } else {
        await workflow.submitPatientPortalProfileChange(portalLoginUsername, portalPassword, profileChangeInput);
      }

      const queue = await workflow.getPatientPortalProfileReviewQueue();
      const reviewRequest = queue.profileReviewRequests.find((request) => request.pubpid === portalProfileAnchorPatientId);
      expect(reviewRequest).toBeTruthy();
      expect(reviewRequest!.requestedDemographics).toMatchObject(profileChangeInput);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-602-patient-portal-reminder-preferences-review-request",
        description:
          "Captures the waiting profile review created from the patient-facing reminder preference change, including requested SMS opt-out and email opt-in.",
        expected: {
          reviewRequest: {
            pubpid: portalProfileAnchorPatientId,
            pendingAction: "review",
            status: "waiting",
            requestedDemographics: profileChangeInput
          }
        },
        actual: summarizeProfileReviewQueue(queue, portalProfileAnchorPatientId),
        context: {
          canonicalId: portalProfileAnchorPatientId,
          suite: "workflow-patient-portal-reminder-preferences",
          workflow: "patient-portal-reminder-preferences-review-request"
        }
      });

      const accepted = await workflow.acceptPatientPortalProfileReview(reviewRequest!.id);
      expect(accepted).toMatchObject({
        accepted: true,
        id: reviewRequest!.id,
        pid: patient.pid,
        status: "closed",
        pendingAction: "completed",
        actionTaken: "accept",
        tableAction: "update"
      });
      expect(accepted!.demographics).toMatchObject(profileChangeInput);

      const acceptedContact = await workflow.getPatientContact(patient.pid);
      expect(acceptedContact).toMatchObject({
        phoneCell: reminderPhone,
        email: reminderEmail,
        hipaaAllowSms: "NO",
        hipaaAllowEmail: "YES"
      });

      const afterRows = await queryTemporaryReminderPreference(target.type, targetDb as QueryableDb, appointmentId);
      expect(afterRows).toHaveLength(1);
      const afterFacts = buildReminderPreferenceFacts(afterRows[0]);
      expect(afterFacts).toMatchObject({
        title,
        eventDate: reminderDate,
        reminderDue: true,
        reminderStatus: "Due now",
        reminderChannel: "Email",
        reminderContact: reminderEmail,
        reminderLeadDays: 7
      });

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-602-patient-portal-reminder-preferences-accepted",
        description:
          "Captures the accepted profile review and reminder derivation after SMS reminder permission is disabled and email reminder permission remains enabled.",
        expected: {
          accepted: {
            status: "closed",
            actionTaken: "accept",
            demographics: profileChangeInput
          },
          contact: {
            hipaaAllowSms: "NO",
            hipaaAllowEmail: "YES"
          },
          reminderChannel: "Email",
          reminderContact: reminderEmail
        },
        actual: {
          accepted,
          contact: acceptedContact,
          reminderRows: afterRows,
          facts: afterFacts
        },
        context: {
          canonicalId: portalProfileAnchorPatientId,
          suite: "workflow-patient-portal-reminder-preferences",
          workflow: "patient-portal-reminder-preferences-accepted"
        }
      });

      await expectApplicationReminderSurface(page, target, patient, appointmentId, beforeFacts, afterFacts);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-602-patient-portal-reminder-preferences-ui",
        description:
          "Captures the application surface after the accepted preference change: legacy opens the temporary appointment, while the modernized Calendar renders Email as the derived reminder channel.",
        expected: {
          title,
          reminderChannel: afterFacts.reminderChannel,
          reminderContact: afterFacts.reminderContact
        },
        actual: {
          target: target.type,
          beforeFacts,
          afterFacts
        },
        context: {
          canonicalId: portalProfileAnchorPatientId,
          suite: "workflow-patient-portal-reminder-preferences",
          workflow: "patient-portal-reminder-preferences-ui"
        }
      });
    } finally {
      if (appointmentId !== null) {
        await workflow.deleteAppointment(appointmentId);
      }

      await workflow.restorePatientPortalProfileAfterReview(
        portalLoginUsername,
        portalPassword,
        originalProfile.demographics
      );
      await workflow.updatePatientContact(originalContact);
      await workflow.cleanupPatientPortalProfileChange(portalLoginUsername, portalPassword);

      const deletedAppointment = appointmentId !== null ? await workflow.getAppointment(appointmentId) : null;
      const restoredContact = await workflow.getPatientContact(patient.pid);
      const restoredProfile = await workflow.getPatientPortalProfile(portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-602-patient-portal-reminder-preferences-restored",
        description:
          "Captures final cleanup after deleting the temporary due appointment and restoring the anchor patient's original contact permissions/profile demographics.",
        expected: {
          appointment: null,
          contact: originalContact,
          profile: {
            hasPendingProfileChanges: false,
            demographics: originalProfile.demographics
          }
        },
        actual: {
          appointment: deletedAppointment,
          contact: restoredContact,
          profile: summarizePortalProfile(restoredProfile)
        },
        context: {
          canonicalId: portalProfileAnchorPatientId,
          suite: "workflow-patient-portal-reminder-preferences",
          workflow: "patient-portal-reminder-preferences-restored"
        }
      });
    }
  });
});

async function submitModernizedPortalProfilePreferenceChange(
  page: Page,
  target: RuntimeTarget,
  beforeFacts: ReturnType<typeof buildReminderPreferenceFacts>
) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const profileRegion = page.getByRole("region", { name: "Patient portal profile" });
  await expect(profileRegion).toContainText("SMS reminder permission");
  await expect(profileRegion).toContainText("Email reminder permission");
  await expect(profileRegion).toContainText("YES");

  const form = page.locator('form[aria-label="Patient portal profile change request"]');
  await form.getByRole("textbox", { name: "Email", exact: true }).fill(profileChangeInput.email);
  await form.getByRole("textbox", { name: "Home phone" }).fill(profileChangeInput.phoneHome);
  await form.getByRole("textbox", { name: "Cell phone" }).fill(profileChangeInput.phoneCell);
  await form.getByRole("textbox", { name: "Street" }).fill(profileChangeInput.street);
  await form.getByRole("textbox", { name: "City" }).fill(profileChangeInput.city);
  await form.getByRole("textbox", { name: "State" }).fill(profileChangeInput.state);
  await form.getByRole("textbox", { name: "ZIP" }).fill(profileChangeInput.postalCode);

  const smsCheckbox = form.getByLabel("Portal profile change SMS reminders allowed");
  const emailCheckbox = form.getByLabel("Portal profile change email reminders allowed");
  await expect(smsCheckbox).toBeChecked();
  await expect(emailCheckbox).toBeChecked();
  await smsCheckbox.uncheck();
  await emailCheckbox.check();
  await form.getByRole("button", { name: "Submit Changes" }).click();
  await expect(profileRegion).toContainText("Pending review");
  await expect(profileRegion).toContainText("SMS reminders NO");
  await expect(profileRegion).toContainText("Email reminders YES");
  expect(beforeFacts.reminderChannel).toBe("SMS + Email");
}

async function expectApplicationReminderSurface(
  page: Page,
  target: RuntimeTarget,
  patient: { pid: number; pubpid: string; fname: string; lname: string },
  appointmentId: number | string,
  beforeFacts: ReturnType<typeof buildReminderPreferenceFacts>,
  afterFacts: ReturnType<typeof buildReminderPreferenceFacts>
) {
  if (target.type === "legacy-openemr") {
    await loginToLegacyOpenEmr(page, target);
    await openAppointmentDirect(page, target, String(appointmentId));
    await expect(page.locator('input[name="form_title"]')).toHaveValue(afterFacts.title);
    await expect(page.locator('input[name="form_patient"]')).toHaveValue(`${patient.lname}, ${patient.fname}`);
    await expect(page.locator('input[name="form_date"]')).toHaveValue(reminderDate);
    return;
  }

  await openAuthenticatedModernizedCalendar(page, target);
  await page.getByLabel("Appointment patient ID").fill(patient.pubpid);
  await page.getByLabel("Appointment from date").fill(reminderBaseDate);

  const appointmentButton = page
    .locator(".appointment-result")
    .filter({ hasText: afterFacts.title })
    .filter({ hasText: reminderDate })
    .first();
  await expect(appointmentButton).toBeVisible();
  await expect(appointmentButton).toContainText("Reminder due");
  await appointmentButton.click();

  await expect(page.getByRole("heading", { name: afterFacts.title })).toBeVisible();
  await expect(page.locator("body")).toContainText("Reminder status");
  await expect(page.locator("body")).toContainText(afterFacts.reminderStatus);
  await expect(page.locator("body")).toContainText("Reminder channel");
  await expect(page.locator("body")).toContainText(afterFacts.reminderChannel);
  await expect(page.locator("body")).toContainText("Reminder contact");
  await expect(page.locator("body")).toContainText(afterFacts.reminderContact);
  await expect(page.locator("body")).not.toContainText(beforeFacts.reminderContact);
}

async function queryTemporaryReminderPreference(targetType: string, db: QueryableDb, appointmentId: number | string) {
  if (targetType === "legacy-openemr") {
    return db.queryRows<ReminderPreferenceRow>(`
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
WHERE e.pc_eid = ${integer(Number(appointmentId))}
LIMIT 1;
`);
  }

  return db.queryRows<ReminderPreferenceRow>(`
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
WHERE a.id = ${sqlString(String(appointmentId))}
LIMIT 1;
`);
}

function buildReminderPreferenceFacts(row: ReminderPreferenceRow) {
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

function summarizePortalProfile(profile: { authenticated: boolean; hasPendingProfileChanges: boolean; pendingChange: unknown; demographics: unknown }) {
  return {
    authenticated: profile.authenticated,
    hasPendingProfileChanges: profile.hasPendingProfileChanges,
    demographics: profile.demographics,
    pendingChange: profile.pendingChange
  };
}

function summarizeProfileReviewQueue(
  queue: { waitingAuditCount: number; waitingProfileReviewCount: number; profileReviewRequests: Array<{ pubpid: string }> },
  pubpid: string
) {
  return {
    waitingAuditCount: queue.waitingAuditCount,
    waitingProfileReviewCount: queue.waitingProfileReviewCount,
    requestForAnchor: queue.profileReviewRequests.find((request) => request.pubpid === pubpid) ?? null
  };
}

function sqlString(value: string) {
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
}

function integer(value: number) {
  if (!Number.isInteger(value)) {
    throw new Error(`Expected integer SQL value, received ${value}.`);
  }

  return value;
}

function workflowSuffix() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}
