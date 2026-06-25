import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import {
  expectRenderedText,
  loginToLegacyOpenEmr,
  openPatientDemographicsEditDirect,
  openPatientSummaryDirect
} from "../../src/ui/legacyOpenEmr.js";
import { openAuthenticatedModernizedPatient } from "../../src/ui/modernizedOpenEmr.js";
import type { NewPatientRegistration } from "../../src/workflows/legacyWorkflowActions.js";

test.describe("patient registration lifecycle parity @slice37 @workflow-registration @mutation", () => {
  test("creates, renders, and removes a temporary registered patient", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const suffix = `${Date.now()}`.slice(-9);
    const registration: NewPatientRegistration = {
      pubpid: `TMP-PAT-REG-${suffix}`,
      firstName: "Taylor",
      lastName: "Register",
      preferredName: "Slice37",
      sex: "Female",
      dateOfBirth: "1991-04-15",
      street: "37 Registration Way",
      city: "Hartford",
      state: "CT",
      postalCode: "06103",
      maritalStatus: "single",
      occupation: "Parity Registration Analyst",
      phoneHome: "(860) 555-3710",
      phoneCell: "(860) 555-3711",
      email: `tmp-register-${suffix}@example.test`,
      hipaaAllowSms: "YES",
      hipaaAllowEmail: "YES"
    };

    let createdPid: number | null = null;
    const beforeCounts = await targetDb.getGoldCounts();
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-37-patient-registration-precondition",
      description: "Captures the Slice 37 patient registration baseline patient count and proposed temporary registration payload before create.",
      expected: {
        publicIdPrefix: "TMP-PAT-REG-",
        demographics: {
          firstName: "Taylor",
          lastName: "Register",
          preferredName: "Slice37",
          sex: "Female",
          dateOfBirth: "1991-04-15",
          street: "37 Registration Way",
          city: "Hartford",
          state: "CT",
          postalCode: "06103",
          maritalStatus: "single",
          occupation: "Parity Registration Analyst"
        },
        contact: {
          phoneHome: "(860) 555-3710",
          phoneCell: "(860) 555-3711",
          hipaaAllowSms: "YES",
          hipaaAllowEmail: "YES"
        },
        countChange: {
          patientsAfterCreate: beforeCounts.patients + 1,
          patientsAfterCleanup: beforeCounts.patients
        }
      },
      actual: {
        beforeCounts,
        proposedRegistration: registration
      },
      context: {
        suite: "workflow-registration",
        workflow: "patient-registration-lifecycle"
      }
    });

    try {
      createdPid = await workflow.createPatient(registration);
      expect(createdPid).toBeGreaterThan(0);

      const demographics = await workflow.getPatientDemographics(createdPid);
      expect(demographics).toMatchObject({
        pid: createdPid,
        pubpid: registration.pubpid,
        firstName: registration.firstName,
        lastName: registration.lastName,
        preferredName: registration.preferredName,
        sex: registration.sex,
        dateOfBirth: registration.dateOfBirth,
        street: registration.street,
        city: registration.city,
        state: registration.state,
        postalCode: registration.postalCode,
        maritalStatus: registration.maritalStatus,
        occupation: registration.occupation
      });

      const contact = await workflow.getPatientContact(createdPid);
      expect(contact).toEqual({
        pid: createdPid,
        pubpid: registration.pubpid,
        phoneHome: registration.phoneHome,
        phoneCell: registration.phoneCell,
        email: registration.email,
        hipaaAllowSms: registration.hipaaAllowSms,
        hipaaAllowEmail: registration.hipaaAllowEmail
      });

      const afterCreateCounts = await targetDb.getGoldCounts();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-37-patient-registration-created",
        description: "Captures the temporary Slice 37 registered patient demographics/contact rows and patient-count increment after create.",
        expected: {
          demographics,
          contact,
          counts: {
            patients: beforeCounts.patients + 1
          }
        },
        actual: {
          beforeCounts,
          afterCreateCounts,
          createdPid,
          registration,
          demographics,
          contact
        },
        context: {
          publicId: registration.pubpid,
          suite: "workflow-registration",
          workflow: "patient-registration-lifecycle-created"
        }
      });
      expect(afterCreateCounts.patients).toBe(beforeCounts.patients + 1);

      if (target.type === "legacy-openemr") {
        await loginToLegacyOpenEmr(page, target);
        await openPatientSummaryDirect(page, target, createdPid);
        await expectRenderedText(page, registration.firstName);
        await expectRenderedText(page, registration.lastName);
        await expectRenderedText(page, `${createdPid}`);
        await openPatientDemographicsEditDirect(page, target, createdPid);
        await expectRenderedText(page, registration.preferredName);
        await expectRenderedText(page, registration.street);
        await expectRenderedText(page, registration.city);
        await expectRenderedText(page, registration.postalCode);
        await expectRenderedText(page, registration.email);
      } else {
        await openAuthenticatedModernizedPatient(page, target, registration.pubpid);

        await expect(page.getByRole("heading", { name: /Register, Taylor/ })).toBeVisible();
        await expect(page.locator("body")).toContainText(registration.pubpid);
        await expect(page.locator("body")).toContainText(registration.dateOfBirth);
        await expect(page.locator("body")).toContainText(registration.street);
        await expect(page.locator("body")).toContainText(registration.city);
        await expect(page.locator("body")).toContainText(registration.email);
      }
    } finally {
      if (createdPid !== null) {
        await workflow.deleteTemporaryPatient(createdPid);
      }
    }

    if (createdPid !== null) {
      await expect.poll(async () => await workflow.getPatientDemographics(createdPid)).toBeNull();
      const afterCleanup = await workflow.getPatientDemographics(createdPid);
      const afterCleanupCounts = await targetDb.getGoldCounts();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-37-patient-registration-cleanup",
        description: "Captures the final Slice 37 hard-delete cleanup state for the temporary registered patient.",
        expected: {
          counts: {
            patients: beforeCounts.patients
          },
          deletedPatient: null
        },
        actual: {
          beforeCounts,
          afterCleanupCounts,
          createdPid,
          publicId: registration.pubpid,
          afterCleanup
        },
        context: {
          publicId: registration.pubpid,
          suite: "workflow-registration",
          workflow: "patient-registration-lifecycle-cleanup"
        }
      });
      expect(afterCleanupCounts.patients).toBe(beforeCounts.patients);
      expect(afterCleanup).toBeNull();
    }
  });
});
