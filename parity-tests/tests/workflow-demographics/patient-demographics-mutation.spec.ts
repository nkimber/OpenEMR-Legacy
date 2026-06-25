import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDemographicsEditDirect,
  openPatientSummaryDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";

const demographicsAnchorPatientId = "MOD-PAT-0010";

test.describe("patient demographics mutation parity @slice36 @workflow-demographics @mutation", () => {
  test("updates, renders, and restores patient demographic data", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId(demographicsAnchorPatientId);
    expect(patient).not.toBeNull();

    const original = await workflow.getPatientDemographics(patient!.pid);
    if (!original) {
      throw new Error("Missing original patient demographics record.");
    }

    const updated = {
      ...original,
      firstName: "Morgan",
      lastName: "Parity",
      preferredName: "Slice36",
      sex: original.sex === "Female" ? "Male" : "Female",
      dateOfBirth: "1984-03-12",
      street: "36 Parity Way",
      city: "Bridgeport",
      state: "CT",
      postalCode: "06460",
      maritalStatus: "married",
      occupation: "Workflow Analyst"
    };

    try {
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-36-patient-demographics-precondition",
        description: "Captures the Slice 36 patient demographics mutation anchor patient, original row state, and proposed update payload before mutation.",
        expected: {
          patient: {
            pubpid: demographicsAnchorPatientId,
            pid: patient!.pid
          },
          updatedFields: {
            firstName: "Morgan",
            lastName: "Parity",
            preferredName: "Slice36",
            dateOfBirth: "1984-03-12",
            street: "36 Parity Way",
            city: "Bridgeport",
            state: "CT",
            postalCode: "06460",
            maritalStatus: "married",
            occupation: "Workflow Analyst"
          }
        },
        actual: {
          patient,
          originalDemographics: original,
          proposedDemographics: updated
        },
        context: {
          canonicalId: demographicsAnchorPatientId,
          suite: "workflow-demographics",
          workflow: "patient-demographics-mutation"
        }
      });

      await workflow.updatePatientDemographics(updated);

      const actual = await workflow.getPatientDemographics(patient!.pid);
      expect(actual).toEqual(updated);
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-36-patient-demographics-updated",
        description: "Captures the Slice 36 patient demographics row after identity, DOB, address, marital-status, and occupation mutation.",
        expected: {
          demographics: updated
        },
        actual: {
          patient,
          originalDemographics: original,
          updatedDemographics: actual
        },
        context: {
          canonicalId: demographicsAnchorPatientId,
          suite: "workflow-demographics",
          workflow: "patient-demographics-mutation-updated"
        }
      });

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, patient!.pid);

        await expectRenderedText(page, updated.firstName);
        await expectRenderedText(page, updated.lastName);
        await openPatientDemographicsEditDirect(page, target, patient!.pid);
        await expectRenderedText(page, updated.preferredName);
        await expectRenderedText(page, updated.street);
        await expectRenderedText(page, updated.city);
        await expectRenderedText(page, updated.postalCode);
      } else {
        await openAuthenticatedModernizedPatient(page, target, patient!.pubpid);

        await expect(page.getByRole("heading", { name: /Parity, Morgan/ })).toBeVisible();
        await expect(page.locator("body")).toContainText(updated.dateOfBirth);
        await expect(page.locator("body")).toContainText(updated.street);
        await expect(page.locator("body")).toContainText(updated.city);
        await expect(page.locator("body")).toContainText(updated.occupation);
        await expect(page.locator("body")).toContainText("Marital status");
      }
    } finally {
      await workflow.updatePatientDemographics(original);
    }

    const restored = await workflow.getPatientDemographics(patient!.pid);
    expect(restored).toEqual(original);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-36-patient-demographics-restored",
      description: "Captures the final Slice 36 cleanup state proving the original patient demographics row was restored.",
      expected: {
        demographics: original
      },
      actual: {
        patient,
        restoredDemographics: restored
      },
      context: {
        canonicalId: demographicsAnchorPatientId,
        suite: "workflow-demographics",
        workflow: "patient-demographics-mutation-restored"
      }
    });
  });
});
