import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientNotesDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedMessages } from "../../src/ui/modernizedOpenEmr.js";

const messagingAnchorPatientId = "MOD-PAT-0004";
const expectedPortalRelation = `portal:${messagingAnchorPatientId}`;

test.describe("patient message portal metadata parity @slice157 @message-portal-metadata @messages", () => {
  test("portal message metadata is preserved in the seeded message facts", async ({ targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(messagingAnchorPatientId);
    expect(patient).not.toBeNull();

    const messages = await targetDb.getPatientMessagesForPatient(patient!.pid);
    const portalMessage = messages.messages.find((item) => item.title === "Portal message");
    const careTeamMessage = messages.messages.find((item) => item.title === "Care team follow-up");

    expect(portalMessage).toBeDefined();
    expect(portalMessage!.portalRelation).toBe(expectedPortalRelation);
    expect(portalMessage!.isEncrypted).toBe(false);
    expect(careTeamMessage).toBeDefined();
    expect(careTeamMessage!.portalRelation).toBe("");
    expect(careTeamMessage!.isEncrypted).toBe(false);
  });

  test("portal message metadata is visible in the modernized message card", async ({ page, target, targetDb }) => {
    const patient = await targetDb.findPatientByCanonicalId(messagingAnchorPatientId);
    expect(patient).not.toBeNull();

    const messages = await targetDb.getPatientMessagesForPatient(patient!.pid);
    const portalMessage = messages.messages.find((item) => item.title === "Portal message");
    expect(portalMessage).toBeDefined();
    expect(portalMessage!.portalRelation).toBe(expectedPortalRelation);

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientNotesDirect(page, target, patient!.pid);
      await expectRenderedText(page, portalMessage!.title);
      return;
    }

    await openAuthenticatedModernizedMessages(page, target, patient!.pubpid);

    await expect(page.getByRole("heading", { name: `${patient!.lname}, ${patient!.fname}` })).toBeVisible();
    await expect(page.locator("body")).toContainText(portalMessage!.title);
    await expect(page.locator("body")).toContainText(`Portal relation ${expectedPortalRelation}`);
    await expect(page.locator("body")).toContainText("Plain text message");
  });
});
