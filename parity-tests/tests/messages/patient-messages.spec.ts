import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientNotesDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedMessages } from "../../src/ui/modernizedOpenEmr.js";

const messagingAnchorPatientId = "MOD-PAT-0004";

test.describe("patient messages parity @slice5 @messages", () => {
  test("stable messaging anchor has portal access and seeded messages", async ({ targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(messagingAnchorPatientId);
    expect(patient).not.toBeNull();
    expect(patient!.allowPatientPortal).toBe("YES");

    const messages = await targetDb.getPatientMessagesForPatient(patient!.pid);
    expect(messages.patientId).toBe(patient!.pid);
    expect(messages.portalEnabled).toBe(true);
    expect(messages.messages.some((item) => item.title === "Care team follow-up" && item.status === "New")).toBe(true);
    expect(messages.messages.some((item) => item.title === "Portal message" && item.status === "Done")).toBe(true);
    expect(messages.messages.some((item) => item.body.includes("Nora Kim"))).toBe(true);
  });

  test("patient messages are visible in the application UI", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(messagingAnchorPatientId);
    expect(patient).not.toBeNull();
    const messages = await targetDb.getPatientMessagesForPatient(patient!.pid);
    expect(messages.messages.length).toBeGreaterThan(0);

    const careTeamMessage = messages.messages.find((item) => item.title === "Care team follow-up") ?? messages.messages[0];
    const portalMessage = messages.messages.find((item) => item.title === "Portal message") ?? messages.messages[0];

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientNotesDirect(page, target, patient!.pid);

      await expectRenderedText(page, careTeamMessage.title);
      await expectRenderedText(page, portalMessage.title);
      await expectRenderedText(page, /Portal|Patient Notes|Messages/i);
      return;
    }

    await openAuthenticatedModernizedMessages(page, target, patient!.pubpid);

    await expect(page.getByRole("heading", { name: patient!.lname + ", " + patient!.fname })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText("Portal enabled");
    await expect(page.locator("body")).toContainText(careTeamMessage.title);
    await expect(page.locator("body")).toContainText(careTeamMessage.body);
    await expect(page.locator("body")).toContainText(portalMessage.title);
    await expect(page.locator("body")).toContainText(portalMessage.status);
  });
});
