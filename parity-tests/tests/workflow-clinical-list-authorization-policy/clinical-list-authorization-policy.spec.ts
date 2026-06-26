import { test, expect } from "../../src/fixtures/parityTest.js";
import { attachDatabaseProbeEvidence } from "../../src/core/probeEvidence.js";
import { requestText } from "../../src/http/httpClient.js";
import { expectRenderedText, loginToLegacyOpenEmr, openPatientSummaryDirect } from "../../src/ui/legacyOpenEmr.js";
import type { RuntimeTarget } from "../../src/config/targets.js";

type ModernizedLoginResponse = {
  authenticated: boolean;
  username: string;
  displayName: string;
  role: string;
  staffId?: number | null;
  sessionId?: string | null;
};

type ModernizedAuthorizationFailure = {
  authenticated: boolean;
  authorized: boolean;
  sessionId?: string | null;
  username: string;
  role: string;
  requiredSection: string;
  requiredPermission: string;
  requiredReturnValue: string;
  failureReason?: string | null;
  sessionSource: string;
};

type AccessControlSnapshot = {
  groupPermissions: Array<{
    groupValue: string;
    sectionValue: string;
    permissionValue: string;
    returnValue: string;
  }>;
  userMemberships: Array<{
    userValue: string;
    groupValue: string;
    groupName: string;
  }>;
};

type ClinicalListsSummary = {
  patientId: string;
  legacyPid: number;
  patientDisplayName: string;
  problems: Array<{ title: string }>;
  allergies: Array<{ title: string }>;
  medications: Array<{ title: string }>;
  prescriptions: Array<{ drug: string }>;
};

test.describe("clinical list authorization policy parity @workflow-clinical-list-authorization-policy @slice175 @clinical-lists @security", () => {
  test("enforces Medical/History access for clinical list APIs and UI", async ({ page, target, targetDb }, testInfo) => {
    const patient = await targetDb.findPatientByCanonicalId("MOD-PAT-0001");
    expect(patient).not.toBeNull();

    const lists = await targetDb.getClinicalListsForPatient(patient!.pid);
    const problem = lists.problems.find((item) => item.title.includes("diabetes")) ?? lists.problems[0];
    const allergy = lists.allergies.find((item) => item.title === "Penicillin") ?? lists.allergies[0];
    const medication = lists.medications.find((item) => item.title.startsWith("Metformin")) ?? lists.medications[0];
    const prescription = lists.prescriptions.find((item) => item.drug === "Metformin") ?? lists.prescriptions[0];

    expect(problem).toBeTruthy();
    expect(allergy).toBeTruthy();
    expect(medication).toBeTruthy();
    expect(prescription).toBeTruthy();

    const accessControl = await targetDb.getAdministrationAccessControl();
    expect(accessControl.groupPermissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "admin",
          sectionValue: "patients",
          permissionValue: "med",
          returnValue: "write"
        }),
        expect.objectContaining({
          groupValue: "front",
          sectionValue: "patients",
          permissionValue: "demo",
          returnValue: "write"
        })
      ])
    );
    expect(accessControl.groupPermissions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          groupValue: "front",
          sectionValue: "patients",
          permissionValue: "med"
        })
      ])
    );
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-175-clinical-list-authorization-policy-precondition",
      description:
        "Captures the Slice 175 clinical-list authorization-policy precondition without storing password, cookie, or session material.",
      expected: {
        patientId: "MOD-PAT-0001",
        requiredSection: "patients",
        requiredPermission: "med",
        requiredReturnValue: "view",
        adminWriteSatisfiesView: true,
        adminGroupHasMedicalHistoryWrite: true,
        frontOfficeGroupHasDemographicsWrite: true,
        frontOfficeGroupDoesNotHaveMedicalHistoryAccess: true,
        modernizedClinicalListPath: "/api/clinical-lists/MOD-PAT-0001",
        modernizedAllergyMutationPath: "/api/clinical-lists/allergies",
        secretMaterialRedacted: true
      },
      actual: {
        targetType: target.type,
        publicUrl: target.publicUrl,
        apiBaseUrl: target.apiBaseUrl,
        configuredUsername: target.credentials.username,
        passwordRedacted: true,
        patient: {
          pubpid: patient!.pubpid,
          pid: patient!.pid
        },
        anchorLists: summarizeClinicalAnchors(problem, allergy, medication, prescription),
        accessControl: summarizeAccessControl(accessControl)
      },
      context: {
        suite: "workflow-clinical-list-authorization-policy",
        workflow: "clinical-list-authorization-policy-precondition"
      }
    });

    if (target.type === "legacy-openemr") {
      await loginToLegacyOpenEmr(page, target);
      await openPatientSummaryDirect(page, target, patient!.pid);
      await expectRenderedText(page, problem.title);
      await expectRenderedText(page, allergy.title);
      await expectRenderedText(page, medication.title);
      await expectRenderedText(page, prescription.drug);
      const patientSummaryText = await page.locator("body").textContent();
      await attachDatabaseProbeEvidence(testInfo, {
        target: target.type,
        probe: "slice-175-clinical-list-authorization-policy-legacy-rendered",
        description:
          "Captures legacy OpenEMR patient-summary clinical-list rendering markers after admin login, with credentials redacted.",
        expected: {
          patientId: patient!.pubpid,
          containsProblem: problem.title,
          containsAllergy: allergy.title,
          containsMedication: medication.title,
          containsPrescription: prescription.drug,
          passwordMaterialRedacted: true
        },
        actual: {
          patientSummary: summarizeRenderedText(patientSummaryText, [
            problem.title,
            allergy.title,
            medication.title,
            prescription.drug
          ]),
          passwordRedacted: true
        },
        context: {
          suite: "workflow-clinical-list-authorization-policy",
          workflow: "clinical-list-authorization-policy-legacy-rendered"
        }
      });
      return;
    }

    const frontDeskLogin = await modernizedLogin(target, "gold-frontdesk-01", "pass");
    expect(frontDeskLogin).toMatchObject({
      authenticated: true,
      username: "gold-frontdesk-01",
      displayName: "Parker Fleming",
      role: "frontdesk",
      staffId: 117
    });
    expect(frontDeskLogin.sessionId).toMatch(/^[0-9a-f-]{36}$/i);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-175-clinical-list-authorization-policy-frontdesk-login",
      description:
        "Captures modernized front-desk session setup for clinical-list policy checks with the session identifier redacted.",
      expected: {
        authenticated: true,
        username: "gold-frontdesk-01",
        role: "frontdesk",
        staffId: 117,
        sessionIdentifierRedacted: true
      },
      actual: summarizeLogin(frontDeskLogin),
      context: {
        suite: "workflow-clinical-list-authorization-policy",
        workflow: "clinical-list-authorization-policy-frontdesk-login"
      }
    });

    const frontDeskLists = await requestText(
      `${target.apiBaseUrl}/api/clinical-lists/${encodeURIComponent(patient!.pubpid)}`,
      {
        headers: {
          "X-OpenEMR-Session": frontDeskLogin.sessionId!
        }
      }
    );
    expect(frontDeskLists.statusCode).toBe(403);
    const frontDeskFailure = JSON.parse(frontDeskLists.body) as ModernizedAuthorizationFailure;
    expect(frontDeskFailure).toMatchObject({
      authenticated: true,
      authorized: false,
      username: "gold-frontdesk-01",
      role: "frontdesk",
      requiredSection: "patients",
      requiredPermission: "med",
      requiredReturnValue: "view",
      sessionSource: "modernized-openemr"
    });
    expect(frontDeskFailure.failureReason).toMatch(/not authorized/i);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-175-clinical-list-authorization-policy-frontdesk-lists-forbidden",
      description:
        "Captures modernized front-desk clinical-list retrieval rejection facts with session material redacted.",
      expected: {
        statusCode: 403,
        authenticated: true,
        authorized: false,
        username: "gold-frontdesk-01",
        role: "frontdesk",
        requiredSection: "patients",
        requiredPermission: "med",
        requiredReturnValue: "view",
        failureReasonContains: "not authorized",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskLists.statusCode,
        body: summarizeAuthorizationFailure(frontDeskFailure)
      },
      context: {
        suite: "workflow-clinical-list-authorization-policy",
        workflow: "clinical-list-authorization-policy-frontdesk-lists-forbidden"
      }
    });

    const frontDeskMutationBody = JSON.stringify({
      patientId: patient!.pubpid,
      title: "Blocked Medical History Allergy",
      dateTime: "2026-06-18 09:00:00",
      comments: "This request should be rejected before mutation.",
      reaction: "Rash",
      severity: "mild",
      listOptionId: "parity-allergy"
    });
    const frontDeskMutation = await requestText(`${target.apiBaseUrl}/api/clinical-lists/allergies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(frontDeskMutationBody)),
        "X-OpenEMR-Session": frontDeskLogin.sessionId!
      },
      body: frontDeskMutationBody
    });
    expect(frontDeskMutation.statusCode).toBe(403);
    const frontDeskMutationFailure = JSON.parse(frontDeskMutation.body) as ModernizedAuthorizationFailure;
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-175-clinical-list-authorization-policy-frontdesk-mutation-forbidden",
      description:
        "Captures modernized front-desk allergy mutation rejection facts with request and session material redacted.",
      expected: {
        statusCode: 403,
        allergyMutationRejected: true,
        requiredSection: "patients",
        requiredPermission: "med",
        requiredReturnValue: "view",
        submittedTitle: "Blocked Medical History Allergy",
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: frontDeskMutation.statusCode,
        body: summarizeAuthorizationFailure(frontDeskMutationFailure),
        request: {
          patientId: patient!.pubpid,
          title: "Blocked Medical History Allergy",
          reaction: "Rash",
          severity: "mild",
          passwordRedacted: true,
          sessionHeaderRedacted: true
        }
      },
      context: {
        suite: "workflow-clinical-list-authorization-policy",
        workflow: "clinical-list-authorization-policy-frontdesk-mutation-forbidden"
      }
    });

    const adminLogin = await modernizedLogin(target, target.credentials.username, target.credentials.password);
    expect(adminLogin).toMatchObject({
      authenticated: true,
      username: "admin",
      role: "administrator"
    });
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-175-clinical-list-authorization-policy-admin-login",
      description:
        "Captures modernized admin session setup for clinical-list policy checks with password and session identifier redacted.",
      expected: {
        authenticated: true,
        username: "admin",
        role: "administrator",
        sessionIdentifierRedacted: true,
        passwordMaterialRedacted: true
      },
      actual: summarizeLogin(adminLogin),
      context: {
        suite: "workflow-clinical-list-authorization-policy",
        workflow: "clinical-list-authorization-policy-admin-login"
      }
    });

    const adminLists = await requestText(`${target.apiBaseUrl}/api/clinical-lists/${encodeURIComponent(patient!.pubpid)}`, {
      headers: {
        "X-OpenEMR-Session": adminLogin.sessionId!
      }
    });
    expect(adminLists.statusCode).toBe(200);
    const adminListsBody = JSON.parse(adminLists.body) as ClinicalListsSummary;
    expect(adminListsBody).toMatchObject({
      patientId: patient!.pubpid,
      legacyPid: patient!.pid,
      patientDisplayName: "Stone, Avery"
    });
    expect(adminListsBody.problems).toEqual(expect.arrayContaining([expect.objectContaining({ title: problem.title })]));
    expect(adminListsBody.allergies).toEqual(expect.arrayContaining([expect.objectContaining({ title: allergy.title })]));
    expect(adminListsBody.medications).toEqual(expect.arrayContaining([expect.objectContaining({ title: medication.title })]));
    expect(adminListsBody.prescriptions).toEqual(expect.arrayContaining([expect.objectContaining({ drug: prescription.drug })]));
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-175-clinical-list-authorization-policy-admin-lists",
      description:
        "Captures modernized admin clinical-list allow facts with session material redacted.",
      expected: {
        statusCode: 200,
        patientId: patient!.pubpid,
        legacyPid: patient!.pid,
        patientDisplayName: "Stone, Avery",
        problemTitle: problem.title,
        allergyTitle: allergy.title,
        medicationTitle: medication.title,
        prescriptionDrug: prescription.drug,
        sessionIdentifierRedacted: true
      },
      actual: {
        statusCode: adminLists.statusCode,
        lists: summarizeClinicalLists(adminListsBody),
        sessionHeaderRedacted: true
      },
      context: {
        suite: "workflow-clinical-list-authorization-policy",
        workflow: "clinical-list-authorization-policy-admin-lists"
      }
    });

    await page.goto(target.publicUrl);
    await page.getByRole("button", { name: "Lists" }).click();
    await expect(page.getByRole("heading", { name: "Lists", exact: true })).toBeVisible();

    const accessPanel = page.locator('form[aria-label="Lists access"]');
    await accessPanel.getByLabel("Username").fill("gold-frontdesk-01");
    await accessPanel.getByLabel("Password").fill("pass");
    await accessPanel.getByRole("button", { name: "Verify Lists Access" }).click();

    await expect(page.locator("body")).toContainText("Signed in as Parker Fleming");
    await expect(page.locator("body")).toContainText("Clinical lists load requires Medical/History access");
    await expect(page.locator("body")).not.toContainText("Stone, Avery");
    await expect(page.locator("body")).not.toContainText(allergy.title);

    await accessPanel.getByLabel("Username").fill(target.credentials.username);
    await accessPanel.getByLabel("Password").fill(target.credentials.password);
    await accessPanel.getByRole("button", { name: "Verify Lists Access" }).click();
    await page.getByLabel("Clinical lists patient ID").fill(patient!.pubpid);

    await expect(page.getByRole("heading", { name: "Stone, Avery" })).toBeVisible();
    await expect(page.locator("body")).toContainText(patient!.pubpid);
    await expect(page.locator("body")).toContainText(problem.title);
    await expect(page.locator("body")).toContainText(allergy.title);
    await expect(page.locator("body")).toContainText(medication.title);
    await expect(page.locator("body")).toContainText(prescription.drug);
    await attachDatabaseProbeEvidence(testInfo, {
      target: target.type,
      probe: "slice-175-clinical-list-authorization-policy-rendered",
      description:
        "Captures modernized Lists-page ACL retry rendering facts for front-desk denial followed by admin allow.",
      expected: {
        frontDeskSignedIn: "Signed in as Parker Fleming",
        frontDeskDeniedMessage: "Clinical lists load requires Medical/History access",
        hidesPatientForFrontDesk: true,
        rendersPatientForAdmin: true,
        rendersProblemForAdmin: problem.title,
        rendersAllergyForAdmin: allergy.title,
        rendersMedicationForAdmin: medication.title,
        rendersPrescriptionForAdmin: prescription.drug
      },
      actual: {
        surfaceFacts: {
          modernizedListsPage: {
            renderedFrontDeskSignedIn: "Signed in as Parker Fleming",
            renderedFrontDeskDeniedMessage: "Clinical lists load requires Medical/History access",
            didNotRenderPatientForFrontDesk: true,
            renderedPatientForAdmin: true,
            renderedProblemForAdmin: true,
            renderedAllergyForAdmin: true,
            renderedMedicationForAdmin: true,
            renderedPrescriptionForAdmin: true,
            passwordRedacted: true,
            sessionIdRedacted: true
          }
        }
      },
      context: {
        suite: "workflow-clinical-list-authorization-policy",
        workflow: "clinical-list-authorization-policy-rendered"
      }
    });
  });
});

async function modernizedLogin(target: RuntimeTarget, username: string, password: string): Promise<ModernizedLoginResponse> {
  const body = JSON.stringify({ username, password });
  const response = await requestText(`${target.apiBaseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(body))
    },
    body
  });

  expect(response.statusCode).toBe(200);
  return JSON.parse(response.body) as ModernizedLoginResponse;
}

function summarizeAccessControl(accessControl: AccessControlSnapshot) {
  return {
    groupPermissionCount: accessControl.groupPermissions.length,
    userMembershipCount: accessControl.userMemberships.length,
    adminMedicalHistoryWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "admin" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "med" &&
        permission.returnValue === "write"
    ),
    frontOfficeDemographicsWrite: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "front" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "demo" &&
        permission.returnValue === "write"
    ),
    frontOfficeMedicalHistoryAccess: accessControl.groupPermissions.some(
      (permission) =>
        permission.groupValue === "front" &&
        permission.sectionValue === "patients" &&
        permission.permissionValue === "med"
    ),
    sampleGroupPermissions: accessControl.groupPermissions.slice(0, 8),
    sampleUserMemberships: accessControl.userMemberships.slice(0, 8)
  };
}

function summarizeClinicalAnchors(
  problem: { title: string },
  allergy: { title: string },
  medication: { title: string },
  prescription: { drug: string }
) {
  return {
    problemTitle: problem.title,
    allergyTitle: allergy.title,
    medicationTitle: medication.title,
    prescriptionDrug: prescription.drug
  };
}

function summarizeLogin(login: ModernizedLoginResponse) {
  return {
    authenticated: login.authenticated,
    username: login.username,
    displayName: login.displayName,
    role: login.role,
    staffId: login.staffId ?? null,
    hasSessionId: Boolean(login.sessionId),
    sessionIdRedacted: true
  };
}

function summarizeAuthorizationFailure(failure: ModernizedAuthorizationFailure) {
  return {
    authenticated: failure.authenticated,
    authorized: failure.authorized,
    username: failure.username,
    role: failure.role,
    requiredSection: failure.requiredSection,
    requiredPermission: failure.requiredPermission,
    requiredReturnValue: failure.requiredReturnValue,
    failureReason: failure.failureReason,
    sessionSource: failure.sessionSource,
    hasSessionId: Boolean(failure.sessionId),
    sessionIdRedacted: true
  };
}

function summarizeClinicalLists(lists: ClinicalListsSummary) {
  return {
    patientId: lists.patientId,
    legacyPid: lists.legacyPid,
    patientDisplayName: lists.patientDisplayName,
    counts: {
      problems: lists.problems.length,
      allergies: lists.allergies.length,
      medications: lists.medications.length,
      prescriptions: lists.prescriptions.length
    },
    problemTitles: lists.problems.map((item) => item.title).slice(0, 8),
    allergyTitles: lists.allergies.map((item) => item.title).slice(0, 8),
    medicationTitles: lists.medications.map((item) => item.title).slice(0, 8),
    prescriptionDrugs: lists.prescriptions.map((item) => item.drug).slice(0, 8)
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
