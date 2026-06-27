import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const portalAppointmentAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("appointment waitlist queue parity @slice576 @workflow-appointment-waitlist @appointments @scheduling @mutation", () => {
  test("projects pending portal appointment requests into the staff waitlist and promotes one to pending", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalAppointmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const requestReason = `Waitlist request parity ${Date.now()}`;
    const requestInput = {
      providerId: 105,
      facilityId: 11,
      categoryId: 9,
      date: "2026-09-23",
      startTime: "09:30",
      durationMinutes: 30,
      reason: requestReason
    };
    let appointmentId: number | string | null = null;
    let reminderId: number | string | null = null;

    try {
      const requestResult = await workflow.requestPatientPortalAppointment(portalLoginUsername, portalPassword, requestInput);
      expect(requestResult.created).toBe(true);
      expect(requestResult.appointment).toMatchObject({
        date: requestInput.date,
        startTime: requestInput.startTime,
        status: "^",
        comments: requestReason
      });
      expect(requestResult.reminder).toMatchObject({
        title: "Patient Reminders",
        status: "New"
      });

      appointmentId = requestResult.appointment!.id;
      reminderId = requestResult.reminder!.id;

      const waitingAppointment = await workflow.getAppointment(appointmentId);
      const reminder = await workflow.getPatientMessage(reminderId);
      expect(waitingAppointment).toMatchObject({
        patientId: patient!.pid,
        providerId: requestInput.providerId,
        eventDate: requestInput.date,
        startTime: "09:30:00",
        endTime: "10:00:00",
        status: "^",
        homeText: requestReason
      });
      expect(reminder).toMatchObject({
        patientId: patient!.pid,
        title: "Patient Reminders",
        status: "New"
      });
      expect(reminder?.body).toContain(requestReason);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-576-appointment-waitlist-created",
        description: "Captures the cleanup-backed portal appointment request before staff waitlist promotion, including pending-request status and linked provider reminder.",
        expected: {
          appointment: {
            status: "^",
            date: requestInput.date,
            startTime: "09:30:00",
            endTime: "10:00:00",
            reason: requestReason
          },
          reminder: {
            title: "Patient Reminders",
            status: "New",
            bodyIncludes: requestReason
          }
        },
        actual: {
          patient,
          requestInput,
          requestResult,
          waitingAppointment,
          reminder
        },
        context: {
          canonicalId: portalAppointmentAnchorPatientId,
          suite: "workflow-appointment-waitlist",
          workflow: "appointment-waitlist-created"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openAppointmentDirect(page, target, appointmentId);
        await expect(page.locator('select[name="form_apptstatus"]')).toHaveValue("^");
        await workflow.updateAppointmentStatus(appointmentId, "~", waitingAppointment!.title);
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        const waitlistRegion = page.getByRole("region", { name: "Appointment waitlist queue" });
        await expect(waitlistRegion).toContainText("Waitlist Queue");
        await expect(waitlistRegion).toContainText(requestReason);
        await expect(waitlistRegion).toContainText("New");
        const requestCard = waitlistRegion.locator("article").filter({ hasText: requestReason });
        await requestCard.getByRole("button", { name: "Promote pending" }).click();
        await expect(page.getByLabel("Edit appointment status")).toHaveValue("~");
      }

      const promotedAppointment = await workflow.getAppointment(appointmentId);
      expect(promotedAppointment).toMatchObject({
        status: "~",
        eventDate: requestInput.date,
        startTime: "09:30:00",
        endTime: "10:00:00",
        homeText: requestReason
      });

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-576-appointment-waitlist-promoted",
        description: "Captures the staff waitlist promotion result: the same portal-request appointment moves from request status ^ to pending status ~ while preserving slot, patient, provider, and reason.",
        expected: {
          status: "~",
          appointmentId,
          preservedReason: requestReason
        },
        actual: {
          patient,
          appointmentId,
          reminderId,
          promotedAppointment
        },
        context: {
          canonicalId: portalAppointmentAnchorPatientId,
          suite: "workflow-appointment-waitlist",
          workflow: "appointment-waitlist-promoted"
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
        probe: "slice-576-appointment-waitlist-cleanup",
        description: "Captures final cleanup after the temporary waitlist appointment request and linked reminder are removed.",
        expected: {
          requestReasonAbsentFromUpcomingAppointments: requestReason
        },
        actual: {
          cleanupAppointments
        },
        context: {
          canonicalId: portalAppointmentAnchorPatientId,
          suite: "workflow-appointment-waitlist",
          workflow: "appointment-waitlist-cleanup"
        }
      });
    }
  });
});
