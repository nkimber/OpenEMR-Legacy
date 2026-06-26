import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalHomeAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal home parity @slice209 @workflow-patient-portal-home @patients @portal", () => {
  test("shows portal identity, secure message summary, and upcoming appointments", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalHomeAnchorPatientId);
    expect(patient).not.toBeNull();

    const account = await workflow.getPatientPortalAccountAccessState(patient!.pid);
    expect(account).toMatchObject({
      portalEnabled: true,
      accessStatusLabel: "Enabled",
      cmsPortalLogin: portalLoginUsername,
      hasAccount: true
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-209-patient-portal-home-precondition",
      description: "Captures the Slice 209 portal-home precondition: anchor patient and enabled portal-account access state.",
      expected: {
        anchorCanonicalId: portalHomeAnchorPatientId,
        loginUsername: portalLoginUsername,
        account: {
          portalEnabled: true,
          accessStatusLabel: "Enabled",
          cmsPortalLogin: portalLoginUsername,
          hasAccount: true
        }
      },
      actual: {
        patient,
        account
      },
      context: {
        canonicalId: portalHomeAnchorPatientId,
        suite: "workflow-patient-portal-home",
        workflow: "patient-portal-home-precondition"
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
      failureReason: null
    });
    expect(home.messages).toMatchObject({
      totalMessages: 2,
      newMessages: 1,
      doneMessages: 1,
      latestMessageTitle: "Portal message"
    });
    expect(home.upcomingAppointmentCount).toBeGreaterThanOrEqual(1);
    expect(home.upcomingAppointments[0]).toMatchObject({
      date: "2026-07-28",
      startTime: "14:30",
      title: "Preventive Care",
      status: "-"
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-209-patient-portal-home-summary",
      description: "Captures the Slice 209 authenticated portal home summary, including identity, message counts, and upcoming appointment facts.",
      expected: {
        authenticated: true,
        username: portalLoginUsername,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        messages: {
          totalMessages: 2,
          newMessages: 1,
          doneMessages: 1,
          latestMessageTitle: "Portal message"
        },
        firstUpcomingAppointment: {
          date: "2026-07-28",
          startTime: "14:30",
          title: "Preventive Care",
          status: "-"
        }
      },
      actual: {
        patient,
        home
      },
      context: {
        canonicalId: portalHomeAnchorPatientId,
        suite: "workflow-patient-portal-home",
        workflow: "patient-portal-home-summary"
      }
    });

    if (target.type === "legacy-openemr") {
      const legacyHomeSurface = await expectLegacyPatientPortalHome(page, target, portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-209-patient-portal-home-legacy-surface",
        description: "Captures the Slice 209 legacy patient portal home rendering after authenticated portal sign-in.",
        expected: {
          urlIncludes: "/portal/home.php",
          visibleText: /Portal|Appointments|Secure|Messages/i.toString()
        },
        actual: {
          url: page.url(),
          legacyHomeSurface
        },
        context: {
          canonicalId: portalHomeAnchorPatientId,
          suite: "workflow-patient-portal-home",
          workflow: "patient-portal-home-legacy-surface"
        }
      });
    } else {
      await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
      await expect(page.locator("body")).toContainText("Kim, Nora");
      await expect(page.locator("body")).toContainText("MOD-PAT-0004");
      await expect(page.locator("body")).toContainText("New messages");
      await expect(page.locator("body")).toContainText("2026-07-28");
      await expect(page.locator("body")).toContainText("Preventive Care");
      const modernizedHomeSurface = await page.locator("body").innerText();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-209-patient-portal-home-modernized-surface",
        description: "Captures the Slice 209 modernized Portal home rendering after authenticated portal sign-in.",
        expected: {
          visibleFields: [
            "Kim, Nora",
            "MOD-PAT-0004",
            "New messages",
            "2026-07-28",
            "Preventive Care"
          ]
        },
        actual: {
          url: page.url(),
          modernizedHomeSurface
        },
        context: {
          canonicalId: portalHomeAnchorPatientId,
          suite: "workflow-patient-portal-home",
          workflow: "patient-portal-home-modernized-surface"
        }
      });
    }
  });
});

async function expectLegacyPatientPortalHome(page: Page, target: RuntimeTarget, username: string, password: string) {
  await page.context().clearCookies();
  await page.goto(`${target.publicUrl}/portal/index.php?site=default&woops=1`);
  await page.locator("#uname").fill(username);
  await page.locator("#pass").fill(password);

  const emailConfirmation = page.locator("#passaddon");
  if ((await emailConfirmation.count()) > 0 && await emailConfirmation.isVisible()) {
    await emailConfirmation.fill(username);
  }

  await page.getByRole("button", { name: "Log In" }).click();
  await expect.poll(() => page.url()).toContain("/portal/home.php");
  await expectRenderedText(page, /Portal|Appointments|Secure|Messages/i);
  return page.locator("body").innerText();
}
