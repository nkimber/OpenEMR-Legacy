import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientNotesDirect } from "../../src/ui/legacyOpenEmr.js";
import {
  getModernizedAdminSessionHeaders,
  openAuthenticatedModernizedMessages
} from "../../src/ui/modernizedOpenEmr.js";

const messageProtectionPatientId = "MOD-PAT-0004";
const careTeamMessageTitle = "Care team follow-up";
const portalMessageTitle = "Portal message";

test.describe("patient message protection parity @slice170 @message-protection", () => {
  test("requires an active session before patient messages are visible", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(messageProtectionPatientId);
    expect(patient).not.toBeNull();

    const messages = await targetDb.getPatientMessagesForPatient(patient!.pid);
    const careTeamMessage = messages.messages.find((item) => item.title === careTeamMessageTitle);
    const portalMessage = messages.messages.find((item) => item.title === portalMessageTitle);

    expect(careTeamMessage).toBeTruthy();
    expect(portalMessage).toBeTruthy();

    if (target.type === "legacy-openemr") {
      await page.goto(`${target.publicUrl}/interface/patient_file/summary/pnotes_full.php?set_pid=${patient!.pid}`);
      await expect(page.locator("body")).not.toContainText(careTeamMessageTitle);
      await expect(page.locator("body")).not.toContainText(portalMessageTitle);

      await loginToLegacyOpenEmr(page, target);
      await openPatientNotesDirect(page, target, patient!.pid);
      await expectRenderedText(page, careTeamMessageTitle);
      await expectRenderedText(page, portalMessageTitle);
      await expectRenderedText(page, /Patient Notes|Messages|Notes/i);
      return;
    }

    const unauthenticatedMessages = await page.request.get(
      `${target.apiBaseUrl}/api/messages/${encodeURIComponent(patient!.pubpid)}`
    );
    expect(unauthenticatedMessages.status()).toBe(401);
    await expectUnauthenticatedResponse(unauthenticatedMessages);

    const unauthenticatedCreate = await page.request.post(`${target.apiBaseUrl}/api/messages`, {
      data: {
        patientId: patient!.pubpid,
        title: "Blocked Protection Patient Message",
        body: "This unauthenticated message create must be blocked.",
        assignedTo: "admin"
      }
    });
    expect(unauthenticatedCreate.status()).toBe(401);
    await expectUnauthenticatedResponse(unauthenticatedCreate);

    const headers = await getModernizedAdminSessionHeaders(page, target);
    const authenticatedMessages = await page.request.get(
      `${target.apiBaseUrl}/api/messages/${encodeURIComponent(patient!.pubpid)}`,
      { headers }
    );
    expect(authenticatedMessages.ok()).toBeTruthy();
    const authenticatedPayload = await authenticatedMessages.json() as {
      messages: Array<{ title: string; status: string }>;
    };
    expect(
      authenticatedPayload.messages.some(
        (message) => message.title === careTeamMessageTitle && message.status === careTeamMessage!.status
      )
    ).toBe(true);
    expect(authenticatedPayload.messages.some((message) => message.title === portalMessageTitle)).toBe(true);

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Messages" }).click();
    await expect(page.getByRole("heading", { name: "Messages", exact: true })).toBeVisible();
    await expect(page.locator('form[aria-label="Messages access"]')).toBeVisible();
    await expect(page.locator("body")).toContainText("Sign in to load patient messages");
    await expect(page.getByLabel("Messages patient ID")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save Message" })).toBeDisabled();
    await expect(page.locator("body")).not.toContainText(careTeamMessageTitle);

    await openAuthenticatedModernizedMessages(page, target, patient!.pubpid);
    await expect(page.locator(".message-list-body")).toContainText(careTeamMessageTitle);
    await expect(page.locator(".message-list-body")).toContainText(portalMessageTitle);
  });
});

async function expectUnauthenticatedResponse(response: { json: () => Promise<unknown> }) {
  const payload = await response.json() as { authenticated?: boolean; sessionSource?: string };
  expect(payload).toMatchObject({
    authenticated: false,
    sessionSource: "modernized-openemr"
  });
}
