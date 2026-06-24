import { test, expect } from "../../src/fixtures/parityTest.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";
const forwardAssignedTo = "admin";

test.describe("patient portal secure-message forward-to-practice parity @slice234 @workflow-patient-portal-message-forward @patients @portal", () => {
  test("creates a practice-side patient message from a portal inbox secure message", async ({ targetDb, workflow }) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    const forwardTitle = "Slice 234 forward secure message API";
    const inboundBody = "Slice 234 inbound secure message for practice forwarding.";
    const forwardBody = "Slice 234 forward to practice for medication review with original context noted.";

    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, forwardTitle);
    await workflow.cleanupPatientPortalForwardedMessage(patient!.pid, forwardTitle, forwardBody);

    try {
      const created = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        title: forwardTitle,
        body: inboundBody,
        senderId: forwardAssignedTo,
        senderName: "Administrator"
      });
      const beforeForward = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const result = await workflow.forwardPatientPortalMessage(portalLoginUsername, portalPassword, created.id, {
        body: forwardBody,
        assignedTo: forwardAssignedTo
      });
      const afterForward = await workflow.getPatientPortalMessages(portalLoginUsername, portalPassword);
      const forwardedPatientMessage = result.forwardedPatientMessage?.id
        ? await workflow.getPatientMessage(result.forwardedPatientMessage.id)
        : null;
      const forwardedPortalMessage = afterForward.messages.find((message) => message.id === created.id);

      expect(result).toMatchObject({
        authenticated: true,
        forwarded: true,
        portalUsername: portalLoginUsername,
        pid: patient!.pid,
        originalMessageId: created.id,
        messageCount: beforeForward.messageCount,
        sentMessageCount: beforeForward.sentMessageCount,
        failureReason: null
      });
      expect(result.originalMessage).toMatchObject({
        id: created.id,
        title: forwardTitle,
        body: inboundBody,
        status: "Sent",
        assignedTo: forwardAssignedTo,
        senderId: forwardAssignedTo,
        recipientId: portalLoginUsername
      });
      expect(result.forwardedPatientMessage).toMatchObject({
        patientId: patient!.pid,
        title: forwardTitle,
        body: forwardBody,
        status: "New",
        assignedTo: forwardAssignedTo,
        portalRelation: "portal:forwarded",
        isEncrypted: false,
        deleted: 0
      });
      expect(forwardedPatientMessage).toMatchObject({
        patientId: patient!.pid,
        title: forwardTitle,
        body: forwardBody,
        status: "New",
        assignedTo: forwardAssignedTo,
        portalRelation: "portal:forwarded",
        isEncrypted: false,
        deleted: 0
      });
      expect(forwardedPortalMessage).toMatchObject({
        id: created.id,
        title: forwardTitle,
        status: "Sent",
        assignedTo: forwardAssignedTo
      });
    } finally {
      await workflow.cleanupPatientPortalForwardedMessage(patient!.pid, forwardTitle, forwardBody);
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, forwardTitle);
    }
  });

  test("shows and runs the forward-to-practice control on the patient portal surface", async ({ page, target, targetDb, workflow }) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();

    const forwardTitle = "Slice 234 forward secure message UI";
    const inboundBody = "Slice 234 inbound secure message for the portal forward UI.";
    const forwardBody = "Slice 234 UI forward body for the practice message queue.";

    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, forwardTitle);
    await workflow.cleanupPatientPortalForwardedMessage(patient!.pid, forwardTitle, forwardBody);

    try {
      const created = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
        title: forwardTitle,
        body: inboundBody,
        senderId: forwardAssignedTo,
        senderName: "Administrator"
      });

      if (target.type === "legacy-openemr") {
        const result = await workflow.forwardPatientPortalMessage(portalLoginUsername, portalPassword, created.id, {
          body: forwardBody,
          assignedTo: forwardAssignedTo
        });
        expect(result.forwarded).toBe(true);
        await expectLegacyForwardedMessage(page, target, forwardTitle);
      } else {
        await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
        const card = page.locator("article.message-item").filter({ hasText: forwardTitle }).first();
        await expect(card).toContainText(inboundBody);
        await expect(card).toContainText("Forward to practice");
        const forwardForm = card.getByRole("form", { name: `Forward ${forwardTitle} to practice` });
        await forwardForm.getByLabel(`Forward ${forwardTitle} to practice`).fill(forwardBody);
        await forwardForm.getByRole("button", { name: "Forward to practice" }).click();
        await expect(page.locator("body")).toContainText("Forwarded secure message to admin");
        await expect(page.locator("article.message-item").filter({ hasText: forwardTitle }).first()).toContainText("Sent");
      }
    } finally {
      await workflow.cleanupPatientPortalForwardedMessage(patient!.pid, forwardTitle, forwardBody);
      await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, forwardTitle);
    }
  });
});

async function expectLegacyForwardedMessage(page: Page, target: RuntimeTarget, title: string) {
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
  await expectRenderedText(page, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
