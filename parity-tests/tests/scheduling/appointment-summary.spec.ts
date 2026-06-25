import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const schedulingAnchorPatientId = "MOD-PAT-0003";
const schedulingAnchorDate = "2026-06-18";

test.describe("scheduling appointment parity @slice2 @scheduling", () => {
  test("stable scheduling anchor has a future appointment fact", async ({ target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(schedulingAnchorPatientId);
    const appointment = patient ? await targetDb.getFutureAppointmentForPatient(patient.pid, schedulingAnchorDate) : null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-2-future-appointment-anchor",
      description: "Verifies the Slice 2 scheduling anchor patient and future appointment database facts.",
      expected: {
        patient: {
          pubpid: schedulingAnchorPatientId
        },
        appointment: {
          patientId: patient?.pid ?? 100003,
          eventDate: `> ${schedulingAnchorDate}`,
          title: "non-empty",
          startTime: "HH:mm",
          status: "non-empty"
        }
      },
      actual: {
        patient,
        appointment
      },
      context: {
        canonicalId: schedulingAnchorPatientId,
        afterDate: schedulingAnchorDate,
        suite: "scheduling",
        workflow: "future-appointment-readiness"
      }
    });

    expect(patient).not.toBeNull();

    expect(appointment).not.toBeNull();
    expect(appointment!.patientId).toBe(patient!.pid);
    expect(appointment!.eventDate > schedulingAnchorDate).toBe(true);
    expect(appointment!.title).toBeTruthy();
    expect(appointment!.startTime).toMatch(/^\d{2}:\d{2}/);
  });

  test("future appointment detail is visible in the application UI", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(schedulingAnchorPatientId);
    const appointment = patient ? await targetDb.getFutureAppointmentForPatient(patient.pid, schedulingAnchorDate) : null;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-2-appointment-ui-precondition",
      description: "Captures the patient and future appointment database rows used before steering the Slice 2 scheduling UI parity flow.",
      expected: {
        patient: {
          pubpid: schedulingAnchorPatientId
        },
        appointment: {
          eventDate: `> ${schedulingAnchorDate}`,
          title: "visible appointment title",
          startTime: "visible appointment time"
        }
      },
      actual: {
        patient,
        appointment
      },
      context: {
        canonicalId: schedulingAnchorPatientId,
        afterDate: schedulingAnchorDate,
        suite: "scheduling",
        workflow: "future-appointment-ui"
      }
    });
    expect(patient).not.toBeNull();
    expect(appointment).not.toBeNull();

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openAppointmentDirect(page, target, appointment!.id);

      await expect(page.locator('input[name="form_title"]')).toHaveValue(appointment!.title);
      await expect(page.locator('input[name="form_patient"]')).toHaveValue(`${patient!.lname}, ${patient!.fname}`);
      await expect(page.locator('input[name="form_date"]')).toHaveValue(appointment!.eventDate);
      await expect(page.locator('input[name="form_hour"]')).toHaveValue(appointment!.startTime.slice(0, 2));
      await expect(page.locator('input[name="form_minute"]')).toHaveValue(appointment!.startTime.slice(3, 5));
      await expect(page.locator('select[name="form_apptstatus"]')).toHaveValue(appointment!.status);
      return;
    }

    await openAuthenticatedModernizedCalendar(page, target);

    await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);
    await page.getByLabel("Appointment from date").fill(schedulingAnchorDate);

    const appointmentButton = page.getByRole("button", { name: new RegExp(escapeRegex(appointment!.title), "i") }).first();
    await expect(appointmentButton).toBeVisible();
    await appointmentButton.click();

    await expect(page.getByRole("heading", { name: appointment!.title })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(`PID ${patient!.pid}`);
    await expect(page.locator("body")).toContainText(appointment!.eventDate);
    await expect(page.locator("body")).toContainText(appointment!.startTime.slice(0, 5));
    await expect(page.locator("body")).toContainText(appointment!.status);
  });
});

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
