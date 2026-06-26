import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { escapeSql } from "../../src/db/legacyMariaDbProbe.js";
import {
  getModernizedAdminSessionHeaders,
  openAuthenticatedModernizedPatient
} from "../../src/ui/modernizedOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";
import type { NewPatientRegistration } from "../../src/workflows/legacyWorkflowActions.js";
import type { LegacyMariaDbProbe } from "../../src/db/legacyMariaDbProbe.js";
import type { ModernizedPostgresProbe } from "../../src/db/modernizedPostgresProbe.js";

type PatientDuplicateCandidate = {
  canonicalId: string;
  legacyPid: number;
  pubpid: string;
  displayName: string;
  dateOfBirth: string;
  phoneHome?: string | null;
  email?: string | null;
  matchScore: number;
  matchReasons: string[];
};

type PatientDuplicateSearchResponse = {
  totalCandidates: number;
  candidates: PatientDuplicateCandidate[];
};

type PatientChartResponse = {
  canonicalId: string;
  pubpid: string;
  duplicateCandidates: PatientDuplicateCandidate[];
};

const duplicateAnchorPatientId = "MOD-PAT-0010";

test.describe("patient duplicate detection parity @slice191 @workflow-patient-duplicate-detection @patients", () => {
  test("detects temporary registration duplicates from demographics, phone, and email", async ({
    page,
    target,
    targetDb,
    workflow
  }, testInfo) => {
    const anchor = await targetDb.findPatientByCanonicalId(duplicateAnchorPatientId);
    expect(anchor).not.toBeNull();
    if (anchor === null) {
      throw new Error(`Duplicate detection anchor patient ${duplicateAnchorPatientId} was not found.`);
    }

    const anchorContact = await workflow.getPatientContact(anchor.pid);
    expect(anchorContact).not.toBeNull();
    if (anchorContact === null) {
      throw new Error(`Duplicate detection anchor patient ${duplicateAnchorPatientId} had no contact row.`);
    }

    const suffix = workflowSuffix();
    const registration: NewPatientRegistration = {
      pubpid: `TMP-PAT-REG-DUP-${suffix}`,
      firstName: anchor.fname,
      lastName: anchor.lname,
      preferredName: "Slice191",
      sex: anchor.sex,
      dateOfBirth: anchor.dob,
      street: "191 Duplicate Way",
      city: "New Haven",
      state: "CT",
      postalCode: "06511",
      maritalStatus: "single",
      occupation: "Duplicate Detection Fixture",
      phoneHome: anchorContact!.phoneHome,
      phoneCell: anchorContact!.phoneCell,
      email: anchorContact!.email,
      hipaaAllowSms: "YES",
      hipaaAllowEmail: "YES"
    };

    let createdPid: number | null = null;
    let databaseCandidates: Record<string, string>[] = [];
    let createdPatient: Awaited<ReturnType<typeof workflow.getPatientDemographics>> | null = null;
    let duplicates: PatientDuplicateSearchResponse | null = null;
    let chart: PatientChartResponse | null = null;

    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-191-patient-duplicate-detection-precondition",
      description: "Captures the Slice 191 duplicate-detection precondition: anchor patient, anchor contact values, and proposed temporary duplicate registration payload.",
      expected: {
        anchorCanonicalId: duplicateAnchorPatientId,
        duplicateInputs: {
          firstName: anchor.fname,
          lastName: anchor.lname,
          dateOfBirth: anchor.dob,
          phoneHome: anchorContact.phoneHome,
          email: anchorContact.email
        },
        expectedCandidate: {
          pubpid: duplicateAnchorPatientId,
          matchScore: 100,
          matchReasons: [
            "Same first name, last name, and date of birth",
            "Matching phone",
            "Matching email"
          ]
        }
      },
      actual: {
        anchor,
        anchorContact,
        registration
      },
      context: {
        canonicalId: duplicateAnchorPatientId,
        suite: "workflow-patient-duplicate-detection",
        workflow: "patient-duplicate-detection-precondition"
      }
    });

    try {
      createdPid = await workflow.createPatient(registration);
      expect(createdPid).toBeGreaterThan(0);
      createdPatient = await workflow.getPatientDemographics(createdPid);
      expect(createdPatient).not.toBeNull();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-191-patient-duplicate-detection-created-registration",
        description: "Captures the temporary Slice 191 duplicate registration immediately after creation and before duplicate-candidate checks.",
        expected: {
          createdPatient: {
            pubpid: registration.pubpid,
            firstName: registration.firstName,
            lastName: registration.lastName,
            dateOfBirth: registration.dateOfBirth
          }
        },
        actual: {
          anchor,
          anchorContact,
          registration,
          createdPid,
          createdPatient
        },
        context: {
          canonicalId: duplicateAnchorPatientId,
          suite: "workflow-patient-duplicate-detection",
          workflow: "patient-duplicate-detection-created-registration"
        }
      });

      databaseCandidates = await getDatabaseDuplicateCandidates(target, targetDb, registration, createdPid);
      expect(databaseCandidates).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            pubpid: duplicateAnchorPatientId,
            firstName: anchor.fname,
            lastName: anchor.lname,
            dateOfBirth: anchor.dob,
            phoneHome: anchorContact.phoneHome,
            email: anchorContact.email
          })
        ])
      );
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-191-patient-duplicate-detection-database-candidates",
        description: "Captures database-level duplicate-candidate rows for the temporary registration, proving the anchor matches on first name, last name, date of birth, home phone, and email.",
        expected: {
          candidate: {
            pubpid: duplicateAnchorPatientId,
            firstName: anchor.fname,
            lastName: anchor.lname,
            dateOfBirth: anchor.dob,
            phoneHome: anchorContact.phoneHome,
            email: anchorContact.email
          }
        },
        actual: {
          anchor,
          registration,
          createdPid,
          databaseCandidates
        },
        context: {
          canonicalId: duplicateAnchorPatientId,
          suite: "workflow-patient-duplicate-detection",
          workflow: "patient-duplicate-detection-database-candidates"
        }
      });

      if (target.type === "legacy-openemr") {
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-191-patient-duplicate-detection-legacy-surface",
          description: "Captures the Slice 191 legacy evidence surface: the database duplicate candidate is the parity source for legacy while the temporary registration exists.",
          expected: {
            legacyDuplicateSource: "patient_data",
            candidate: {
              pubpid: duplicateAnchorPatientId,
              firstName: anchor.fname,
              lastName: anchor.lname,
              dateOfBirth: anchor.dob
            }
          },
          actual: {
            anchor,
            anchorContact,
            registration,
            createdPid,
            createdPatient,
            databaseCandidates
          },
          context: {
            canonicalId: duplicateAnchorPatientId,
            suite: "workflow-patient-duplicate-detection",
            workflow: "patient-duplicate-detection-legacy-surface"
          }
        });
      } else {
        const headers = await getModernizedAdminSessionHeaders(page, target);
        const query = new URLSearchParams({
          firstName: registration.firstName,
          lastName: registration.lastName,
          dateOfBirth: registration.dateOfBirth,
          phone: registration.phoneHome,
          email: registration.email,
          excludePatientId: registration.pubpid,
          limit: "5"
        });
        const duplicatesResponse = await page.request.get(`${target.apiBaseUrl}/api/patients/duplicates?${query}`, {
          headers
        });
        expect(duplicatesResponse.ok()).toBeTruthy();
        duplicates = (await duplicatesResponse.json()) as PatientDuplicateSearchResponse;
        expect(duplicates.totalCandidates).toBeGreaterThanOrEqual(1);
        expect(duplicates.candidates).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              pubpid: duplicateAnchorPatientId,
              matchScore: 100,
              matchReasons: expect.arrayContaining([
                "Same first name, last name, and date of birth",
                "Matching phone",
                "Matching email"
              ])
            })
          ])
        );

        const chartResponse = await page.request.get(
          `${target.apiBaseUrl}/api/patients/${encodeURIComponent(registration.pubpid)}`,
          { headers }
        );
        expect(chartResponse.ok()).toBeTruthy();
        chart = (await chartResponse.json()) as PatientChartResponse;
        expect(chart).toMatchObject({
          canonicalId: registration.pubpid,
          pubpid: registration.pubpid
        });
        expect(chart.duplicateCandidates).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              pubpid: duplicateAnchorPatientId,
              matchScore: 100
            })
          ])
        );

        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-191-patient-duplicate-detection-modernized-api",
          description: "Captures the Slice 191 modernized duplicate-search and chart-detail API responses for the temporary registration.",
          expected: {
            duplicateSearch: {
              minimumCandidates: 1,
              candidate: {
                pubpid: duplicateAnchorPatientId,
                matchScore: 100,
                matchReasons: [
                  "Same first name, last name, and date of birth",
                  "Matching phone",
                  "Matching email"
                ]
              }
            },
            chart: {
              canonicalId: registration.pubpid,
              duplicateCandidatePubpid: duplicateAnchorPatientId
            }
          },
          actual: {
            anchor,
            registration,
            createdPid,
            databaseCandidates,
            duplicates,
            chart,
            sessionHeaderRedacted: true
          },
          context: {
            canonicalId: duplicateAnchorPatientId,
            suite: "workflow-patient-duplicate-detection",
            workflow: "patient-duplicate-detection-modernized-api"
          }
        });

        await openAuthenticatedModernizedPatient(page, target, registration.pubpid);
        await expect(page.getByRole("heading", { name: new RegExp(registration.lastName) })).toBeVisible();
        const duplicatePanel = page.getByLabel("Patient duplicate detection");
        await expect(duplicatePanel).toContainText(duplicateAnchorPatientId);
        await expect(duplicatePanel).toContainText("Score 100");
        await expect(duplicatePanel).toContainText("Same first name, last name, and date of birth");
        await expect(duplicatePanel).toContainText("Matching phone");
        await expect(duplicatePanel).toContainText("Matching email");
        await attachDatabaseProbeEvidence(testInfo, {
          target: target.type,
          probe: "slice-191-patient-duplicate-detection-modernized-surface",
          description: "Captures the Slice 191 modernized Patient/Client duplicate-detection panel rendering for the temporary registration.",
          expected: {
            ui: {
              region: "Patient duplicate detection",
              candidatePubpid: duplicateAnchorPatientId,
              score: "Score 100",
              reasons: [
                "Same first name, last name, and date of birth",
                "Matching phone",
                "Matching email"
              ]
            }
          },
          actual: {
            anchor,
            registration,
            createdPid,
            duplicates,
            chart,
            modernizedSurface: {
              selectedPatient: registration.pubpid,
              headingLastName: registration.lastName,
              duplicateRegion: "Patient duplicate detection",
              renderedCandidatePubpid: duplicateAnchorPatientId
            }
          },
          context: {
            canonicalId: duplicateAnchorPatientId,
            suite: "workflow-patient-duplicate-detection",
            workflow: "patient-duplicate-detection-modernized-surface"
          }
        });
      }
    } finally {
      if (createdPid !== null) {
        await workflow.deleteTemporaryPatient(createdPid);
      }
    }

    const deletedPatient = createdPid === null ? null : await workflow.getPatientDemographics(createdPid);
    if (createdPid !== null) {
      await expect.poll(async () => await workflow.getPatientDemographics(createdPid)).toBeNull();
    }
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-191-patient-duplicate-detection-cleanup",
      description: "Captures the final Slice 191 cleanup state after deleting the temporary duplicate registration.",
      expected: {
        deletedPatient: createdPid === null ? null : { pid: createdPid, row: null },
        temporaryPubpid: registration.pubpid
      },
      actual: {
        anchor,
        registration,
        createdPid,
        deletedPatient,
        databaseCandidates,
        modernizedDuplicateSearch: duplicates,
        modernizedChart: chart
      },
      context: {
        canonicalId: duplicateAnchorPatientId,
        suite: "workflow-patient-duplicate-detection",
        workflow: "patient-duplicate-detection-cleanup"
      }
    });
  });
});

async function getDatabaseDuplicateCandidates(
  target: RuntimeTarget,
  targetDb: LegacyMariaDbProbe | ModernizedPostgresProbe,
  registration: NewPatientRegistration,
  createdPid: number
) {
  if (target.type === "legacy-openemr") {
    return await targetDb.queryRows<Record<string, string>>(`
SELECT pubpid,
  fname AS firstName,
  lname AS lastName,
  DATE(DOB) AS dateOfBirth,
  COALESCE(phone_home, '') AS phoneHome,
  COALESCE(email, '') AS email
FROM patient_data
WHERE pid <> ${createdPid}
  AND LOWER(fname) = LOWER('${escapeSql(registration.firstName)}')
  AND LOWER(lname) = LOWER('${escapeSql(registration.lastName)}')
  AND DATE(DOB) = '${escapeSql(registration.dateOfBirth)}'
ORDER BY pubpid;
`);
  }

  return await targetDb.queryRows<Record<string, string>>(`
SELECT pubpid,
  first_name AS "firstName",
  last_name AS "lastName",
  date_of_birth AS "dateOfBirth",
  COALESCE(phone_home, '') AS "phoneHome",
  COALESCE(email, '') AS email
FROM patients
WHERE legacy_pid <> ${createdPid}
  AND LOWER(first_name) = LOWER('${escapeSql(registration.firstName)}')
  AND LOWER(last_name) = LOWER('${escapeSql(registration.lastName)}')
  AND date_of_birth = '${escapeSql(registration.dateOfBirth)}'
ORDER BY pubpid;
`);
}

function workflowSuffix() {
  const raw = process.env.PARITY_RUN_ID || `local-${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9]/gu, "");
  return cleaned.slice(-10) || "local";
}
