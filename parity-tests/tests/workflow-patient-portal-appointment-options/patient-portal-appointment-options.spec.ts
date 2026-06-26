import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalAppointmentAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal appointment request options parity @slice221 @workflow-patient-portal-appointment-options @patients @portal @appointments @read-only", () => {
  test("exposes signed-in appointment request categories, providers, facilities, and defaults", async ({
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(portalAppointmentAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-221-patient-portal-appointment-options-precondition",
      description: "Captures the Slice 221 portal appointment request-options precondition: the signed-in anchor patient exists before deriving categories, providers, facilities, and defaults.",
      expected: {
        anchorCanonicalId: portalAppointmentAnchorPatientId,
        loginUsername: portalLoginUsername,
        pubpid: portalAppointmentAnchorPatientId
      },
      actual: {
        patient
      },
      context: {
        canonicalId: portalAppointmentAnchorPatientId,
        suite: "workflow-patient-portal-appointment-options",
        workflow: "patient-portal-appointment-options-precondition"
      }
    });

    const options = await workflow.getPatientPortalAppointmentRequestOptions(portalLoginUsername, portalPassword);

    expect(options).toMatchObject({
      authenticated: true,
      username: portalLoginUsername,
      portalUsername: portalLoginUsername,
      pid: patient!.pid,
      pubpid: patient!.pubpid,
      displayName: "Kim, Nora",
      failureReason: null
    });
    expect(options.defaults).toMatchObject({
      categoryId: 9,
      providerId: 105,
      facilityId: 11,
      durationMinutes: 15,
      date: "2026-09-22",
      startTime: "09:30"
    });
    expect(options.categories).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 9, name: "Established Patient", durationMinutes: 15 }),
      expect.objectContaining({ id: 10, name: "New Patient", durationMinutes: 30 }),
      expect.objectContaining({ id: 13, name: "Preventive Care Services", durationMinutes: 15 })
    ]));
    expect(options.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 105, facilityId: 11 })
    ]));
    expect(options.facilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 11 })
    ]));
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-221-patient-portal-appointment-options-result",
      description: "Captures the Slice 221 appointment request-options projection, including visit categories, provider/facility choices, and derived defaults.",
      expected: {
        defaults: {
          categoryId: 9,
          providerId: 105,
          facilityId: 11,
          durationMinutes: 15,
          date: "2026-09-22",
          startTime: "09:30"
        },
        categoryOptions: [
          { id: 9, name: "Established Patient", durationMinutes: 15 },
          { id: 10, name: "New Patient", durationMinutes: 30 },
          { id: 13, name: "Preventive Care Services", durationMinutes: 15 }
        ],
        providerIdsInclude: [105],
        facilityIdsInclude: [11]
      },
      actual: {
        patient,
        options
      },
      context: {
        canonicalId: portalAppointmentAnchorPatientId,
        suite: "workflow-patient-portal-appointment-options",
        workflow: "patient-portal-appointment-options-result"
      }
    });
  });

  test("renders appointment request options on the portal form", async ({
    page,
    target
  }, testInfo) => {
    if (target.type === "legacy-openemr") {
      await expectLegacyPatientPortalAppointmentOptions(page, target);
      const legacyAppointmentOptionsSurface = await page.locator("body").innerText();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-221-patient-portal-appointment-options-legacy-surface",
        description: "Captures the Slice 221 legacy patient portal appointment request form options and selected provider.",
        expected: {
          visibleFields: [
            "Established Patient",
            "New Patient"
          ],
          providerValue: "105"
        },
        actual: {
          url: page.url(),
          providerValue: await page.locator("#form_provider_ae").inputValue(),
          categoryText: await page.locator("#form_category").innerText(),
          providerText: await page.locator("#form_provider_ae").innerText(),
          legacyAppointmentOptionsSurface
        },
        context: {
          canonicalId: portalAppointmentAnchorPatientId,
          suite: "workflow-patient-portal-appointment-options",
          workflow: "patient-portal-appointment-options-legacy-surface"
        }
      });
      return;
    }

    await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
    const appointmentsRegion = page.getByRole("region", { name: "Patient portal appointments" });

    await expect(appointmentsRegion.getByLabel("Portal appointment visit")).toHaveValue("9");
    await expect(appointmentsRegion.getByLabel("Portal appointment provider")).toHaveValue("105");
    await expect(appointmentsRegion.getByLabel("Portal appointment facility")).toHaveValue("11");
    await expect(appointmentsRegion.getByLabel("Portal appointment duration")).toHaveValue("15");

    await appointmentsRegion.getByLabel("Portal appointment visit").selectOption("10");
    await expect(appointmentsRegion.getByLabel("Portal appointment duration")).toHaveValue("30");
    await expect(appointmentsRegion.getByLabel("Portal appointment provider")).toContainText(/,/);
    await expect(appointmentsRegion.getByLabel("Portal appointment facility")).not.toHaveValue("");
    const modernizedAppointmentOptionsSurface = await appointmentsRegion.innerText();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-221-patient-portal-appointment-options-modernized-surface",
      description: "Captures the Slice 221 modernized Portal appointment request options rendering and duration update after switching visit type.",
      expected: {
        defaultValues: {
          categoryId: "9",
          providerId: "105",
          facilityId: "11",
          durationMinutes: "15"
        },
        changedCategoryId: "10",
        changedDurationMinutes: "30"
      },
      actual: {
        url: page.url(),
        selectedVisit: await appointmentsRegion.getByLabel("Portal appointment visit").inputValue(),
        selectedProvider: await appointmentsRegion.getByLabel("Portal appointment provider").inputValue(),
        selectedFacility: await appointmentsRegion.getByLabel("Portal appointment facility").inputValue(),
        durationMinutes: await appointmentsRegion.getByLabel("Portal appointment duration").inputValue(),
        modernizedAppointmentOptionsSurface
      },
      context: {
        canonicalId: portalAppointmentAnchorPatientId,
        suite: "workflow-patient-portal-appointment-options",
        workflow: "patient-portal-appointment-options-modernized-surface"
      }
    });
  });
});

async function expectLegacyPatientPortalAppointmentOptions(page: Page, target: RuntimeTarget) {
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
  await page.goto(`${target.publicUrl}/portal/add_edit_event_user.php?site=default&userid=105`);

  await expectRenderedText(page, /Established Patient/i);
  await expect(page.locator("#form_category")).toContainText("New Patient");
  await expect(page.locator("#form_provider_ae")).toContainText(/,/);
  await expect(page.locator("#form_provider_ae")).toHaveValue("105");
}
