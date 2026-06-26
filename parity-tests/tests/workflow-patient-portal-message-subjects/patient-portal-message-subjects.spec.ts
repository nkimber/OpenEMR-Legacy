import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { PatientPortalMessageComposeOptionsResult } from "../../src/workflows/legacyWorkflowActions.js";
import type { Page } from "@playwright/test";

const portalSubjectAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

const expectedSubjectOptions = [
  { value: "General", label: "General", default: true },
  { value: "Insurance", label: "Insurance", default: false },
  { value: "Prior Auth", label: "Prior Auth", default: false },
  { value: "Bill/Collect", label: "Bill/Collect", default: false },
  { value: "Referral", label: "Referral", default: false },
  { value: "Pharmacy", label: "Pharmacy", default: false }
];

test.describe("patient portal secure-message subject preset parity @slice239 @workflow-patient-portal-message-subjects @patients @portal @messages", () => {
  test("normalizes the patient portal secure-message compose subject presets", async ({ target, targetDb, workflow }, testInfo) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalSubjectAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-239-patient-portal-message-subjects-precondition",
      description: "Captures the Slice 239 subject-preset precondition: the signed-in portal anchor patient exists and can load OpenEMR-compatible secure-message compose options.",
      expected: {
        canonicalId: portalSubjectAnchorPatientId,
        portalUsername: portalLoginUsername,
        defaultSubject: "General",
        subjectCount: expectedSubjectOptions.length,
        recipientId: "admin"
      },
      actual: {
        canonicalId: portalSubjectAnchorPatientId,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        portalUsername: portalLoginUsername
      },
      context: {
        suite: "workflow-patient-portal-message-subjects",
        workflow: "patient-portal-message-subjects-precondition"
      }
    });

    const composeOptions = await workflow.getPatientPortalMessageComposeOptions(portalLoginUsername, portalPassword);

    expect(composeOptions).toMatchObject({
      authenticated: true,
      portalUsername: portalLoginUsername,
      pid: patient!.pid,
      defaultSubject: "General",
      subjectCount: expectedSubjectOptions.length,
      recipientCount: 1,
      failureReason: null
    });
    expect(composeOptions.subjectOptions).toEqual(expectedSubjectOptions);
    expect(composeOptions.recipients).toEqual([
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
      probe: "slice-239-patient-portal-message-subjects-compose-options",
      description: "Captures the normalized Slice 239 secure-message compose options, including OpenEMR-compatible subject presets and the selected recipient-directory route.",
      expected: {
        authenticated: true,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        defaultSubject: "General",
        subjectCount: expectedSubjectOptions.length,
        subjectOptions: expectedSubjectOptions,
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
      actual: summarizeComposeOptions(composeOptions),
      context: {
        suite: "workflow-patient-portal-message-subjects",
        workflow: "patient-portal-message-subjects-compose-options"
      }
    });
  });

  test("renders editable secure-message subject presets in the portal compose form", async ({ page, target, workflow }, testInfo) => {
    test.setTimeout(240_000);

    const composeOptions = await workflow.getPatientPortalMessageComposeOptions(portalLoginUsername, portalPassword);
    expect(composeOptions.subjectOptions).toEqual(expectedSubjectOptions);

    if (target.type === "legacy-openemr") {
      const legacyUi = await expectLegacyPortalSubjectOptions(page, target);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-239-patient-portal-message-subjects-legacy-ui",
        description: "Captures the legacy patient portal Compose Message subject input and datalist-backed OpenEMR preset rendering.",
        expected: {
          visibleFacts: ["Secure Messaging", "Compose Message", "General", "Referral"],
          inputId: "title",
          datalistId: "listid",
          defaultSubject: "General",
          editableCustomSubject: "Custom billing question",
          subjectOptions: expectedSubjectOptions.map(({ value, label }) => ({ value, label }))
        },
        actual: {
          composeOptions: summarizeComposeOptions(composeOptions),
          legacyUi
        },
        context: {
          suite: "workflow-patient-portal-message-subjects",
          workflow: "patient-portal-message-subjects-legacy-ui"
        }
      });
      return;
    }

    await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
    await expect(page.locator("body")).toContainText("Subject Presets");
    await expect(page.locator("body")).toContainText("6 options");

    const subjectInput = page.getByLabel("Secure message subject");
    await expect(subjectInput).toBeVisible();
    await expect(subjectInput).toHaveValue("General");
    await expect(subjectInput).toHaveAttribute("list", "secure-message-subject-options");

    const renderedOptions = await getDatalistOptions(page.locator("#secure-message-subject-options option"));
    expect(renderedOptions).toEqual(expectedSubjectOptions.map(({ value, label }) => ({ value, label })));

    await subjectInput.fill("Referral");
    await expect(subjectInput).toHaveValue("Referral");
    await subjectInput.fill("Custom billing question");
    await expect(subjectInput).toHaveValue("Custom billing question");
    const modernizedUi = await captureModernizedSubjectOptions(page);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-239-patient-portal-message-subjects-modernized-ui",
      description: "Captures the modernized Portal subject preset panel and editable secure-message subject input rendering.",
      expected: {
        visibleFacts: ["Subject Presets", "6 options", "General", "Referral"],
        inputList: "secure-message-subject-options",
        defaultSubject: "General",
        editableCustomSubject: "Custom billing question",
        subjectOptions: expectedSubjectOptions.map(({ value, label }) => ({ value, label }))
      },
      actual: {
        composeOptions: summarizeComposeOptions(composeOptions),
        modernizedUi
      },
      context: {
        suite: "workflow-patient-portal-message-subjects",
        workflow: "patient-portal-message-subjects-modernized-ui"
      }
    });
  });
});

async function expectLegacyPortalSubjectOptions(page: Page, target: RuntimeTarget) {
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

  const subjectInput = page.locator("#title");
  await expect(subjectInput).toBeVisible();
  await expect(subjectInput).toHaveAttribute("list", "listid");
  await expect(subjectInput).toHaveAttribute("value", "General");

  const renderedOptions = await getDatalistOptions(page.locator("#listid option"));
  expect(renderedOptions).toEqual(expectedSubjectOptions.map(({ value, label }) => ({ value, label })));

  await subjectInput.fill("Referral");
  await expect(subjectInput).toHaveValue("Referral");
  await subjectInput.fill("Custom billing question");
  await expect(subjectInput).toHaveValue("Custom billing question");
  return captureLegacySubjectOptions(page);
}

async function getDatalistOptions(locator: ReturnType<Page["locator"]>) {
  return locator.evaluateAll((options) =>
    options.map((option) => ({
      value: option.getAttribute("value") ?? "",
      label: option.getAttribute("label") ?? option.getAttribute("value") ?? ""
    }))
  );
}

async function captureLegacySubjectOptions(page: Page) {
  const subjectInput = page.locator("#title");
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    inputId: "title",
    currentValue: await subjectInput.inputValue(),
    listAttribute: await subjectInput.getAttribute("list"),
    optionCount: await page.locator("#listid option").count(),
    options: await getDatalistOptions(page.locator("#listid option")),
    bodyContainsSecureMessaging: await page.locator("body").evaluate((body) => body.textContent?.includes("Secure Messaging") ?? false)
  };
}

async function captureModernizedSubjectOptions(page: Page) {
  const subjectInput = page.getByLabel("Secure message subject");
  return {
    pageTitle: await page.title(),
    urlPath: new URL(page.url()).pathname,
    currentValue: await subjectInput.inputValue(),
    listAttribute: await subjectInput.getAttribute("list"),
    optionCount: await page.locator("#secure-message-subject-options option").count(),
    options: await getDatalistOptions(page.locator("#secure-message-subject-options option")),
    containsSubjectPresets: await page.locator("body").evaluate((body) => body.textContent?.includes("Subject Presets") ?? false),
    containsOptionCount: await page.locator("body").evaluate((body) => body.textContent?.includes("6 options") ?? false)
  };
}

function summarizeComposeOptions(composeOptions: PatientPortalMessageComposeOptionsResult) {
  return {
    authenticated: composeOptions.authenticated,
    username: composeOptions.username,
    portalUsername: composeOptions.portalUsername,
    canonicalId: composeOptions.canonicalId,
    pid: composeOptions.pid,
    pubpid: composeOptions.pubpid,
    displayName: composeOptions.displayName,
    datasetVersion: composeOptions.datasetVersion,
    asOfDate: composeOptions.asOfDate,
    defaultSubject: composeOptions.defaultSubject,
    subjectCount: composeOptions.subjectCount,
    subjectOptions: composeOptions.subjectOptions.map((subject) => ({
      value: subject.value,
      label: subject.label,
      default: subject.default
    })),
    recipientCount: composeOptions.recipientCount,
    recipients: composeOptions.recipients.map((recipient) => ({
      id: recipient.id,
      displayName: recipient.displayName,
      type: recipient.type,
      active: recipient.active,
      fallback: recipient.fallback
    })),
    failureReason: composeOptions.failureReason,
    sessionSource: composeOptions.sessionSource
  };
}
