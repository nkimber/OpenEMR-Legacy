import { test, expect } from "../../src/fixtures/parityTest.js";
import { openAuthenticatedModernizedCalendar } from "../../src/ui/modernizedOpenEmr.js";
import { loginToLegacyOpenEmr, openAppointmentDirect } from "../../src/ui/legacyOpenEmr.js";

const appointmentAnchorPatientId = "MOD-PAT-0003";
const endDate = "2027-04-30";

const scenarios = [
  {
    titlePrefix: "Parity Monthly Repeat-On Nth",
    anchorDate: "2026-12-08",
    startTime: "09:10:00",
    endTime: "09:40:00",
    room: "RepeatNth",
    repeatOnNum: 2,
    repeatOnDay: 2,
    repeatOnFrequency: 1,
    legacyRepeatType: "5",
    expectedLabel: `Every month on the 2nd Tue until ${endDate}`,
    expectedRepeatOnDetail: "2nd Tue each month",
    generatedDate: "2027-01-12",
    expectedDates: ["2026-12-08", "2027-01-12", "2027-02-09", "2027-03-09", "2027-04-13"]
  },
  {
    titlePrefix: "Parity Monthly Repeat-On Last",
    anchorDate: "2026-12-25",
    startTime: "14:20:00",
    endTime: "14:50:00",
    room: "RepeatLast",
    repeatOnNum: 5,
    repeatOnDay: 5,
    repeatOnFrequency: 1,
    legacyRepeatType: "6",
    expectedLabel: `Every month on the Last Fri until ${endDate}`,
    expectedRepeatOnDetail: "Last Fri each month",
    generatedDate: "2027-01-29",
    expectedDates: ["2026-12-25", "2027-01-29", "2027-02-26", "2027-03-26", "2027-04-30"]
  }
] as const;

test.describe("appointment monthly repeat-on recurrence parity @slice115 @workflow-appointment-monthly-repeat-on-recurrence @mutation", () => {
  test("creates, renders, expands, and removes nth and last weekday monthly recurring appointments", async ({ page, target, targetDb, workflow }) => {
    const patient = await targetDb.findPatientByCanonicalId(appointmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const beforeCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    const suffix = workflowSuffix();
    const appointmentIds: Array<number | string> = [];

    try {
      for (const scenario of scenarios) {
        const title = `${scenario.titlePrefix} ${suffix}`;
        const appointmentId = await workflow.createAppointment({
          patientId: patient!.pid,
          providerId: patient!.providerId,
          title,
          eventDate: scenario.anchorDate,
          startTime: scenario.startTime,
          endTime: scenario.endTime,
          durationSeconds: 1800,
          homeText: "Created by the appointment monthly repeat-on recurrence parity suite.",
          facilityId: 10,
          billingLocationId: 10,
          room: scenario.room,
          categoryId: 9,
          recurrenceType: 2,
          repeatOnNum: scenario.repeatOnNum,
          repeatOnDay: scenario.repeatOnDay,
          repeatOnFrequency: scenario.repeatOnFrequency,
          recurrenceEndDate: endDate
        });
        appointmentIds.push(appointmentId);

        const created = await workflow.getAppointment(appointmentId);
        expect(created).toMatchObject({
          patientId: patient!.pid,
          providerId: patient!.providerId,
          title,
          eventDate: scenario.anchorDate,
          startTime: scenario.startTime,
          endTime: scenario.endTime,
          status: "-",
          facilityId: 10,
          billingLocationId: 10,
          room: scenario.room,
          categoryId: 9,
          recurrenceType: 2,
          repeatFrequency: null,
          repeatUnit: null,
          repeatOnNum: scenario.repeatOnNum,
          repeatOnDay: scenario.repeatOnDay,
          repeatOnFrequency: scenario.repeatOnFrequency,
          recurrenceEndDate: endDate
        });

        const occurrences = await workflow.getAppointmentSeriesOccurrences(patient!.pid, scenario.anchorDate);
        const scenarioOccurrences = occurrences.filter((occurrence) => occurrence.title === title);
        expect(scenarioOccurrences.map((occurrence) => occurrence.date)).toEqual(scenario.expectedDates);
        expect(scenarioOccurrences.map((occurrence) => occurrence.occurrenceNumber)).toEqual(
          scenario.expectedDates.map((_, index) => index + 1));
        expect(scenarioOccurrences.every((occurrence) => occurrence.recurrenceType === 2)).toBe(true);
        expect(scenarioOccurrences.every((occurrence) => occurrence.repeatFrequency === null)).toBe(true);
        expect(scenarioOccurrences.every((occurrence) => occurrence.repeatUnit === null)).toBe(true);
        expect(scenarioOccurrences.every((occurrence) => occurrence.repeatOnNum === scenario.repeatOnNum)).toBe(true);
        expect(scenarioOccurrences.every((occurrence) => occurrence.repeatOnDay === scenario.repeatOnDay)).toBe(true);
        expect(scenarioOccurrences.every((occurrence) => occurrence.repeatOnFrequency === scenario.repeatOnFrequency)).toBe(true);
        expect(scenarioOccurrences[1].isVirtualOccurrence).toBe(true);
      }

      const afterCreateCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
      expect(afterCreateCounts.appointments).toBe(beforeCounts.appointments + scenarios.length);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        for (const [index, scenario] of scenarios.entries()) {
          const title = `${scenario.titlePrefix} ${suffix}`;
          await openAppointmentDirect(page, target, appointmentIds[index]);

          await expect(page.locator('input[name="form_title"]')).toHaveValue(title);
          await expect(page.locator('input[name="form_repeat"]')).toBeChecked();
          await expect(page.locator('select[name="form_repeat_freq"]')).toHaveValue(String(scenario.repeatOnFrequency));
          await expect(page.locator('select[name="form_repeat_type"]')).toHaveValue(scenario.legacyRepeatType);
          await expect(page.locator('input[name="form_enddate"]')).toHaveValue(endDate);
        }
      } else {
        await openAuthenticatedModernizedCalendar(page, target);
        await page.getByLabel("Appointment patient ID").fill(patient!.pubpid);

        for (const scenario of scenarios) {
          const title = `${scenario.titlePrefix} ${suffix}`;
          await page.getByLabel("Appointment from date").fill(scenario.anchorDate);

          const rootButton = page.getByRole("button", { name: new RegExp(escapeRegex(title), "i") }).first();
          await expect(rootButton).toBeVisible();
          await expect(rootButton).toContainText(scenario.expectedLabel);
          await rootButton.click();
          await expect(page.getByRole("heading", { name: title })).toBeVisible();
          await expect(page.getByLabel("Edit appointment repeats")).toBeChecked();
          await expect(page.getByLabel("Edit appointment monthly repeat on")).toBeChecked();
          await expect(page.getByLabel("Edit appointment repeat-on ordinal")).toHaveValue(String(scenario.repeatOnNum));
          await expect(page.getByLabel("Edit appointment repeat-on weekday")).toHaveValue(String(scenario.repeatOnDay));
          await expect(page.getByLabel("Edit appointment repeat-on frequency")).toHaveValue(String(scenario.repeatOnFrequency));
          await expect(page.getByLabel("Edit appointment recurrence end date")).toHaveValue(endDate);
          await expect(page.locator("body")).toContainText(scenario.expectedLabel);
          await expect(page.locator("body")).toContainText(scenario.expectedRepeatOnDetail);

          await page.getByLabel("Appointment from date").fill(scenario.generatedDate);
          const generatedButton = page
            .getByRole("button", { name: new RegExp(`${escapeRegex(title)}[\\s\\S]*${scenario.generatedDate}`, "i") })
            .first();
          await expect(generatedButton).toBeVisible();
          await expect(generatedButton).toContainText("Generated occurrence 2");
          await expect(generatedButton).toContainText(scenario.expectedLabel);
        }
      }
    } finally {
      for (const appointmentId of appointmentIds.reverse()) {
        await workflow.deleteAppointment(appointmentId);
      }
    }

    const afterCleanupCounts = await targetDb.getPatientWorkflowCounts(patient!.pid);
    expect(afterCleanupCounts.appointments).toBe(beforeCounts.appointments);
    for (const appointmentId of appointmentIds) {
      await expect(workflow.getAppointment(appointmentId)).resolves.toBeNull();
    }
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}