import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalAppointmentAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal appointment list parity @slice219 @workflow-patient-portal-appointments @patients @portal @appointments", () => {
  test("lists future and past appointments for the signed-in portal patient", async ({
    targetDb,
    workflow
  }) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalAppointmentAnchorPatientId);
    expect(patient).not.toBeNull();

    const appointments = await workflow.getPatientPortalAppointments(portalLoginUsername, portalPassword);
    expect(appointments).toMatchObject({
      authenticated: true,
      username: portalLoginUsername,
      portalUsername: portalLoginUsername,
      pid: patient!.pid,
      pubpid: patient!.pubpid,
      displayName: "Kim, Nora",
      upcomingAppointmentCount: 1,
      pastAppointmentCount: 2,
      failureReason: null
    });
    expect(appointments.upcomingAppointments).toHaveLength(1);
    expect(appointments.upcomingAppointments[0]).toMatchObject({
      date: "2026-07-28",
      startTime: "14:30",
      title: "Preventive Care",
      status: "-",
      categoryId: 13,
      categoryName: "Preventive Care Services"
    });
    expect(appointments.pastAppointments.map((appointment) => appointment.title)).toEqual([
      "Established Patient",
      "New Patient"
    ]);
    expect(appointments.pastAppointments.map((appointment) => appointment.date)).toEqual([
      "2026-06-06",
      "2026-02-21"
    ]);
  });

  test("renders upcoming and past appointments on the portal surface", async ({
    page,
    target
  }) => {
    test.setTimeout(120_000);

    if (target.type === "legacy-openemr") {
      await expectLegacyPatientPortalAppointments(page, target);
      return;
    }

    await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
    const appointmentsRegion = page.getByRole("region", { name: "Patient portal appointments" });
    await expect(appointmentsRegion).toContainText("Appointments");
    await expect(appointmentsRegion).toContainText("Upcoming");
    await expect(appointmentsRegion).toContainText("Past");
    await expect(appointmentsRegion).toContainText("Preventive Care");
    await expect(appointmentsRegion).toContainText("2026-07-28 14:30");
    await expect(appointmentsRegion).toContainText("Established Patient");
    await expect(appointmentsRegion).toContainText("2026-06-06 13:00");
    await expect(appointmentsRegion).toContainText("New Patient");
    await expect(appointmentsRegion).toContainText("2026-02-21 12:30");
  });
});

async function expectLegacyPatientPortalAppointments(page: Page, target: RuntimeTarget) {
  await page.context().clearCookies();
  await page.goto(`${target.publicUrl}/portal/index.php?site=default&woops=1`);
  await page.locator("#uname").fill(portalLoginUsername);
  await page.locator("#pass").fill(portalPassword);

  const emailConfirmation = page.locator("#passaddon");
  if ((await emailConfirmation.count()) > 0 && await emailConfirmation.isVisible()) {
    await emailConfirmation.fill(portalLoginUsername);
  }

  await page.getByRole("button", { name: "Log In" }).click();
  await expect.poll(() => page.url()).toContain("/portal/home.php");
  await page.locator("#appointments-go").click();
  await expectRenderedText(page, /Future Appointments/i);
  await expectRenderedText(page, /Past Appointments/i);
  await expect(page.locator("body")).toContainText("Preventive Care");
  await expect(page.locator("body")).toContainText("Established Patient");
  await expect(page.locator("body")).toContainText("New Patient");
}
