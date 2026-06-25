import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientNotesDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedMessages } from "../../src/ui/modernizedOpenEmr.js";

const messagingAnchorPatientId = "MOD-PAT-0004";

test.describe("patient messages parity @slice5 @messages", () => {
  test("stable messaging anchor has portal access and seeded messages", async ({ target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(messagingAnchorPatientId);
    const messages = patient ? await targetDb.getPatientMessagesForPatient(patient.pid) : null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-5-messaging-anchor",
      description: "Verifies the Slice 5 messaging anchor patient portal access and seeded patient-message database facts.",
      expected: {
        patient: {
          pubpid: messagingAnchorPatientId,
          allowPatientPortal: "YES"
        },
        messages: {
          patientId: patient?.pid ?? 100004,
          portalEnabled: true,
          careTeamFollowUp: {
            title: "Care team follow-up",
            status: "New"
          },
          portalMessage: {
            title: "Portal message",
            status: "Done"
          },
          body: "contains Nora Kim"
        }
      },
      actual: {
        patient,
        messages
      },
      context: {
        canonicalId: messagingAnchorPatientId,
        suite: "messages",
        workflow: "patient-messages"
      }
    });

    expect(patient).not.toBeNull();
    expect(patient!.allowPatientPortal).toBe("YES");
    expect(messages).not.toBeNull();
    expect(messages!.patientId).toBe(patient!.pid);
    expect(messages!.portalEnabled).toBe(true);
    expect(messages!.messages.some((item) => item.title === "Care team follow-up" && item.status === "New")).toBe(true);
    expect(messages!.messages.some((item) => item.title === "Portal message" && item.status === "Done")).toBe(true);
    expect(messages!.messages.some((item) => item.body.includes("Nora Kim"))).toBe(true);
  });

  test("patient messages are visible in the application UI", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(messagingAnchorPatientId);
    const messages = patient ? await targetDb.getPatientMessagesForPatient(patient.pid) : null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-5-messaging-ui-precondition",
      description: "Captures the patient portal access and seeded messages used before steering the Slice 5 messaging UI parity flow.",
      expected: {
        patient: {
          pubpid: messagingAnchorPatientId,
          allowPatientPortal: "YES"
        },
        messages: {
          count: "> 0",
          careTeamFollowUp: "visible care-team message",
          portalMessage: "visible portal message"
        }
      },
      actual: {
        patient,
        messages
      },
      context: {
        canonicalId: messagingAnchorPatientId,
        suite: "messages",
        workflow: "patient-messages-ui"
      }
    });

    expect(patient).not.toBeNull();
    expect(messages).not.toBeNull();
    expect(messages!.messages.length).toBeGreaterThan(0);

    const careTeamMessage = messages!.messages.find((item) => item.title === "Care team follow-up") ?? messages!.messages[0];
    const portalMessage = messages!.messages.find((item) => item.title === "Portal message") ?? messages!.messages[0];

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
