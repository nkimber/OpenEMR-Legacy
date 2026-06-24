import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
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
  test("normalizes the patient portal secure-message compose subject presets", async ({ targetDb, workflow }) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalSubjectAnchorPatientId);
    expect(patient).not.toBeNull();

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
  });

  test("renders editable secure-message subject presets in the portal compose form", async ({ page, target }) => {
    test.setTimeout(240_000);

    if (target.type === "legacy-openemr") {
      await expectLegacyPortalSubjectOptions(page, target);
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
}

async function getDatalistOptions(locator: ReturnType<Page["locator"]>) {
  return locator.evaluateAll((options) =>
    options.map((option) => ({
      value: option.getAttribute("value") ?? "",
      label: option.getAttribute("label") ?? option.getAttribute("value") ?? ""
    }))
  );
}
