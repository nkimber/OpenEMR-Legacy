import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientNotesDirect } from "../../src/ui/legacyOpenEmr.js";
import {
  getModernizedAdminSessionHeaders,
  openAuthenticatedModernizedMessages
} from "../../src/ui/modernizedOpenEmr.js";

const messageProtectionPatientId = "MOD-PAT-0004";
const careTeamMessageTitle = "Care team follow-up";
const portalMessageTitle = "Portal message";

test.describe("patient message protection parity @slice170 @message-protection", () => {
  test("requires an active session before patient messages are visible", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(messageProtectionPatientId);
    expect(patient).not.toBeNull();

    const messages = await targetDb.getPatientMessagesForPatient(patient!.pid);
    const careTeamMessage = messages.messages.find((item) => item.title === careTeamMessageTitle);
    const portalMessage = messages.messages.find((item) => item.title === portalMessageTitle);

    expect(careTeamMessage).toBeTruthy();
    expect(portalMessage).toBeTruthy();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-170-message-protection-precondition",
      description:
        "Captures the Slice 170 message protection precondition without storing password, cookie, or session material.",
      expected: {
        canonicalPatientId: messageProtectionPatientId,
        anchorMessageTitles: [careTeamMessageTitle, portalMessageTitle],
        legacyPatientNotesPath: "/interface/patient_file/summary/pnotes_full.php",
        modernizedMessageListPath: "/api/messages/{canonicalId}",
        modernizedMessageCreatePath: "/api/messages",
        requiresAuthenticatedSession: true,
        secretMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true,
        patient: {
          canonicalId: patient!.pubpid,
          legacyPid: patient!.pid,
          displayName: `${patient!.lname}, ${patient!.fname}`
        },
        messages: [
          summarizeMessage(careTeamMessage!),
          summarizeMessage(portalMessage!)
        ]
      },
      context: {
        suite: "workflow-message-protection",
        workflow: "message-protection-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await page.goto(`${target.publicUrl}/interface/patient_file/summary/pnotes_full.php?set_pid=${patient!.pid}`);
      await expect(page.locator("body")).not.toContainText(careTeamMessageTitle);
      await expect(page.locator("body")).not.toContainText(portalMessageTitle);
      const unauthenticatedMessageText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-170-message-protection-unauthenticated",
        description:
          "Captures legacy OpenEMR patient-notes protection markers before an admin session is established.",
        expected: {
          containsCareTeamMessage: false,
          containsPortalMessage: false
        },
        actual: summarizeRenderedText(unauthenticatedMessageText, [careTeamMessageTitle, portalMessageTitle]),
        context: {
          suite: "workflow-message-protection",
          workflow: "message-protection-unauthenticated"
        }
      });

      await loginToLegacyOpenEmr(page, target);
      await openPatientNotesDirect(page, target, patient!.pid);
      await expectRenderedText(page, careTeamMessageTitle);
      await expectRenderedText(page, portalMessageTitle);
      await expectRenderedText(page, /Patient Notes|Messages|Notes/i);
      const authenticatedMessageText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-170-message-protection-authenticated",
        description:
          "Captures legacy OpenEMR patient-notes visibility markers after an admin session is established.",
        expected: {
          containsCareTeamMessage: true,
          containsPortalMessage: true,
          containsMessageHeading: true,
          passwordMaterialRedacted: true
        },
        actual: {
          rendered: summarizeRenderedText(authenticatedMessageText, [
            careTeamMessageTitle,
            portalMessageTitle,
            "Patient Notes",
            "Messages",
            "Notes"
          ]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-message-protection",
          workflow: "message-protection-authenticated"
        }
      });
      return;
    }

    const unauthenticatedMessages = await page.request.get(
      `${target.apiBaseUrl}/api/messages/${encodeURIComponent(patient!.pubpid)}`
    );
    expect(unauthenticatedMessages.status()).toBe(401);
    const unauthenticatedMessagesBody = await expectUnauthenticatedResponse(unauthenticatedMessages);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-170-message-protection-unauthenticated-search",
      description:
        "Captures modernized patient-message list API protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        authenticated: false,
        sessionSource: "modernized-openemr"
      },
      actual: {
        statusCode: unauthenticatedMessages.status(),
        body: unauthenticatedMessagesBody
      },
      context: {
        suite: "workflow-message-protection",
        workflow: "message-protection-unauthenticated-search"
      }
    });

    const unauthenticatedCreate = await page.request.post(`${target.apiBaseUrl}/api/messages`, {
      data: {
        patientId: patient!.pubpid,
        title: "Blocked Protection Patient Message",
        body: "This unauthenticated message create must be blocked.",
        assignedTo: "admin"
      }
    });
    expect(unauthenticatedCreate.status()).toBe(401);
    const unauthenticatedCreateBody = await expectUnauthenticatedResponse(unauthenticatedCreate);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-170-message-protection-unauthenticated-create",
      description:
        "Captures modernized patient-message create protection facts before an admin session is established.",
      expected: {
        statusCode: 401,
        createRejected: true,
        title: "Blocked Protection Patient Message"
      },
      actual: {
        statusCode: unauthenticatedCreate.status(),
        body: unauthenticatedCreateBody
      },
      context: {
        suite: "workflow-message-protection",
        workflow: "message-protection-unauthenticated-create"
      }
    });

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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-170-message-protection-authenticated-search",
      description:
        "Captures modernized patient-message list API visibility facts after an admin session is established, with session headers redacted.",
      expected: {
        statusCode: 200,
        careTeamMessageTitle,
        careTeamMessageStatus: careTeamMessage!.status,
        portalMessageTitle,
        sessionIdentifierRedacted: true
      },
      actual: {
        authenticatedSearch: {
          statusCode: authenticatedMessages.status(),
          messageCount: authenticatedPayload.messages.length,
          includesCareTeamMessage: authenticatedPayload.messages.some(
            (message) => message.title === careTeamMessageTitle && message.status === careTeamMessage!.status
          ),
          includesPortalMessage: authenticatedPayload.messages.some((message) => message.title === portalMessageTitle),
          sampleMessages: authenticatedPayload.messages.slice(0, 5)
        },
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-message-protection",
        workflow: "message-protection-authenticated-search"
      }
    });

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
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-170-message-protection-rendered",
      description:
        "Captures modernized Messages-page protection rendering facts before and after login.",
      expected: {
        rendersSignedOutPrompt: "Sign in to load patient messages",
        hidesCareTeamMessageBeforeLogin: true,
        disablesPatientSearchBeforeLogin: true,
        disablesSaveBeforeLogin: true,
        rendersCareTeamMessage: careTeamMessageTitle,
        rendersPortalMessage: portalMessageTitle
      },
      actual: {
        surfaceFacts: {
          modernizedMessagesPage: {
            renderedSignedOutPrompt: "Sign in to load patient messages",
            didNotRenderCareTeamMessageBeforeLogin: true,
            disabledPatientSearchBeforeLogin: true,
            disabledSaveBeforeLogin: true,
            renderedCareTeamMessage: careTeamMessageTitle,
            renderedPortalMessage: portalMessageTitle,
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-message-protection",
        workflow: "message-protection-rendered"
      }
    });
  });
});

async function expectUnauthenticatedResponse(response: { json: () => Promise<unknown> }) {
  const payload = await response.json() as { authenticated?: boolean; sessionSource?: string };
  expect(payload).toMatchObject({
    authenticated: false,
    sessionSource: "modernized-openemr"
  });
  return payload;
}

function summarizeMessage(message: { id?: number; title: string; status: string; assignedTo?: string | null }) {
  return {
    id: message.id,
    title: message.title,
    status: message.status,
    assignedTo: message.assignedTo ?? null
  };
}

function summarizeRenderedText(text: string | null, markers: string[]) {
  const body = text ?? "";
  return {
    bodyLength: body.length,
    bodyPreview: body.slice(0, 240),
    markers: Object.fromEntries(markers.map((marker) => [marker, body.includes(marker)]))
  };
}
