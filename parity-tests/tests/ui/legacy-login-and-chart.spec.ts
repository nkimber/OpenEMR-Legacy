import { test, expect } from "../../src/fixtures/parityTest.js";
import { LegacyMariaDbProbe } from "../../src/db/legacyMariaDbProbe.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openAppointmentDirect,
  openEncounterDirect,
  openFeeSheetDirect,
  openPatientSummaryDirect,
  openProcedureResultsDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

test.describe("legacy Playwright UI contract @ui", () => {
  test("logs in with configured local demo credentials", async ({ page, target }) => {
    test.skip(target.type !== "legacy-openemr", "Modernized authentication is deferred to a later slice.");

    await loginToLegacyOpenEmr(page, target);

    await expect(page.locator("body")).toContainText(/OpenEMR|Patient/i);
  });

  test("opens the stable gold patient chart through the legacy UI", async ({ page, target }) => {
    test.skip(target.type !== "legacy-openemr", "Legacy direct chart URL applies only to the legacy target.");

    const legacyDb = new LegacyMariaDbProbe(target);
    const patient = await legacyDb.findPatientByCanonicalId("MOD-PAT-0001");
    expect(patient).not.toBeNull();

    await loginToLegacyOpenEmr(page, target);
    await openPatientSummaryDirect(page, target, patient!.pid);

    await expect(page.locator("body")).toContainText(patient!.fname);
    await expect(page.locator("body")).toContainText(patient!.lname);
    await expect(page.locator("body")).toContainText(patient!.pubpid);
  });

  test("renders a seeded encounter with SOAP and vitals details", async ({ page, target }) => {
    test.skip(target.type !== "legacy-openemr", "Modernized encounter detail is covered by the dedicated slice-3 encounters parity suite.");

    const legacyDb = new LegacyMariaDbProbe(target);
    const patient = await legacyDb.findPatientByCanonicalId("MOD-PAT-0001");
    expect(patient).not.toBeNull();
    const encounter = await legacyDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();

    await loginToLegacyOpenEmr(page, target);
    await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);

    await expectRenderedText(page, new RegExp(escapeRegex(encounterTopic(encounter!.reason)), "i"));
    await expectRenderedText(page, "SOAP");
    await expectRenderedText(page, "Vitals");
    await expectRenderedText(page, /Blood Pressure/i);
    await expectRenderedText(page, /Assessment:/i);
  });

  test("renders future gold appointment details in the legacy scheduler", async ({ page, target }) => {
    test.skip(target.type !== "legacy-openemr", "Modernized scheduler detail is covered by the dedicated slice-2 scheduling parity suite.");

    const legacyDb = new LegacyMariaDbProbe(target);
    const patient = await legacyDb.findPatientByCanonicalId("MOD-PAT-0003");
    expect(patient).not.toBeNull();
    const appointment = await legacyDb.getFutureAppointmentForPatient(patient!.pid, "2026-06-18");
    expect(appointment).not.toBeNull();

    await loginToLegacyOpenEmr(page, target);
    await openAppointmentDirect(page, target, appointment!.id);

    await expect(page.locator('input[name="form_title"]')).toHaveValue(appointment!.title);
    await expect(page.locator('input[name="form_patient"]')).toHaveValue(`${patient!.lname}, ${patient!.fname}`);
    await expect(page.locator('input[name="form_date"]')).toHaveValue(appointment!.eventDate);
    await expect(page.locator('input[name="form_hour"]')).toHaveValue(appointment!.startTime.slice(0, 2));
    await expect(page.locator('input[name="form_minute"]')).toHaveValue(appointment!.startTime.slice(3, 5));
    await expect(page.locator('select[name="form_apptstatus"]')).toHaveValue(appointment!.status);
  });

  test("renders seeded encounter billing codes in the fee sheet", async ({ page, target }) => {
    test.skip(target.type !== "legacy-openemr", "Fee sheet detail is not implemented in the modernized read-only patient slice.");

    const legacyDb = new LegacyMariaDbProbe(target);
    const patient = await legacyDb.findPatientByCanonicalId("MOD-PAT-0001");
    expect(patient).not.toBeNull();
    const encounter = await legacyDb.getLatestEncounterForPatient(patient!.pid);
    expect(encounter).not.toBeNull();
    const billingLines = await legacyDb.getBillingLinesForEncounter(patient!.pid, encounter!.encounter);
    expect(billingLines.length).toBeGreaterThan(0);

    await loginToLegacyOpenEmr(page, target);
    await openEncounterDirect(page, target, patient!.pid, encounter!.encounter);
    await openFeeSheetDirect(page, target, patient!.pid, encounter!.encounter);

    await expectRenderedText(page, "Selected Fee Sheet Codes and Charges");
    for (const billingLine of billingLines.slice(0, 2)) {
      await expectRenderedText(page, billingLine.code);
      await expectRenderedText(page, billingLine.codeText);
    }
  });

  test("renders completed procedure results for a gold lab patient", async ({ page, target }) => {
    test.skip(target.type !== "legacy-openemr", "Procedure results are not implemented in the modernized read-only patient slice.");

    const legacyDb = new LegacyMariaDbProbe(target);
    const patient = await legacyDb.findPatientByCanonicalId("MOD-PAT-0009");
    expect(patient).not.toBeNull();
    const procedureOrder = await legacyDb.getLatestProcedureOrderForPatient(patient!.pid);
    expect(procedureOrder).not.toBeNull();

    await loginToLegacyOpenEmr(page, target);
    await openProcedureResultsDirect(page, target, patient!.pid);

    await expectRenderedText(page, "Order Report Results");
    await expectRenderedText(page, procedureOrder!.procedureName);
    await expectRenderedText(page, /Final|Reviewed|complete/i);
  });

  test("opens the stable gold patient chart through the modernized UI", async ({ page, target }) => {
    test.skip(target.type !== "modernized-openemr", "Modernized UI contract only applies to the modernized target.");

    await openAuthenticatedModernizedPatient(page, target, "MOD-PAT-0001");

    await expect(page.getByRole("button", { name: /Stone, Avery/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Stone, Avery" })).toBeVisible();
    await expect(page.locator("body")).toContainText("MOD-PAT-0001");
    await expect(page.locator("body")).toContainText("PID 100001");
    await expect(page.locator("body")).toContainText("Stable search and demographics navigation");
    await expect(page.locator("body")).toContainText("Appointments");
    await expect(page.locator("body")).toContainText("Encounters");
    await expect(page.locator("body")).toContainText("Prescriptions");
  });
});

function encounterTopic(reason: string) {
  return reason.replace(/^Follow-up for\s+/i, "").replace(/^Comprehensive\s+/i, "");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
