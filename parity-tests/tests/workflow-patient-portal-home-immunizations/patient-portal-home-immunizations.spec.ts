import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type {
  ImmunizationRecord,
  PatientPortalHomeImmunizationSummary,
  PatientPortalHomeSummary
} from "../../src/workflows/legacyWorkflowActions.js";
import type { Page } from "@playwright/test";

const portalHomeAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const vaccine = "Influenza, seasonal, injectable";

const expectedPermanentImmunization = {
  administeredDate: "2026-01-12",
  administeredFormatted: "01/12/2026",
  cvxCode: "141",
  codeText: vaccine,
  note: "Seasonal influenza vaccine for portal-messaging.",
  completionStatus: "completed",
  addedErroneously: 0
};

test.describe("patient portal home immunization parity @slice249 @workflow-patient-portal-home-immunizations @patients @portal", () => {
  test("shows portal health-snapshot immunizations including entered-in-error rows", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalHomeAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-249-patient-portal-home-immunizations-precondition",
      description: "Captures the Slice 249 portal home immunization precondition: the signed-in anchor patient exists before creating the temporary entered-in-error immunization row.",
      expected: {
        canonicalId: portalHomeAnchorPatientId,
        portalUsername: portalLoginUsername,
        permanentImmunization: expectedPermanentImmunization
      },
      actual: {
        patient
      },
      context: {
        canonicalId: portalHomeAnchorPatientId,
        suite: "workflow-patient-portal-home-immunizations",
        workflow: "patient-portal-home-immunizations-precondition"
      }
    });

    const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const lotNumber = `PORTAL-HOME-IMM-${suffix}`;
    const errorNote = `Entered in error for portal home immunization parity ${suffix}.`;
    let immunizationId: number | string | null = null;

    try {
      immunizationId = await workflow.createImmunization({
        patientId: patient!.pid,
        providerId: patient!.providerId,
        encounter: 0,
        administeredAt: "2026-08-20 09:15:00",
        immunizationId: 30,
        cvxCode: "141",
        vaccine,
        manufacturer: "Sanofi Pasteur",
        lotNumber,
        administeredBy: "admin",
        educationDate: "2026-08-20",
        visDate: "2026-08-01",
        amountAdministered: 0.5,
        amountAdministeredUnit: "mL",
        expirationDate: "2027-06-30",
        route: "intramuscular",
        administrationSite: "right deltoid",
        completionStatus: "completed",
        informationSource: "new_immunization_record",
        note: "Created for patient portal home immunization parity."
      });

      await workflow.markImmunizationEnteredInError(immunizationId, errorNote);
      const enteredInError = await workflow.getImmunization(immunizationId);
      expect(enteredInError).toMatchObject({
        patientId: patient!.pid,
        immunizationId: 30,
        cvxCode: "141",
        vaccine,
        administeredDate: "2026-08-20",
        manufacturer: "Sanofi Pasteur",
        lotNumber,
        route: "intramuscular",
        administrationSite: "right deltoid",
        completionStatus: "completed",
        informationSource: "new_immunization_record",
        note: errorNote,
        addedErroneously: 1
      });
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-249-patient-portal-home-immunizations-entered-in-error-row",
        description: "Captures the temporary Slice 249 immunization after it is marked entered in error but before the portal home projection reads it.",
        expected: {
          patientId: patient!.pid,
          administeredDate: "2026-08-20",
          cvxCode: "141",
          vaccine,
          lotNumber,
          note: errorNote,
          addedErroneously: 1
        },
        actual: {
          immunizationId,
          enteredInError: summarizeImmunizationRecord(enteredInError)
        },
        context: {
          canonicalId: portalHomeAnchorPatientId,
          suite: "workflow-patient-portal-home-immunizations",
          workflow: "patient-portal-home-immunizations-entered-in-error-row"
        }
      });

      const home = await workflow.getPatientPortalHomeSummary(portalLoginUsername, portalPassword);
      expect(home).toMatchObject({
        authenticated: true,
        username: portalLoginUsername,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        immunizationCount: 2,
        failureReason: null
      });

      expect(home.immunizations).toEqual(expect.arrayContaining([
        expect.objectContaining(expectedPermanentImmunization),
        expect.objectContaining({
          administeredDate: "2026-08-20",
          administeredFormatted: "08/20/2026",
          cvxCode: "141",
          codeText: vaccine,
          note: errorNote,
          completionStatus: "completed",
          addedErroneously: 1
        })
      ]));
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-249-patient-portal-home-immunizations-result",
        description: "Captures the Slice 249 portal home immunization health-snapshot result, including the permanent active row and temporary entered-in-error row.",
        expected: {
          authenticated: true,
          canonicalId: portalHomeAnchorPatientId,
          displayName: "Kim, Nora",
          immunizationCount: 2,
          permanentImmunization: expectedPermanentImmunization,
          enteredInErrorImmunization: {
            administeredDate: "2026-08-20",
            administeredFormatted: "08/20/2026",
            cvxCode: "141",
            codeText: vaccine,
            note: errorNote,
            completionStatus: "completed",
            addedErroneously: 1
          }
        },
        actual: summarizeHomeImmunizations(home),
        context: {
          canonicalId: portalHomeAnchorPatientId,
          suite: "workflow-patient-portal-home-immunizations",
          workflow: "patient-portal-home-immunizations-result"
        }
      });

      if (target.type === "legacy-openemr") {
        const legacyUi = await expectLegacyPortalHomeImmunizations(page, target, errorNote);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-249-patient-portal-home-immunizations-legacy-ui",
          description: "Captures the legacy portal home Health Snapshot rendering for Slice 249 immunization rows.",
          expected: {
            urlIncludes: "/portal/home.php",
            visibleFacts: [
              "01/12/2026",
              "08/20/2026",
              vaccine,
              errorNote,
              "completed"
            ]
          },
          actual: legacyUi,
          context: {
            canonicalId: portalHomeAnchorPatientId,
            suite: "workflow-patient-portal-home-immunizations",
            workflow: "patient-portal-home-immunizations-legacy-ui"
          }
        });
      } else {
        const modernizedUi = await expectModernizedPortalHomeImmunizations(page, target, errorNote);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-249-patient-portal-home-immunizations-modernized-ui",
          description: "Captures the modernized Portal home immunization region rendering for Slice 249 immunization rows.",
          expected: {
            regionName: "Patient portal immunizations",
            visibleFacts: [
              "2 records",
              "01/12/2026",
              "08/20/2026",
              vaccine,
              "Seasonal influenza vaccine for portal-messaging.",
              errorNote,
              "Entered in error"
            ]
          },
          actual: modernizedUi,
          context: {
            canonicalId: portalHomeAnchorPatientId,
            suite: "workflow-patient-portal-home-immunizations",
            workflow: "patient-portal-home-immunizations-modernized-ui"
          }
        });
      }
    } finally {
      if (immunizationId !== null) {
        await workflow.deleteImmunization(immunizationId);
        const afterCleanup = await workflow.getImmunization(immunizationId);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-249-patient-portal-home-immunizations-cleanup",
          description: "Captures the final hard-delete cleanup state for the temporary Slice 249 entered-in-error immunization row.",
          expected: {
            deletedImmunization: null
          },
          actual: {
            immunizationId,
            afterCleanup
          },
          context: {
            canonicalId: portalHomeAnchorPatientId,
            suite: "workflow-patient-portal-home-immunizations",
            workflow: "patient-portal-home-immunizations-cleanup"
          }
        });
        expect(afterCleanup).toBeNull();
      }
    }
  });
});

async function expectLegacyPortalHomeImmunizations(page: Page, target: RuntimeTarget, errorNote: string) {
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
  await expectRenderedText(page, /Health Snapshot|Patient Immunization/i);
  await expect(page.locator("body")).toContainText("01/12/2026");
  await expect(page.locator("body")).toContainText("08/20/2026");
  await expect(page.locator("body")).toContainText(vaccine);
  await expect(page.locator("body")).toContainText(errorNote);
  await expect(page.locator("body")).toContainText("completed");
  return {
    url: page.url(),
    bodyText: await page.locator("body").innerText()
  };
}

async function expectModernizedPortalHomeImmunizations(page: Page, target: RuntimeTarget, errorNote: string) {
  await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
  const immunizationRegion = page.getByRole("region", { name: "Patient portal immunizations" });
  await expect(immunizationRegion).toContainText("2 records");
  await expect(immunizationRegion).toContainText("01/12/2026");
  await expect(immunizationRegion).toContainText("08/20/2026");
  await expect(immunizationRegion).toContainText(vaccine);
  await expect(immunizationRegion).toContainText("Seasonal influenza vaccine for portal-messaging.");
  await expect(immunizationRegion).toContainText(errorNote);
  await expect(immunizationRegion).toContainText("Entered in error");
  return {
    url: page.url(),
    regionText: await immunizationRegion.innerText()
  };
}

function summarizeHomeImmunizations(home: PatientPortalHomeSummary) {
  return {
    authenticated: home.authenticated,
    username: home.username,
    portalUsername: home.portalUsername,
    pid: home.pid,
    pubpid: home.pubpid,
    displayName: home.displayName,
    immunizationCount: home.immunizationCount,
    failureReason: home.failureReason,
    immunizations: home.immunizations.map(summarizeHomeImmunization)
  };
}

function summarizeHomeImmunization(immunization: PatientPortalHomeImmunizationSummary) {
  return {
    id: immunization.id,
    administeredDate: immunization.administeredDate,
    administeredFormatted: immunization.administeredFormatted,
    immunizationId: immunization.immunizationId,
    cvxCode: immunization.cvxCode,
    codeText: immunization.codeText,
    note: immunization.note,
    completionStatus: immunization.completionStatus,
    addedErroneously: immunization.addedErroneously
  };
}

function summarizeImmunizationRecord(immunization: ImmunizationRecord | null) {
  if (!immunization) {
    return null;
  }

  return {
    id: immunization.id,
    patientId: immunization.patientId,
    immunizationId: immunization.immunizationId,
    cvxCode: immunization.cvxCode,
    vaccine: immunization.vaccine,
    administeredDate: immunization.administeredDate,
    manufacturer: immunization.manufacturer,
    lotNumber: immunization.lotNumber,
    route: immunization.route,
    administrationSite: immunization.administrationSite,
    completionStatus: immunization.completionStatus,
    informationSource: immunization.informationSource,
    note: immunization.note,
    addedErroneously: immunization.addedErroneously,
    encounter: immunization.encounter
  };
}
