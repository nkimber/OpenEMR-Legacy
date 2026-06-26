import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatientPortal } from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { Page } from "@playwright/test";

const portalMessageAnchorPatientId = "MOD-PAT-0004";
const portalLoginUsername = "mod-pat-0004@example.test";
const portalPassword = "PortalPass207!";

const auditTitles = {
  compose: "Slice 232 secure message audit compose",
  lifecycle: "Slice 232 secure message audit lifecycle",
  batchA: "Slice 232 secure message audit batch A",
  batchB: "Slice 232 secure message audit batch B"
};

type NormalizedMessageAuditEvent = {
  eventType: string;
  eventLabel: string;
  messageTitle: string;
  messageStatus: string;
  relatedMessageIds: string[];
  archivedMessageCount: number;
  summary: string;
};

test.describe("patient portal secure-message audit parity @slice232 @workflow-patient-portal-message-audit @patients @portal", () => {
  test("normalizes secure-message lifecycle audit events", async ({ targetDb, target, workflow }, testInfo) => {
    test.setTimeout(240_000);

    const patient = await targetDb.findPatientByCanonicalId(portalMessageAnchorPatientId);
    expect(patient).not.toBeNull();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.id,
      probe: "slice-232-patient-portal-message-audit-precondition",
      description: "Captures the Slice 232 secure-message lifecycle audit precondition: the signed-in anchor patient exists before temporary audit messages are created.",
      expected: {
        canonicalId: portalMessageAnchorPatientId,
        portalUsername: portalLoginUsername,
        auditTitles,
        expectedAuditEventTypes: [
          "message_composed",
          "message_replied",
          "message_read",
          "message_archived",
          "messages_archived"
        ]
      },
      actual: {
        canonicalId: portalMessageAnchorPatientId,
        pid: patient!.pid,
        pubpid: patient!.pubpid,
        displayName: "Kim, Nora",
        portalUsername: portalLoginUsername
      },
      context: {
        suite: "workflow-patient-portal-message-audit",
        workflow: "patient-portal-secure-message-audit-precondition"
      }
    });

    await cleanupAuditMessages(workflow);

    try {
      const lifecycle = await performAuditLifecycle(workflow);
      const auditEvents = buildNormalizedMessageAuditEvents(lifecycle);

      expect(auditEvents.map((event) => event.eventType)).toEqual([
        "message_composed",
        "message_replied",
        "message_read",
        "message_archived",
        "messages_archived"
      ]);
      expect(auditEvents[0]).toMatchObject({
        eventLabel: "Message composed",
        messageTitle: auditTitles.compose,
        archivedMessageCount: 0
      });
      expect(auditEvents[0].relatedMessageIds).toHaveLength(2);
      expect(auditEvents[1]).toMatchObject({
        eventLabel: "Message replied",
        messageTitle: auditTitles.lifecycle
      });
      expect(auditEvents[2]).toMatchObject({
        eventLabel: "Message marked read",
        messageTitle: auditTitles.lifecycle,
        messageStatus: "Read"
      });
      expect(auditEvents[3]).toMatchObject({
        eventLabel: "Message archived",
        messageTitle: auditTitles.lifecycle,
        archivedMessageCount: 1
      });
      expect(auditEvents[4]).toMatchObject({
        eventLabel: "Messages archived",
        archivedMessageCount: 2
      });
      expect(auditEvents[4].summary).toContain("Archived 2 selected secure-message mailbox rows");
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-232-patient-portal-message-audit-result",
        description: "Captures the Slice 232 normalized secure-message lifecycle audit projection after compose, reply, read, single-archive, and selected-archive actions.",
        expected: {
          auditEventTypes: [
            "message_composed",
            "message_replied",
            "message_read",
            "message_archived",
            "messages_archived"
          ],
          composedRelatedMessageCount: 2,
          replyRelatedMessageCount: 3,
          batchArchivedMessageCount: 2,
          messageTitles: auditTitles
        },
        actual: {
          auditEvents,
          lifecycle: summarizeAuditLifecycle(lifecycle)
        },
        context: {
          suite: "workflow-patient-portal-message-audit",
          workflow: "patient-portal-secure-message-audit-result"
        }
      });
    } finally {
      await cleanupAuditMessages(workflow);
    }
  });

  test("captures secure-message audit through API and portal UI", async ({ page, target, workflow }, testInfo) => {
    test.setTimeout(240_000);

    await cleanupAuditMessages(workflow);

    try {
      const lifecycle = await performAuditLifecycle(workflow);

      if (target.type === "legacy-openemr") {
        const auditEvents = buildNormalizedMessageAuditEvents(lifecycle);
        expect(auditEvents.map((event) => event.eventType)).toContain("message_composed");
        const legacyUi = await openLegacyPatientPortalMessages(page, target);
        await expectRenderedText(page, /Secure Messaging/i);
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.id,
          probe: "slice-232-patient-portal-message-audit-legacy-ui",
          description: "Captures the legacy secure-message lifecycle source evidence: normalized audit events produced by workflow actions plus the legacy Secure Messaging portal surface.",
          expected: {
            auditEventTypes: [
              "message_composed",
              "message_replied",
              "message_read",
              "message_archived",
              "messages_archived"
            ],
            visibleFacts: ["Secure Messaging"],
            messageTitles: auditTitles
          },
          actual: {
            auditEvents,
            lifecycle: summarizeAuditLifecycle(lifecycle),
            legacyUi
          },
          context: {
            suite: "workflow-patient-portal-message-audit",
            workflow: "patient-portal-secure-message-audit-legacy-ui"
          }
        });
        return;
      }

      const audit = await getModernizedPortalMessageAudit(page, target);
      expect(audit.authenticated).toBeTruthy();
      expect(audit.auditEventCount).toBe(audit.auditEvents.length);

      const relevantEvents = audit.auditEvents.filter((event) =>
        Object.values(auditTitles).includes(event.messageTitle)
      );
      expect(relevantEvents.map((event) => event.eventType)).toEqual([
        "message_composed",
        "message_replied",
        "message_read",
        "message_archived",
        "messages_archived"
      ]);

      const composedEvent = relevantEvents.find((event) => event.eventType === "message_composed");
      expect(composedEvent).toMatchObject({
        eventLabel: "Message composed",
        messageTitle: auditTitles.compose,
        archivedMessageCount: 0,
        eventSource: "modernized-openemr-portal"
      });
      expect(composedEvent!.relatedMessageIds).toHaveLength(2);
      expect(composedEvent!.summary).toContain("Composed secure message");

      const batchEvent = relevantEvents.find((event) => event.eventType === "messages_archived");
      expect(batchEvent).toMatchObject({
        eventLabel: "Messages archived",
        archivedMessageCount: 2,
        eventSource: "modernized-openemr-portal"
      });

      await openAuthenticatedModernizedPatientPortal(page, target, portalLoginUsername, portalPassword);
      const auditPanel = page.locator("section.info-panel").filter({ hasText: "Message Audit" }).first();
      await expect(auditPanel).toContainText("Audit Events");
      await expect(auditPanel).toContainText("Message composed");
      await expect(auditPanel).toContainText("Message replied");
      await expect(auditPanel).toContainText("Message marked read");
      await expect(auditPanel).toContainText("Message archived");
      await expect(auditPanel).toContainText("Messages archived");
      const auditPanelText = await auditPanel.innerText();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.id,
        probe: "slice-232-patient-portal-message-audit-modernized-ui",
        description: "Captures the modernized secure-message lifecycle audit API and Portal surface for compose, reply, read, single-archive, and selected-archive events.",
        expected: {
          auditEndpoint: "/api/patient-portal/messages/audit",
          auditEventTypes: [
            "message_composed",
            "message_replied",
            "message_read",
            "message_archived",
            "messages_archived"
          ],
          eventSource: "modernized-openemr-portal",
          visibleFacts: [
            "Message Audit",
            "Audit Events",
            "Message composed",
            "Message replied",
            "Message marked read",
            "Message archived",
            "Messages archived"
          ]
        },
        actual: {
          auditEndpoint: `${target.apiBaseUrl}/api/patient-portal/messages/audit`,
          auditEventCount: audit.auditEventCount,
          relevantEvents,
          auditPanelText,
          portalUrl: page.url(),
          containsFacts: {
            messageAudit: auditPanelText.includes("Message Audit"),
            auditEvents: auditPanelText.includes("Audit Events"),
            messageComposed: auditPanelText.includes("Message composed"),
            messageReplied: auditPanelText.includes("Message replied"),
            messageMarkedRead: auditPanelText.includes("Message marked read"),
            messageArchived: auditPanelText.includes("Message archived"),
            messagesArchived: auditPanelText.includes("Messages archived")
          }
        },
        context: {
          suite: "workflow-patient-portal-message-audit",
          workflow: "patient-portal-secure-message-audit-modernized-ui"
        }
      });
    } finally {
      await cleanupAuditMessages(workflow);
    }
  });
});

async function performAuditLifecycle(workflow: any) {
  const composed = await workflow.composePatientPortalMessage(portalLoginUsername, portalPassword, {
    recipientId: "admin",
    title: auditTitles.compose,
    body: "Slice 232 temporary secure-message compose audit evidence."
  });

  const lifecycleMessage = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
    senderId: "admin",
    title: auditTitles.lifecycle,
    body: "Slice 232 temporary secure-message lifecycle audit evidence."
  });
  const reply = await workflow.replyToPatientPortalMessage(portalLoginUsername, portalPassword, lifecycleMessage.id, {
    body: "Slice 232 temporary secure-message reply audit evidence."
  });
  const read = await workflow.readPatientPortalMessage(portalLoginUsername, portalPassword, lifecycleMessage.id);
  const deleted = await workflow.deletePatientPortalMessage(portalLoginUsername, portalPassword, lifecycleMessage.id);

  const firstBatch = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
    senderId: "admin",
    title: auditTitles.batchA,
    body: "Slice 232 temporary secure-message batch audit evidence A."
  });
  const secondBatch = await workflow.createPatientPortalInboxMessage(portalLoginUsername, portalPassword, {
    senderId: "admin",
    title: auditTitles.batchB,
    body: "Slice 232 temporary secure-message batch audit evidence B."
  });
  const archived = await workflow.archivePatientPortalMessages(portalLoginUsername, portalPassword, [
    firstBatch.id,
    secondBatch.id
  ]);

  expect(composed.created).toBeTruthy();
  expect(reply.created).toBeTruthy();
  expect(read.markedRead).toBeTruthy();
  expect(deleted.deleted).toBeTruthy();
  expect(archived.archived).toBeTruthy();

  return {
    composed,
    lifecycleMessage,
    reply,
    read,
    deleted,
    archived
  };
}

function buildNormalizedMessageAuditEvents(lifecycle: any): NormalizedMessageAuditEvent[] {
  return [
    {
      eventType: "message_composed",
      eventLabel: "Message composed",
      messageTitle: lifecycle.composed.sentMessage.title,
      messageStatus: lifecycle.composed.sentMessage.status,
      relatedMessageIds: [lifecycle.composed.sentMessage.id, lifecycle.composed.recipientMessage.id],
      archivedMessageCount: 0,
      summary: `Composed secure message "${lifecycle.composed.sentMessage.title}".`
    },
    {
      eventType: "message_replied",
      eventLabel: "Message replied",
      messageTitle: lifecycle.reply.originalMessage.title,
      messageStatus: lifecycle.reply.sentMessage.status,
      relatedMessageIds: [
        lifecycle.reply.originalMessage.id,
        lifecycle.reply.sentMessage.id,
        lifecycle.reply.recipientMessage.id
      ],
      archivedMessageCount: 0,
      summary: `Replied to secure message "${lifecycle.reply.originalMessage.title}".`
    },
    {
      eventType: "message_read",
      eventLabel: "Message marked read",
      messageTitle: lifecycle.read.message.title,
      messageStatus: lifecycle.read.message.status,
      relatedMessageIds: [lifecycle.read.message.id],
      archivedMessageCount: 0,
      summary: `Marked secure message "${lifecycle.read.message.title}" read.`
    },
    {
      eventType: "message_archived",
      eventLabel: "Message archived",
      messageTitle: lifecycle.deleted.deletedMessage.title,
      messageStatus: lifecycle.deleted.deletedMessage.status,
      relatedMessageIds: [lifecycle.deleted.deletedMessage.id],
      archivedMessageCount: lifecycle.deleted.deletedMessageCount,
      summary: `Archived secure message "${lifecycle.deleted.deletedMessage.title}".`
    },
    {
      eventType: "messages_archived",
      eventLabel: "Messages archived",
      messageTitle: lifecycle.archived.archivedMessages[0].title,
      messageStatus: lifecycle.archived.archivedMessages[0].status,
      relatedMessageIds: lifecycle.archived.archivedMessages.map((message: any) => message.id),
      archivedMessageCount: lifecycle.archived.archivedMessageCount,
      summary: `Archived ${lifecycle.archived.archivedMessageCount} selected secure-message mailbox rows.`
    }
  ];
}

function summarizeAuditLifecycle(lifecycle: any) {
  return {
    composed: {
      created: lifecycle.composed.created,
      sentMessage: lifecycle.composed.sentMessage,
      recipientMessage: lifecycle.composed.recipientMessage
    },
    reply: {
      created: lifecycle.reply.created,
      originalMessage: lifecycle.reply.originalMessage,
      sentMessage: lifecycle.reply.sentMessage,
      recipientMessage: lifecycle.reply.recipientMessage
    },
    read: {
      markedRead: lifecycle.read.markedRead,
      message: lifecycle.read.message
    },
    deleted: {
      deleted: lifecycle.deleted.deleted,
      deletedMessage: lifecycle.deleted.deletedMessage,
      deletedMessageCount: lifecycle.deleted.deletedMessageCount
    },
    archived: {
      archived: lifecycle.archived.archived,
      archivedMessageCount: lifecycle.archived.archivedMessageCount,
      archivedMessages: lifecycle.archived.archivedMessages
    }
  };
}

async function getModernizedPortalMessageAudit(page: Page, target: RuntimeTarget) {
  const loginResponse = await page.request.post(`${target.apiBaseUrl}/api/patient-portal/login`, {
    data: {
      username: portalLoginUsername,
      password: portalPassword
    }
  });
  expect(loginResponse.ok()).toBeTruthy();
  const login = await loginResponse.json() as { authenticated: boolean; sessionId?: string | null };
  expect(login.authenticated).toBeTruthy();
  expect(login.sessionId).toBeTruthy();

  const headers = {
    "X-OpenEMR-Patient-Portal-Session": login.sessionId!
  };
  const auditResponse = await page.request.get(`${target.apiBaseUrl}/api/patient-portal/messages/audit`, {
    headers
  });
  expect(auditResponse.ok()).toBeTruthy();
  const audit = await auditResponse.json() as {
    authenticated: boolean;
    auditEventCount: number;
    auditEvents: Array<{
      eventType: string;
      eventLabel: string;
      eventAt: string;
      messageTitle: string;
      messageStatus: string;
      relatedMessageIds: string[];
      archivedMessageCount: number;
      summary: string;
      eventSource: string;
    }>;
  };

  await page.request.delete(`${target.apiBaseUrl}/api/patient-portal/session`, { headers });
  return audit;
}

async function cleanupAuditMessages(workflow: any) {
  for (const title of Object.values(auditTitles)) {
    await workflow.cleanupPatientPortalComposedMessage(portalLoginUsername, title);
  }
}

async function openLegacyPatientPortalMessages(page: Page, target: RuntimeTarget) {
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
  const bodyText = await page.locator("body").innerText();
  return {
    portalUrl: page.url(),
    bodyTextLength: bodyText.length,
    containsFacts: {
      secureMessaging: /Secure Messaging/i.test(bodyText)
    }
  };
}
