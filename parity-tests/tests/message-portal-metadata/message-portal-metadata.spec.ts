import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientNotesDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedMessages } from "../../src/ui/modernizedOpenEmr.js";

const messagingAnchorPatientId = "MOD-PAT-0004";
const expectedPortalRelation = `portal:${messagingAnchorPatientId}`;

test.describe("patient message portal metadata parity @slice157 @message-portal-metadata @messages", () => {
  test("portal message metadata is preserved in the seeded message facts", async ({ target, targetDb }, testInfo) => {
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

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-157-message-portal-metadata-seeded",
      description:
        "Captures the Slice 157 seeded patient-message portal metadata contract for pnotes portal relation and plaintext encryption flags.",
      expected: {
        anchorCanonicalId: messagingAnchorPatientId,
        portalTitle: "Portal message",
        portalRelation: expectedPortalRelation,
        portalEncrypted: false,
        careTeamTitle: "Care team follow-up",
        careTeamPortalRelation: "",
        careTeamEncrypted: false
      },
      actual: {
        patient,
        portalMessage,
        careTeamMessage,
        messageCount: messages.messages.length
      },
      context: {
        suite: "message-portal-metadata",
        workflow: "message-portal-metadata-seeded"
      }
    });
  });

  test("portal message metadata is visible in the modernized message card", async ({ page, target, targetDb }, testInfo) => {
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
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-157-message-portal-metadata-rendered",
        description:
          "Captures legacy browser rendering facts for the seeded portal-backed pnotes message after validating the portal metadata projection.",
        expected: {
          rendersPortalTitle: portalMessage!.title,
          portalRelation: expectedPortalRelation,
          portalEncrypted: false
        },
        actual: {
          patient,
          portalMessage,
          surfaceFacts: {
            legacyPatientNotes: {
              renderedTitle: portalMessage!.title,
              patientPid: patient!.pid
            }
          }
        },
        context: {
          suite: "message-portal-metadata",
          workflow: "message-portal-metadata-rendered"
        }
      });
      return;
    }

    await openAuthenticatedModernizedMessages(page, target, patient!.pubpid);

    await expect(page.getByRole("heading", { name: `${patient!.lname}, ${patient!.fname}` })).toBeVisible();
    await expect(page.locator("body")).toContainText(portalMessage!.title);
    await expect(page.locator("body")).toContainText(`Portal relation ${expectedPortalRelation}`);
    await expect(page.locator("body")).toContainText("Plain text message");

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-157-message-portal-metadata-rendered",
      description:
        "Captures modernized browser/API rendering facts for the seeded portal-backed message card and plaintext metadata label.",
      expected: {
        rendersPortalTitle: portalMessage!.title,
        rendersPortalRelation: `Portal relation ${expectedPortalRelation}`,
        rendersPlaintextLabel: "Plain text message",
        portalEncrypted: false
      },
      actual: {
        patient,
        portalMessage,
        surfaceFacts: {
          modernizedMessages: {
            renderedHeading: `${patient!.lname}, ${patient!.fname}`,
            renderedTitle: portalMessage!.title,
            renderedPortalRelation: `Portal relation ${expectedPortalRelation}`,
            renderedPlaintextLabel: "Plain text message",
            patientPubpid: patient!.pubpid
          }
        }
      },
      context: {
        suite: "message-portal-metadata",
        workflow: "message-portal-metadata-rendered"
      }
    });
  });
});
