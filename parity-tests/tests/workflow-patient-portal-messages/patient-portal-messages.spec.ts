import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal secure-message parity @slice210 @workflow-patient-portal-messages @patients @portal", () => {
  test("shows the signed-in patient's secure-message inbox", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    test.setTimeout(120_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-210-patient-portal-messages-precondition",
      description: "Captures the Slice 210 portal secure-message inbox precondition: the signed-in anchor patient exists for portal mailbox checks.",
      expected: {
        anchorCanonicalId: portalMessageAnchorPatientId,
        loginUsername: portalLoginUsername,
        pubpid: portalMessageAnchorPatientId
      },
      actual: {
        patient
      },
      context: {
        canonicalId: portalMessageAnchorPatientId,
        suite: "workflow-patient-portal-messages",
        workflow: "patient-portal-messages-precondition"
      }
    });

    const portalMessages = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
    expect(portalMessages).toMatchObject({
      authenticated: true,
      username: portalLoginUsername,
      portalUsername: portalLoginUsername,
      pid: patient!.pid,
      pubpid: patient!.pubpid,
      displayName: "Kim, Nora",
      messageCount: 2,
      failureReason: null
    });

    const latestMessage = portalMessages.messages[0];
    const portalMessage = portalMessages.messages.find((message) => message.title === "Portal message");
    const careTeamMessage = portalMessages.messages.find((message) => message.title === "Care team follow-up");
    expect(latestMessage).toMatchObject({
      title: "Portal message",
      status: "Done",
      body: "Patient portal question about medications.",
      isEncrypted: false
    });
    expect(portalMessage).toMatchObject({
      status: "Done",
      body: "Patient portal question about medications.",
      isEncrypted: false
    });
    expect(careTeamMessage).toMatchObject({
      status: "New",
      body: "Follow-up message for Nora Kim.",
      isEncrypted: false
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-210-patient-portal-messages-inbox",
      description: "Captures the Slice 210 authenticated portal secure-message inbox payload, including identity, message counts, and seeded message details.",
      expected: {
        authenticated: true,
        username: portalLoginUsername,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        messageCount: 2,
        messages: [
          {
            title: "Portal message",
            status: "Done",
            body: "Patient portal question about medications.",
            isEncrypted: false
          },
          {
            title: "Care team follow-up",
            status: "New",
            body: "Follow-up message for Nora Kim.",
            isEncrypted: false
          }
        ]
      },
      actual: {
        patient,
        portalMessages,
        latestMessage,
        portalMessage,
        careTeamMessage
      },
      context: {
        canonicalId: portalMessageAnchorPatientId,
        suite: "workflow-patient-portal-messages",
        workflow: "patient-portal-messages-inbox"
      }
    });

    if (target.type === "legacy-openemr") {
      const legacyMessagesSurface = await expectLegacyPatientPortalMessages(page, target, portalLoginUsername, portalPassword);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-210-patient-portal-messages-legacy-surface",
        description: "Captures the Slice 210 legacy patient portal secure-message inbox rendering after authenticated portal sign-in.",
        expected: {
          urlIncludes: "/portal/messaging/messages.php",
          visibleFields: [
            "Secure Messaging",
            "Inbox",
            "Portal message",
            "Care team follow-up"
          ]
        },
        actual: {
          url: page.url(),
          legacyMessagesSurface
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-messages",
          workflow: "patient-portal-messages-legacy-surface"
        }
      });
    } else {
      await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
      await expect(page.locator("body")).toContainText("Secure Messages");
      await expect(page.locator("body")).toContainText("Inbox");
      await expect(page.locator("body")).toContainText("Portal message");
      await expect(page.locator("body")).toContainText("Patient portal question about medications.");
      await expect(page.locator("body")).toContainText("Care team follow-up");
      await expect(page.locator("body")).toContainText("Plain text message");
      const modernizedMessagesSurface = await page.locator("body").innerText();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-210-patient-portal-messages-modernized-surface",
        description: "Captures the Slice 210 modernized Portal secure-message inbox rendering after authenticated portal sign-in.",
        expected: {
          visibleFields: [
            "Secure Messages",
            "Inbox",
            "Portal message",
            "Patient portal question about medications.",
            "Care team follow-up",
            "Plain text message"
          ]
        },
        actual: {
          url: page.url(),
          modernizedMessagesSurface
        },
        context: {
          canonicalId: portalMessageAnchorPatientId,
          suite: "workflow-patient-portal-messages",
          workflow: "patient-portal-messages-modernized-surface"
        }
      });
    }
  });
});

async function expectLegacyPatientPortalMessages(page: Page, target: RuntimeTarget, username: string, password: string) {
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
  await page.goto(`${target.publicUrl}/portal/messaging/messages.php`);
  await expectRenderedText(page, /Secure Messaging/i);
  await expectRenderedText(page, /Inbox/i);
  await expect(page.locator("body")).toContainText("Portal message");
  await expect(page.locator("body")).toContainText("Care team follow-up");
  return page.locator("body").innerText();
}
