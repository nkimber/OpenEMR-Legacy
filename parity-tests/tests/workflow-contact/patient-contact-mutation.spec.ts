import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const contactAnchorPatientId = "MOD-PAT-0001";

test.describe("patient contact mutation parity @slice10 @workflow-contact @mutation", () => {
  test("updates, renders, and restores patient contact data", async ({ page, target, targetDb, workflow }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(contactAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientContact(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient contact record.");
    }

    const suffix = workflowSuffix();
    const updated = {
      ...original,
      phoneHome: "(619) 555-9101",
      phoneCell: "(619) 555-9102",
      email: `parity-contact-${suffix}@example.test`,
      hipaaAllowSms: "YES",
      hipaaAllowEmail: "YES"
    };

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-10-patient-contact-mutation-precondition",
      description: "Captures the Slice 10 contact mutation anchor patient, original contact database state, and proposed update before the mutation runs.",
      expected: {
        patient: {
          pubpid: contactAnchorPatientId
        },
        update: {
          phoneHome: "(619) 555-9101",
          phoneCell: "(619) 555-9102",
          hipaaAllowSms: "YES",
          hipaaAllowEmail: "YES",
          emailPrefix: "parity-contact-"
        }
      },
      actual: {
        patient,
        original,
        proposed: updated
      },
      context: {
        canonicalId: contactAnchorPatientId,
        suite: "workflow-contact",
        workflow: "patient-contact-mutation"
      }
    });

    try {
      await workflow.updatePatientContact(updated);

      const actual = await workflow.getPatientContact(patient!.pid);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-10-patient-contact-mutation-post-update",
        description: "Captures the patient contact database row after the Slice 10 contact mutation and before browser-visible rendering assertions.",
        expected: {
          updated
        },
        actual: {
          patient,
          original,
          updated,
          actual
        },
        context: {
          canonicalId: contactAnchorPatientId,
          suite: "workflow-contact",
          workflow: "patient-contact-mutation-post-update"
        }
      });

      expect(actual).toEqual(updated);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);

        await expect(page.locator("body")).toContainText(updated.email);
        await expect(page.locator("body")).toContainText(updated.phoneHome);
        await expect(page.locator("body")).toContainText(updated.phoneCell);
      } else {
        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);

        await expect(page.getByRole("heading", { name: "Stone, Avery" })).toBeVisible();
        await expect(page.locator("body")).toContainText(updated.email);
        await expect(page.locator("body")).toContainText(updated.phoneHome);
        await expect(page.locator("body")).toContainText(updated.phoneCell);
        await expect(page.locator("body")).toContainText("SMS permission");
        await expect(page.locator("body")).toContainText("Email permission");
      }
    } finally {
      await workflow.updatePatientContact(original);
    }

    const restored = await workflow.getPatientContact(patient!.pid);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-10-patient-contact-mutation-restored",
      description: "Captures the restored patient contact database row after the Slice 10 contact mutation cleanup runs.",
      expected: {
        original
      },
      actual: {
        patient,
        updated,
        restored
      },
      context: {
        canonicalId: contactAnchorPatientId,
        suite: "workflow-contact",
        workflow: "patient-contact-mutation-restored"
      }
    });

    expect(restored).toEqual(original);
  });
});

function workflowSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}
