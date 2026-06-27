import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const waitlistDeferralAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("appointment waitlist deferral parity @slice600 @workflow-appointment-waitlist-deferral @appointments @scheduling @mutation", () => {
  test("defers a waiting portal appointment request without removing it from the waitlist", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(waitlistDeferralAnchorPatientId);
    expect(patient).not.toBeNull();

    const requestReason = `Waitlist deferral parity ${Date.now()}`;
    const deferredBody = `${requestReason}\n\nDeferred by scheduling staff for follow-up.`;
    const requestInput = {
      providerId: 105,
      facilityId: 11,
      categoryId: 9,
      date: "2026-09-24",
      startTime: "11:00",
      durationMinutes: 30,
      reason: requestReason
    };
    let appointmentId: number | string | null = null;
    let reminderId: number | string | null = null;

    try {
      const requestResult = await workflow.requestPatientPortalAppointment(portalLoginUsername, portalPassword, requestInput);
      expect(requestResult.created).toBe(true);
      appointmentId = requestResult.appointment!.id;
      reminderId = requestResult.reminder!.id;

      const waitingAppointment = await workflow.getAppointment(appointmentId);
      const reminderBefore = await workflow.getPatientMessage(reminderId);
      expect(waitingAppointment).toMatchObject({
        patientId: patient!.pid,
        status: "^",
        homeText: requestReason
      });
      expect(reminderBefore).toMatchObject({
        title: "Patient Reminders",
        status: "New"
      });

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-600-appointment-waitlist-deferral-created",
        description: "Captures the cleanup-backed portal appointment request before staff deferral, including waitlist appointment status and linked provider reminder.",
        expected: {
          appointment: {
            status: "^",
            reason: requestReason
          },
          reminder: {
            title: "Patient Reminders",
            status: "New"
          }
        },
        actual: {
          patient,
          requestInput,
          requestResult,
          waitingAppointment,
          reminderBefore
        },
        context: {
          canonicalId: waitlistDeferralAnchorPatientId,
          suite: "workflow-appointment-waitlist-deferral",
          workflow: "appointment-waitlist-deferral-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);
        await expect(page.locator('select[name="form_apptstatus"]')).toHaveValue("^");
        await workflow.updatePatientMessageStatus(reminderId, "Deferred", deferredBody);
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        const waitlistRegion = page.getByRole("region", { name: "Appointment waitlist queue" });
        await expect(waitlistRegion).toContainText("Waitlist Queue");
        await expect(waitlistRegion).toContainText(requestReason);
        const requestCard = waitlistRegion.locator("article").filter({ hasText: requestReason });
        await expect(requestCard).toContainText("New");
        await requestCard.getByRole("button", { name: "Defer request" }).click();
        await expect(requestCard).toContainText("Deferred");
      }

      const deferredAppointment = await workflow.getAppointment(appointmentId);
      const reminderAfter = await workflow.getPatientMessage(reminderId);
      expect(deferredAppointment).toMatchObject({
        status: "^",
        eventDate: requestInput.date,
        startTime: "11:00:00",
        endTime: "11:30:00",
        homeText: requestReason
      });
      expect(reminderAfter).toMatchObject({
        patientId: patient!.pid,
        title: "Patient Reminders",
        status: "Deferred"
      });
      const normalizedReminderBody = String(reminderAfter?.body ?? "").replace(/\\n/g, "\n");
      expect(normalizedReminderBody).toBe(deferredBody);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-600-appointment-waitlist-deferral-deferred",
        description: "Captures the staff waitlist deferral result: the appointment remains in waitlist status while the linked reminder records Deferred follow-up state and staff note text.",
        expected: {
          appointment: {
            status: "^",
            stillWaiting: true,
            preservedReason: requestReason
          },
          reminder: {
            status: "Deferred",
            body: deferredBody
          }
        },
        actual: {
          patient,
          appointmentId,
          reminderId,
          deferredAppointment,
          reminderAfter
        },
        context: {
          canonicalId: waitlistDeferralAnchorPatientId,
          suite: "workflow-appointment-waitlist-deferral",
          workflow: "appointment-waitlist-deferral-deferred"
        }
      });
    } finally {
      if (appointmentId !== null) {
        await workflow.deleteAppointment(appointmentId);
      }
      if (reminderId !== null) {
        await workflow.deletePatientMessage(reminderId);
      }
      const cleanupAppointments = await workflow.getPatientPortalAppointments(portalLoginUsername, portalPassword);
      expect(cleanupAppointments.upcomingAppointments.some((item) => item.comments === requestReason)).toBe(false);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-600-appointment-waitlist-deferral-cleanup",
        description: "Captures final cleanup after the temporary deferred waitlist appointment request and linked reminder are removed.",
        expected: {
          requestReasonAbsentFromUpcomingAppointments: requestReason
        },
        actual: {
          cleanupAppointments
        },
        context: {
          canonicalId: waitlistDeferralAnchorPatientId,
          suite: "workflow-appointment-waitlist-deferral",
          workflow: "appointment-waitlist-deferral-cleanup"
        }
      });
    }
  });
});
