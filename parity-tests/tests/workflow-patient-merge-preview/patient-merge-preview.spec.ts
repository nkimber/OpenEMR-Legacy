import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { getModernizedAdminSessionHeaders, openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";
import type { NewPatientRegistration } from "../../src/workflows/legacyWorkflowActions.js";

type PatientMergePreviewResponse = {
  previewOnly: boolean;
  targetPatient: { pubpid: string; displayName: string };
  sourcePatient: { pubpid: string; displayName: string };
  targetCounts: PatientActivityCounts;
  sourceCounts: PatientActivityCounts;
  combinedCounts: PatientActivityCounts;
  matchScore: number;
  matchReasons: string[];
  safeguards: string[];
};

type PatientActivityCounts = {
  appointments: number;
  encounters: number;
  prescriptions: number;
  billingItems: number;
  labOrders: number;
  messages: number;
  problems: number;
  allergies: number;
  medications: number;
};

const mergeAnchorPatientId = "MOD-PAT-0010";

test.describe("patient merge preview parity @slice605 @workflow-patient-merge-preview @patients", () => {
  test("previews duplicate patient merge direction, counts, and safeguards", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const anchor = await targetDb.findPatientByCanonicalId(mergeAnchorPatientId);
    expect(anchor).not.toBeNull();
    if (anchor === null) {
      throw new Error(`Merge preview anchor patient ${mergeAnchorPatientId} was not found.`);
    }

    const anchorContact = await workflow.getPatientContact(anchor.pid);
    expect(anchorContact).not.toBeNull();
    if (anchorContact === null) {
      throw new Error(`Merge preview anchor patient ${mergeAnchorPatientId} had no contact row.`);
    }

    const suffix = workflowSuffix();
    const registration: NewPatientRegistration = {
      pubpid: `TMP-PAT-REG-MERGE-${suffix}`,
      firstName: anchor.fname,
      lastName: anchor.lname,
      preferredName: "Slice605",
      sex: anchor.sex,
      dateOfBirth: anchor.dob,
      street: "605 Merge Preview Way",
      city: "New Haven",
      state: "CT",
      postalCode: "06511",
      maritalStatus: "single",
      occupation: "Merge Preview Fixture",
      phoneHome: anchorContact.phoneHome,
      phoneCell: anchorContact.phoneCell,
      email: anchorContact.email,
      hipaaAllowSms: "YES",
      hipaaAllowEmail: "YES"
    };

    let createdPid: number | null = null;
    let preview: PatientMergePreviewResponse | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-605-patient-merge-preview-precondition",
      description: "Captures the Slice 605 patient-merge preview precondition: target chart, matching contact values, and proposed temporary duplicate source registration.",
      expected: {
        targetPubpid: mergeAnchorPatientId,
        duplicateMatchReasons: [
          "Same first name, last name, and date of birth",
          "Matching phone",
          "Matching email"
        ],
        previewOnly: true
      },
      actual: {
        anchor,
        anchorContact,
        registration
      },
      context: {
        canonicalId: mergeAnchorPatientId,
        suite: "workflow-patient-merge-preview",
        workflow: "patient-merge-preview-precondition"
      }
    });

    try {
      createdPid = await workflow.createPatient(registration);
      const targetCounts = normalizeActivityCounts(await targetDb.getPatientWorkflowCounts(anchor.pid));
      const sourceCounts = normalizeActivityCounts(await targetDb.getPatientWorkflowCounts(createdPid));
      const expectedCombinedCounts = combineCounts(targetCounts, sourceCounts);

      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-605-patient-merge-preview-database-counts",
        description: "Captures database-level merge-preview source, target, and combined count facts before any destructive patient merge exists.",
        expected: {
          targetPubpid: mergeAnchorPatientId,
          sourcePubpid: registration.pubpid,
          combinedCounts: expectedCombinedCounts
        },
        actual: {
          targetCounts,
          sourceCounts,
          expectedCombinedCounts,
          createdPid
        },
        context: {
          canonicalId: mergeAnchorPatientId,
          suite: "workflow-patient-merge-preview",
          workflow: "patient-merge-preview-database-counts"
        }
      });

      if (target.type === "legacy-openemr") {
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-605-patient-merge-preview-legacy-surface",
          description: "Captures the Slice 605 legacy merge-preview baseline as normalized database evidence because the installed legacy surface does not expose a non-destructive merge preview panel.",
          expected: {
            targetPubpid: mergeAnchorPatientId,
            sourcePubpid: registration.pubpid,
            previewOnly: true,
            combinedCounts: expectedCombinedCounts
          },
          actual: {
            anchor,
            registration,
            targetCounts,
            sourceCounts,
            expectedCombinedCounts
          },
          context: {
            canonicalId: mergeAnchorPatientId,
            suite: "workflow-patient-merge-preview",
            workflow: "patient-merge-preview-legacy-surface"
          }
        });
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const query = new URLSearchParams({
          targetPatientId: mergeAnchorPatientId,
          sourcePatientId: registration.pubpid
        });
        const previewResponse = await page.request.get(`${target.apiBaseUrl}/api/patients/merge-preview?${query}`, {
          headers
        });
        expect(previewResponse.ok()).toBeTruthy();
        preview = (await previewResponse.json()) as PatientMergePreviewResponse;
        expect(preview).toMatchObject({
          previewOnly: true,
          targetPatient: { pubpid: mergeAnchorPatientId },
          sourcePatient: { pubpid: registration.pubpid },
          combinedCounts: expectedCombinedCounts,
          matchScore: 100,
          matchReasons: expect.arrayContaining([
            "Same first name, last name, and date of birth",
            "Matching phone",
            "Matching email"
          ])
        });

        await openAuthenticatedModernizedPatient(page, target, mergeAnchorPatientId);
        const duplicatePanel = page.getByLabel("Patient duplicate detection");
        await expect(duplicatePanel).toContainText(registration.pubpid);
        await duplicatePanel
          .locator(".duplicate-candidate-card")
          .filter({ hasText: registration.pubpid })
          .getByRole("button", { name: "Preview merge" })
          .click();
        const mergePreview = page.getByLabel("Patient merge preview");
        await expect(mergePreview).toContainText("Preview only");
        await expect(mergePreview).toContainText(mergeAnchorPatientId);
        await expect(mergePreview).toContainText(registration.pubpid);
        await expect(mergePreview).toContainText("Match score 100");
        await expect(mergePreview).toContainText("Full destructive merge remains blocked");

        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-605-patient-merge-preview-modernized-api-ui",
          description: "Captures the modernized non-destructive merge-preview API payload and Patient/Client merge-preview panel rendering.",
          expected: {
            previewOnly: true,
            targetPubpid: mergeAnchorPatientId,
            sourcePubpid: registration.pubpid,
            combinedCounts: expectedCombinedCounts,
            uiRegion: "Patient merge preview"
          },
          actual: {
            preview,
            ui: {
              duplicatePanelRendered: true,
              mergePreviewRendered: true
            }
          },
          context: {
            canonicalId: mergeAnchorPatientId,
            suite: "workflow-patient-merge-preview",
            workflow: "patient-merge-preview-modernized-api-ui"
          }
        });
      }
    } finally {
      if (createdPid !== null) {
        await workflow.deleteTemporaryPatient(createdPid);
      }
    }

    if (createdPid !== null) {
      await expect.poll(async () => await workflow.getPatientDemographics(createdPid)).toBeNull();
    }
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-605-patient-merge-preview-cleanup",
      description: "Captures final cleanup after removing the temporary duplicate source chart used for merge-preview readiness.",
      expected: {
        temporaryPubpid: registration.pubpid,
        deletedPatient: createdPid === null ? null : { pid: createdPid, row: null }
      },
      actual: {
        createdPid,
        preview
      },
      context: {
        canonicalId: mergeAnchorPatientId,
        suite: "workflow-patient-merge-preview",
        workflow: "patient-merge-preview-cleanup"
      }
    });
  });
});

function normalizeActivityCounts(counts: Record<string, number>): PatientActivityCounts {
  return {
    appointments: counts.appointments ?? 0,
    encounters: counts.encounters ?? 0,
    prescriptions: counts.prescriptions ?? 0,
    billingItems: counts.billingLineItems ?? 0,
    labOrders: counts.procedureOrders ?? 0,
    messages: counts.messages ?? 0,
    problems: counts.problems ?? 0,
    allergies: counts.allergies ?? 0,
    medications: counts.medications ?? 0
  };
}

function combineCounts(target: PatientActivityCounts, source: PatientActivityCounts): PatientActivityCounts {
  return {
    appointments: target.appointments + source.appointments,
    encounters: target.encounters + source.encounters,
    prescriptions: target.prescriptions + source.prescriptions,
    billingItems: target.billingItems + source.billingItems,
    labOrders: target.labOrders + source.labOrders,
    messages: target.messages + source.messages,
    problems: target.problems + source.problems,
    allergies: target.allergies + source.allergies,
    medications: target.medications + source.medications
  };
}

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-10) || "local";
}
