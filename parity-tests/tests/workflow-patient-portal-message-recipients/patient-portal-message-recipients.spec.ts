import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { PatientPortalMessageRecipientsResult } from "../../src/workflows/legacyWorkflowActions.js";
import type { Page } from "@playwright/test";

const portalRecipientAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

test.describe("patient portal secure-message recipient directory parity @slice238 @workflow-patient-portal-message-recipients @patients @portal @messages", () => {
  test("normalizes the patient portal secure-message recipient directory", async ({ target, targetDb, workflow }, testInfo) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalRecipientAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-238-patient-portal-message-recipients-precondition",
      description: "Captures the Slice 238 recipient-directory precondition: the signed-in portal anchor patient exists and can be used to resolve secure-message routing.",
      expected: {
        canonicalId: portalRecipientAnchorPatientId,
        portalUsername: portalLoginUsername,
        fallbackRecipientId: "admin",
        fallbackRecipientName: "Administrator"
      },
      actual: {
        canonicalId: portalRecipientAnchorPatientId,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        portalUsername: portalLoginUsername
      },
      context: {
        suite: "workflow-patient-portal-message-recipients",
        workflow: "patient-portal-message-recipients-precondition"
      }
    });

    const directory = await workflow.getPatientPortalMessageRecipients(portalLoginUsername, portalPassword);

    expect(directory).toMatchObject({
      authenticated: true,
      portalUsername: portalLoginUsername,
      pid: patient!.pid,
      recipientCount: 1,
      failureReason: null
    });
    expect(directory.recipients).toEqual([
      {
        id: "admin",
        displayName: "Administrator",
        type: "user",
        active: true,
        fallback: true
      }
    ]);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-238-patient-portal-message-recipients-directory",
      description: "Captures the normalized Slice 238 secure-message recipient directory after target-specific routing rules are projected through the shared workflow API.",
      expected: {
        authenticated: true,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        recipientCount: 1,
        recipients: [
          {
            id: "admin",
            displayName: "Administrator",
            type: "user",
            active: true,
            fallback: true
          }
        ],
        failureReason: null
      },
      actual: summarizeRecipientDirectory(directory),
      context: {
        suite: "workflow-patient-portal-message-recipients",
        workflow: "patient-portal-message-recipients-directory"
      }
    });
  });

  test("renders the available secure-message route as a portal compose option", async ({ page, target, workflow }, testInfo) => {
    test.setTimeout(240_000);

    const directory = await workflow.getPatientPortalMessageRecipients(portalLoginUsername, portalPassword);
    const recipient = directory.recipients[0];
    expect(recipient).toMatchObject({ id: "admin", displayName: "Administrator" });

    if (target.type === "legacy-openemr") {
      const legacyUi = await expectLegacyPortalRecipientOption(page, target, recipient.displayName);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-238-patient-portal-message-recipients-legacy-ui",
        description: "Captures the legacy patient portal Compose Message recipient selector for the Slice 238 fallback secure-message route.",
        expected: {
          visibleFacts: ["Secure Messaging", "Compose Message", recipient.displayName],
          selectedRecipientId: recipient.id,
          selectedRecipientName: recipient.displayName
        },
        actual: {
          directory: summarizeRecipientDirectory(directory),
          legacyUi
        },
        context: {
          suite: "workflow-patient-portal-message-recipients",
          workflow: "patient-portal-message-recipients-legacy-ui"
        }
      });
      return;
    }

    await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
    await expect(page.locator("body")).toContainText("Recipient Directory");
    await expect(page.locator("body")).toContainText("1 routes");
    const selector = page.getByLabel("Secure message recipient");
    await expect(selector).toBeVisible();
    await expect(selector).toHaveValue(recipient.id);
    await expect(selector).toContainText(`${recipient.displayName} (${recipient.id})`);
    const modernizedUi = await captureModernizedRecipientSelector(page, recipient.id);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-238-patient-portal-message-recipients-modernized-ui",
      description: "Captures the modernized Portal recipient-directory panel and secure-message recipient selector for the Slice 238 fallback route.",
      expected: {
        visibleFacts: ["Recipient Directory", "1 routes", recipient.displayName, recipient.id],
        selectedRecipientId: recipient.id,
        selectedRecipientName: recipient.displayName
      },
      actual: {
        directory: summarizeRecipientDirectory(directory),
        modernizedUi
      },
      context: {
        suite: "workflow-patient-portal-message-recipients",
        workflow: "patient-portal-message-recipients-modernized-ui"
      }
    });
  });
});

async function expectLegacyPortalRecipientOption(page: Page, target: RuntimeTarget, recipientName: string) {
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
  await page.goto(`${target.publicUrl}/portal/messaging/messages.php`);
  await expectRenderedText(page, /Secure Messaging/i);
  await page.getByText("Compose Message", { exact: false }).first().click();

  const selector = page.locator("#selSendto");
  await expect(selector).toBeVisible();
  await expect(selector).toContainText(recipientName);
  return captureLegacyRecipientSelector(page);
}

async function captureLegacyRecipientSelector(page: Page) {
  const selector = page.locator("#selSendto");
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    selectorId: "selSendto",
    selectedValue: await selector.inputValue(),
    optionCount: await selector.locator("option").count(),
    options: await captureSelectOptions(selector),
    bodyContainsSecureMessaging: await page.locator("body").evaluate((body) => body.textContent?.includes("Secure Messaging") ?? false)
  };
}

async function captureModernizedRecipientSelector(page: Page, selectedRecipientId: string) {
  const selector = page.getByLabel("Secure message recipient");
  const directoryPanel = page.locator("body");
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    selectedValue: await selector.inputValue(),
    optionCount: await selector.locator("option").count(),
    options: await captureSelectOptions(selector),
    containsRecipientDirectory: await directoryPanel.evaluate((body) => body.textContent?.includes("Recipient Directory") ?? false),
    containsRouteCount: await directoryPanel.evaluate((body) => body.textContent?.includes("1 routes") ?? false),
    selectedOptionText: await selector.locator(`option[value="${selectedRecipientId}"]`).textContent()
  };
}

async function captureSelectOptions(selector: ReturnType<Page["locator"]>) {
  return selector.locator("option").evaluateAll((options) =>
    options.map((option) => ({
      value: option.getAttribute("value") ?? "",
      label: option.textContent?.trim() ?? "",
      selected: (option as HTMLOptionElement).selected
    }))
  );
}

function summarizeRecipientDirectory(directory: PatientPortalMessageRecipientsResult) {
  return {
    authenticated: directory.authenticated,
    username: directory.username,
    portalUsername: directory.portalUsername,
    canonicalId: directory.canonicalId,
    pid: directory.pid,
    pubpid: directory.pubpid,
    displayName: directory.displayName,
    datasetVersion: directory.datasetVersion,
    asOfDate: directory.asOfDate,
    recipientCount: directory.recipientCount,
    recipients: directory.recipients.map((recipient) => ({
      id: recipient.id,
      displayName: recipient.displayName,
      type: recipient.type,
      active: recipient.active,
      fallback: recipient.fallback
    })),
    failureReason: directory.failureReason,
    sessionSource: directory.sessionSource
  };
}
